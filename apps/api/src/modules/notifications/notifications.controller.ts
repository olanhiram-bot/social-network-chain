import { Controller, Get, Headers, Patch, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my notifications' })
  list(@Headers('authorization') authorization: string | undefined) {
    return this.notificationsService.list(this.bearer(authorization));
  }

  @Patch('read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark my notifications as read' })
  read(@Headers('authorization') authorization: string | undefined) {
    return this.notificationsService.markRead(this.bearer(authorization));
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }
}
