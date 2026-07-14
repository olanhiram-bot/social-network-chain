import { JwtService } from '@nestjs/jwt';
import { PostsService } from './posts.service';

describe('PostsService reports', () => {
  const previousModerators = process.env.MODERATOR_EMAILS;

  afterEach(() => {
    process.env.MODERATOR_EMAILS = previousModerators;
  });

  it('only exposes reports to configured moderators', async () => {
    process.env.MODERATOR_EMAILS = 'moderator@nexo.test';
    const prisma = { $queryRaw: jest.fn() } as any;
    const jwt = { verify: jest.fn(() => ({ sub: 'user', email: 'member@nexo.test' })) } as unknown as JwtService;
    const service = new PostsService(prisma, jwt, {} as any, {} as any);

    await expect(service.reports('token')).rejects.toThrow('Moderator access is required');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
