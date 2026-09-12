import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { HealthController } from './presentation/health/health.controller';
import { AuthModule } from './application/auth/auth.module';
import { ClassesModule } from './application/classes/classes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClassesModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
