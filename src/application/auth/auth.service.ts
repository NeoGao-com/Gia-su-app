import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        fullName: dto.fullName,
        role: dto.role || Role.STUDENT,
        status: 'ACTIVE',
        tutorProfile: dto.role === Role.TUTOR ? { create: { hourlyRate: 0 } } : undefined,
        studentProfile: dto.role === Role.STUDENT ? { create: { gradeLevel: 'N/A' } } : undefined,
      },
      include: {
        tutorProfile: true,
        studentProfile: true,
      },
    });

    const { passwordHash, ...result } = user;
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tutorProfile: true, studentProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    const { passwordHash, ...userInfo } = user;
    return {
      accessToken,
      user: userInfo,
    };
  }
}
