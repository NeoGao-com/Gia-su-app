import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { Role } from '@prisma/client';
export declare class ClassesService {
    private prisma;
    constructor(prisma: PrismaService);
    createClass(tutorId: string, dto: CreateClassDto): Promise<{
        tutor: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    }>;
    findAllClasses(): Promise<({
        tutor: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    })[]>;
    findClassById(id: string): Promise<{
        schedules: ({
            student: {
                id: string;
                email: string;
                role: import(".prisma/client").$Enums.Role;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            classId: string;
            studentId: string;
            startTime: Date;
            endTime: Date;
        })[];
        tutor: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    }>;
    updateClass(id: string, userId: string, userRole: Role, dto: UpdateClassDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    }>;
    deleteClass(id: string, userId: string, userRole: Role): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    }>;
    createSchedule(userId: string, userRole: Role, dto: CreateScheduleDto): Promise<{
        class: {
            id: string;
            status: import(".prisma/client").$Enums.ClassStatus;
            createdAt: Date;
            title: string;
            description: string | null;
            subject: string;
            price: number;
            tutorId: string;
        };
        student: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ScheduleStatus;
        classId: string;
        studentId: string;
        startTime: Date;
        endTime: Date;
    }>;
    findSchedules(userId: string, userRole: Role): Promise<({
        class: {
            id: string;
            status: import(".prisma/client").$Enums.ClassStatus;
            createdAt: Date;
            title: string;
            description: string | null;
            subject: string;
            price: number;
            tutorId: string;
        };
        student: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ScheduleStatus;
        classId: string;
        studentId: string;
        startTime: Date;
        endTime: Date;
    })[]>;
    updateSchedule(id: string, userId: string, userRole: Role, dto: UpdateScheduleDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ScheduleStatus;
        classId: string;
        studentId: string;
        startTime: Date;
        endTime: Date;
    }>;
    deleteSchedule(id: string, userId: string, userRole: Role): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ScheduleStatus;
        classId: string;
        studentId: string;
        startTime: Date;
        endTime: Date;
    }>;
}
