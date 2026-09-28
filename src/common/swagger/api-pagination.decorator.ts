import { applyDecorators } from '@nestjs/common';
import { ApiQuery, ApiQueryOptions } from '@nestjs/swagger';

const paginationParams: ApiQueryOptions[] = [
  {
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number',
  },
  {
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
    description: 'Number of items per page (max 100)',
  },
];

export function ApiPaginationQuery(extraParams?: ApiQueryOptions[]) {
  const params = [...paginationParams, ...(extraParams ?? [])];
  return applyDecorators(...params.map((p) => ApiQuery(p)));
}
