// src/common/swagger/api-responses.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

// Response موحد للنجاح
export const ApiSuccessResponse = (description: string, type?: any) =>
  applyDecorators(
    ApiResponse({
      status: 200,
      description,
      schema: {
        properties: {
          success: { type: 'boolean', example: true },
          data: type
            ? { $ref: `#/components/schemas/${type.name}` }
            : { type: 'object' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        },
      },
    }),
  );

// Responses الشائعة
export const ApiCommonResponses = () =>
  applyDecorators(
    ApiUnauthorizedResponse({ description: 'يرجى تسجيل الدخول أولاً' }),
    ApiForbiddenResponse({ description: 'ليس لديك صلاحية' }),
    ApiBadRequestResponse({ description: 'بيانات غير صحيحة' }),
    ApiTooManyRequestsResponse({ description: 'تجاوزت الحد المسموح به' }),
  );

// Auth decorators
export const ApiBearerAuth = () =>
  applyDecorators(ApiResponse({ status: 401, description: 'JWT غير صالح' }));
