import { Injectable, Logger } from '@nestjs/common';
import { Contract, JsonRpcProvider, Wallet, isAddress } from 'ethers';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

const actionRegistryAbi = [
  'function recordAction(bytes32 actionHash, string actionType, string resourceType, string resourceId, string uri)',
] as const;

type ChainAnchorInput = {
  actionId: string;
  actionType: string;
  messageHash: string;
  privateKey: string;
  resourceId: string | null;
  resourceType: string;
};

@Injectable()
export class OnchainActionsService {
  private readonly logger = new Logger(OnchainActionsService.name);

  constructor(private prisma: PrismaService) {}

  async queue(input: ChainAnchorInput) {
    const rpcUrl = process.env.SOCIAL_ACTION_RPC_URL;
    const registryAddress = process.env.SOCIAL_ACTION_REGISTRY_ADDRESS;

    if (!rpcUrl || !registryAddress || !isAddress(registryAddress)) {
      await this.update(input.actionId, 'PENDING', 'Configure SOCIAL_ACTION_RPC_URL and SOCIAL_ACTION_REGISTRY_ADDRESS to anchor this action.');
      return;
    }

    try {
      const provider = new JsonRpcProvider(rpcUrl);
      const signer = new Wallet(input.privateKey, provider);
      const registry = new Contract(registryAddress, actionRegistryAbi, signer);
      const uri = process.env.SOCIAL_ACTION_PUBLIC_URL
        ? `${process.env.SOCIAL_ACTION_PUBLIC_URL.replace(/\/$/, '')}/wallet/actions/${input.actionId}`
        : `urn:social-network:action:${input.actionId}`;
      const transaction = await registry.recordAction(
        input.messageHash,
        input.actionType,
        input.resourceType,
        input.resourceId ?? '',
        uri,
      );
      const network = await provider.getNetwork();

      await this.prisma.$executeRaw`
        UPDATE "ChainAnchor"
        SET "chainId" = ${Number(network.chainId)}, "registryAddress" = ${registryAddress},
            "transactionHash" = ${transaction.hash}, "status" = 'SUBMITTED', "error" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "signedActionId" = ${input.actionId}
      `;

      await transaction.wait(1);
      await this.update(input.actionId, 'CONFIRMED');
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unable to submit on-chain action.';
      this.logger.warn(`Unable to anchor action ${input.actionId}: ${message}`);
      await this.update(input.actionId, 'FAILED', message);
    }
  }

  async createPending(actionId: string) {
    await this.prisma.$executeRaw`
      INSERT INTO "ChainAnchor" ("id", "signedActionId", "status")
      VALUES (${randomUUID()}, ${actionId}, 'PENDING')
    `;
  }

  async listForActor(actorId: string) {
    return this.prisma.$queryRaw`
      SELECT a."id" AS "actionId", a."actionType", a."resourceType", a."resourceId", a."messageHash", a."createdAt",
             c."chainId", c."registryAddress", c."transactionHash", c."status", c."error", c."updatedAt"
      FROM "SignedAction" a
      JOIN "ChainAnchor" c ON c."signedActionId" = a."id"
      WHERE a."actorId" = ${actorId}
      ORDER BY a."createdAt" DESC
      LIMIT 100
    `;
  }

  async publicReceipt(actionId: string) {
    const [receipt] = await this.prisma.$queryRaw<{
      actionId: string;
      actionType: string;
      resourceType: string;
      resourceId: string | null;
      messageHash: string;
      createdAt: Date;
      chainId: number | null;
      registryAddress: string | null;
      transactionHash: string | null;
      status: string;
      updatedAt: Date;
    }[]>`
      SELECT a."id" AS "actionId", a."actionType", a."resourceType", a."resourceId", a."messageHash", a."createdAt",
             c."chainId", c."registryAddress", c."transactionHash", c."status", c."updatedAt"
      FROM "SignedAction" a
      JOIN "ChainAnchor" c ON c."signedActionId" = a."id"
      WHERE a."id" = ${actionId}
      LIMIT 1
    `;
    return receipt ?? null;
  }

  private async update(actionId: string, status: string, error?: string) {
    await this.prisma.$executeRaw`
      UPDATE "ChainAnchor"
      SET "status" = ${status}, "error" = ${error ?? null}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "signedActionId" = ${actionId}
    `;
  }
}
