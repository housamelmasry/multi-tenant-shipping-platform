import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
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
      description: 'Invalid request data',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Invalid verification code' },
          statusCode: { type: 'number', example: 400 },
        },
      },
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Please sign in first' },
          statusCode: { type: 'number', example: 401 },
        },
      },
    }),
    ApiForbiddenResponse({
      description: 'Insufficient permissions',
    }),
    ApiNotFoundResponse({
      description: 'Resource not found',
    }),
    ApiConflictResponse({
      description: 'Data conflict',
    }),
    ApiTooManyRequestsResponse({
      description: 'Rate limit exceeded',
    }),
    ApiInternalServerErrorResponse({
      description: 'Internal server error',
    }),
  );
}
