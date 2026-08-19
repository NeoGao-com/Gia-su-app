import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateScheduleDto, UpdateScheduleDto } from './dto/schedule.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ClassesService {
  constructor(private prisma: PrismaService) {}

  async createClass(tutorId: string, dto: CreateClassDto) {
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
        lessons: true,
        enrollments: true,
      },
    });
  }

  async findClassById(id: string) {
    const classEntity = await this.prisma.class.findUnique({
      where: { id },
      include: {
        tutor: {
          select: { id: true, email: true, role: true },
        },
        lessons: true,
        enrollments: {
          include: {
            student: {
              select: { id: true, email: true, role: true },
            },
          },
        },
      },
    });
    if (!classEntity) {
      throw new NotFoundException('Class not found');
    }
    return classEntity;
  }

  async updateClass(id: string, userId: string, userRole: Role, dto: UpdateClassDto) {
    const classEntity = await this.findClassById(id);
    if (userRole !== Role.ADMIN && classEntity.tutorId !== userId) {
      throw new ForbiddenException('You can only update your own classes');
    }
    return this.prisma.class.update({
      where: { id },
      data: dto,
    });
  }

  async deleteClass(id: string, userId: string, userRole: Role) {
    const classEntity = await this.findClassById(id);
    if (userRole !== Role.ADMIN && classEntity.tutorId !== userId) {
      throw new ForbiddenException('You can only delete your own classes');
    }
    return this.prisma.class.delete({
      where: { id },
    });
  }

  async createSchedule(userId: string, userRole: Role, dto: CreateScheduleDto) {
    const classEntity = await this.findClassById(dto.classId);
    if (userRole !== Role.ADMIN && classEntity.tutorId !== userId) {
      throw new ForbiddenException('Only the class tutor or admin can schedule lessons');
    }
    return this.prisma.lesson.create({
      data: {
        classId: dto.classId,
        title: dto.title || 'Class Lesson',
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        meetingLink: dto.meetingLink,
      },
      include: {
        class: true,
      },
    });
  }

  async findSchedules(userId: string, userRole: Role) {
    if (userRole === Role.ADMIN) {
      return this.prisma.lesson.findMany({
        include: {
          class: true,
        },
      });
    }
    if (userRole === Role.TUTOR) {
      return this.prisma.lesson.findMany({
        where: { class: { tutorId: userId } },
        include: {
          class: true,
        },
      });
    }
    return this.prisma.lesson.findMany({
      where: { class: { enrollments: { some: { studentId: userId, status: 'ACCEPTED' } } } },
      include: {
        class: true,
      },
    });
  }

  async updateSchedule(id: string, userId: string, userRole: Role, dto: UpdateScheduleDto) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: { class: true },
    });
    if (!lesson) {
      throw new NotFoundException('Schedule not found');
    }
    if (userRole !== Role.ADMIN && lesson.class.tutorId !== userId) {
      throw new ForbiddenException('Only the class tutor or admin can update schedules');
    }
    return this.prisma.lesson.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.startTime && { startTime: new Date(dto.startTime) }),
        ...(dto.endTime && { endTime: new Date(dto.endTime) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.meetingLink && { meetingLink: dto.meetingLink }),
      },
    });
  }

  async deleteSchedule(id: string, userId: string, userRole: Role) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: { class: true },
    });
    if (!lesson) {
      throw new NotFoundException('Schedule not found');
    }
    if (userRole !== Role.ADMIN && lesson.class.tutorId !== userId) {
      throw new ForbiddenException('Only the class tutor or admin can delete schedules');
    }
    return this.prisma.lesson.delete({
      where: { id },
    });
  }
}
