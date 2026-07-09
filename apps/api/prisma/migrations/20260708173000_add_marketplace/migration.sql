CREATE TABLE "MarketplaceProduct" (
  "id" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "location" TEXT NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceProduct_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MarketplaceProduct_sellerId_idx" ON "MarketplaceProduct"("sellerId");
CREATE INDEX "MarketplaceProduct_category_idx" ON "MarketplaceProduct"("category");
CREATE INDEX "MarketplaceProduct_createdAt_idx" ON "MarketplaceProduct"("createdAt");
