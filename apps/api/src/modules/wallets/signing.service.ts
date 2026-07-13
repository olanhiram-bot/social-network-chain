import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { hashMessage, verifyMessage, Wallet as EvmWallet } from 'ethers';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret } from './crypto-box';
import { OnchainActionsService } from './onchain-actions.service';

@Injectable()
export class SigningService {
  constructor(
    private prisma: PrismaService,
    private onchainActions: OnchainActionsService,
  ) {}

  async signAction(
    actorId: string,
    actionType: string,
    resourceType: string,
    resourceId: string | null,
    payload: Record<string, unknown>,
  ) {
    const signer = await this.prisma.appSigner.findFirst({
      where: { active: true, wallet: { userId: actorId } },
    });

    if (!signer) {
      throw new UnprocessableEntityException('Active app signer is required');
    }

    const message = JSON.stringify({
      actorId,
      actionType,
      resourceType,
      resourceId,
      payload,
    });
    const signature = await new EvmWallet(
      decryptSecret(signer.encryptedPrivateKey),
    ).signMessage(message);
    const recovered = verifyMessage(message, signature);

    if (recovered.toLowerCase() !== signer.address.toLowerCase()) {
      throw new UnprocessableEntityException('Invalid app signer signature');
    }

    const signed = {
      signerAddress: signer.address,
      messageHash: hashMessage(message),
      signature,
    };

    const actionId = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "SignedAction" (
        "id", "actorId", "actionType", "resourceType", "resourceId", "payload",
        "signerAddress", "messageHash", "signature"
      )
      VALUES (
        ${actionId}, ${actorId}, ${actionType}, ${resourceType}, ${resourceId},
        ${JSON.stringify(payload)}::jsonb, ${signed.signerAddress}, ${signed.messageHash},
        ${signed.signature}
      )
    `;

    await this.onchainActions.createPending(actionId);
    void this.onchainActions.queue({
      actionId,
      actionType,
      messageHash: signed.messageHash,
      privateKey: decryptSecret(signer.encryptedPrivateKey),
      resourceId,
      resourceType,
    });

    return { ...signed, actionId };
  }
}
