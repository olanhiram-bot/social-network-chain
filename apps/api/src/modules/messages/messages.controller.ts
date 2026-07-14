import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';

class StartConversationDto {
  @ApiProperty({ example: 'user-id' })
  peerId: string;
}

class SendMessageDto {
  @ApiProperty({ example: 'Hola', required: false })
  content?: string;

  @ApiProperty({ example: '/media/message.png', required: false })
  mediaUrl?: string;

  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'VIDEO'], required: false })
  mediaType?: string;
}

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('conversations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my conversations' })
  conversations(@Headers('authorization') authorization: string | undefined) {
    return this.messagesService.conversations(this.bearer(authorization));
  }

  @Post('conversations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start or get a direct conversation' })
  start(@Headers('authorization') authorization: string | undefined, @Body() body: StartConversationDto) {
    return this.messagesService.start(this.bearer(authorization), body.peerId);
  }

  @Get('conversations/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List conversation messages' })
  messages(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.messagesService.messages(this.bearer(authorization), id);
  }

  @Post('conversations/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a signed direct message' })
  send(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    return this.messagesService.send(this.bearer(authorization), id, body);
  }

  @Post('conversations/:id/typing')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Notify the other participant that I am typing' })
  typing(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.messagesService.typing(this.bearer(authorization), id);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return token;
  }
}
