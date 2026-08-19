import { AuthService } from '../../application/auth/auth.service';
import { RegisterDto } from '../../application/auth/dto/register.dto';
import { LoginDto } from '../../application/auth/dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto): Promise<{
        tutorProfile: {
            id: string;
            bio: string | null;
            subjects: string[];
            degrees: string[];
            hourlyRate: number;
            isVerified: boolean;
            userId: string;
        };
        studentProfile: {
            id: string;
            userId: string;
            gradeLevel: string;
            address: string | null;
        };
        id: string;
        email: string;
        fullName: string;
        phone: string | null;
        avatarUrl: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        updatedAt: Date;
    }>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            tutorProfile: {
                id: string;
                bio: string | null;
                subjects: string[];
                degrees: string[];
                hourlyRate: number;
                isVerified: boolean;
                userId: string;
            };
            studentProfile: {
                id: string;
                userId: string;
                gradeLevel: string;
                address: string | null;
            };
            id: string;
            email: string;
            fullName: string;
            phone: string | null;
            avatarUrl: string | null;
            status: import(".prisma/client").$Enums.UserStatus;
            role: import(".prisma/client").$Enums.Role;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
