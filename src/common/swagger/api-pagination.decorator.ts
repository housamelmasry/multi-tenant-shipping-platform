// src/common/swagger/api-pagination.decorator.ts
import { ApiQuery } from '@nestjs/swagger';
import { applyDecorators } from '@nestjs/common';

export const ApiPaginationQuery = () =>
  applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'رقم الصفحة',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 20,
      description: 'عدد النتائج',
    }),
  );
