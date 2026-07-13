CREATE TABLE "ChainAnchor" (
  "id" TEXT NOT NULL,
  "signedActionId" TEXT NOT NULL,
  "chainId" INTEGER,
  "registryAddress" TEXT,
  "transactionHash" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChainAnchor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChainAnchor_signedActionId_key" UNIQUE ("signedActionId"),
  CONSTRAINT "ChainAnchor_signedActionId_fkey" FOREIGN KEY ("signedActionId") REFERENCES "SignedAction"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChainAnchor_status_createdAt_idx" ON "ChainAnchor"("status", "createdAt");
