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
    this.userId(accessToken);
    return this.prisma.$queryRaw<ProductRow[]>`
      SELECT p."id", p."title", p."description", p."category", p."priceCents", p."location", p."imageUrl", p."createdAt",
             u."id" AS "sellerId", u."name" AS "sellerName", u."avatar" AS "sellerAvatar"
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
      SELECT p."id", p."title", p."description", p."category", p."priceCents", p."location", p."imageUrl", p."createdAt",
             u."id" AS "sellerId", u."name" AS "sellerName", u."avatar" AS "sellerAvatar"
      FROM "MarketplaceProduct" p
      JOIN "User" u ON u."id" = p."sellerId"
      WHERE p."id" = ${id}
    `;
    return product;
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
