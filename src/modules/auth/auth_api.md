Request
   │
   ▼
JwtAuthGuard
   ├── @Public? → تمر مباشرة ✅
   └── JWT valid?
         ├── لأ → 401 Unauthorized
         └── أيوه → JwtStrategy.validate()
                       └── user في الـ DB وactive؟
                             ├── لأ → 401
                             └── أيوه → request.user = user
                                           │
                                           ▼
                                       RolesGuard
                                           ├── @Roles موجود؟
                                           │     ├── لأ → تمر ✅
                                           │     └── أيوه → role مطابق؟
                                           │                 ├── لأ → 403
                                           │                 └── أيوه → تمر ✅
                                           └── Controller Method