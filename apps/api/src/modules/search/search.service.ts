import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

type AccessPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async search(accessToken: string, query: string) {
    this.userId(accessToken);
    const q = query.trim();
    if (q.length < 2) {
      return { query: q, people: [], pages: [], groups: [], posts: [], lives: [] };
    }

    const term = `%${q}%`;
    const [people, pages, groups, posts, lives] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT "id", "name", "avatar", "bio"
        FROM "User"
        WHERE "name" ILIKE ${term} OR "email" ILIKE ${term}
        ORDER BY "name" ASC
        LIMIT 8
      `,
      this.prisma.$queryRaw`
        SELECT "id", "name", "category", "description", "avatar", "cover"
        FROM "Page"
        WHERE "name" ILIKE ${term} OR "category" ILIKE ${term} OR COALESCE("description", '') ILIKE ${term}
        ORDER BY "createdAt" DESC
        LIMIT 8
      `,
      this.prisma.$queryRaw`
        SELECT "id", "name", "description", "privacy", "cover"
        FROM "Group"
        WHERE "name" ILIKE ${term} OR COALESCE("description", '') ILIKE ${term}
        ORDER BY "createdAt" DESC
        LIMIT 8
      `,
      this.prisma.$queryRaw`
        SELECT p."id", p."content", p."mediaUrl", p."mediaType", p."createdAt",
               u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
        FROM "Post" p
        JOIN "User" u ON u."id" = p."authorId"
        WHERE p."content" ILIKE ${term}
        ORDER BY p."createdAt" DESC
        LIMIT 8
      `,
      this.prisma.$queryRaw`
        SELECT l."id", l."title", l."status", l."startedAt", l."latestFrameUrl", l."recordingUrl",
               u."id" AS "hostId", u."name" AS "hostName", u."avatar" AS "hostAvatar"
        FROM "LiveSession" l
        JOIN "User" u ON u."id" = l."hostId"
        WHERE l."title" ILIKE ${term} OR u."name" ILIKE ${term}
        ORDER BY l."startedAt" DESC
        LIMIT 8
      `,
    ]);

    return { query: q, people, pages, groups, posts, lives };
  }

  private userId(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
