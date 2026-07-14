import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type ProductRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priceCents: number;
  location: string;
  imageUrl: string | null;
  status: 'ACTIVE' | 'SOLD';
  savedByMe: boolean;
  createdAt: Date;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string | null;
};

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  list(accessToken: string) {
    const userId = this.userId(accessToken);
    return this.prisma.$queryRaw<ProductRow[]>`
      SELECT p."id", p."title", p."description", p."category", p."priceCents", p."location", p."imageUrl", p."status", p."createdAt",
             u."id" AS "sellerId", u."name" AS "sellerName", u."avatar" AS "sellerAvatar"
             , EXISTS (SELECT 1 FROM "MarketplaceSaved" s WHERE s."productId" = p."id" AND s."userId" = ${userId}) AS "savedByMe"
      FROM "MarketplaceProduct" p
      JOIN "User" u ON u."id" = p."sellerId"
      ORDER BY p."createdAt" DESC
      LIMIT 60
    `;
  }

  async create(accessToken: string, body: {
    title: string;
    category?: string;
    description?: string;
    priceCents: number;
    location: string;
    imageUrl?: string;
  }) {
    const sellerId = this.userId(accessToken);
    const title = body.title?.trim();
    const category = body.category?.trim() || 'General';
    const location = body.location?.trim();
    const priceCents = Number(body.priceCents);

    if (!title || !location || !Number.isInteger(priceCents) || priceCents < 0) {
      throw new UnprocessableEntityException('Product title, location and price are required');
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "MarketplaceProduct" ("id", "sellerId", "title", "description", "category", "priceCents", "location", "imageUrl", "updatedAt")
      VALUES (${id}, ${sellerId}, ${title}, ${body.description?.trim() || null}, ${category}, ${priceCents}, ${location}, ${this.mediaUrl(body.imageUrl)}, NOW())
    `;
    const [product] = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT p."id", p."title", p."description", p."category", p."priceCents", p."location", p."imageUrl", p."status", p."createdAt",
             u."id" AS "sellerId", u."name" AS "sellerName", u."avatar" AS "sellerAvatar"
             , false AS "savedByMe"
      FROM "MarketplaceProduct" p
      JOIN "User" u ON u."id" = p."sellerId"
      WHERE p."id" = ${id}
    `;
    return product;
  }

  async setStatus(accessToken: string, id: string, status: string) {
    const sellerId = this.userId(accessToken);
    const cleanStatus = status.toUpperCase();
    if (!['ACTIVE', 'SOLD'].includes(cleanStatus)) {
      throw new UnprocessableEntityException('Invalid product status');
    }
    const result = await this.prisma.$executeRaw`
      UPDATE "MarketplaceProduct" SET "status" = ${cleanStatus}, "updatedAt" = NOW()
      WHERE "id" = ${id} AND "sellerId" = ${sellerId}
    `;
    if (!result) throw new UnprocessableEntityException('Product not found');
    return { status: cleanStatus };
  }

  async remove(accessToken: string, id: string) {
    const sellerId = this.userId(accessToken);
    const result = await this.prisma.$executeRaw`
      DELETE FROM "MarketplaceProduct" WHERE "id" = ${id} AND "sellerId" = ${sellerId}
    `;
    if (!result) throw new UnprocessableEntityException('Product not found');
    return { deleted: true };
  }

  async toggleSave(accessToken: string, productId: string) {
    const userId = this.userId(accessToken);
    const [product] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "MarketplaceProduct" WHERE "id" = ${productId} LIMIT 1
    `;
    if (!product) throw new UnprocessableEntityException('Product not found');
    const [saved] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "MarketplaceSaved" WHERE "productId" = ${productId} AND "userId" = ${userId} LIMIT 1
    `;
    if (saved) {
      await this.prisma.$executeRaw`DELETE FROM "MarketplaceSaved" WHERE "id" = ${saved.id}`;
      return { saved: false };
    }
    await this.prisma.$executeRaw`
      INSERT INTO "MarketplaceSaved" ("id", "productId", "userId")
      VALUES (${randomUUID()}, ${productId}, ${userId})
    `;
    return { saved: true };
  }

  private mediaUrl(value?: string) {
    const url = value?.trim();
    if (!url) {
      return null;
    }
    if (!url.startsWith('/media/')) {
      throw new UnprocessableEntityException('Product image must be uploaded media');
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
