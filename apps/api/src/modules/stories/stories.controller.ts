import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { StoriesService } from './stories.service';

class CreateStoryDto {
  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'VIDEO', 'STREAM'] })
  mediaType: 'IMAGE' | 'VIDEO' | 'STREAM';

  @ApiProperty({ example: 'https://example.com/story.jpg' })
  mediaUrl: string;

  @ApiProperty({ example: 'Probando historias onchain', required: false })
  caption?: string;
}

class UpdateStoryDto {
  @ApiProperty({ example: 'Caption editado', required: false, nullable: true })
  caption?: string | null;
}

@ApiTags('stories')
@Controller('stories')
export class StoriesController {
  constructor(private storiesService: StoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List active stories' })
  list() {
    return this.storiesService.list();
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a signed story' })
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateStoryDto,
  ) {
    return this.storiesService.create(
      this.bearer(authorization),
      body.mediaUrl,
      body.mediaType,
      body.caption,
    );
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit my story caption' })
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdateStoryDto,
  ) {
    return this.storiesService.update(this.bearer(authorization), id, body.caption);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my story' })
  delete(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.storiesService.delete(this.bearer(authorization), id);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }
}
