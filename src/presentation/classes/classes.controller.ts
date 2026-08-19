import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ClassesService } from '../../application/classes/classes.service';
import { CreateClassDto, UpdateClassDto } from '../../application/classes/dto/class.dto';
import { CreateScheduleDto, UpdateScheduleDto } from '../../application/classes/dto/schedule.dto';
import { JwtAuthGuard } from '../../infrastructure/auth/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/auth/roles.guard';
import { Roles } from '../../infrastructure/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post('classes')
  @Roles(Role.ADMIN, Role.TUTOR)
  async createClass(@Req() req, @Body() dto: CreateClassDto) {
    return this.classesService.createClass(req.user.userId, dto);
  }

  @Get('classes')
  async findAllClasses() {
    return this.classesService.findAllClasses();
  }

  @Get('classes/:id')
  async findClassById(@Param('id') id: string) {
    return this.classesService.findClassById(id);
  }

  @Put('classes/:id')
  @Roles(Role.ADMIN, Role.TUTOR)
  async updateClass(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.updateClass(
      id,
      req.user.userId,
      req.user.role,
      dto,
    );
  }

  @Delete('classes/:id')
  @Roles(Role.ADMIN, Role.TUTOR)
  async deleteClass(@Req() req, @Param('id') id: string) {
    return this.classesService.deleteClass(id, req.user.userId, req.user.role);
  }

  @Post('schedules')
  @Roles(Role.ADMIN, Role.TUTOR)
  async createSchedule(@Req() req, @Body() dto: CreateScheduleDto) {
    return this.classesService.createSchedule(req.user.userId, req.user.role, dto);
  }

  @Get('schedules')
  async findSchedules(@Req() req) {
    return this.classesService.findSchedules(req.user.userId, req.user.role);
  }

  @Put('schedules/:id')
  @Roles(Role.ADMIN, Role.TUTOR)
  async updateSchedule(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.classesService.updateSchedule(
      id,
      req.user.userId,
      req.user.role,
      dto,
    );
  }

  @Delete('schedules/:id')
  @Roles(Role.ADMIN, Role.TUTOR)
  async deleteSchedule(@Req() req, @Param('id') id: string) {
    return this.classesService.deleteSchedule(
      id,
      req.user.userId,
      req.user.role,
    );
  }
}
