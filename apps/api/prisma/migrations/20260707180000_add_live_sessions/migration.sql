CREATE TYPE "LiveSessionStatus" AS ENUM ('LIVE', 'ENDED');

CREATE TABLE "LiveSession" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'LIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "signerAddress" TEXT,
  "messageHash" TEXT,
  "signature" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LiveSession_hostId_idx" ON "LiveSession"("hostId");
CREATE INDEX "LiveSession_status_startedAt_idx" ON "LiveSession"("status", "startedAt");
