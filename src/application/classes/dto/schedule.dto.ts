import { IsString, IsNotEmpty, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ScheduleStatus } from '@prisma/client';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  classId: string;

  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;
}

export class UpdateScheduleDto {
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsEnum(ScheduleStatus)
  @IsOptional()
  status?: ScheduleStatus;
}
