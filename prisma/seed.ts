import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.lessonSchedule.deleteMany();
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

  console.log({ admin, tutorUser, studentUser });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
