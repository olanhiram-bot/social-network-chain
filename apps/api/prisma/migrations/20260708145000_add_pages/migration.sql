CREATE TABLE "Page" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "avatar" TEXT,
  "cover" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Page_ownerId_idx" ON "Page"("ownerId");
CREATE INDEX "Page_name_idx" ON "Page"("name");
CREATE INDEX "Page_createdAt_idx" ON "Page"("createdAt");

ALTER TABLE "Page"
  ADD CONSTRAINT "Page_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
