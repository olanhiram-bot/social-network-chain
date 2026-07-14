import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletsController } from './wallets.controller';
import { OnchainActionsService } from './onchain-actions.service';
import { SigningService } from './signing.service';
import { WalletsService } from './wallets.service';
import { BadgesService } from './badges.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [WalletsController],
  providers: [WalletsService, SigningService, OnchainActionsService, BadgesService],
  exports: [WalletsService, SigningService],
})
export class WalletsModule {}
