import {
  Body,
  Controller,
  Get,
  Headers,
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
import { AuthService } from './auth.service';

class RegisterDto {
  @ApiProperty({ example: 'Daniel' })
  name: string;

  @ApiProperty({ example: 'daniel@example.com' })
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  password: string;
}

class LoginDto {
  @ApiProperty({ example: 'daniel@example.com' })
  email: string;

  @ApiProperty({ example: 'password123' })
  password: string;
}

class SiweVerifyDto {
  @ApiProperty()
  message: string;

  @ApiProperty()
  signature: string;
}

class RefreshDto {
  @ApiProperty()
  refreshToken: string;
}

class PasswordResetRequestDto { email: string; }
class PasswordResetDto { token: string; password: string; }

class UpdateMeDto {
  @ApiProperty({ example: 'Daniel', required: false })
  name?: string;

  @ApiProperty({
    type: String,
    example: 'https://example.com/avatar.png',
    required: false,
    nullable: true,
  })
  avatar?: string | null;

  @ApiProperty({
    type: String,
    example: '/media/cover.jpg',
    required: false,
    nullable: true,
  })
  cover?: string | null;

  @ApiProperty({
    type: String,
    example: 'Full-stack developer',
    required: false,
    nullable: true,
  })
  bio?: string | null;

  @ApiProperty({ enum: ['PUBLIC', 'FRIENDS'], required: false })
  profileVisibility?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a user' })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.name);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post('password-reset/request')
  requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  resetPassword(@Body() body: PasswordResetDto) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Get('siwe/nonce')
  @ApiOperation({ summary: 'Create a SIWE nonce' })
  siweNonce() {
    return this.authService.createSiweNonce();
  }

  @Post('siwe/verify')
  @ApiOperation({ summary: 'Login with Sign-In with Ethereum' })
  siweVerify(@Body() body: SiweVerifyDto) {
    return this.authService.loginWithSiwe(body.message, body.signature);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate a refresh token' })
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() body: RefreshDto) {
    return this.authService.logout(body.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user' })
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(this.bearer(authorization));
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current user profile' })
  updateMe(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: UpdateMeDto,
  ) {
    return this.authService.updateMe(this.bearer(authorization), body);
  }

  private bearer(authorization?: string) {
    const [type, token] = authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return token;
  }
}
