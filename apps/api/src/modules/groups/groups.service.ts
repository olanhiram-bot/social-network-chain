import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  privacy: string;
  cover: string | null;
  createdAt: Date;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  memberCount: bigint;
  joinedByMe: boolean;
  requestPendingByMe: boolean;
  myRole: string | null;
};

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  list(accessToken: string) {
    const userId = this.userId(accessToken);
    return this.groupQuery(userId, Prisma.empty).then((groups) => groups.map((group) => this.present(group)));
  }

  mine(accessToken: string) {
    const userId = this.userId(accessToken);
    return this.groupQuery(userId, Prisma.sql`AND EXISTS (
      SELECT 1 FROM "GroupMember" mine WHERE mine."groupId" = g."id" AND mine."userId" = ${userId}
    )`).then((groups) => groups.map((group) => this.present(group)));
  }

  async create(accessToken: string, body: { name: string; description?: string; privacy?: string; cover?: string }) {
    const userId = this.userId(accessToken);
    const name = body.name?.trim();
    const privacy = (body.privacy?.trim() || 'PUBLIC').toUpperCase();

    if (!name) {
      throw new UnprocessableEntityException('Group name is required');
    }

    if (!['PUBLIC', 'PRIVATE'].includes(privacy)) {
      throw new UnprocessableEntityException('Invalid group privacy');
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Group" ("id", "ownerId", "name", "description", "privacy", "cover", "updatedAt")
      VALUES (${id}, ${userId}, ${name}, ${body.description?.trim() || null}, ${privacy}, ${this.mediaUrl(body.cover)}, NOW())
    `;
    await this.prisma.$executeRaw`
      INSERT INTO "GroupMember" ("id", "groupId", "userId", "role")
      VALUES (${randomUUID()}, ${id}, ${userId}, 'ADMIN')
    `;
    this.realtime.publish('groups_updated', { groupId: id });
    return this.one(accessToken, id);
  }

  async one(accessToken: string, id: string) {
    const userId = this.userId(accessToken);
    const groups = await this.groupQuery(userId, Prisma.sql`AND g."id" = ${id}`);
    const group = groups[0];
    if (!group) {
      throw new UnprocessableEntityException('Group not found');
    }
    return this.present(group);
  }

  async join(accessToken: string, id: string) {
    const userId = this.userId(accessToken);
    const [group] = await this.prisma.$queryRaw<{ id: string; privacy: string; ownerId: string }[]>`
      SELECT "id", "privacy", "ownerId" FROM "Group" WHERE "id" = ${id} LIMIT 1
    `;
    if (!group) {
      throw new UnprocessableEntityException('Group not found');
    }
    if (group.privacy === 'PRIVATE' && group.ownerId !== userId) {
      await this.prisma.$executeRaw`
        INSERT INTO "GroupJoinRequest" ("id", "groupId", "requesterId", "status", "updatedAt")
        VALUES (${randomUUID()}, ${id}, ${userId}, 'PENDING', NOW())
        ON CONFLICT ("groupId", "requesterId") DO UPDATE SET "status" = 'PENDING', "updatedAt" = NOW()
      `;
      await this.notify(group.ownerId, 'GROUP_JOIN_REQUEST', 'New group request', `Someone requested to join ${id}.`, 'Group', id);
      this.realtime.publish('groups_updated', { groupId: id });
      return { joined: false, requested: true };
    }

    await this.prisma.$executeRaw`
      INSERT INTO "GroupMember" ("id", "groupId", "userId", "role")
      VALUES (${randomUUID()}, ${id}, ${userId}, 'MEMBER')
      ON CONFLICT ("groupId", "userId") DO NOTHING
    `;
    this.realtime.publish('groups_updated', { groupId: id });
    return { joined: true };
  }

  async leave(accessToken: string, id: string) {
    const userId = this.userId(accessToken);
    const [group] = await this.prisma.$queryRaw<{ ownerId: string }[]>`
      SELECT "ownerId" FROM "Group" WHERE "id" = ${id} LIMIT 1
    `;
    if (!group) {
      throw new UnprocessableEntityException('Group not found');
    }
    if (group.ownerId === userId) {
      throw new UnprocessableEntityException('Owner cannot leave their group');
    }

    await this.prisma.$executeRaw`
      DELETE FROM "GroupMember" WHERE "groupId" = ${id} AND "userId" = ${userId}
    `;
    this.realtime.publish('groups_updated', { groupId: id });
    return { joined: false };
  }

  async requests(accessToken: string, groupId: string) {
    const userId = this.userId(accessToken);
    await this.assertOwner(groupId, userId);
    return this.prisma.$queryRaw`
      SELECT r."id", r."createdAt", u."id" AS "requesterId", u."name" AS "requesterName", u."avatar" AS "requesterAvatar"
      FROM "GroupJoinRequest" r
      JOIN "User" u ON u."id" = r."requesterId"
      WHERE r."groupId" = ${groupId} AND r."status" = 'PENDING'
      ORDER BY r."createdAt" ASC
      LIMIT 100
    `;
  }

  async respondToRequest(accessToken: string, groupId: string, requestId: string, accept: boolean) {
    const userId = this.userId(accessToken);
    await this.assertOwner(groupId, userId);
    const [request] = await this.prisma.$queryRaw<{ requesterId: string }[]>`
      SELECT "requesterId" FROM "GroupJoinRequest"
      WHERE "id" = ${requestId} AND "groupId" = ${groupId} AND "status" = 'PENDING'
      LIMIT 1
    `;
    if (!request) throw new UnprocessableEntityException('Group request not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "GroupJoinRequest" SET "status" = ${accept ? 'ACCEPTED' : 'REJECTED'}, "updatedAt" = NOW()
        WHERE "id" = ${requestId}
      `;
      if (accept) {
        await tx.$executeRaw`
          INSERT INTO "GroupMember" ("id", "groupId", "userId", "role")
          VALUES (${randomUUID()}, ${groupId}, ${request.requesterId}, 'MEMBER')
          ON CONFLICT ("groupId", "userId") DO NOTHING
        `;
      }
    });
    await this.notify(request.requesterId, 'GROUP_JOIN_RESPONSE', accept ? 'Request accepted' : 'Request declined', accept ? 'You can now participate in the group.' : 'Your request was not accepted.', 'Group', groupId);
    this.realtime.publish('groups_updated', { groupId });
    return { accepted: accept };
  }

  async members(accessToken: string, groupId: string) {
    const userId = this.userId(accessToken);
    await this.assertOwner(groupId, userId);
    return this.prisma.$queryRaw`SELECT m."userId", m."role", u."name", u."avatar" FROM "GroupMember" m JOIN "User" u ON u."id" = m."userId" WHERE m."groupId" = ${groupId} ORDER BY m."createdAt" ASC`;
  }

  async setMemberRole(accessToken: string, groupId: string, memberId: string, role: string) {
    const userId = this.userId(accessToken);
    await this.assertOwner(groupId, userId);
    const cleanRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    if (memberId === userId) throw new UnprocessableEntityException('Owner role cannot be changed');
    await this.prisma.$executeRaw`UPDATE "GroupMember" SET "role" = ${cleanRole} WHERE "groupId" = ${groupId} AND "userId" = ${memberId}`;
    return { role: cleanRole };
  }

  async removeMember(accessToken: string, groupId: string, memberId: string) {
    const userId = this.userId(accessToken);
    await this.assertOwner(groupId, userId);
    if (memberId === userId) throw new UnprocessableEntityException('Owner cannot be removed');
    await this.prisma.$executeRaw`DELETE FROM "GroupMember" WHERE "groupId" = ${groupId} AND "userId" = ${memberId}`;
    this.realtime.publish('groups_updated', { groupId });
    return { removed: true };
  }

  private groupQuery(userId: string, whereSql: Prisma.Sql) {
    return this.prisma.$queryRaw<GroupRow[]>`
      SELECT g."id", g."name", g."description", g."privacy", g."cover", g."createdAt",
             u."id" AS "ownerId", u."name" AS "ownerName", u."avatar" AS "ownerAvatar",
             COUNT(gm."id") AS "memberCount",
             EXISTS (
               SELECT 1 FROM "GroupMember" me WHERE me."groupId" = g."id" AND me."userId" = ${userId}
             ) AS "joinedByMe",
             EXISTS (
               SELECT 1 FROM "GroupJoinRequest" request
               WHERE request."groupId" = g."id" AND request."requesterId" = ${userId} AND request."status" = 'PENDING'
             ) AS "requestPendingByMe",
             (
               SELECT me."role" FROM "GroupMember" me WHERE me."groupId" = g."id" AND me."userId" = ${userId} LIMIT 1
             ) AS "myRole"
      FROM "Group" g
      JOIN "User" u ON u."id" = g."ownerId"
      LEFT JOIN "GroupMember" gm ON gm."groupId" = g."id"
      WHERE true
      ${whereSql}
      GROUP BY g."id", u."id"
      ORDER BY g."createdAt" DESC
      LIMIT 50
    `;
  }

  private present(group: GroupRow) {
    return {
      ...group,
      memberCount: Number(group.memberCount),
    };
  }

  private mediaUrl(value?: string) {
    const url = value?.trim();
    if (!url) {
      return null;
    }
    if (!url.startsWith('/media/')) {
      throw new UnprocessableEntityException('Group media must be uploaded media');
    }
    return url;
  }

  private async assertOwner(groupId: string, userId: string) {
    const [group] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Group" WHERE "id" = ${groupId} AND "ownerId" = ${userId} LIMIT 1
    `;
    if (!group) throw new UnprocessableEntityException('Group not found');
  }

  private async notify(userId: string, type: string, title: string, body: string, entityType: string, entityId: string) {
    await this.prisma.$executeRaw`
      INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "entityType", "entityId")
      VALUES (${randomUUID()}, ${userId}, ${type}, ${title}, ${body}, ${entityType}, ${entityId})
    `;
    this.realtime.publishTo(userId, 'notifications_updated', {});
  }

  private userId(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
