import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnchainActionsService } from './onchain-actions.service';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallet')
export class WalletsController {
  constructor(
    private walletsService: WalletsService,
    private onchainActions: OnchainActionsService,
    private jwt: JwtService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user wallet' })
  me(@Headers('authorization') authorization?: string) {
    return this.walletsService.getByUserId(this.userId(authorization));
  }

  @Get('anchors')
  @ApiOperation({ summary: 'List the current user signed actions and their on-chain anchor status' })
  anchors(@Headers('authorization') authorization?: string) {
    return this.onchainActions.listForActor(this.userId(authorization));
  }

  private userId(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      return this.jwt.verify<{ sub: string }>(token).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
