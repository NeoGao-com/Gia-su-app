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
    updateClass(req: any, id: string, dto: UpdateClassDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    }>;
    deleteClass(req: any, id: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ClassStatus;
        createdAt: Date;
        title: string;
        description: string | null;
        subject: string;
        price: number;
        tutorId: string;
    }>;
    createSchedule(req: any, dto: CreateScheduleDto): Promise<{
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
    findSchedules(req: any): Promise<({
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
    updateSchedule(req: any, id: string, dto: UpdateScheduleDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ScheduleStatus;
        classId: string;
        studentId: string;
        startTime: Date;
        endTime: Date;
    }>;
    deleteSchedule(req: any, id: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ScheduleStatus;
        classId: string;
        studentId: string;
        startTime: Date;
        endTime: Date;
    }>;
}
