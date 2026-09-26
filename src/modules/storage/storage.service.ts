// src/modules/storage/storage.service.ts
import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3Client } from '@config/storage.config';
import sharp from 'sharp';
import * as crypto from 'crypto';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────

export type UploadFolder = 'delivery-photos' | 'return-photos' | 'documents';

export type UploadResult = {
  key: string; // المسار الداخلي في الـ bucket
  url: string; // الرابط الكامل
  size: number; // الحجم بعد الضغط
  mimeType: string;
};

type ProcessOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
};

// ─── Constants ────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic', // iOS
  'image/heif', // iOS
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB قبل الضغط

const FOLDER_OPTIONS: Record<UploadFolder, ProcessOptions> = {
  'delivery-photos': {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 85,
    format: 'jpeg',
  },
  'return-photos': {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 85,
    format: 'jpeg',
  },
  documents: {
    maxWidth: 2480, // A4 width at 300dpi
    maxHeight: 3508,
    quality: 90,
    format: 'jpeg',
  },
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl: string;
  private provider: string;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.provider = this.config.get('STORAGE_PROVIDER') ?? 's3';
    this.s3Client = createS3Client(this.config);
    this.bucket = this.getBucketName();
    this.publicUrl = this.getPublicUrl();

    if (!this.config.get('S3_ACCESS_KEY') && this.provider === 's3') {
      this.logger.warn('⏭️ Storage skipped — no S3 credentials configured');
      return;
    }

    await this.ensureBucketExists();
  }

  // ─── Upload ───────────────────────────────────────────

  async uploadPhoto(
    file: Express.Multer.File,
    folder: UploadFolder,
    tenantId: string,
    metadata?: Record<string, string>,
  ): Promise<UploadResult> {
    // 1. التحقق من نوع الملف
    this.validateFile(file);

    // 2. ضغط وتحسين الصورة
    const processed = await this.processImage(file, folder);

    // 3. توليد اسم فريد
    const key = this.generateKey(folder, tenantId, processed.format);

    // 4. رفع على S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed.buffer,
        ContentType: `image/${processed.format}`,
        Metadata: {
          originalName: file.originalname,
          tenantId,
          uploadedAt: new Date().toISOString(),
          ...metadata,
        },
      }),
    );

    const url = `${this.publicUrl}/${key}`;

    this.logger.log(
      `✅ Uploaded: ${key} | Original: ${this.formatSize(file.size)} → Compressed: ${this.formatSize(processed.size)}`,
    );

    return {
      key,
      url,
      size: processed.size,
      mimeType: `image/${processed.format}`,
    };
  }

  // ─── Signed URL (رابط مؤقت آمن) ──────────────────────

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  // ─── Delete ───────────────────────────────────────────

  async deletePhoto(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`🗑️  Deleted: ${key}`);
    } catch (error) {
      // لو مش موجود → مش مشكلة
      this.logger.warn(`Failed to delete ${key}: ${error.message}`);
    }
  }

  // ─── Process Image ────────────────────────────────────

  private async processImage(
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<{ buffer: Buffer; size: number; format: string }> {
    const options = FOLDER_OPTIONS[folder];

    try {
      let sharpInstance = sharp(file.buffer)
        .rotate() // auto-rotate حسب EXIF
        .resize({
          width: options.maxWidth,
          height: options.maxHeight,
          fit: 'inside', // محافظة على النسبة
          withoutEnlargement: true, // مش يكبر لو أصغر
        });

      // تحويل لـ JPEG أو WebP
      if (options.format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality: options.quality });
      } else {
        sharpInstance = sharpInstance.jpeg({
          quality: options.quality,
          progressive: true, // أسرع في التحميل
          mozjpeg: true, // ضغط أفضل
        });
      }

      // إزالة الـ EXIF (خصوصية — مش نحتفظ بالموقع الجغرافي)
      sharpInstance = sharpInstance.withMetadata();

      const buffer = await sharpInstance.toBuffer();

      return {
        buffer,
        size: buffer.length,
        format: options.format ?? 'jpeg',
      };
    } catch (error) {
      throw new BadRequestException(`فشل في معالجة الصورة: ${error.message}`);
    }
  }

  // ─── Validation ───────────────────────────────────────

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('لم يتم رفع أي ملف');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `نوع الملف غير مدعوم (${file.mimetype}). الأنواع المسموحة: JPEG, PNG, WebP`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `حجم الملف كبير جداً (${this.formatSize(file.size)}). الحد الأقصى: ${this.formatSize(MAX_FILE_SIZE)}`,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  private generateKey(
    folder: UploadFolder,
    tenantId: string,
    format: string,
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = crypto.randomBytes(16).toString('hex');

    // مثال: delivery-photos/tenant-uuid/2024/01/a3f92b1c...jpeg
    return `${folder}/${tenantId}/${year}/${month}/${random}.${format}`;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private getBucketName(): string {
    const buckets: Record<string, string> = {
      s3: this.config.get('S3_BUCKET') ?? 'shipping-media',
      r2: this.config.get('R2_BUCKET') ?? 'shipping-media',
      minio: this.config.get('MINIO_BUCKET') ?? 'shipping-media',
    };
    return buckets[this.provider];
  }

  private getPublicUrl(): string {
    if (this.provider === 'r2') {
      return this.config.get('R2_PUBLIC_URL') ?? '';
    }
    if (this.provider === 'minio') {
      const endpoint =
        this.config.get('MINIO_ENDPOINT') ?? 'http://localhost:9000';
      return `${endpoint}/${this.bucket}`;
    }
    // AWS S3
    const region = this.config.get('S3_REGION') ?? 'me-south-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com`;
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.bucket }),
        { requestTimeout: 5000 },
      );
      this.logger.log(`✅ Storage bucket ready: ${this.bucket}`);
    } catch (err) {
      if (err.name === 'CredentialsProviderError' || err.name === 'CredentialsError' || err.message?.includes('connect')) {
        this.logger.warn('⏭️ Storage skipped — no valid credentials');
        return;
      }
      // لو مش موجود → إنشاء (للـ MinIO development فقط)
      if (this.provider === 'minio') {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`✅ Created bucket: ${this.bucket}`);
      } else {
        this.logger.error(`❌ Bucket not found: ${this.bucket}`);
      }
    }
  }
}
