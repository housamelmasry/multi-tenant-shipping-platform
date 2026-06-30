// src/common/utils/haversine.util.ts

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // الفرق بين الإحداثيات
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  // Haversine Formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // المسافة بالكيلومتر
  return EARTH_RADIUS_KM * c;
}

export function findNearestDriver(
  targetLat: number,
  targetLng: number,
  drivers: Array<{
    id: string;
    currentLat: number | null;
    currentLng: number | null;
    [key: string]: any;
  }>,
  maxDistanceKm: number = 20, // حد أقصى 20 كم
): { driver: (typeof drivers)[0]; distanceKm: number } | null {
  const driversWithDistance = drivers
    // فلترة السائقين بدون موقع
    .filter((d) => d.currentLat !== null && d.currentLng !== null)
    // حساب المسافة لكل سائق
    .map((driver) => ({
      driver,
      distanceKm: calculateDistance(
        targetLat,
        targetLng,
        Number(driver.currentLat),
        Number(driver.currentLng),
      ),
    }))
    // فلترة من هم خارج الحد الأقصى
    .filter((d) => d.distanceKm <= maxDistanceKm)
    // ترتيب من الأقرب للأبعد
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return driversWithDistance[0] ?? null;
}
