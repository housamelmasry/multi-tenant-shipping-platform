السائق يحرك الهاتف
       │
       ▼
PATCH /drivers/me/location
       │
       ▼
DriversService.updateLocation()
   ├── DB: تحديث currentLat/currentLng
   └── TrackingGateway.emitDriverLocationUpdate()
                │
                ▼
        Socket.io broadcast
        لـ tenant:xxx room
                │
        ┌───────┴────────┐
        ▼                ▼
   Admin App         Admin App
   (browser 1)       (browser 2)
   خريطة تتحدث       خريطة تتحدث