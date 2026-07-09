import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { LivesController } from './lives.controller';
import { LivesService } from './lives.service';

@Module({
  imports: [
    PrismaModule,
    WalletsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [LivesController],
  providers: [LivesService],
})
export class LivesModule {}
