import { Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SigningService } from '../wallets/signing.service';

type AccessPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private signing: SigningService,
    private realtime: RealtimeService,
  ) {}

  async conversations(accessToken: string) {
    const userId = this.userId(accessToken);
    return this.prisma.$queryRaw`
      SELECT c."id", c."updatedAt",
             u."id" AS "peerId", u."name" AS "peerName", u."avatar" AS "peerAvatar",
             lm."content" AS "lastMessage", lm."createdAt" AS "lastMessageAt"
      FROM "Conversation" c
      JOIN "ConversationParticipant" me ON me."conversationId" = c."id" AND me."userId" = ${userId}
      JOIN "ConversationParticipant" other ON other."conversationId" = c."id" AND other."userId" <> ${userId}
      JOIN "User" u ON u."id" = other."userId"
      LEFT JOIN LATERAL (
        SELECT "content", "createdAt" FROM "DirectMessage"
        WHERE "conversationId" = c."id"
        ORDER BY "createdAt" DESC
        LIMIT 1
      ) lm ON true
      ORDER BY c."updatedAt" DESC
      LIMIT 50
    `;
  }

  async start(accessToken: string, peerId: string) {
    const userId = this.userId(accessToken);
    if (userId === peerId) {
      throw new UnprocessableEntityException('Cannot message yourself');
    }

    const peer = await this.prisma.user.findUnique({ where: { id: peerId } });
    if (!peer) {
      throw new NotFoundException('User not found');
    }

    const [existing] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c."id"
      FROM "Conversation" c
      JOIN "ConversationParticipant" a ON a."conversationId" = c."id" AND a."userId" = ${userId}
      JOIN "ConversationParticipant" b ON b."conversationId" = c."id" AND b."userId" = ${peerId}
      LIMIT 1
    `;

    if (existing) {
      return { id: existing.id };
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Conversation" ("id", "updatedAt") VALUES (${id}, NOW())
    `;
    await this.prisma.$executeRaw`
      INSERT INTO "ConversationParticipant" ("id", "conversationId", "userId")
      VALUES (${randomUUID()}, ${id}, ${userId}), (${randomUUID()}, ${id}, ${peerId})
    `;
    return { id };
  }

  async messages(accessToken: string, conversationId: string) {
    const userId = this.userId(accessToken);
    await this.assertParticipant(conversationId, userId);

    return this.prisma.$queryRaw`
      SELECT m."id", m."conversationId", m."content", m."signerAddress", m."messageHash", m."signature", m."createdAt",
             u."id" AS "senderId", u."name" AS "senderName", u."avatar" AS "senderAvatar"
      FROM "DirectMessage" m
      JOIN "User" u ON u."id" = m."senderId"
      WHERE m."conversationId" = ${conversationId}
      ORDER BY m."createdAt" ASC
      LIMIT 300
    `;
  }

  async send(accessToken: string, conversationId: string, content: string) {
    const userId = this.userId(accessToken);
    const clean = content.trim();
    if (!clean) {
      throw new UnprocessableEntityException('Message content is required');
    }

    await this.assertParticipant(conversationId, userId);
    const signed = await this.signing.signAction(userId, 'SEND_MESSAGE', 'Conversation', conversationId, {
      content: clean,
    });
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "DirectMessage" ("id", "conversationId", "senderId", "content", "signerAddress", "messageHash", "signature")
      VALUES (${id}, ${conversationId}, ${userId}, ${clean}, ${signed.signerAddress}, ${signed.messageHash}, ${signed.signature})
    `;
    await this.prisma.$executeRaw`
      UPDATE "Conversation" SET "updatedAt" = NOW() WHERE "id" = ${conversationId}
    `;
    await this.notifyPeers(conversationId, userId);
    this.realtime.publishTo(userId, 'messages_updated', { conversationId });
    return { id, content: clean, ...signed };
  }

  private async notifyPeers(conversationId: string, senderId: string) {
    const peers = await this.prisma.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "ConversationParticipant"
      WHERE "conversationId" = ${conversationId} AND "userId" <> ${senderId}
    `;
    await Promise.all(peers.map((peer) => this.prisma.$executeRaw`
      INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "entityType", "entityId")
      VALUES (${randomUUID()}, ${peer.userId}, 'DIRECT_MESSAGE', 'Nuevo mensaje', 'Tienes un mensaje nuevo.', 'Conversation', ${conversationId})
    `.then(() => {
      this.realtime.publishTo(peer.userId, 'messages_updated', { conversationId });
      this.realtime.publishTo(peer.userId, 'notifications_updated', {});
    })));
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const [participant] = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "ConversationParticipant"
      WHERE "conversationId" = ${conversationId} AND "userId" = ${userId}
      LIMIT 1
    `;
    if (!participant) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private userId(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
