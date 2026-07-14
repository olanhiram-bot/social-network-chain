import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { generateNonce, SiweMessage } from 'siwe';
import { verifyMessage } from 'ethers';
import { PrismaService } from '../../prisma/prisma.service';

const vercelSiweDomain = /^(?:social-network-chain\.vercel\.app|social-network-chain(?:-[a-z0-9]+)?-danielolan1s-projects\.vercel\.app)$/;

function isAllowedSiweDomain(domain: string) {
  return domain === 'localhost:3001' || domain === process.env.SIWE_DOMAIN || vercelSiweDomain.test(domain);
}
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
  profileVisibility: string;
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

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) return { ok: true };

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });

    const appUrl = (process.env.WEB_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const delivery = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Nexo', email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email: user.email }],
        subject: 'Reset your Nexo password',
        htmlContent: `<p>Reset your password within 30 minutes:</p><p><a href="${appUrl}/?reset=${token}">Reset password</a></p>`,
      }),
    });
    if (!delivery.ok) throw new Error('Password reset email could not be sent');
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    if (password.length < 8) throw new UnauthorizedException('Password must be at least 8 characters');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const reset = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!reset || reset.expiresAt < new Date()) throw new UnauthorizedException('Invalid or expired reset link');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { password: await bcrypt.hash(password, 10) } }),
      this.prisma.session.deleteMany({ where: { userId: reset.userId } }),
      this.prisma.passwordResetToken.delete({ where: { id: reset.id } }),
    ]);
    return { ok: true };
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
      if (!this.siweNonces.has(siwe.nonce)) {
        throw new UnauthorizedException('Invalid SIWE nonce');
      }
      if (!isAllowedSiweDomain(siwe.domain)) {
        throw new UnauthorizedException('Invalid SIWE domain');
      }

      // Rabby and MetaMask sign standard EIP-191 messages. Verify locally as
      // a fallback when the SIWE library cannot resolve a connector/provider.
      const recovered = verifyMessage(message, signature).toLowerCase();
      if (recovered !== siwe.address.toLowerCase()) {
        throw new UnauthorizedException('Invalid SIWE signature');
      }
      this.siweNonces.delete(siwe.nonce);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
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
      SELECT "id", "name", "email", "avatar", "cover", "bio", "profileVisibility", "createdAt", "updatedAt"
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
    data: { name?: string; avatar?: string | null; cover?: string | null; bio?: string | null; profileVisibility?: string },
  ) {
    const payload = this.verifyAccessToken(accessToken);
    const [user] = await this.prisma.$queryRaw<PublicUser[]>`
      UPDATE "User"
      SET
        "name" = ${data.name?.trim() || 'Usuario'},
        "avatar" = ${data.avatar ?? null},
        "cover" = ${data.cover ?? null},
        "bio" = ${data.bio ?? null}, "profileVisibility" = ${data.profileVisibility === 'FRIENDS' ? 'FRIENDS' : 'PUBLIC'},
        "updatedAt" = NOW()
      WHERE "id" = ${payload.sub}
      RETURNING "id", "name", "email", "avatar", "cover", "bio", "profileVisibility", "createdAt", "updatedAt"
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
