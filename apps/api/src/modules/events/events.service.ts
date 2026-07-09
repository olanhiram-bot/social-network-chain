import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

type AccessPayload = { sub: string; email: string };
type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  startsAt: Date;
  imageUrl: string | null;
  hostId: string;
  hostName: string;
  hostAvatar: string | null;
  pageId: string | null;
  pageName: string | null;
  groupId: string | null;
  groupName: string | null;
  goingCount: bigint;
  interestedCount: bigint;
  myStatus: string | null;
};

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  list(accessToken: string) {
    const userId = this.userId(accessToken);
    return this.query(userId);
  }

  async create(accessToken: string, body: {
    title: string;
    description?: string;
    location: string;
    startsAt: string;
    imageUrl?: string;
    pageId?: string;
    groupId?: string;
  }) {
    const userId = this.userId(accessToken);
    const title = body.title?.trim();
    const location = body.location?.trim();
    const startsAt = new Date(body.startsAt);
    const pageId = body.pageId?.trim() || null;
    const groupId = body.groupId?.trim() || null;

    if (!title || !location || Number.isNaN(startsAt.getTime())) {
      throw new UnprocessableEntityException('Event title, location and date are required');
    }
    if (pageId) {
      const [page] = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Page" WHERE "id" = ${pageId} AND "ownerId" = ${userId} LIMIT 1
      `;
      if (!page) throw new UnprocessableEntityException('Page not found');
    }
    if (groupId) {
      const [member] = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "GroupMember" WHERE "groupId" = ${groupId} AND "userId" = ${userId} LIMIT 1
      `;
      if (!member) throw new UnprocessableEntityException('Group not found');
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "SocialEvent" ("id", "hostId", "pageId", "groupId", "title", "description", "location", "startsAt", "imageUrl", "updatedAt")
      VALUES (${id}, ${userId}, ${pageId}, ${groupId}, ${title}, ${body.description?.trim() || null}, ${location}, ${startsAt}, ${this.mediaUrl(body.imageUrl)}, NOW())
    `;
    await this.rsvp(accessToken, id, 'GOING');
    this.realtime.publish('events_updated', { eventId: id });
    return (await this.query(userId)).find((event) => event.id === id);
  }

  async rsvp(accessToken: string, eventId: string, status: 'GOING' | 'INTERESTED') {
    const userId = this.userId(accessToken);
    if (!['GOING', 'INTERESTED'].includes(status)) {
      throw new UnprocessableEntityException('Invalid RSVP status');
    }
    await this.assertEvent(eventId);
    await this.prisma.$executeRaw`
      INSERT INTO "SocialEventRsvp" ("id", "eventId", "userId", "status", "updatedAt")
      VALUES (${randomUUID()}, ${eventId}, ${userId}, ${status}, NOW())
      ON CONFLICT ("eventId", "userId") DO UPDATE SET "status" = ${status}, "updatedAt" = NOW()
    `;
    this.realtime.publish('events_updated', { eventId });
    return { status };
  }

  async invite(accessToken: string, eventId: string, userIds: string[]) {
    const inviterId = this.userId(accessToken);
    const event = await this.assertEvent(eventId);
    const uniqueIds = [...new Set(userIds)].filter((id) => id && id !== inviterId).slice(0, 50);
    await Promise.all(uniqueIds.map(async (inviteeId) => {
      await this.prisma.$executeRaw`
        INSERT INTO "SocialEventInvite" ("id", "eventId", "inviterId", "inviteeId")
        VALUES (${randomUUID()}, ${eventId}, ${inviterId}, ${inviteeId})
        ON CONFLICT ("eventId", "inviteeId") DO NOTHING
      `;
      await this.prisma.$executeRaw`
        INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "entityType", "entityId")
        VALUES (${randomUUID()}, ${inviteeId}, 'EVENT_INVITE', 'Invitacion a evento', ${`Te invitaron a ${event.title}.`}, 'Event', ${eventId})
      `;
      this.realtime.publishTo(inviteeId, 'notifications_updated', {});
    }));
    return { invited: uniqueIds.length };
  }

  private async query(userId: string) {
    const rows = await this.prisma.$queryRaw<EventRow[]>`
      SELECT e."id", e."title", e."description", e."location", e."startsAt", e."imageUrl",
             u."id" AS "hostId", u."name" AS "hostName", u."avatar" AS "hostAvatar",
             p."id" AS "pageId", p."name" AS "pageName",
             g."id" AS "groupId", g."name" AS "groupName",
             COUNT(r1."id") FILTER (WHERE r1."status" = 'GOING') AS "goingCount",
             COUNT(r1."id") FILTER (WHERE r1."status" = 'INTERESTED') AS "interestedCount",
             (SELECT r2."status" FROM "SocialEventRsvp" r2 WHERE r2."eventId" = e."id" AND r2."userId" = ${userId} LIMIT 1) AS "myStatus"
      FROM "SocialEvent" e
      JOIN "User" u ON u."id" = e."hostId"
      LEFT JOIN "Page" p ON p."id" = e."pageId"
      LEFT JOIN "Group" g ON g."id" = e."groupId"
      LEFT JOIN "SocialEventRsvp" r1 ON r1."eventId" = e."id"
      GROUP BY e."id", u."id", p."id", g."id"
      ORDER BY e."startsAt" ASC
      LIMIT 80
    `;
    return rows.map((event) => ({
      ...event,
      goingCount: Number(event.goingCount),
      interestedCount: Number(event.interestedCount),
    }));
  }

  private async assertEvent(eventId: string) {
    const [event] = await this.prisma.$queryRaw<{ id: string; title: string }[]>`
      SELECT "id", "title" FROM "SocialEvent" WHERE "id" = ${eventId} LIMIT 1
    `;
    if (!event) throw new UnprocessableEntityException('Event not found');
    return event;
  }

  private mediaUrl(value?: string) {
    const url = value?.trim();
    if (!url) return null;
    if (!url.startsWith('/media/')) throw new UnprocessableEntityException('Event image must be uploaded media');
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
