CREATE TABLE "GroupJoinRequest" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GroupJoinRequest_groupId_requesterId_key" ON "GroupJoinRequest"("groupId", "requesterId");
CREATE INDEX "GroupJoinRequest_groupId_status_idx" ON "GroupJoinRequest"("groupId", "status");
CREATE INDEX "GroupJoinRequest_requesterId_status_idx" ON "GroupJoinRequest"("requesterId", "status");

ALTER TABLE "GroupJoinRequest"
  ADD CONSTRAINT "GroupJoinRequest_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupJoinRequest"
  ADD CONSTRAINT "GroupJoinRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
