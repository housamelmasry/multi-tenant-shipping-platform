import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { PrivacyInterceptor } from './common/interceptors/privacy.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove fields not declared in the DTO.
      forbidNonWhitelisted: true,
      transform: true, // Automatically transform values to their declared types.
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ResponseInterceptor(),
    new PrivacyInterceptor(),
  );

  // CORS
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
  });

  // ─── Swagger ────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `🚀 Server running on http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `📚 Swagger Docs: http://localhost:${process.env.PORT ?? 3000}/docs`,
  );
}

function setupSwagger(app: any) {
  const config = new DocumentBuilder()
    .setTitle('Shipping Management API')
    .setDescription(
      `
## نظام إدارة الشحن — API Documentation

### المصادقة
- **JWT Bearer**: للمستخدمين والسائقين \`Authorization: Bearer <token>\`
- **API Key**: للشركات الخارجية \`X-API-Key: <key>\`

### الأدوار
| الدور | الصلاحيات |
|-------|-----------|
| \`SUPER_ADMIN\` | كل الصلاحيات |
| \`TENANT_ADMIN\` | إدارة شركته |
| \`TENANT_STAFF\` | السائق |

### Response Format
\`\`\`json
{
  "success": true,
  "data": { },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
\`\`\`
    `,
    )
    .setVersion('1.0.0')
    .setContact('Support', 'https://yourapp.com', 'support@yourapp.com')
    .setLicense('Private', '')
    .setExternalDoc('Postman Collection', 'https://yourapp.com/postman.json')
    .addServer('http://localhost:3000', 'Development')
    .addServer('https://api.yourapp.com', 'Production')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'أدخل الـ JWT token',
      },
      'JWT',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API Key للشركات الخارجية',
      },
      'API-Key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Shipping API Docs',
    customfavIcon: 'https://yourapp.com/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true, // Persist authorization credentials.
      displayRequestDuration: true, // Display request duration.
      filter: true, // Enable endpoint search.
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .topbar-wrapper img { content: url('https://yourapp.com/logo.png'); }
    `,
  });
}
bootstrap();
