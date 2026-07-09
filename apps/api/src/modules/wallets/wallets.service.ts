import { Injectable } from '@nestjs/common';
import { Wallet as EvmWallet } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptSecret } from './crypto-box';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async createForUser(userId: string) {
    const custodyWallet = EvmWallet.createRandom();
    const appSigner = EvmWallet.createRandom();

    const wallet = await this.prisma.wallet.create({
      data: {
        userId,
        address: custodyWallet.address,
        encryptedPrivateKey: encryptSecret(custodyWallet.privateKey),
        appSigners: {
          create: {
            address: appSigner.address,
            encryptedPrivateKey: encryptSecret(appSigner.privateKey),
            label: 'Social app signer',
          },
        },
      },
      include: { appSigners: true },
    });

    return this.publicWallet(wallet);
  }

  async getByUserId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { appSigners: true },
    });

    return wallet ? this.publicWallet(wallet) : null;
  }

  private publicWallet(wallet: {
    id: string;
    address: string;
    appSigners: {
      id: string;
      address: string;
      label: string;
      active: boolean;
    }[];
  }) {
    return {
      id: wallet.id,
      address: wallet.address,
      appSigners: wallet.appSigners.map((signer) => ({
        id: signer.id,
        address: signer.address,
        label: signer.label,
        active: signer.active,
      })),
    };
  }
}
