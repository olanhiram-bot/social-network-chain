ALTER TABLE "Post" ADD COLUMN "pageId" TEXT;

CREATE TABLE "PageFollow" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PageFollow_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Post_pageId_idx" ON "Post"("pageId");
CREATE INDEX "PageFollow_userId_idx" ON "PageFollow"("userId");
CREATE UNIQUE INDEX "PageFollow_pageId_userId_key" ON "PageFollow"("pageId", "userId");

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "Page"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PageFollow"
  ADD CONSTRAINT "PageFollow_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "Page"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PageFollow"
  ADD CONSTRAINT "PageFollow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
