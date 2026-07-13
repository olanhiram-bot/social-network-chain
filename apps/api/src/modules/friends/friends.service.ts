import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FriendRequestStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SigningService } from '../wallets/signing.service';

type AccessPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private signing: SigningService,
    private realtime: RealtimeService,
  ) {}

  async suggestions(accessToken: string) {
    const userId = this.userId(accessToken);
    const blockedIds = await this.relatedUserIds(userId);

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          notIn: [userId, ...blockedIds],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return users.map((user) => this.publicUser(user));
  }

  async friends(accessToken: string) {
    const userId = this.userId(accessToken);
    const friendships = await this.prisma.friendship.findMany({
      where: { userId },
      include: { friend: true },
      orderBy: { createdAt: 'desc' },
    });

    return friendships.map(({ friend }) => this.publicUser(friend));
  }

  async requests(accessToken: string) {
    const userId = this.userId(accessToken);
    const requests = await this.prisma.friendRequest.findMany({
      where: { addresseeId: userId, status: FriendRequestStatus.PENDING },
      include: { requester: true },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((request) => ({
      id: request.id,
      requester: this.publicUser(request.requester),
      createdAt: request.createdAt,
    }));
  }

  async profile(accessToken: string, profileId: string) {
    const viewerId = this.userId(accessToken);
    const user = await this.prisma.user.findUnique({ where: { id: profileId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.assertNotBlocked(viewerId, profileId);

    const [friendship, pendingRequest, posts, lives] = await Promise.all([
      this.prisma.friendship.findUnique({
        where: { userId_friendId: { userId: viewerId, friendId: profileId } },
      }),
      this.prisma.friendRequest.findFirst({
        where: {
          status: FriendRequestStatus.PENDING,
          OR: [
            { requesterId: viewerId, addresseeId: profileId },
            { requesterId: profileId, addresseeId: viewerId },
          ],
        },
      }),
      this.prisma.$queryRaw<
        {
          id: string;
          content: string;
          mediaUrl: string | null;
          mediaType: string | null;
          audience: string;
          createdAt: Date;
          signerAddress: string | null;
          messageHash: string | null;
          signature: string | null;
          authorId: string;
          authorName: string;
          authorAvatar: string | null;
        }[]
      >`
        SELECT p."id", p."content", p."mediaUrl", p."mediaType", p."audience", p."createdAt",
               p."signerAddress", p."messageHash", p."signature",
               u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
        FROM "Post" p
        JOIN "User" u ON u."id" = p."authorId"
        WHERE p."authorId" = ${profileId}
          AND p."deletedAt" IS NULL
          AND (
            p."audience" = 'PUBLIC'
            OR p."authorId" = ${viewerId}
            OR (p."audience" = 'FRIENDS' AND EXISTS (
              SELECT 1 FROM "Friendship" f WHERE f."userId" = ${viewerId} AND f."friendId" = p."authorId"
            ))
          )
        ORDER BY p."createdAt" DESC
        LIMIT 30
      `,
      this.prisma.$queryRaw`
        SELECT l."id", l."title", l."status", l."startedAt", l."endedAt", l."recordingUrl", l."latestFrameUrl",
               l."signerAddress", l."messageHash", l."signature",
               u."id" AS "hostId", u."name" AS "hostName", u."avatar" AS "hostAvatar"
        FROM "LiveSession" l
        JOIN "User" u ON u."id" = l."hostId"
        WHERE l."hostId" = ${profileId}
        ORDER BY l."startedAt" DESC
        LIMIT 30
      `,
    ]);

    return {
      user: this.publicUser(user),
      relationship:
        viewerId === profileId
          ? 'SELF'
          : friendship
            ? 'FRIEND'
            : pendingRequest
              ? pendingRequest.requesterId === viewerId
                ? 'REQUEST_SENT'
                : 'REQUEST_RECEIVED'
              : 'NONE',
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        mediaUrl: post.mediaUrl,
        mediaType: post.mediaType,
        audience: post.audience,
        createdAt: post.createdAt,
        signerAddress: post.signerAddress,
        messageHash: post.messageHash,
        signature: post.signature,
        author: {
          id: post.authorId,
          name: post.authorName,
          avatar: post.authorAvatar,
        },
        page: null,
        group: null,
        sharedPost: null,
        reactionCount: 0,
        commentCount: 0,
        shareCount: 0,
        reactedByMe: false,
        comments: [],
      })),
      lives,
    };
  }

  async sendRequest(accessToken: string, addresseeId: string) {
    const requesterId = this.userId(accessToken);

    if (requesterId === addresseeId) {
      throw new UnprocessableEntityException('Cannot add yourself');
    }

    const addressee = await this.prisma.user.findUnique({
      where: { id: addresseeId },
    });

    if (!addressee) {
      throw new NotFoundException('User not found');
    }

    const alreadyFriends = await this.prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: requesterId, friendId: addresseeId },
      },
    });

    if (alreadyFriends) {
      throw new ConflictException('Already friends');
    }

    const inversePending = await this.prisma.friendRequest.findUnique({
      where: {
        requesterId_addresseeId: {
          requesterId: addresseeId,
          addresseeId: requesterId,
        },
      },
    });

    if (inversePending?.status === FriendRequestStatus.PENDING) {
      return this.accept(accessToken, inversePending.id);
    }

    try {
      const request = await this.prisma.friendRequest.create({
        data: { requesterId, addresseeId },
      });
      await this.signing.signAction(
        requesterId,
        'SEND_FRIEND_REQUEST',
        'FriendRequest',
        request.id,
        { addresseeId },
      );
      await this.notify(addresseeId, 'FRIEND_REQUEST', 'Nueva solicitud de amistad', 'Alguien quiere agregarte como amigo.', 'FriendRequest', request.id);
      return request;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Friend request already exists');
      }

      throw error;
    }
  }

  async accept(accessToken: string, requestId: string) {
    const userId = this.userId(accessToken);
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (
      !request ||
      request.addresseeId !== userId ||
      request.status !== FriendRequestStatus.PENDING
    ) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.$transaction([
      this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.ACCEPTED },
      }),
      this.prisma.friendship.upsert({
        where: {
          userId_friendId: {
            userId: request.requesterId,
            friendId: request.addresseeId,
          },
        },
        update: {},
        create: { userId: request.requesterId, friendId: request.addresseeId },
      }),
      this.prisma.friendship.upsert({
        where: {
          userId_friendId: {
            userId: request.addresseeId,
            friendId: request.requesterId,
          },
        },
        update: {},
        create: { userId: request.addresseeId, friendId: request.requesterId },
      }),
    ]);
    await this.signing.signAction(
      userId,
      'ACCEPT_FRIEND_REQUEST',
      'FriendRequest',
      requestId,
      { requesterId: request.requesterId },
    );
    await this.notify(request.requesterId, 'FRIEND_ACCEPTED', 'Solicitud aceptada', 'Ahora son amigos.', 'User', userId);

    return { ok: true };
  }

  async reject(accessToken: string, requestId: string) {
    const userId = this.userId(accessToken);
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (
      !request ||
      request.addresseeId !== userId ||
      request.status !== FriendRequestStatus.PENDING
    ) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: FriendRequestStatus.REJECTED },
    });
    await this.signing.signAction(
      userId,
      'REJECT_FRIEND_REQUEST',
      'FriendRequest',
      requestId,
      { requesterId: request.requesterId },
    );

    return { ok: true };
  }

  async block(accessToken: string, blockedId: string) {
    const blockerId = this.userId(accessToken);
    if (blockerId === blockedId) {
      throw new UnprocessableEntityException('Cannot block yourself');
    }
    const blocked = await this.prisma.user.findUnique({ where: { id: blockedId } });
    if (!blocked) {
      throw new NotFoundException('User not found');
    }
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        INSERT INTO "UserBlock" ("id", "blockerId", "blockedId")
        VALUES (${randomUUID()}, ${blockerId}, ${blockedId})
        ON CONFLICT ("blockerId", "blockedId") DO NOTHING
      `,
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId: blockerId, friendId: blockedId },
            { userId: blockedId, friendId: blockerId },
          ],
        },
      }),
      this.prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { requesterId: blockerId, addresseeId: blockedId },
            { requesterId: blockedId, addresseeId: blockerId },
          ],
        },
      }),
    ]);
    return { blocked: true };
  }

  private async relatedUserIds(userId: string) {
    const [friendships, sent, received, blocks] = await Promise.all([
      this.prisma.friendship.findMany({ where: { userId } }),
      this.prisma.friendRequest.findMany({
        where: { requesterId: userId, status: FriendRequestStatus.PENDING },
      }),
      this.prisma.friendRequest.findMany({
        where: { addresseeId: userId, status: FriendRequestStatus.PENDING },
      }),
      this.prisma.$queryRaw<{ userId: string }[]>`
        SELECT "blockedId" AS "userId" FROM "UserBlock" WHERE "blockerId" = ${userId}
        UNION
        SELECT "blockerId" AS "userId" FROM "UserBlock" WHERE "blockedId" = ${userId}
      `,
    ]);

    return [
      ...friendships.map((friendship) => friendship.friendId),
      ...sent.map((request) => request.addresseeId),
      ...received.map((request) => request.requesterId),
      ...blocks.map((block) => block.userId),
    ];
  }

  private async assertNotBlocked(viewerId: string, profileId: string) {
    const [block] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "UserBlock"
      WHERE ("blockerId" = ${viewerId} AND "blockedId" = ${profileId})
         OR ("blockerId" = ${profileId} AND "blockedId" = ${viewerId})
      LIMIT 1
    `;
    if (block) {
      throw new NotFoundException('User not found');
    }
  }

  private userId(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async notify(
    userId: string,
    type: string,
    title: string,
    body: string,
    entityType?: string,
    entityId?: string,
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "entityType", "entityId")
      VALUES (${randomUUID()}, ${userId}, ${type}, ${title}, ${body}, ${entityType ?? null}, ${entityId ?? null})
    `;
    this.realtime.publishTo(userId, 'notifications_updated', {});
  }

  private publicUser(user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    bio: string | null;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      bio: user.bio,
    };
  }
}
