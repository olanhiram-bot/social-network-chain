import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { LivesService } from './lives.service';

class StartLiveDto {
  @ApiProperty({ example: 'Probando live desde Nexo' })
  title: string;
}

class EndLiveDto {
  @ApiProperty({ example: '/media/live.webm', required: false })
  recordingUrl?: string;
}

class UpdateLiveDto {
  @ApiProperty({ example: 'Titulo editado' })
  title: string;
}

class LiveMessageDto {
  @ApiProperty({ example: 'Excelente live' })
  content: string;
}

@ApiTags('lives')
@Controller('lives')
export class LivesController {
  constructor(private livesService: LivesService) {}

  @Get()
  @ApiOperation({ summary: 'List active lives' })
  list() {
    return this.livesService.list();
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my live sessions' })
  mine(@Headers('authorization') authorization: string | undefined) {
    return this.livesService.mine(this.bearer(authorization));
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a live session' })
  start(@Headers('authorization') authorization: string | undefined, @Body() body: StartLiveDto) {
    return this.livesService.start(this.bearer(authorization), body.title);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List live chat messages' })
  messages(@Param('id') id: string) {
    return this.livesService.messages(id);
  }

  @Post(':id/messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a live chat message' })
  message(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: LiveMessageDto,
  ) {
    return this.livesService.message(this.bearer(authorization), id, body.content);
  }

  @Patch(':id/end')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End a live session' })
  end(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: EndLiveDto,
  ) {
    return this.livesService.end(this.bearer(authorization), id, body.recordingUrl);
  }

  @Patch(':id/frame')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Update the current live preview frame' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 1024 * 1024 } }))
  frame(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string },
  ) {
    return this.livesService.uploadFrame(this.bearer(authorization), id, file);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit my live title' })
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateLiveDto,
  ) {
    return this.livesService.update(this.bearer(authorization), id, body.title);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my live' })
  delete(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.livesService.delete(this.bearer(authorization), id);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }
}
