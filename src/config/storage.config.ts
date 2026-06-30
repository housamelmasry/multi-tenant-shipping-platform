// src/config/storage.config.ts
import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createS3Client = (config: ConfigService): S3Client => {
  const provider = config.get('STORAGE_PROVIDER') ?? 's3';

  if (provider === 'r2') {
    // Cloudflare R2
    return new S3Client({
      region: 'auto',
      endpoint: `https://${config.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get('R2_ACCESS_KEY')!,
        secretAccessKey: config.get('R2_SECRET_KEY')!,
      },
    });
  }

  if (provider === 'minio') {
    // MinIO
    return new S3Client({
      region: 'us-east-1',
      endpoint: config.get('MINIO_ENDPOINT'),
      forcePathStyle: true, // مطلوب لـ MinIO
      credentials: {
        accessKeyId: config.get('MINIO_ACCESS_KEY')!,
        secretAccessKey: config.get('MINIO_SECRET_KEY')!,
      },
    });
  }

  // AWS S3 (default)
  return new S3Client({
    region: config.get('S3_REGION') ?? 'me-south-1',
    credentials: {
      accessKeyId: config.get('S3_ACCESS_KEY')!,
      secretAccessKey: config.get('S3_SECRET_KEY')!,
    },
  });
};
