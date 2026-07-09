import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';

class EventDto {
  @ApiProperty({ example: 'Meetup Nexo' })
  title: string;
  @ApiProperty({ example: 'Comunidad y networking.', required: false })
  description?: string;
  @ApiProperty({ example: 'Monterrey, NL' })
  location: string;
  @ApiProperty({ example: '2026-08-01T20:00:00.000Z' })
  startsAt: string;
  @ApiProperty({ example: '/media/event.png', required: false })
  imageUrl?: string;
  @ApiProperty({ example: 'page-id', required: false })
  pageId?: string;
  @ApiProperty({ example: 'group-id', required: false })
  groupId?: string;
}

class RsvpDto {
  @ApiProperty({ example: 'GOING', enum: ['GOING', 'INTERESTED'] })
  status: 'GOING' | 'INTERESTED';
}

class InviteDto {
  @ApiProperty({ example: ['user-id'] })
  userIds: string[];
}

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List events' })
  list(@Headers('authorization') authorization: string | undefined) {
    return this.eventsService.list(this.bearer(authorization));
  }

  @Post()
  @ApiOperation({ summary: 'Create event' })
  create(@Headers('authorization') authorization: string | undefined, @Body() body: EventDto) {
    return this.eventsService.create(this.bearer(authorization), body);
  }

  @Post(':id/rsvp')
  @ApiOperation({ summary: 'RSVP to event' })
  rsvp(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() body: RsvpDto) {
    return this.eventsService.rsvp(this.bearer(authorization), id, body.status);
  }

  @Post(':id/invites')
  @ApiOperation({ summary: 'Invite friends to event' })
  invite(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() body: InviteDto) {
    return this.eventsService.invite(this.bearer(authorization), id, body.userIds ?? []);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return token;
  }
}
