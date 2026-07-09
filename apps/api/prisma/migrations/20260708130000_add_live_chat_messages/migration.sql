CREATE TABLE "LiveChatMessage" (
  "id" TEXT NOT NULL,
  "liveId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "offsetMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LiveChatMessage_liveId_fkey" FOREIGN KEY ("liveId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LiveChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LiveChatMessage_liveId_offsetMs_idx" ON "LiveChatMessage"("liveId", "offsetMs");
CREATE INDEX "LiveChatMessage_authorId_idx" ON "LiveChatMessage"("authorId");
