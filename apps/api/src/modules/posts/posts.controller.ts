import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';

class CreatePostDto {
  @ApiProperty({ example: 'Primer post desde el feed.' })
  content: string;

  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'VIDEO', 'STREAM'], required: false })
  mediaType?: 'IMAGE' | 'VIDEO' | 'STREAM';

  @ApiProperty({ example: 'https://example.com/photo.jpg', required: false })
  mediaUrl?: string;

  @ApiProperty({ example: 'page-id', required: false })
  pageId?: string;

  @ApiProperty({ example: 'group-id', required: false })
  groupId?: string;

  @ApiProperty({ example: 'PUBLIC', enum: ['PUBLIC', 'FRIENDS', 'ONLY_ME'], required: false })
  audience?: 'PUBLIC' | 'FRIENDS' | 'ONLY_ME';
}

class CreateCommentDto {
  @ApiProperty({ example: 'Totalmente de acuerdo.' })
  content: string;
}

class UpdatePostDto {
  @ApiProperty({ example: 'Texto editado.' })
  content: string;
}

class SharePostDto {
  @ApiProperty({ example: 'Mira esto', required: false })
  content?: string;

  @ApiProperty({ example: 'page-id', required: false })
  pageId?: string;
}

class ReportDto {
  @ApiProperty({ example: 'Spam o contenido ofensivo.' })
  reason: string;
}

class ReactPostDto {
  @ApiProperty({ example: 'LOVE', enum: ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'], required: false })
  reactionType?: 'LIKE' | 'LOVE' | 'CARE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'List latest posts' })
  list(@Headers('authorization') authorization?: string) {
    return this.postsService.list(this.optionalBearer(authorization));
  }

  @Get('reports')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List open content reports' })
  reports(@Headers('authorization') authorization: string | undefined) {
    return this.postsService.reports(this.bearer(authorization));
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a post' })
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreatePostDto,
  ) {
    return this.postsService.create(
      this.bearer(authorization),
      body.content,
      body.mediaUrl,
      body.mediaType,
      body.pageId,
      body.groupId,
      body.audience,
    );
  }

  @Post(':id/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comment on a post' })
  comment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
  ) {
    return this.postsService.comment(this.bearer(authorization), id, body.content);
  }

  @Patch('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit my comment text' })
  updateComment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: CreateCommentDto,
  ) {
    return this.postsService.updateComment(this.bearer(authorization), id, body.content);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my comment' })
  deleteComment(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.postsService.deleteComment(this.bearer(authorization), id);
  }

  @Post(':id/share')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Share a post to my profile or page' })
  share(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: SharePostDto,
  ) {
    return this.postsService.share(this.bearer(authorization), id, body.content ?? '', body.pageId);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit my post text' })
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
  ) {
    return this.postsService.update(this.bearer(authorization), id, body.content);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my post' })
  delete(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ) {
    return this.postsService.delete(this.bearer(authorization), id);
  }

  @Post(':id/reactions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle or change a reaction on a post' })
  react(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: ReactPostDto,
  ) {
    return this.postsService.react(this.bearer(authorization), id, body.reactionType);
  }

  @Post(':id/report')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a post' })
  report(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: ReportDto,
  ) {
    return this.postsService.report(this.bearer(authorization), id, body.reason);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }

  private optionalBearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
