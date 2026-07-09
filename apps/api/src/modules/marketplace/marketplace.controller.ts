import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
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

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }
    return token;
  }
}
