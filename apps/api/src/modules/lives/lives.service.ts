import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessToken } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { storeMedia } from '../media/media-storage';
import { SigningService } from '../wallets/signing.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type LiveChatMessageRow = {
  id: string;
  liveId: string;
  content: string;
  offsetMs: number;
  createdAt: Date;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
};

@Injectable()
export class LivesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private signing: SigningService,
  ) {}

  list() {
    return this.prisma.$queryRaw`
      SELECT l."id", l."title", l."status", l."startedAt", l."endedAt", l."recordingUrl", l."latestFrameUrl",
             l."signerAddress", l."messageHash", l."signature",
             u."id" AS "hostId", u."name" AS "hostName", u."avatar" AS "hostAvatar"
      FROM "LiveSession" l
      JOIN "User" u ON u."id" = l."hostId"
      WHERE l."status" = 'LIVE'
      ORDER BY l."startedAt" DESC
      LIMIT 20
    `;
  }

  mine(accessToken: string) {
    const payload = this.verifyAccessToken(accessToken);

    return this.prisma.$queryRaw`
      SELECT l."id", l."title", l."status", l."startedAt", l."endedAt", l."recordingUrl", l."latestFrameUrl",
             l."signerAddress", l."messageHash", l."signature",
             u."id" AS "hostId", u."name" AS "hostName", u."avatar" AS "hostAvatar"
      FROM "LiveSession" l
      JOIN "User" u ON u."id" = l."hostId"
      WHERE l."hostId" = ${payload.sub}
      ORDER BY l."startedAt" DESC
      LIMIT 50
    `;
  }

  async start(accessToken: string, title: string) {
    const payload = this.verifyAccessToken(accessToken);
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      throw new UnprocessableEntityException('Live title is required');
    }

    const id = randomUUID();
    const signed = await this.signing.signAction(payload.sub, 'START_LIVE', 'LiveSession', id, {
      title: cleanTitle,
    });

    await this.prisma.$executeRaw`
      INSERT INTO "LiveSession" (
        "id", "hostId", "title", "signerAddress", "messageHash", "signature", "updatedAt"
      )
      VALUES (
        ${id}, ${payload.sub}, ${cleanTitle}, ${signed.signerAddress},
        ${signed.messageHash}, ${signed.signature}, NOW()
      )
    `;

    const [live] = await this.prisma.$queryRaw<
      {
        id: string;
        title: string;
        status: string;
        startedAt: Date;
        endedAt: Date | null;
        recordingUrl: string | null;
        latestFrameUrl: string | null;
        signerAddress: string | null;
        messageHash: string | null;
        signature: string | null;
        hostId: string;
        hostName: string;
        hostAvatar: string | null;
      }[]
    >`
      SELECT l."id", l."title", l."status", l."startedAt", l."endedAt", l."recordingUrl", l."latestFrameUrl",
             l."signerAddress", l."messageHash", l."signature",
             u."id" AS "hostId", u."name" AS "hostName", u."avatar" AS "hostAvatar"
      FROM "LiveSession" l
      JOIN "User" u ON u."id" = l."hostId"
      WHERE l."id" = ${id}
    `;
    return live;
  }

  async end(accessToken: string, id: string, recordingUrl?: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [live] = await this.prisma.$queryRaw<{ id: string; hostId: string }[]>`
      SELECT "id", "hostId" FROM "LiveSession"
      WHERE "id" = ${id} AND "status" = 'LIVE'
      LIMIT 1
    `;

    if (!live || live.hostId !== payload.sub) {
      throw new UnprocessableEntityException('Live session not found');
    }

    await this.signing.signAction(payload.sub, 'END_LIVE', 'LiveSession', id, {});
    await this.prisma.$executeRaw`
      UPDATE "LiveSession"
      SET "status" = 'ENDED', "endedAt" = NOW(), "recordingUrl" = ${recordingUrl ?? null}, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;

    return { ended: true };
  }

  async token(accessToken: string, id: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [live] = await this.prisma.$queryRaw<
      { id: string; hostId: string; hostName: string; status: 'LIVE' | 'ENDED' }[]
    >`
      SELECT l."id", l."hostId", u."name" AS "hostName", l."status"
      FROM "LiveSession" l
      JOIN "User" u ON u."id" = l."hostId"
      WHERE l."id" = ${id}
      LIMIT 1
    `;

    if (!live || live.status !== 'LIVE') {
      throw new UnprocessableEntityException('Live session is not active');
    }

    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!url || !apiKey || !apiSecret) {
      throw new UnprocessableEntityException('Live streaming is not configured');
    }

    const canPublish = live.hostId === payload.sub;
    const roomName = `live-${live.id}`;
    const token = new AccessToken(apiKey, apiSecret, {
      identity: `${canPublish ? 'host' : 'viewer'}-${payload.sub}-${randomUUID()}`,
      name: canPublish ? live.hostName : payload.email,
      ttl: '15m',
    });
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish,
      canPublishData: canPublish,
      canSubscribe: true,
    });

    return { url, roomName, token: await token.toJwt(), canPublish };
  }

  async uploadFrame(accessToken: string, id: string, file: { buffer: Buffer; mimetype: string }) {
    const payload = this.verifyAccessToken(accessToken);

    if (!file?.buffer || !file.mimetype.startsWith('image/')) {
      throw new UnprocessableEntityException('Frame image is required');
    }

    const [live] = await this.prisma.$queryRaw<{ id: string; hostId: string }[]>`
      SELECT "id", "hostId" FROM "LiveSession"
      WHERE "id" = ${id} AND "status" = 'LIVE'
      LIMIT 1
    `;

    if (!live || live.hostId !== payload.sub) {
      throw new UnprocessableEntityException('Live session not found');
    }

    const filename = `live-frame-${id.replace(/[^a-zA-Z0-9-]/g, '')}.jpg`;
    const frameUrl = `${await storeMedia(filename, file.buffer, file.mimetype)}?t=${Date.now()}`;
    await this.prisma.$executeRaw`
      UPDATE "LiveSession" SET "latestFrameUrl" = ${frameUrl}, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;
    return { frameUrl };
  }

  messages(id: string) {
    return this.prisma.$queryRaw<LiveChatMessageRow[]>`
      SELECT m."id", m."liveId", m."content", m."offsetMs", m."createdAt",
             u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
      FROM "LiveChatMessage" m
      JOIN "User" u ON u."id" = m."authorId"
      WHERE m."liveId" = ${id}
      ORDER BY m."offsetMs" ASC, m."createdAt" ASC
      LIMIT 500
    `;
  }

  async message(accessToken: string, id: string, content: string) {
    const payload = this.verifyAccessToken(accessToken);
    const cleanContent = content.trim();

    if (!cleanContent) {
      throw new UnprocessableEntityException('Message content is required');
    }

    const [live] = await this.prisma.$queryRaw<
      { id: string; startedAt: Date; endedAt: Date | null }[]
    >`
      SELECT "id", "startedAt", "endedAt" FROM "LiveSession" WHERE "id" = ${id} LIMIT 1
    `;

    if (!live) {
      throw new UnprocessableEntityException('Live session not found');
    }

    if (live.endedAt) {
      throw new UnprocessableEntityException('Live session has ended');
    }

    const offsetMs = Math.max(0, Date.now() - live.startedAt.getTime());
    const messageId = randomUUID();
    await this.signing.signAction(payload.sub, 'COMMENT_LIVE', 'LiveSession', id, {
      content: cleanContent,
      offsetMs,
    });
    await this.prisma.$executeRaw`
      INSERT INTO "LiveChatMessage" ("id", "liveId", "authorId", "content", "offsetMs")
      VALUES (${messageId}, ${id}, ${payload.sub}, ${cleanContent}, ${offsetMs})
    `;

    const [message] = await this.prisma.$queryRaw<LiveChatMessageRow[]>`
      SELECT m."id", m."liveId", m."content", m."offsetMs", m."createdAt",
             u."id" AS "authorId", u."name" AS "authorName", u."avatar" AS "authorAvatar"
      FROM "LiveChatMessage" m
      JOIN "User" u ON u."id" = m."authorId"
      WHERE m."id" = ${messageId}
    `;
    return message;
  }

  async update(accessToken: string, id: string, title: string) {
    const payload = this.verifyAccessToken(accessToken);
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      throw new UnprocessableEntityException('Live title is required');
    }

    const [live] = await this.prisma.$queryRaw<{ id: string; hostId: string }[]>`
      SELECT "id", "hostId" FROM "LiveSession" WHERE "id" = ${id} LIMIT 1
    `;

    if (!live || live.hostId !== payload.sub) {
      throw new UnprocessableEntityException('Live session not found');
    }

    await this.signing.signAction(payload.sub, 'EDIT_LIVE', 'LiveSession', id, { title: cleanTitle });
    await this.prisma.$executeRaw`
      UPDATE "LiveSession" SET "title" = ${cleanTitle}, "updatedAt" = NOW() WHERE "id" = ${id}
    `;
    return { updated: true };
  }

  async delete(accessToken: string, id: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [live] = await this.prisma.$queryRaw<{ id: string; hostId: string }[]>`
      SELECT "id", "hostId" FROM "LiveSession" WHERE "id" = ${id} LIMIT 1
    `;

    if (!live || live.hostId !== payload.sub) {
      throw new UnprocessableEntityException('Live session not found');
    }

    await this.signing.signAction(payload.sub, 'DELETE_LIVE', 'LiveSession', id, {});
    await this.prisma.$executeRaw`
      DELETE FROM "LiveSession" WHERE "id" = ${id}
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
}
