import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { hasPersistentMediaStorage, localMediaPath, remoteMediaUrl, storeMedia } from './media-storage';

@ApiTags('media')
@Controller('media')
export class MediaController {
  @Post()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload photo or video media' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async upload(@Headers('authorization') authorization: string | undefined, @UploadedFile() file: any) {
    this.bearer(authorization);

    if (process.env.NODE_ENV === 'production' && !hasPersistentMediaStorage()) {
      throw new ServiceUnavailableException('Media storage is not configured');
    }

    if (!file?.buffer || !['image/', 'video/'].some((type) => file.mimetype.startsWith(type))) {
      throw new UnprocessableEntityException('Only image and video uploads are supported');
    }

    const extension = file.originalname?.split('.').pop() || 'bin';
    const filename = `${randomUUID()}.${extension}`;

    return {
      url: await storeMedia(filename, file.buffer, file.mimetype),
      mediaType: file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE',
    };
  }

  @Get(':filename')
  file(@Param('filename') filename: string, @Res() response: Response) {
    const remote = remoteMediaUrl(filename);
    if (remote) {
      return response.redirect(remote);
    }

    return response.sendFile(localMediaPath(filename));
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }
}
