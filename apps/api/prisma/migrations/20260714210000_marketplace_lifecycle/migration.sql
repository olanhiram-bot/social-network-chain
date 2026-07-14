ALTER TABLE "MarketplaceProduct" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE "MarketplaceSaved" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceSaved_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceSaved_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MarketplaceSaved_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MarketplaceSaved_productId_userId_key" ON "MarketplaceSaved"("productId", "userId");
CREATE INDEX "MarketplaceSaved_userId_createdAt_idx" ON "MarketplaceSaved"("userId", "createdAt");
CREATE INDEX "MarketplaceProduct_status_createdAt_idx" ON "MarketplaceProduct"("status", "createdAt");
