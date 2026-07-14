import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';

class ProductDto {
  @ApiProperty({ example: 'Camara Canon' })
  title: string;

  @ApiProperty({ example: 'Fotografia', required: false })
  category?: string;

  @ApiProperty({ example: 'Seminueva, incluye lente.', required: false })
  description?: string;

  @ApiProperty({ example: 250000 })
  priceCents: number;

  @ApiProperty({ example: 'Monterrey, NL' })
  location: string;

  @ApiProperty({ example: '/media/photo.png', required: false })
  imageUrl?: string;
}

class ProductStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SOLD'] })
  status: string;
}

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private marketplaceService: MarketplaceService) {}

  @Get()
  @ApiOperation({ summary: 'List marketplace products' })
  list(@Headers('authorization') authorization: string | undefined) {
    return this.marketplaceService.list(this.bearer(authorization));
  }

  @Post()
  @ApiOperation({ summary: 'Create marketplace product' })
  create(@Headers('authorization') authorization: string | undefined, @Body() body: ProductDto) {
    return this.marketplaceService.create(this.bearer(authorization), body);
  }

  @Patch(':id')
  updateStatus(@Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() body: ProductStatusDto) {
    return this.marketplaceService.setStatus(this.bearer(authorization), id, body.status);
  }

  @Delete(':id')
  remove(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.marketplaceService.remove(this.bearer(authorization), id);
  }

  @Post(':id/save')
  save(@Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    return this.marketplaceService.toggleSave(this.bearer(authorization), id);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return token;
  }
}
