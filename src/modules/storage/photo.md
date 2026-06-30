# مدمج في الـ OTP verify

POST /api/v1/orders/:id/otp/verify
multipart/form-data: { code, photo? }

POST /api/v1/returns/:id/otp/verify
multipart/form-data: { code, photo? }

     السائق يضغط "تأكيد التسليم" + يرفع صورة
              │
              ▼

POST /orders/:id/otp/verify
multipart/form-data
├── code: "483920"
└── photo: [binary JPEG 4MB]
│
▼
multerConfig → memory storage
│
▼
StorageService.uploadPhoto()
│
├── validateFile()
│ ├── mime type ✅
│ └── size < 15MB ✅
│
├── processImage() via sharp
│ ├── auto-rotate (EXIF)
│ ├── resize → max 1920x1080
│ ├── compress → quality 85
│ ├── format → JPEG progressive
│ └── strip EXIF (خصوصية)
│ 4MB → 380KB ✅
│
├── generateKey()
│ └── delivery-photos/tenant-id/2024/01/abc123.jpeg
│
└── S3Client.PutObject()
└── https://bucket.s3.amazonaws.com/delivery-photos/...
│
▼
Order.update(deliveryPhoto = URL)
│
▼
✅ الصورة محفوظة وآمنة
