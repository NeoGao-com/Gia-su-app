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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassesController = void 0;
const common_1 = require("@nestjs/common");
const classes_service_1 = require("../../application/classes/classes.service");
const class_dto_1 = require("../../application/classes/dto/class.dto");
const schedule_dto_1 = require("../../application/classes/dto/schedule.dto");
const jwt_auth_guard_1 = require("../../infrastructure/auth/jwt-auth.guard");
const roles_guard_1 = require("../../infrastructure/auth/roles.guard");
const roles_decorator_1 = require("../../infrastructure/auth/roles.decorator");
const client_1 = require("@prisma/client");
let ClassesController = class ClassesController {
    constructor(classesService) {
        this.classesService = classesService;
    }
    async createClass(req, dto) {
        return this.classesService.createClass(req.user.userId, dto);
    }
    async findAllClasses() {
        return this.classesService.findAllClasses();
    }
    async findClassById(id) {
        return this.classesService.findClassById(id);
    }
    async updateClass(req, id, dto) {
        return this.classesService.updateClass(id, req.user.userId, req.user.role, dto);
    }
    async deleteClass(req, id) {
        return this.classesService.deleteClass(id, req.user.userId, req.user.role);
    }
    async createSchedule(req, dto) {
        return this.classesService.createSchedule(req.user.userId, req.user.role, dto);
    }
    async findSchedules(req) {
        return this.classesService.findSchedules(req.user.userId, req.user.role);
    }
    async updateSchedule(req, id, dto) {
        return this.classesService.updateSchedule(id, req.user.userId, req.user.role, dto);
    }
    async deleteSchedule(req, id) {
        return this.classesService.deleteSchedule(id, req.user.userId, req.user.role);
    }
};
exports.ClassesController = ClassesController;
__decorate([
    (0, common_1.Post)('classes'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TUTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, class_dto_1.CreateClassDto]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "createClass", null);
__decorate([
    (0, common_1.Get)('classes'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "findAllClasses", null);
__decorate([
    (0, common_1.Get)('classes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "findClassById", null);
__decorate([
    (0, common_1.Put)('classes/:id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TUTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, class_dto_1.UpdateClassDto]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "updateClass", null);
__decorate([
    (0, common_1.Delete)('classes/:id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TUTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "deleteClass", null);
__decorate([
    (0, common_1.Post)('schedules'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TUTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, schedule_dto_1.CreateScheduleDto]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "createSchedule", null);
__decorate([
    (0, common_1.Get)('schedules'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "findSchedules", null);
__decorate([
    (0, common_1.Put)('schedules/:id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TUTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, schedule_dto_1.UpdateScheduleDto]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "updateSchedule", null);
__decorate([
    (0, common_1.Delete)('schedules/:id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.TUTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ClassesController.prototype, "deleteSchedule", null);
exports.ClassesController = ClassesController = __decorate([
    (0, common_1.Controller)('api/v1'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [classes_service_1.ClassesService])
], ClassesController);
//# sourceMappingURL=classes.controller.js.map