import { Controller, MessageEvent, Query, Sse, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

type AccessPayload = {
  sub: string;
  email: string;
};

@Controller('realtime')
export class RealtimeController {
  constructor(
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  @Sse()
  stream(@Query('token') token?: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const payload = this.jwt.verify<AccessPayload>(token);
      return this.realtime.stream(payload.sub) as Observable<MessageEvent>;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
