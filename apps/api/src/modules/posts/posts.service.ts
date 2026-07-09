import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashMessage, verifyMessage, Wallet as EvmWallet } from 'ethers';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { decryptSecret } from '../wallets/crypto-box';
import { SigningService } from '../wallets/signing.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type MediaType = 'IMAGE' | 'VIDEO' | 'STREAM';
type Audience = 'PUBLIC' | 'FRIENDS' | 'ONLY_ME';

type PostRow = {
  id: string;
  content: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  audience: Audience;
  createdAt: Date;
  signerAddress: string | null;
  messageHash: string | null;
  signature: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  pageId: string | null;
  pageName: string | null;
  pageAvatar: string | null;
  pageCategory: string | null;
  groupId: string | null;
  groupName: string | null;
  sharedPostId: string | null;
  sharedContent: string | null;
  sharedMediaUrl: string | null;
  sharedMediaType: MediaType | null;
  sharedAuthorId: string | null;
  sharedAuthorName: string | null;
  sharedAuthorAvatar: string | null;
};

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private signing: SigningService,
    private realtime: RealtimeService,
  ) {}

  async list(accessToken?: string) {
    const viewerId = accessToken ? this.verifyAccessToken(accessToken).sub : undefined;
    const posts = viewerId
      ? await this.prisma.$queryRaw<PostRow[]>`
        SELECT p."id", p."content", p."mediaUrl", p."mediaType", p."audience", p."createdAt",
               p."signerAddress", p."messageHash", p."signature",
               u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar",
               pg."id" AS "pageId", pg."name" AS "pageName", pg."avatar" AS "pageAvatar",
               pg."category" AS "pageCategory",
               g."id" AS "groupId", g."name" AS "groupName",
               sp."id" AS "sharedPostId", sp."content" AS "sharedContent",
               sp."mediaUrl" AS "sharedMediaUrl", sp."mediaType" AS "sharedMediaType",
               su."id" AS "sharedAuthorId", su."name" AS "sharedAuthorName", su."avatar" AS "sharedAuthorAvatar"
        FROM "Post" p
        JOIN "User" u ON u."id" = p."authorId"
        LEFT JOIN "Page" pg ON pg."id" = p."pageId"
        LEFT JOIN "Group" g ON g."id" = p."groupId"
        LEFT JOIN "Post" sp ON sp."id" = p."sharedPostId"
        LEFT JOIN "User" su ON su."id" = sp."authorId"
        WHERE p."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "UserBlock" b
            WHERE (b."blockerId" = ${viewerId} AND b."blockedId" = p."authorId")
               OR (b."blockerId" = p."authorId" AND b."blockedId" = ${viewerId})
          )
          AND (
            p."audience" = 'PUBLIC'
            OR p."authorId" = ${viewerId}
            OR (p."audience" = 'FRIENDS' AND EXISTS (
              SELECT 1 FROM "Friendship" f WHERE f."userId" = ${viewerId} AND f."friendId" = p."authorId"
            ))
          )
        ORDER BY p."createdAt" DESC
        LIMIT 50
      `
      : await this.prisma.$queryRaw<PostRow[]>`
        SELECT p."id", p."content", p."mediaUrl", p."mediaType", p."audience", p."createdAt",
               p."signerAddress", p."messageHash", p."signature",
               u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar",
               pg."id" AS "pageId", pg."name" AS "pageName", pg."avatar" AS "pageAvatar",
               pg."category" AS "pageCategory",
               g."id" AS "groupId", g."name" AS "groupName",
               sp."id" AS "sharedPostId", sp."content" AS "sharedContent",
               sp."mediaUrl" AS "sharedMediaUrl", sp."mediaType" AS "sharedMediaType",
               su."id" AS "sharedAuthorId", su."name" AS "sharedAuthorName", su."avatar" AS "sharedAuthorAvatar"
        FROM "Post" p
        JOIN "User" u ON u."id" = p."authorId"
        LEFT JOIN "Page" pg ON pg."id" = p."pageId"
        LEFT JOIN "Group" g ON g."id" = p."groupId"
        LEFT JOIN "Post" sp ON sp."id" = p."sharedPostId"
        LEFT JOIN "User" su ON su."id" = sp."authorId"
        WHERE p."deletedAt" IS NULL
          AND p."audience" = 'PUBLIC'
        ORDER BY p."createdAt" DESC
        LIMIT 50
      `;
    const postIds = posts.map((post) => post.id);
    const [comments, reactionCounts, shareCounts, viewerReactions] = postIds.length
      ? await Promise.all([
          this.prisma.$queryRaw<
            {
              id: string;
              postId: string;
              content: string;
              createdAt: Date;
              signerAddress: string;
              authorId: string;
              authorName: string;
              authorAvatar: string | null;
            }[]
          >`
            SELECT c."id", c."postId", c."content", c."createdAt", c."signerAddress",
                   u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
            FROM "PostComment" c
            JOIN "User" u ON u."id" = c."authorId"
            WHERE c."postId" = ANY(${postIds})
            ORDER BY c."createdAt" ASC
          `,
          this.prisma.$queryRaw<{ postId: string; count: bigint }[]>`
            SELECT "postId", COUNT(*) AS count
            FROM "PostReaction"
            WHERE "postId" = ANY(${postIds})
            GROUP BY "postId"
          `,
          this.prisma.$queryRaw<{ sharedPostId: string; count: bigint }[]>`
            SELECT "sharedPostId", COUNT(*) AS count
            FROM "Post"
            WHERE "sharedPostId" = ANY(${postIds})
            GROUP BY "sharedPostId"
          `,
          viewerId
            ? this.prisma.$queryRaw<{ postId: string }[]>`
                SELECT "postId"
                FROM "PostReaction"
                WHERE "userId" = ${viewerId} AND "postId" = ANY(${postIds})
              `
            : Promise.resolve([]),
        ])
      : [[], [], [], []];
    const reactedPostIds = new Set(viewerReactions.map((reaction) => reaction.postId));

    return posts.map((post) => ({
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      audience: post.audience,
      createdAt: post.createdAt,
      author: {
        id: post.authorId,
        name: post.authorName,
        avatar: post.authorAvatar,
      },
      page: post.pageId
        ? {
            id: post.pageId,
            name: post.pageName,
            avatar: post.pageAvatar,
            category: post.pageCategory,
          }
        : null,
      group: post.groupId ? { id: post.groupId, name: post.groupName } : null,
      sharedPost: post.sharedPostId
        ? {
            id: post.sharedPostId,
            content: post.sharedContent,
            mediaUrl: post.sharedMediaUrl,
            mediaType: post.sharedMediaType,
            author: {
              id: post.sharedAuthorId,
              name: post.sharedAuthorName,
              avatar: post.sharedAuthorAvatar,
            },
          }
        : null,
      signerAddress: post.signerAddress,
      messageHash: post.messageHash,
      signature: post.signature,
      reactionCount: Number(
        reactionCounts.find((reaction) => reaction.postId === post.id)?.count ?? 0,
      ),
      commentCount: comments.filter((comment) => comment.postId === post.id).length,
      shareCount: Number(shareCounts.find((share) => share.sharedPostId === post.id)?.count ?? 0),
      reactedByMe: reactedPostIds.has(post.id),
      comments: comments
        .filter((comment) => comment.postId === post.id)
        .slice(-3)
        .map((comment) => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          signerAddress: comment.signerAddress,
          author: {
            id: comment.authorId,
            name: comment.authorName,
            avatar: comment.authorAvatar,
          },
        })),
    }));
  }

  async create(
    accessToken: string,
    content: string,
    mediaUrl?: string,
    mediaType?: MediaType,
    pageId?: string,
    groupId?: string,
    audience?: Audience,
  ) {
    const trimmed = content.trim();
    const url = mediaUrl?.trim() || null;
    const type: MediaType | null = url ? mediaType ?? 'IMAGE' : null;

    if (!trimmed && !url) {
      throw new UnprocessableEntityException('Post content or media is required');
    }

    if (type && !['IMAGE', 'VIDEO', 'STREAM'].includes(type)) {
      throw new UnprocessableEntityException('Invalid post media type');
    }

    if (url) {
      if (!this.validMediaUrl(url)) {
        throw new UnprocessableEntityException('Post mediaUrl must be a valid URL');
      }
    }

    const payload = this.verifyAccessToken(accessToken);
    const cleanAudience: Audience = ['PUBLIC', 'FRIENDS', 'ONLY_ME'].includes(audience ?? 'PUBLIC') ? audience ?? 'PUBLIC' : 'PUBLIC';
    const cleanPageId = pageId?.trim() || null;
    const cleanGroupId = groupId?.trim() || null;
    if (cleanPageId) {
      const [page] = await this.prisma.$queryRaw<{ id: string; ownerId: string }[]>`
        SELECT "id", "ownerId" FROM "Page" WHERE "id" = ${cleanPageId} LIMIT 1
      `;

      if (!page || page.ownerId !== payload.sub) {
        throw new UnprocessableEntityException('Page not found');
      }
    }
    if (cleanGroupId) {
      const [member] = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "GroupMember"
        WHERE "groupId" = ${cleanGroupId} AND "userId" = ${payload.sub}
        LIMIT 1
      `;
      if (!member) {
        throw new UnprocessableEntityException('Group not found');
      }
    }

    const signer = await this.prisma.appSigner.findFirst({
      where: {
        active: true,
        wallet: { userId: payload.sub },
      },
      include: { wallet: true },
    });

    if (!signer) {
      throw new UnprocessableEntityException('Active app signer is required');
    }

    const message = this.postMessage({
      authorId: payload.sub,
      content: trimmed,
      mediaUrl: url,
      mediaType: type,
      pageId: cleanPageId,
      groupId: cleanGroupId,
      audience: cleanAudience,
      signerAddress: signer.address,
    });
    const signature = await new EvmWallet(
      decryptSecret(signer.encryptedPrivateKey),
    ).signMessage(message);
    const recovered = verifyMessage(message, signature);

    if (recovered.toLowerCase() !== signer.address.toLowerCase()) {
      throw new UnprocessableEntityException('Invalid post signature');
    }

    const id = randomUUID();
    const messageHash = hashMessage(message);

    await this.prisma.$executeRaw`
      INSERT INTO "Post" (
        "id", "authorId", "pageId", "groupId", "audience", "content", "mediaUrl", "mediaType", "signerAddress",
        "messageHash", "signature", "updatedAt"
      )
      VALUES (
        ${id}, ${payload.sub}, ${cleanPageId}, ${cleanGroupId}, ${cleanAudience}, ${trimmed}, ${url}, ${type}::"MediaType",
        ${signer.address}, ${messageHash}, ${signature}, NOW()
      )
    `;
    await this.signing.signAction(payload.sub, 'CREATE_POST', 'Post', id, {
      content: trimmed,
      mediaUrl: url,
      mediaType: type,
      pageId: cleanPageId,
      groupId: cleanGroupId,
      audience: cleanAudience,
    });
    if (cleanPageId) {
      await this.notifyPageFollowers(cleanPageId, payload.sub, id, 'Nueva publicacion', trimmed || 'La pagina publico contenido nuevo.');
    }
    this.realtime.publish('feed_updated', { postId: id });
    const [post] = await this.prisma.$queryRaw<PostRow[]>`
      SELECT p."id", p."content", p."mediaUrl", p."mediaType", p."audience", p."createdAt",
             p."signerAddress", p."messageHash", p."signature",
             u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar",
             pg."id" AS "pageId", pg."name" AS "pageName", pg."avatar" AS "pageAvatar",
             pg."category" AS "pageCategory",
             g."id" AS "groupId", g."name" AS "groupName",
             sp."id" AS "sharedPostId", sp."content" AS "sharedContent",
             sp."mediaUrl" AS "sharedMediaUrl", sp."mediaType" AS "sharedMediaType",
             su."id" AS "sharedAuthorId", su."name" AS "sharedAuthorName", su."avatar" AS "sharedAuthorAvatar"
      FROM "Post" p
      JOIN "User" u ON u."id" = p."authorId"
      LEFT JOIN "Page" pg ON pg."id" = p."pageId"
      LEFT JOIN "Group" g ON g."id" = p."groupId"
      LEFT JOIN "Post" sp ON sp."id" = p."sharedPostId"
      LEFT JOIN "User" su ON su."id" = sp."authorId"
      WHERE p."id" = ${id}
    `;

    return {
      id: post.id,
      content: post.content,
      mediaUrl: post.mediaUrl,
      mediaType: post.mediaType,
      audience: post.audience,
      createdAt: post.createdAt,
      author: {
        id: post.authorId,
        name: post.authorName,
        avatar: post.authorAvatar,
      },
      page: post.pageId
        ? {
            id: post.pageId,
            name: post.pageName,
            avatar: post.pageAvatar,
            category: post.pageCategory,
          }
        : null,
      group: post.groupId ? { id: post.groupId, name: post.groupName } : null,
      sharedPost: post.sharedPostId
        ? {
            id: post.sharedPostId,
            content: post.sharedContent,
            mediaUrl: post.sharedMediaUrl,
            mediaType: post.sharedMediaType,
            author: {
              id: post.sharedAuthorId,
              name: post.sharedAuthorName,
              avatar: post.sharedAuthorAvatar,
            },
          }
        : null,
      signerAddress: post.signerAddress,
      messageHash: post.messageHash,
      signature: post.signature,
      reactionCount: 0,
      commentCount: 0,
      shareCount: 0,
      reactedByMe: false,
      comments: [],
    };
  }

  async share(accessToken: string, postId: string, content: string, pageId?: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [target] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Post" WHERE "id" = ${postId} LIMIT 1
    `;
    if (!target) {
      throw new UnprocessableEntityException('Post not found');
    }

    const cleanPageId = pageId?.trim() || null;
    if (cleanPageId) {
      const [page] = await this.prisma.$queryRaw<{ id: string; ownerId: string }[]>`
        SELECT "id", "ownerId" FROM "Page" WHERE "id" = ${cleanPageId} LIMIT 1
      `;
      if (!page || page.ownerId !== payload.sub) {
        throw new UnprocessableEntityException('Page not found');
      }
    }

    const signer = await this.prisma.appSigner.findFirst({
      where: { active: true, wallet: { userId: payload.sub } },
      include: { wallet: true },
    });
    if (!signer) {
      throw new UnprocessableEntityException('Active app signer is required');
    }

    const trimmed = content.trim();
    const id = randomUUID();
    const message = this.postMessage({
      authorId: payload.sub,
      content: trimmed,
      mediaUrl: null,
      mediaType: null,
      pageId: cleanPageId,
      groupId: null,
      sharedPostId: postId,
      signerAddress: signer.address,
    });
    const signature = await new EvmWallet(decryptSecret(signer.encryptedPrivateKey)).signMessage(message);
    const messageHash = hashMessage(message);

    await this.prisma.$executeRaw`
      INSERT INTO "Post" ("id", "authorId", "pageId", "sharedPostId", "content", "signerAddress", "messageHash", "signature", "updatedAt")
      VALUES (${id}, ${payload.sub}, ${cleanPageId}, ${postId}, ${trimmed}, ${signer.address}, ${messageHash}, ${signature}, NOW())
    `;
    await this.signing.signAction(payload.sub, 'SHARE_POST', 'Post', postId, {
      sharedPostId: postId,
      postId: id,
      pageId: cleanPageId,
      content: trimmed,
    });
    this.realtime.publish('feed_updated', { postId: id });
    return { id, sharedPostId: postId };
  }

  async comment(accessToken: string, postId: string, content: string) {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new UnprocessableEntityException('Comment content is required');
    }

    const payload = this.verifyAccessToken(accessToken);
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new UnprocessableEntityException('Post not found');
    }

    const signed = await this.signing.signAction(
      payload.sub,
      'COMMENT_POST',
      'Post',
      postId,
      { content: trimmed },
    );
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "PostComment" (
        "id", "postId", "authorId", "content", "signerAddress", "messageHash", "signature"
      )
      VALUES (
        ${id}, ${postId}, ${payload.sub}, ${trimmed}, ${signed.signerAddress},
        ${signed.messageHash}, ${signed.signature}
      )
    `;
    if (post.authorId !== payload.sub) {
      await this.notify(post.authorId, 'POST_COMMENT', 'Nuevo comentario', 'Alguien comento tu publicacion.', 'Post', postId);
    }
    this.realtime.publish('feed_updated', { postId });

    return { id, content: trimmed, ...signed };
  }

  async updateComment(accessToken: string, commentId: string, content: string) {
    const payload = this.verifyAccessToken(accessToken);
    const trimmed = content.trim();
    if (!trimmed) {
      throw new UnprocessableEntityException('Comment content is required');
    }

    const [comment] = await this.prisma.$queryRaw<{ id: string; authorId: string; postId: string }[]>`
      SELECT "id", "authorId", "postId" FROM "PostComment" WHERE "id" = ${commentId} LIMIT 1
    `;
    if (!comment || comment.authorId !== payload.sub) {
      throw new UnprocessableEntityException('Comment not found');
    }

    await this.signing.signAction(payload.sub, 'EDIT_COMMENT', 'PostComment', commentId, {
      content: trimmed,
    });
    await this.prisma.$executeRaw`
      UPDATE "PostComment" SET "content" = ${trimmed} WHERE "id" = ${commentId}
    `;
    this.realtime.publish('feed_updated', { postId: comment.postId });
    return { updated: true };
  }

  async deleteComment(accessToken: string, commentId: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [comment] = await this.prisma.$queryRaw<{ id: string; authorId: string; postId: string }[]>`
      SELECT "id", "authorId", "postId" FROM "PostComment" WHERE "id" = ${commentId} LIMIT 1
    `;
    if (!comment || comment.authorId !== payload.sub) {
      throw new UnprocessableEntityException('Comment not found');
    }

    await this.signing.signAction(payload.sub, 'DELETE_COMMENT', 'PostComment', commentId, {});
    await this.prisma.$executeRaw`
      DELETE FROM "PostComment" WHERE "id" = ${commentId}
    `;
    this.realtime.publish('feed_updated', { postId: comment.postId });
    return { deleted: true };
  }

  async update(accessToken: string, postId: string, content: string) {
    const payload = this.verifyAccessToken(accessToken);
    const trimmed = content.trim();
    const [post] = await this.prisma.$queryRaw<
      { id: string; authorId: string; mediaUrl: string | null }[]
    >`
      SELECT "id", "authorId", "mediaUrl" FROM "Post" WHERE "id" = ${postId} LIMIT 1
    `;

    if (!post || post.authorId !== payload.sub) {
      throw new UnprocessableEntityException('Post not found');
    }

    if (!trimmed && !post.mediaUrl) {
      throw new UnprocessableEntityException('Post content or media is required');
    }

    await this.signing.signAction(payload.sub, 'EDIT_POST', 'Post', postId, { content: trimmed });
    await this.prisma.$executeRaw`
      UPDATE "Post" SET "content" = ${trimmed}, "updatedAt" = NOW() WHERE "id" = ${postId}
    `;
    this.realtime.publish('feed_updated', { postId });
    return { updated: true };
  }

  async delete(accessToken: string, postId: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [post] = await this.prisma.$queryRaw<{ id: string; authorId: string }[]>`
      SELECT "id", "authorId" FROM "Post" WHERE "id" = ${postId} LIMIT 1
    `;

    if (!post || post.authorId !== payload.sub) {
      throw new UnprocessableEntityException('Post not found');
    }

    await this.signing.signAction(payload.sub, 'DELETE_POST', 'Post', postId, {});
    await this.prisma.$executeRaw`
      UPDATE "Post" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = ${postId}
    `;
    this.realtime.publish('feed_updated', { postId });
    return { deleted: true };
  }

  async react(accessToken: string, postId: string) {
    const payload = this.verifyAccessToken(accessToken);
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new UnprocessableEntityException('Post not found');
    }

    const existing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "PostReaction"
      WHERE "postId" = ${postId} AND "userId" = ${payload.sub}
      LIMIT 1
    `;

    if (existing[0]) {
      await this.signing.signAction(payload.sub, 'UNLIKE_POST', 'Post', postId, {});
      await this.prisma.$executeRaw`
        DELETE FROM "PostReaction" WHERE "id" = ${existing[0].id}
      `;
      this.realtime.publish('feed_updated', { postId });
      return { reacted: false };
    }

    const signed = await this.signing.signAction(
      payload.sub,
      'LIKE_POST',
      'Post',
      postId,
      { reactionType: 'LIKE' },
    );
    await this.prisma.$executeRaw`
      INSERT INTO "PostReaction" (
        "id", "postId", "userId", "reactionType", "signerAddress", "messageHash", "signature"
      )
      VALUES (
        ${randomUUID()}, ${postId}, ${payload.sub}, 'LIKE', ${signed.signerAddress},
        ${signed.messageHash}, ${signed.signature}
      )
    `;
    if (post.authorId !== payload.sub) {
      await this.notify(post.authorId, 'POST_REACTION', 'Nueva reaccion', 'A alguien le gusto tu publicacion.', 'Post', postId);
    }
    this.realtime.publish('feed_updated', { postId });

    return { reacted: true, ...signed };
  }

  async report(accessToken: string, postId: string, reason: string) {
    const payload = this.verifyAccessToken(accessToken);
    const clean = reason.trim();
    if (!clean) {
      throw new UnprocessableEntityException('Report reason is required');
    }
    const [post] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Post" WHERE "id" = ${postId} AND "deletedAt" IS NULL LIMIT 1
    `;
    if (!post) {
      throw new UnprocessableEntityException('Post not found');
    }
    await this.prisma.$executeRaw`
      INSERT INTO "ContentReport" ("id", "reporterId", "entityType", "entityId", "reason")
      VALUES (${randomUUID()}, ${payload.sub}, 'Post', ${postId}, ${clean})
    `;
    return { reported: true };
  }

  async reports(accessToken: string) {
    this.verifyAccessToken(accessToken);
    return this.prisma.$queryRaw`
      SELECT r."id", r."entityType", r."entityId", r."reason", r."status", r."createdAt",
             u."id" AS "reporterId", u."name" AS "reporterName"
      FROM "ContentReport" r
      JOIN "User" u ON u."id" = r."reporterId"
      WHERE r."status" = 'OPEN'
      ORDER BY r."createdAt" DESC
      LIMIT 100
    `;
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

  private async notifyPageFollowers(pageId: string, authorId: string, postId: string, title: string, body: string) {
    const followers = await this.prisma.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "PageFollow"
      WHERE "pageId" = ${pageId} AND "userId" <> ${authorId}
      LIMIT 500
    `;

    await Promise.all(
      followers.map((follower) => this.notify(follower.userId, 'PAGE_POST', title, body, 'Post', postId)),
    );
  }

  private postMessage({
    authorId,
    content,
    mediaUrl,
    mediaType,
    pageId,
    groupId,
    audience = 'PUBLIC',
    sharedPostId = null,
    signerAddress,
  }: {
    authorId: string;
    content: string;
    mediaUrl: string | null;
    mediaType: MediaType | null;
    pageId: string | null;
    groupId: string | null;
    audience?: Audience;
    sharedPostId?: string | null;
    signerAddress: string;
  }) {
    return JSON.stringify({
      type: 'social.post',
      version: 1,
      authorId,
      content,
      mediaUrl,
      mediaType,
      pageId,
      groupId,
      audience,
      sharedPostId,
      signerAddress,
    });
  }

  private verifyAccessToken(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private validMediaUrl(url: string) {
    if (url.startsWith('/media/')) {
      return true;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
