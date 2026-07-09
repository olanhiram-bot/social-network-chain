import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { generateNonce, SiweMessage } from 'siwe';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';

type AccessPayload = {
  sub: string;
  email: string;
};

type RefreshPayload = {
  sub: string;
  sessionId: string;
};

type PublicUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  cover: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AuthService {
  private siweNonces = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private wallets: WalletsService,
  ) {}

  async register(email: string, password: string, name: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });

    if (exists) {
      throw new ConflictException('User already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        name,
      },
    });
    await this.wallets.createForUser(user.id);

    return this.createSession(user);
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createSession(user);
  }

  createSiweNonce() {
    const nonce = generateNonce();
    this.siweNonces.add(nonce);
    return { nonce };
  }

  async loginWithSiwe(message: string, signature: string) {
    let siwe: SiweMessage;
    try {
      siwe = new SiweMessage(message);
      if (!this.siweNonces.delete(siwe.nonce)) {
        throw new UnauthorizedException('Invalid SIWE nonce');
      }

      const result = await siwe.verify({
        signature,
        domain: process.env.SIWE_DOMAIN || 'localhost:3001',
      });

      if (!result.success) {
        throw new UnauthorizedException('Invalid SIWE signature');
      }
    } catch {
      throw new UnauthorizedException('Invalid SIWE signature');
    }

    const address = siwe.address.toLowerCase();
    const email = `${address}@wallet.local`;
    const name = `${address.slice(0, 6)}...${address.slice(-4)}`;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { name },
        })
      : await this.prisma.user.create({
          data: {
            email,
            name,
            password: await bcrypt.hash(randomUUID(), 10),
          },
        });

    if (!existing) {
      await this.wallets.createForUser(user.id);
    }

    return this.createSession(user);
  }

  async refresh(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.expiresAt < new Date() ||
      !(await bcrypt.compare(refreshToken, session.refreshTokenHash))
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.delete({ where: { id: session.id } });
    return this.createSession(session.user);
  }

  async logout(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);
    await this.prisma.session.deleteMany({ where: { id: payload.sessionId } });
    return { ok: true };
  }

  async me(accessToken: string) {
    const payload = this.verifyAccessToken(accessToken);
    const [user] = await this.prisma.$queryRaw<PublicUser[]>`
      SELECT "id", "name", "email", "avatar", "cover", "bio", "createdAt", "updatedAt"
      FROM "User"
      WHERE "id" = ${payload.sub}
      LIMIT 1
    `;

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return user;
  }

  async updateMe(
    accessToken: string,
    data: { name?: string; avatar?: string | null; cover?: string | null; bio?: string | null },
  ) {
    const payload = this.verifyAccessToken(accessToken);
    const [user] = await this.prisma.$queryRaw<PublicUser[]>`
      UPDATE "User"
      SET
        "name" = ${data.name?.trim() || 'Usuario'},
        "avatar" = ${data.avatar ?? null},
        "cover" = ${data.cover ?? null},
        "bio" = ${data.bio ?? null},
        "updatedAt" = NOW()
      WHERE "id" = ${payload.sub}
      RETURNING "id", "name", "email", "avatar", "cover", "bio", "createdAt", "updatedAt"
    `;

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    return user;
  }

  private async createSession(user: User) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: '',
        expiresAt,
      },
    });
    const tokens = this.generateTokens(user.id, user.email, session.id);

    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 10) },
    });

    return {
      ...tokens,
      user: this.toPublicUser(user),
    };
  }

  private generateTokens(userId: string, email: string, sessionId: string) {
    return {
      accessToken: this.jwt.sign({ sub: userId, email }),
      refreshToken: this.jwt.sign(
        { sub: userId, sessionId },
        { expiresIn: '7d' },
      ),
    };
  }

  private verifyAccessToken(accessToken: string) {
    try {
      return this.jwt.verify<AccessPayload>(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private verifyRefreshToken(refreshToken: string) {
    try {
      return this.jwt.verify<RefreshPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      cover: null,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
