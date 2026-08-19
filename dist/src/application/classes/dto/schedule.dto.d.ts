import { LessonStatus } from '@prisma/client';
export declare class CreateScheduleDto {
    classId: string;
    title?: string;
    startTime: string;
    endTime: string;
    meetingLink?: string;
}
export declare class UpdateScheduleDto {
    title?: string;
    startTime?: string;
    endTime?: string;
    status?: LessonStatus;
    meetingLink?: string;
}
