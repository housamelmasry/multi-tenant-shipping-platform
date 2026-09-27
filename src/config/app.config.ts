import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Public base URL, used to build customer-facing tracking links in SMS.
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3000',
}));
