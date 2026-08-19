import { ScheduleStatus } from '@prisma/client';
export declare class CreateScheduleDto {
    classId: string;
    studentId: string;
    startTime: string;
    endTime: string;
}
export declare class UpdateScheduleDto {
    startTime?: string;
    endTime?: string;
    status?: ScheduleStatus;
}
