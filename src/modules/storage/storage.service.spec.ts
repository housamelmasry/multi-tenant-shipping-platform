import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { StorageService } from './storage.service';

describe('StorageService upload keys', () => {
  it('builds a key for a memoryStorage file without a filename', async () => {
    const image = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();
    let uploadedKey: string | undefined;
    const send = jest.fn((command: PutObjectCommand) => {
      uploadedKey = command.input.Key;
      return Promise.resolve({});
    });
    const service = new StorageService(
      { get: jest.fn() } as never,
      { t: (key: string) => key } as never,
    );
    Object.assign(service, {
      s3Client: { send },
      bucket: 'test-bucket',
      publicUrl: 'https://bucket.example.test',
    });
    const file = {
      fieldname: 'photo',
      originalname: 'proof.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: image.length,
      buffer: image,
    } as Express.Multer.File;

    const result = await service.uploadPhoto(file, 'return-photos', 'tenant-1');

    expect(result.key).toMatch(
      /^return-photos\/tenant-1\/\d{4}\/\d{2}\/[a-f0-9]{32}\.jpeg$/,
    );
    expect(uploadedKey).toBe(result.key);
    expect(result.key).not.toContain('undefined');
  });
});
