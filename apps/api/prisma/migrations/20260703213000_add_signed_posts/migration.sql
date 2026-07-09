-- AlterTable
ALTER TABLE "Post" ADD COLUMN "signerAddress" TEXT,
ADD COLUMN "messageHash" TEXT,
ADD COLUMN "signature" TEXT;

-- CreateIndex
CREATE INDEX "Post_signerAddress_idx" ON "Post"("signerAddress");
