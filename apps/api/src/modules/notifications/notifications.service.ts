import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type AccessPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  async list(accessToken: string) {
    const userId = this.userId(accessToken);
    const notifications = await this.prisma.$queryRaw<
      {
        id: string;
        type: string;
        title: string;
        body: string;
        entityType: string | null;
        entityId: string | null;
        readAt: Date | null;
        createdAt: Date;
      }[]
    >`
      SELECT "id", "type", "title", "body", "entityType", "entityId", "readAt", "createdAt"
      FROM "Notification"
      WHERE "userId" = ${userId}
      ORDER BY "createdAt" DESC
      LIMIT 40
    `;

    return {
      unreadCount: notifications.filter((notification) => !notification.readAt).length,
      notifications,
    };
  }

  async markRead(accessToken: string) {
    const userId = this.userId(accessToken);
    await this.prisma.$executeRaw`
      UPDATE "Notification" SET "readAt" = NOW()
      WHERE "userId" = ${userId} AND "readAt" IS NULL
    `;
    this.realtime.publishTo(userId, 'notifications_updated', {});
    return { ok: true };
  }

  private userId(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
