import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type PageRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  avatar: string | null;
  cover: string | null;
  createdAt: Date;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  followerCount: bigint;
  followedByMe: boolean;
};

@Injectable()
export class PagesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  list(accessToken?: string) {
    const viewerId = accessToken ? this.verifyAccessToken(accessToken).sub : null;

    if (!viewerId) {
      return this.prisma.$queryRaw<PageRow[]>`
        SELECT p."id", p."name", p."category", p."description", p."avatar", p."cover", p."createdAt",
               u."id" AS "ownerId", u."name" AS "ownerName", u."avatar" AS "ownerAvatar",
               COUNT(pf."id") AS "followerCount",
               false AS "followedByMe"
        FROM "Page" p
        JOIN "User" u ON u."id" = p."ownerId"
        LEFT JOIN "PageFollow" pf ON pf."pageId" = p."id"
        GROUP BY p."id", u."id"
        ORDER BY p."createdAt" DESC
        LIMIT 50
      `.then((pages) => pages.map((page) => this.present(page)));
    }

    return this.prisma.$queryRaw<PageRow[]>`
      SELECT p."id", p."name", p."category", p."description", p."avatar", p."cover", p."createdAt",
             u."id" AS "ownerId", u."name" AS "ownerName", u."avatar" AS "ownerAvatar",
             COUNT(pf."id") AS "followerCount",
             EXISTS (
               SELECT 1 FROM "PageFollow" vf WHERE vf."pageId" = p."id" AND vf."userId" = ${viewerId}
             ) AS "followedByMe"
      FROM "Page" p
      JOIN "User" u ON u."id" = p."ownerId"
      LEFT JOIN "PageFollow" pf ON pf."pageId" = p."id"
      GROUP BY p."id", u."id"
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `.then((pages) => pages.map((page) => this.present(page)));
  }

  mine(accessToken: string) {
    const payload = this.verifyAccessToken(accessToken);

    return this.prisma.$queryRaw<PageRow[]>`
      SELECT p."id", p."name", p."category", p."description", p."avatar", p."cover", p."createdAt",
             u."id" AS "ownerId", u."name" AS "ownerName", u."avatar" AS "ownerAvatar",
             COUNT(pf."id") AS "followerCount",
             EXISTS (
               SELECT 1 FROM "PageFollow" vf WHERE vf."pageId" = p."id" AND vf."userId" = ${payload.sub}
             ) AS "followedByMe"
      FROM "Page" p
      JOIN "User" u ON u."id" = p."ownerId"
      LEFT JOIN "PageFollow" pf ON pf."pageId" = p."id"
      WHERE p."ownerId" = ${payload.sub}
      GROUP BY p."id", u."id"
      ORDER BY p."createdAt" DESC
      LIMIT 50
    `.then((pages) => pages.map((page) => this.present(page)));
  }

  async create(accessToken: string, body: {
    name: string;
    category: string;
    description?: string;
    avatar?: string;
    cover?: string;
  }) {
    const payload = this.verifyAccessToken(accessToken);
    const data = this.clean(body);
    const id = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO "Page" ("id", "ownerId", "name", "category", "description", "avatar", "cover", "updatedAt")
      VALUES (${id}, ${payload.sub}, ${data.name}, ${data.category}, ${data.description}, ${data.avatar}, ${data.cover}, NOW())
    `;
    this.realtime.publish('pages_updated', { pageId: id });

    return this.findOne(id);
  }

  async findOne(id: string) {
    const [page] = await this.prisma.$queryRaw<PageRow[]>`
      SELECT p."id", p."name", p."category", p."description", p."avatar", p."cover", p."createdAt",
             u."id" AS "ownerId", u."name" AS "ownerName", u."avatar" AS "ownerAvatar",
             COUNT(pf."id") AS "followerCount",
             false AS "followedByMe"
      FROM "Page" p
      JOIN "User" u ON u."id" = p."ownerId"
      LEFT JOIN "PageFollow" pf ON pf."pageId" = p."id"
      WHERE p."id" = ${id}
      GROUP BY p."id", u."id"
      LIMIT 1
    `;

    if (!page) {
      throw new UnprocessableEntityException('Page not found');
    }

    return this.present(page);
  }

  async toggleFollow(accessToken: string, id: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [page] = await this.prisma.$queryRaw<{ id: string; ownerId: string }[]>`
      SELECT "id", "ownerId" FROM "Page" WHERE "id" = ${id} LIMIT 1
    `;

    if (!page) {
      throw new UnprocessableEntityException('Page not found');
    }

    if (page.ownerId === payload.sub) {
      throw new UnprocessableEntityException('You already manage this page');
    }

    const [existing] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "PageFollow"
      WHERE "pageId" = ${id} AND "userId" = ${payload.sub}
      LIMIT 1
    `;

    if (existing) {
      await this.prisma.$executeRaw`DELETE FROM "PageFollow" WHERE "id" = ${existing.id}`;
      this.realtime.publish('pages_updated', { pageId: id });
      return { followed: false };
    }

    await this.prisma.$executeRaw`
      INSERT INTO "PageFollow" ("id", "pageId", "userId")
      VALUES (${randomUUID()}, ${id}, ${payload.sub})
    `;
    await this.notify(page.ownerId, 'PAGE_FOLLOW', 'Nuevo seguidor', 'Alguien empezo a seguir tu pagina.', 'Page', id);
    this.realtime.publish('pages_updated', { pageId: id });
    return { followed: true };
  }

  async update(accessToken: string, id: string, body: {
    name: string;
    category: string;
    description?: string;
    avatar?: string;
    cover?: string;
  }) {
    const payload = this.verifyAccessToken(accessToken);
    await this.assertOwner(id, payload.sub);
    const data = this.clean(body);

    await this.prisma.$executeRaw`
      UPDATE "Page"
      SET "name" = ${data.name}, "category" = ${data.category}, "description" = ${data.description},
          "avatar" = ${data.avatar}, "cover" = ${data.cover}, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;
    this.realtime.publish('pages_updated', { pageId: id });

    return this.findOne(id);
  }

  async delete(accessToken: string, id: string) {
    const payload = this.verifyAccessToken(accessToken);
    await this.assertOwner(id, payload.sub);

    await this.prisma.$executeRaw`DELETE FROM "Page" WHERE "id" = ${id}`;
    this.realtime.publish('pages_updated', { pageId: id });
    return { deleted: true };
  }

  private clean(body: {
    name: string;
    category: string;
    description?: string;
    avatar?: string;
    cover?: string;
  }) {
    const name = body.name?.trim();
    const category = body.category?.trim();

    if (!name || !category) {
      throw new UnprocessableEntityException('Page name and category are required');
    }

    return {
      name,
      category,
      description: body.description?.trim() || null,
      avatar: this.mediaUrl(body.avatar),
      cover: this.mediaUrl(body.cover),
    };
  }

  private mediaUrl(value?: string) {
    const url = value?.trim();
    if (!url) {
      return null;
    }

    if (!url.startsWith('/media/')) {
      throw new UnprocessableEntityException('Page media must be uploaded media');
    }

    return url;
  }

  private present(page: PageRow) {
    return {
      ...page,
      followerCount: Number(page.followerCount),
    };
  }

  private async assertOwner(id: string, ownerId: string) {
    const [page] = await this.prisma.$queryRaw<{ id: string; ownerId: string }[]>`
      SELECT "id", "ownerId" FROM "Page" WHERE "id" = ${id} LIMIT 1
    `;

    if (!page || page.ownerId !== ownerId) {
      throw new UnprocessableEntityException('Page not found');
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

  private verifyAccessToken(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
