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
        title: string;
        description: string | null;
        subject: string;
        price: number;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        updatedAt: Date;
        tutorId: string;
    }>;
    findAllClasses(): Promise<({
        tutor: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
        enrollments: {
            id: string;
            status: import(".prisma/client").$Enums.EnrollmentStatus;
            classId: string;
            studentId: string;
            enrolledAt: Date;
        }[];
        lessons: {
            id: string;
            title: string;
            status: import(".prisma/client").$Enums.LessonStatus;
            classId: string;
            startTime: Date;
            endTime: Date;
            meetingLink: string | null;
        }[];
    } & {
        id: string;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        updatedAt: Date;
        tutorId: string;
    })[]>;
    findClassById(id: string): Promise<{
        tutor: {
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
        };
        enrollments: ({
            student: {
                id: string;
                email: string;
                role: import(".prisma/client").$Enums.Role;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.EnrollmentStatus;
            classId: string;
            studentId: string;
            enrolledAt: Date;
        })[];
        lessons: {
            id: string;
            title: string;
            status: import(".prisma/client").$Enums.LessonStatus;
            classId: string;
            startTime: Date;
            endTime: Date;
            meetingLink: string | null;
        }[];
    } & {
        id: string;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        updatedAt: Date;
        tutorId: string;
    }>;
    updateClass(id: string, userId: string, userRole: Role, dto: UpdateClassDto): Promise<{
        id: string;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        updatedAt: Date;
        tutorId: string;
    }>;
    deleteClass(id: string, userId: string, userRole: Role): Promise<{
        id: string;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        updatedAt: Date;
        tutorId: string;
    }>;
    createSchedule(userId: string, userRole: Role, dto: CreateScheduleDto): Promise<{
        class: {
            id: string;
            title: string;
            description: string | null;
            subject: string;
            price: number;
            status: import(".prisma/client").$Enums.ClassStatus;
            createdAt: Date;
            updatedAt: Date;
            tutorId: string;
        };
    } & {
        id: string;
        title: string;
        status: import(".prisma/client").$Enums.LessonStatus;
        classId: string;
        startTime: Date;
        endTime: Date;
        meetingLink: string | null;
    }>;
    findSchedules(userId: string, userRole: Role): Promise<({
        class: {
            id: string;
            title: string;
            description: string | null;
            subject: string;
            price: number;
            status: import(".prisma/client").$Enums.ClassStatus;
            createdAt: Date;
            updatedAt: Date;
            tutorId: string;
        };
    } & {
        id: string;
        title: string;
        status: import(".prisma/client").$Enums.LessonStatus;
        classId: string;
        startTime: Date;
        endTime: Date;
        meetingLink: string | null;
    })[]>;
    updateSchedule(id: string, userId: string, userRole: Role, dto: UpdateScheduleDto): Promise<{
        id: string;
        title: string;
        status: import(".prisma/client").$Enums.LessonStatus;
        classId: string;
        startTime: Date;
        endTime: Date;
        meetingLink: string | null;
    }>;
    deleteSchedule(id: string, userId: string, userRole: Role): Promise<{
        id: string;
        title: string;
        status: import(".prisma/client").$Enums.LessonStatus;
        classId: string;
        startTime: Date;
        endTime: Date;
        meetingLink: string | null;
    }>;
}
