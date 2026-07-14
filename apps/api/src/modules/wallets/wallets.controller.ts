import {
  Controller,
  Body,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnchainActionsService } from './onchain-actions.service';
import { WalletsService } from './wallets.service';
import { BadgesService } from './badges.service';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallet')
export class WalletsController {
  constructor(
    private walletsService: WalletsService,
    private onchainActions: OnchainActionsService,
    private jwt: JwtService,
    private badges: BadgesService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user wallet' })
  me(@Headers('authorization') authorization?: string) {
    return this.walletsService.getByUserId(this.userId(authorization));
  }

  @Post('export')
  @ApiOperation({ summary: 'Export the custody wallet private key after password verification' })
  export(@Headers('authorization') authorization: string | undefined, @Body() body: { password: string }) {
    return this.walletsService.exportPrivateKey(this.userId(authorization), body.password);
  }

  @Get('anchors')
  @ApiOperation({ summary: 'List the current user signed actions and their on-chain anchor status' })
  anchors(@Headers('authorization') authorization?: string) {
    return this.onchainActions.listForActor(this.userId(authorization));
  }

  @Get('actions/:id')
  @ApiOperation({ summary: 'Get a public hash-only receipt for an anchored action' })
  async action(@Param('id') id: string) {
    const receipt = await this.onchainActions.publicReceipt(id);
    if (!receipt) throw new NotFoundException('Action receipt not found');
    return receipt;
  }

  @Post('badges')
  @ApiOperation({ summary: 'Grant or revoke a social badge (moderator only)' })
  updateBadge(@Headers('authorization') authorization: string | undefined, @Body() body: { socialId: string; badge: string; grant: boolean; uri?: string }) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');
    const email = this.jwt.verify<{ email: string }>(token).email;
    return this.badges.update(email, body.socialId, body.badge, body.grant === true, body.uri);
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
