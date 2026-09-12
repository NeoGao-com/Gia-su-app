# EdTech Backend MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khởi tạo dự án NestJS backend với Prisma ORM, Clean Architecture, Health Check, Auth & User module và Class & Schedule module (loại bỏ thanh toán).

**Architecture:** Clean Architecture (Presentation, Application, Infrastructure, Domain/Prisma schema).
**Tech Stack:** NestJS, TypeScript, Prisma, PostgreSQL, class-validator, class-transformer.

## Global Constraints
- Node.js LTS, NestJS v10+, Prisma v5+.
- Không sử dụng module thanh toán trong MVP.
- Kết nối PostgreSQL qua biến môi trường `DATABASE_URL`.

---

### Task 1: Khởi tạo dự án NestJS và cấu hình môi trường

**Files:**
- Create: `package.json`, `tsconfig.json`, `nest-cli.json`
- Create: `.env`, `.env.example`
- Create: `prisma/schema.prisma`

**Interfaces:**
- Consumes: None
- Produces: Base NestJS project structure & Prisma schema

- [ ] **Step 1: Khởi tạo package.json và cài đặt dependencies**

```json
{
  "name": "edtech-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "prebuild": "rimraf dist",
    "build": "nest build",
    "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "prisma:init": "prisma init"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@prisma/client": "^5.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/node": "^20.3.1",
    "prisma": "^5.0.0",
    "source-map-support": "^0.5.21",
    "ts-loader": "^9.5.0",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  }
}
```

- [ ] **Step 2: Tạo file cấu hình môi trường `.env` và `.env.example`**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edtech_db?schema=public"
PORT=3000
JWT_SECRET="super-secret-key"
```

- [ ] **Step 3: Định nghĩa Prisma Schema (`prisma/schema.prisma`)**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  TUTOR
  STUDENT
}

enum ClassStatus {
  PENDING
  ACTIVE
  COMPLETED
}

enum ScheduleStatus {
  SCHEDULED
  COMPLETED
  CANCELED
}

model User {
  id           String        @id @default(uuid())
  email        String        @unique
  passwordHash String        @map("password_hash")
  role         Role          @default(STUDENT)
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")
  profile      UserProfile?
  classes      Class[]       @relation("TutorClasses")
  schedules    LessonSchedule[]

  @@map("users")
}

model UserProfile {
  id       String @id @default(uuid())
  userId   String @unique @map("user_id")
  fullName String @map("full_name")
  phone    String?
  address  String?
  bio      String?
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

model Class {
  id          String        @id @default(uuid())
  title       String
  description String?
  subject     String
  price       Float
  tutorId     String        @map("tutor_id")
  status      ClassStatus   @default(PENDING)
  createdAt   DateTime      @default(now()) @map("created_at")
  tutor       User          @relation("TutorClasses", fields: [tutorId], references: [id])
  schedules   LessonSchedule[]

  @@map("classes")
}

model LessonSchedule {
  id        String         @id @default(uuid())
  classId   String         @map("class_id")
  studentId String         @map("student_id")
  startTime DateTime       @map("start_time")
  endTime   DateTime       @map("end_time")
  status    ScheduleStatus @default(SCHEDULED)
  class     Class          @relation(fields: [classId], references: [id], onDelete: Cascade)
  student   User           @relation(fields: [studentId], references: [id])

  @@map("lesson_schedules")
}
```

- [ ] **Step 4: Commit thay đổi**

```bash
git add package.json .env .env.example prisma/schema.prisma
git commit -m "feat: initialize project structure and prisma schema"
```

---

### Task 2: Xây dựng PrismaModule và Health Check Endpoint

**Files:**
- Create: `src/infrastructure/prisma/prisma.service.ts`
- Create: `src/infrastructure/prisma/prisma.module.ts`
- Create: `src/presentation/health/health.controller.ts`
- Create: `src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaClient`
- Produces: `PrismaService`, `GET /api/v1/health`

- [ ] **Step 1: Tạo `PrismaService`**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Tạo `PrismaModule`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Tạo `HealthController`**

```typescript
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'error', database: 'disconnected', error: error.message };
    }
  }
}
```

- [ ] **Step 4: Commit thay đổi**

```bash
git add src/
git commit -m "feat: add prisma service and health check endpoint"
```
