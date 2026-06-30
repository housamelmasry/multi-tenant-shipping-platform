import { applyDecorators } from '@nestjs/common';
import { Throttle as ThrottleBase, SkipThrottle as SkipThrottleBase } from '@nestjs/throttler';

export const SkipThrottle = () => SkipThrottleBase();

export function AuthThrottle() {
  return ThrottleBase({
    short: { limit: 5, ttl: 1000 },
    medium: { limit: 20, ttl: 60000 },
    long: { limit: 100, ttl: 86400000 },
  });
}

export function LocationUpdateThrottle() {
  return ThrottleBase({
    short: { limit: 20, ttl: 1000 },
    medium: { limit: 300, ttl: 60000 },
    long: { limit: 10000, ttl: 86400000 },
  });
}

export function OtpThrottle() {
  return ThrottleBase({
    short: { limit: 3, ttl: 1000 },
    medium: { limit: 10, ttl: 60000 },
    long: { limit: 30, ttl: 86400000 },
  });
}

export function Throttle(options: {
  short?: { ttl: number; limit: number };
  medium?: { ttl: number; limit: number };
  long?: { ttl: number; limit: number };
}) {
  const merged: Record<string, { ttl: number; limit: number }> = {};
  if (options.short) merged.short = options.short;
  if (options.medium) merged.medium = options.medium;
  if (options.long) merged.long = options.long;
  return ThrottleBase(merged);
}
