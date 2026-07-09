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
    return this.groupQuery(userId, Prisma.sql`WHERE EXISTS (
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
    const groups = await this.groupQuery(userId, Prisma.sql`WHERE g."id" = ${id}`);
    const group = groups[0];
    if (!group) {
      throw new UnprocessableEntityException('Group not found');
    }
    return this.present(group);
  }

  async join(accessToken: string, id: string) {
    const userId = this.userId(accessToken);
    const [group] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Group" WHERE "id" = ${id} LIMIT 1
    `;
    if (!group) {
      throw new UnprocessableEntityException('Group not found');
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

  private groupQuery(userId: string, whereSql: Prisma.Sql) {
    return this.prisma.$queryRaw<GroupRow[]>`
      SELECT g."id", g."name", g."description", g."privacy", g."cover", g."createdAt",
             u."id" AS "ownerId", u."name" AS "ownerName", u."avatar" AS "ownerAvatar",
             COUNT(gm."id") AS "memberCount",
             EXISTS (
               SELECT 1 FROM "GroupMember" me WHERE me."groupId" = g."id" AND me."userId" = ${userId}
             ) AS "joinedByMe",
             (
               SELECT me."role" FROM "GroupMember" me WHERE me."groupId" = g."id" AND me."userId" = ${userId} LIMIT 1
             ) AS "myRole"
      FROM "Group" g
      JOIN "User" u ON u."id" = g."ownerId"
      LEFT JOIN "GroupMember" gm ON gm."groupId" = g."id"
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

  private userId(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
