import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from '../../presentation/classes/classes.controller';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
