import { ClassStatus } from '@prisma/client';
export declare class CreateClassDto {
    title: string;
    description?: string;
    subject: string;
    price: number;
}
export declare class UpdateClassDto {
    title?: string;
    description?: string;
    subject?: string;
    price?: number;
    status?: ClassStatus;
}
