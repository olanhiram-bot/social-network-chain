import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { FriendsService } from './friends.service';

class FriendRequestDto {
  @ApiProperty()
  userId: string;
}

@ApiTags('friends')
@ApiBearerAuth()
@Controller('friends')
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get()
  @ApiOperation({ summary: 'List current user friends' })
  friends(@Headers('authorization') authorization?: string) {
    return this.friendsService.friends(this.bearer(authorization));
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'List people you may know' })
  suggestions(@Headers('authorization') authorization?: string) {
    return this.friendsService.suggestions(this.bearer(authorization));
  }

  @Get('requests')
  @ApiOperation({ summary: 'List incoming friend requests' })
  requests(@Headers('authorization') authorization?: string) {
    return this.friendsService.requests(this.bearer(authorization));
  }

  @Get('users/:id/profile')
  @ApiOperation({ summary: 'Get a public user profile' })
  profile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.friendsService.profile(this.bearer(authorization), id);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Send a friend request' })
  sendRequest(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: FriendRequestDto,
  ) {
    return this.friendsService.sendRequest(
      this.bearer(authorization),
      body.userId,
    );
  }

  @Patch('requests/:id/accept')
  @ApiOperation({ summary: 'Accept a friend request' })
  accept(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.friendsService.accept(this.bearer(authorization), id);
  }

  @Patch('requests/:id/reject')
  @ApiOperation({ summary: 'Reject a friend request' })
  reject(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.friendsService.reject(this.bearer(authorization), id);
  }

  @Post('users/:id/block')
  @ApiOperation({ summary: 'Block a user' })
  block(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.friendsService.block(this.bearer(authorization), id);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }
}
