"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infrastructure/prisma/prisma.service");
const client_1 = require("@prisma/client");
let ClassesService = class ClassesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createClass(tutorId, dto) {
        return this.prisma.class.create({
            data: {
                ...dto,
                tutorId,
            },
            include: {
                tutor: {
                    select: { id: true, email: true, role: true },
                },
            },
        });
    }
    async findAllClasses() {
        return this.prisma.class.findMany({
            include: {
                tutor: {
                    select: { id: true, email: true, role: true },
                },
            },
        });
    }
    async findClassById(id) {
        const classEntity = await this.prisma.class.findUnique({
            where: { id },
            include: {
                tutor: {
                    select: { id: true, email: true, role: true },
                },
                schedules: {
                    include: {
                        student: {
                            select: { id: true, email: true, role: true },
                        },
                    },
                },
            },
        });
        if (!classEntity) {
            throw new common_1.NotFoundException('Class not found');
        }
        return classEntity;
    }
    async updateClass(id, userId, userRole, dto) {
        const classEntity = await this.findClassById(id);
        if (userRole !== client_1.Role.ADMIN && classEntity.tutorId !== userId) {
            throw new common_1.ForbiddenException('You can only update your own classes');
        }
        return this.prisma.class.update({
            where: { id },
            data: dto,
        });
    }
    async deleteClass(id, userId, userRole) {
        const classEntity = await this.findClassById(id);
        if (userRole !== client_1.Role.ADMIN && classEntity.tutorId !== userId) {
            throw new common_1.ForbiddenException('You can only delete your own classes');
        }
        return this.prisma.class.delete({
            where: { id },
        });
    }
    async createSchedule(userId, userRole, dto) {
        const classEntity = await this.findClassById(dto.classId);
        if (userRole !== client_1.Role.ADMIN && classEntity.tutorId !== userId) {
            throw new common_1.ForbiddenException('Only the class tutor or admin can schedule lessons');
        }
        return this.prisma.lessonSchedule.create({
            data: {
                classId: dto.classId,
                studentId: dto.studentId,
                startTime: new Date(dto.startTime),
                endTime: new Date(dto.endTime),
            },
            include: {
                class: true,
                student: {
                    select: { id: true, email: true, role: true },
                },
            },
        });
    }
    async findSchedules(userId, userRole) {
        if (userRole === client_1.Role.ADMIN) {
            return this.prisma.lessonSchedule.findMany({
                include: {
                    class: true,
                    student: { select: { id: true, email: true, role: true } },
                },
            });
        }
        if (userRole === client_1.Role.TUTOR) {
            return this.prisma.lessonSchedule.findMany({
                where: { class: { tutorId: userId } },
                include: {
                    class: true,
                    student: { select: { id: true, email: true, role: true } },
                },
            });
        }
        return this.prisma.lessonSchedule.findMany({
            where: { studentId: userId },
            include: {
                class: true,
                student: { select: { id: true, email: true, role: true } },
            },
        });
    }
    async updateSchedule(id, userId, userRole, dto) {
        const schedule = await this.prisma.lessonSchedule.findUnique({
            where: { id },
            include: { class: true },
        });
        if (!schedule) {
            throw new common_1.NotFoundException('Schedule not found');
        }
        if (userRole !== client_1.Role.ADMIN && schedule.class.tutorId !== userId) {
            throw new common_1.ForbiddenException('Only the class tutor or admin can update schedules');
        }
        return this.prisma.lessonSchedule.update({
            where: { id },
            data: {
                ...(dto.startTime && { startTime: new Date(dto.startTime) }),
                ...(dto.endTime && { endTime: new Date(dto.endTime) }),
                ...(dto.status && { status: dto.status }),
            },
        });
    }
    async deleteSchedule(id, userId, userRole) {
        const schedule = await this.prisma.lessonSchedule.findUnique({
            where: { id },
            include: { class: true },
        });
        if (!schedule) {
            throw new common_1.NotFoundException('Schedule not found');
        }
        if (userRole !== client_1.Role.ADMIN && schedule.class.tutorId !== userId) {
            throw new common_1.ForbiddenException('Only the class tutor or admin can delete schedules');
        }
        return this.prisma.lessonSchedule.delete({
            where: { id },
        });
    }
};
exports.ClassesService = ClassesService;
exports.ClassesService = ClassesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClassesService);
//# sourceMappingURL=classes.service.js.map