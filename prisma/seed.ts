import { PrismaClient, Role, UserStatus, ClassStatus, EnrollmentStatus, LessonStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.lesson.deleteMany();
  await prisma.classEnrollment.deleteMany();
  await prisma.class.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.tutorProfile.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@giasuapp.com',
      passwordHash: hashedPassword,
      fullName: 'System Admin',
      phone: '0900000001',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const tutorUser = await prisma.user.create({
    data: {
      email: 'tutor@giasuapp.com',
      passwordHash: hashedPassword,
      fullName: 'John Tutor',
      phone: '0900000002',
      role: Role.TUTOR,
      status: UserStatus.ACTIVE,
      tutorProfile: {
        create: {
          bio: 'Experienced Math and Physics tutor with 5+ years of teaching.',
          subjects: ['Math', 'Physics'],
          degrees: ['Bachelor of Science in Mathematics'],
          hourlyRate: 20.0,
          isVerified: true,
        },
      },
    },
    include: { tutorProfile: true },
  });

  const studentUser = await prisma.user.create({
    data: {
      email: 'student@giasuapp.com',
      passwordHash: hashedPassword,
      fullName: 'Alice Student',
      phone: '0900000003',
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
      studentProfile: {
        create: {
          gradeLevel: 'Grade 10',
          address: '123 Main St, City',
        },
      },
    },
    include: { studentProfile: true },
  });

  const mathClass = await prisma.class.create({
    data: {
      title: 'Advanced Mathematics Grade 10',
      description: 'Comprehensive math course covering algebra and trigonometry.',
      subject: 'Math',
      price: 150.0,
      tutorId: tutorUser.id,
      status: ClassStatus.OPEN,
      lessons: {
        create: [
          {
            title: 'Lesson 1: Introduction to Advanced Algebra',
            startTime: new Date('2026-09-01T09:00:00Z'),
            endTime: new Date('2026-09-01T11:00:00Z'),
            status: LessonStatus.SCHEDULED,
            meetingLink: 'https://meet.google.com/abc-defg-hij',
          },
          {
            title: 'Lesson 2: Quadratic Equations Deep Dive',
            startTime: new Date('2026-09-03T09:00:00Z'),
            endTime: new Date('2026-09-03T11:00:00Z'),
            status: LessonStatus.SCHEDULED,
            meetingLink: 'https://meet.google.com/abc-defg-hij',
          },
        ],
      },
      enrollments: {
        create: [
          {
            studentId: studentUser.id,
            status: EnrollmentStatus.PENDING,
          },
        ],
      },
    },
    include: {
      lessons: true,
      enrollments: true,
    },
  });

  console.log({ admin, tutorUser, studentUser, mathClass });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
