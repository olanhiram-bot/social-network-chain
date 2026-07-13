ALTER TABLE "DirectMessage" ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "DirectMessage_conversationId_senderId_readAt_idx"
ON "DirectMessage"("conversationId", "senderId", "readAt");
