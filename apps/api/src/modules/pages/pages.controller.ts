import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { PagesService } from './pages.service';

class PageDto {
  @ApiProperty({ example: 'Nexo Studio' })
  name: string;

  @ApiProperty({ example: 'Creador digital' })
  category: string;

  @ApiProperty({ example: 'Contenido, comunidad y lives.', required: false })
  description?: string;

  @ApiProperty({ example: '/media/avatar.png', required: false })
  avatar?: string;

  @ApiProperty({ example: '/media/cover.png', required: false })
  cover?: string;
}

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private pagesService: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'List pages' })
  list(@Headers('authorization') authorization?: string) {
    return this.pagesService.list(this.optionalBearer(authorization));
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my pages' })
  mine(@Headers('authorization') authorization: string | undefined) {
    return this.pagesService.mine(this.bearer(authorization));
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a page' })
  create(@Headers('authorization') authorization: string | undefined, @Body() body: PageDto) {
    return this.pagesService.create(this.bearer(authorization), body);
  }

  @Post(':id/follow')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow or unfollow a page' })
  follow(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.pagesService.toggleFollow(this.bearer(authorization), id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a page' })
  one(@Param('id') id: string) {
    return this.pagesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit my page' })
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: PageDto,
  ) {
    return this.pagesService.update(this.bearer(authorization), id, body);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my page' })
  delete(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.pagesService.delete(this.bearer(authorization), id);
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
