import {
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SigningService } from '../wallets/signing.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type MediaType = 'IMAGE' | 'VIDEO' | 'STREAM';
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private signing: SigningService,
  ) {}

  async list() {
    const now = new Date();
    return this.prisma.$queryRaw`
      SELECT s."id", s."caption", s."mediaUrl", s."mediaType", s."createdAt",
             s."expiresAt", s."signerAddress", s."messageHash", s."signature",
             u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
      FROM "Story" s
      JOIN "User" u ON u."id" = s."authorId"
      WHERE s."expiresAt" > ${now}
      ORDER BY s."createdAt" DESC
      LIMIT 50
    `;
  }

  async create(
    accessToken: string,
    mediaUrl: string,
    mediaType: MediaType,
    caption?: string,
  ) {
    const payload = this.verifyAccessToken(accessToken);
    const url = mediaUrl.trim();
    const cleanCaption = caption?.trim() || null;

    if (!['IMAGE', 'VIDEO', 'STREAM'].includes(mediaType)) {
      throw new UnprocessableEntityException('Invalid story media type');
    }

    if (!this.validMediaUrl(url)) {
      throw new UnprocessableEntityException('Story mediaUrl must be a valid URL');
    }

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + STORY_TTL_MS);
    const signed = await this.signing.signAction(
      payload.sub,
      'CREATE_STORY',
      'Story',
      id,
      { mediaUrl: url, mediaType, caption: cleanCaption, expiresAt: expiresAt.toISOString() },
    );

    await this.prisma.$executeRaw`
      INSERT INTO "Story" (
        "id", "authorId", "caption", "mediaUrl", "mediaType", "signerAddress",
        "messageHash", "signature", "expiresAt", "updatedAt"
      )
      VALUES (
        ${id}, ${payload.sub}, ${cleanCaption}, ${url}, ${mediaType}::"MediaType",
        ${signed.signerAddress}, ${signed.messageHash}, ${signed.signature},
        ${expiresAt}, NOW()
      )
    `;

    const [story] = await this.prisma.$queryRaw<
      {
        id: string;
        caption: string | null;
        mediaUrl: string;
        mediaType: MediaType;
        createdAt: Date;
        expiresAt: Date;
        signerAddress: string;
        messageHash: string;
        signature: string;
        authorId: string;
        authorName: string;
        authorAvatar: string | null;
      }[]
    >`
      SELECT s."id", s."caption", s."mediaUrl", s."mediaType", s."createdAt",
             s."expiresAt", s."signerAddress", s."messageHash", s."signature",
             u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
      FROM "Story" s
      JOIN "User" u ON u."id" = s."authorId"
      WHERE s."id" = ${id}
    `;

    return story;
  }

  async update(accessToken: string, id: string, caption?: string | null) {
    const payload = this.verifyAccessToken(accessToken);
    const [story] = await this.prisma.$queryRaw<{ id: string; authorId: string }[]>`
      SELECT "id", "authorId" FROM "Story" WHERE "id" = ${id} LIMIT 1
    `;

    if (!story || story.authorId !== payload.sub) {
      throw new UnprocessableEntityException('Story not found');
    }

    const cleanCaption = caption?.trim() || null;
    await this.signing.signAction(payload.sub, 'EDIT_STORY', 'Story', id, { caption: cleanCaption });
    await this.prisma.$executeRaw`
      UPDATE "Story" SET "caption" = ${cleanCaption}, "updatedAt" = NOW() WHERE "id" = ${id}
    `;
    return { updated: true };
  }

  async delete(accessToken: string, id: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [story] = await this.prisma.$queryRaw<{ id: string; authorId: string }[]>`
      SELECT "id", "authorId" FROM "Story" WHERE "id" = ${id} LIMIT 1
    `;

    if (!story || story.authorId !== payload.sub) {
      throw new UnprocessableEntityException('Story not found');
    }

    await this.signing.signAction(payload.sub, 'DELETE_STORY', 'Story', id, {});
    await this.prisma.$executeRaw`
      DELETE FROM "Story" WHERE "id" = ${id}
    `;
    return { deleted: true };
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
