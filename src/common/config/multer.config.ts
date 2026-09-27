// src/common/config/multer.config.ts
import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';

export const multerConfig = {
  storage: memoryStorage(), // Temporarily store files in memory.
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
    files: 1,
  },
  fileFilter: (_req: any, file: any, callback: any) => {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
    ];
    if (allowed.includes(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new BadRequestException('نوع الملف غير مدعوم'), false);
    }
  },
};
