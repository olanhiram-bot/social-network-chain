CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'STREAM');

CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "caption" TEXT,
  "mediaUrl" TEXT NOT NULL,
  "mediaType" "MediaType" NOT NULL,
  "signerAddress" TEXT,
  "messageHash" TEXT,
  "signature" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Story_authorId_idx" ON "Story"("authorId");
CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");
