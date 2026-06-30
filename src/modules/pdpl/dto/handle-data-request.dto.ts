import { IsEnum, IsString, IsOptional, IsUrl } from 'class-validator';

export enum DataRequestHandleAction {
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export class HandleDataRequestDto {
  @IsEnum(DataRequestHandleAction)
  status: DataRequestHandleAction;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUrl()
  reportUrl?: string;
}
