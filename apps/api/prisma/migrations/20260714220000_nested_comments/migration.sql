ALTER TABLE "PostComment" ADD COLUMN "parentId" TEXT;

ALTER TABLE "PostComment"
  ADD CONSTRAINT "PostComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "PostComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PostComment_parentId_createdAt_idx" ON "PostComment"("parentId", "createdAt");
