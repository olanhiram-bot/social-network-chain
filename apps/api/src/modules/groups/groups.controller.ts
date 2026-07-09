import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';

class GroupDto {
  @ApiProperty({ example: 'Comunidad Nexo' })
  name: string;

  @ApiProperty({ example: 'Un grupo para compartir ideas.', required: false })
  description?: string;

  @ApiProperty({ example: 'PUBLIC', enum: ['PUBLIC', 'PRIVATE'], required: false })
  privacy?: string;

  @ApiProperty({ example: '/media/cover.png', required: false })
  cover?: string;
}

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List groups' })
  list(@Headers('authorization') authorization: string | undefined) {
    return this.groupsService.list(this.bearer(authorization));
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my groups' })
  mine(@Headers('authorization') authorization: string | undefined) {
    return this.groupsService.mine(this.bearer(authorization));
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a group' })
  create(@Headers('authorization') authorization: string | undefined, @Body() body: GroupDto) {
    return this.groupsService.create(this.bearer(authorization), body);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a group' })
  one(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.groupsService.one(this.bearer(authorization), id);
  }

  @Post(':id/join')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a group' })
  join(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.groupsService.join(this.bearer(authorization), id);
  }

  @Delete(':id/leave')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a group' })
  leave(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.groupsService.leave(this.bearer(authorization), id);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return token;
  }
}
