import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(dto: RegisterDto): Promise<{
        profile: {
            id: string;
            fullName: string;
            phone: string | null;
            address: string | null;
            bio: string | null;
            userId: string;
        };
        id: string;
        email: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            profile: {
                id: string;
                fullName: string;
                phone: string | null;
                address: string | null;
                bio: string | null;
                userId: string;
            };
            id: string;
            email: string;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
