CREATE TABLE "SocialEvent" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "pageId" TEXT,
  "groupId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "location" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialEvent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SocialEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SocialEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SocialEventRsvp" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialEventRsvp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SocialEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SocialEventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SocialEventInvite" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialEventInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SocialEventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SocialEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SocialEventInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SocialEventInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SocialEvent_hostId_idx" ON "SocialEvent"("hostId");
CREATE INDEX "SocialEvent_pageId_idx" ON "SocialEvent"("pageId");
CREATE INDEX "SocialEvent_groupId_idx" ON "SocialEvent"("groupId");
CREATE INDEX "SocialEvent_startsAt_idx" ON "SocialEvent"("startsAt");
CREATE UNIQUE INDEX "SocialEventRsvp_eventId_userId_key" ON "SocialEventRsvp"("eventId", "userId");
CREATE INDEX "SocialEventRsvp_userId_idx" ON "SocialEventRsvp"("userId");
CREATE INDEX "SocialEventRsvp_status_idx" ON "SocialEventRsvp"("status");
CREATE UNIQUE INDEX "SocialEventInvite_eventId_inviteeId_key" ON "SocialEventInvite"("eventId", "inviteeId");
CREATE INDEX "SocialEventInvite_inviteeId_idx" ON "SocialEventInvite"("inviteeId");
