import { JwtService } from '@nestjs/jwt';
import { MediaController } from './media.controller';

describe('MediaController', () => {
  it('rejects an invalid bearer token before accepting a file', async () => {
    const controller = new MediaController({ verify: jest.fn(() => { throw new Error('bad token'); }) } as unknown as JwtService);

    await expect(controller.upload('Bearer invalid', {})).rejects.toThrow('Invalid access token');
  });
});
