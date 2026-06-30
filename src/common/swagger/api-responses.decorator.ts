import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse, ApiCreatedResponse,
  ApiBadRequestResponse, ApiUnauthorizedResponse,
  ApiForbiddenResponse, ApiNotFoundResponse,
  ApiConflictResponse, ApiTooManyRequestsResponse,
  ApiInternalServerErrorResponse,
  getSchemaPath,
} from '@nestjs/swagger';

export function ApiSuccessResponse(
  description: string,
  dataType?: Type<unknown>,
) {
  const schema: any = {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: description },
      timestamp: { type: 'string', format: 'date-time' },
    },
  };

  if (dataType) {
    schema.properties.data = { $ref: getSchemaPath(dataType) };
  }

  return applyDecorators(
    ApiOkResponse({
      description,
      schema,
    }),
  );
}

export function ApiCreatedResponseDoc(
  description: string,
  dataType?: Type<unknown>,
) {
  const schema: any = {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: description },
      timestamp: { type: 'string', format: 'date-time' },
    },
  };

  if (dataType) {
    schema.properties.data = { $ref: getSchemaPath(dataType) };
  }

  return applyDecorators(
    ApiCreatedResponse({
      description,
      schema,
    }),
  );
}

export function ApiCommonResponses() {
  return applyDecorators(
    ApiBadRequestResponse({
      description: 'خطأ في البيانات المرسلة',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'رمز التحقق غير صحيح' },
          statusCode: { type: 'number', example: 400 },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'غير مصرح',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'يرجى تسجيل الدخول' },
          statusCode: { type: 'number', example: 401 },
        },
      },
    }),
    ApiForbiddenResponse({
      description: 'صلاحية غير كافية',
    }),
    ApiNotFoundResponse({
      description: 'الموارد غير موجود',
    }),
    ApiConflictResponse({
      description: 'تعارض في البيانات',
    }),
    ApiTooManyRequestsResponse({
      description: 'تجاوزت حد الطلبات المسموح',
    }),
    ApiInternalServerErrorResponse({
      description: 'خطأ داخلي في الخادم',
    }),
  );
}
