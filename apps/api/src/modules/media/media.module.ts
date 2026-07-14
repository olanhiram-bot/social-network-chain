import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MediaController } from './media.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [MediaController],
})
export class MediaModule {}
