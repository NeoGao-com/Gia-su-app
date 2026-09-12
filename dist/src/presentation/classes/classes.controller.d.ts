import { ClassesService } from '../../application/classes/classes.service';
import { CreateClassDto, UpdateClassDto } from '../../application/classes/dto/class.dto';
import { CreateScheduleDto, UpdateScheduleDto } from '../../application/classes/dto/schedule.dto';
export declare class ClassesController {
    private readonly classesService;
    constructor(classesService: ClassesService);
    createClass(req: any, dto: CreateClassDto): Promise<{
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
    updateClass(req: any, id: string, dto: UpdateClassDto): Promise<{
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
    deleteClass(req: any, id: string): Promise<{
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
    createSchedule(req: any, dto: CreateScheduleDto): Promise<{
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
    findSchedules(req: any): Promise<({
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
    updateSchedule(req: any, id: string, dto: UpdateScheduleDto): Promise<{
        id: string;
        title: string;
        status: import(".prisma/client").$Enums.LessonStatus;
        classId: string;
        startTime: Date;
        endTime: Date;
        meetingLink: string | null;
    }>;
    deleteSchedule(req: any, id: string): Promise<{
        id: string;
        title: string;
        status: import(".prisma/client").$Enums.LessonStatus;
        classId: string;
        startTime: Date;
        endTime: Date;
        meetingLink: string | null;
    }>;
}
