import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

// GET - Get tutor's students or student's tutors, or search for a student by email
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const username = searchParams.get('username');

    // Search for a specific student by email or username
    if (email || username) {
      if (user.role !== 'TUTOR') {
        return NextResponse.json({ error: 'Only tutors can search for students' }, { status: 403 });
      }

      const student = await db.user.findFirst({
        where: {
          OR: [
            { email: email?.toLowerCase() || '' },
            { username: username?.toLowerCase() || '' }
          ],
          role: 'STUDENT'
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          avatar: true,
          isManual: true
        }
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      return NextResponse.json({ student });
    }

    if (user.role === 'TUTOR') {
      // Get tutor's students
      const requests = await db.tutorRequest.findMany({
        where: {
          tutorId: user.id,
          status: 'ACCEPTED'
        },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatar: true,
              isManual: true
            }
          }
        }
      });

      const students = requests.map(r => r.student);
      return NextResponse.json({ students });
    } else {
      // Get student's tutors
      const requests = await db.tutorRequest.findMany({
        where: {
          studentId: user.id,
          status: 'ACCEPTED'
        },
        include: {
          tutor: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatar: true
            }
          }
        }
      });

      const tutors = requests.map(r => r.tutor);
      return NextResponse.json({ tutors });
    }
  } catch (error) {
    console.error('Get students/tutors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create student manually or send invitation
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can add students' }, { status: 403 });
    }

    // Parse body safely
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { 
      studentId,      // ID существующего ученика для приглашения
      studentEmail,   // Email для поиска
      studentUsername, // Username для поиска
      name,           // Имя для ручного создания
      createManual    // Флаг для ручного создания
    } = body;

    console.log('POST /api/students - body:', { studentId, studentEmail, studentUsername, name, createManual });

    // Если указан studentId - отправляем приглашение существующему ученику
    if (studentId) {
      console.log('Processing studentId:', studentId);
      
      const student = await db.user.findUnique({
        where: { id: studentId, role: 'STUDENT' }
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      }

      // Check if already exists
      const existingRequest = await db.tutorRequest.findUnique({
        where: {
          tutorId_studentId: {
            tutorId: user.id,
            studentId: student.id
          }
        }
      });

      if (existingRequest) {
        if (existingRequest.status === 'ACCEPTED') {
          return NextResponse.json({ error: 'Student is already assigned to you' }, { status: 400 });
        }
        if (existingRequest.status === 'PENDING') {
          return NextResponse.json({ error: 'Invitation already sent' }, { status: 400 });
        }
        // If declined, we can update to pending
      }

      // Create or update request
      const tutorRequest = await db.tutorRequest.upsert({
        where: {
          tutorId_studentId: {
            tutorId: user.id,
            studentId: student.id
          }
        },
        update: {
          status: 'PENDING'
        },
        create: {
          tutorId: user.id,
          studentId: student.id,
          status: 'PENDING'
        }
      });

      // Create notification for student (только если не manual)
      if (!student.isManual) {
        const tutor = await db.user.findUnique({
          where: { id: user.id }
        });

        await db.notification.create({
          data: {
            userId: student.id,
            type: 'TUTOR_INVITE',
            title: 'Приглашение от репетитора',
            message: `Репетитор ${tutor?.name || tutor?.username} приглашает вас к сотрудничеству`,
            data: JSON.stringify({ requestId: tutorRequest.id, tutorId: user.id })
          }
        });
      }

      return NextResponse.json({ request: tutorRequest, student });
    }

    // Поиск ученика по email/username
    if (studentEmail || studentUsername) {
      console.log('Searching by email/username:', { studentEmail, studentUsername });
      
      const student = await db.user.findFirst({
        where: {
          OR: [
            { email: studentEmail?.toLowerCase() || '' },
            { username: studentUsername?.toLowerCase() || '' }
          ],
          role: 'STUDENT'
        }
      });

      if (!student) {
        // Если ученик не найден и включён флаг createManual - создаём вручную
        if (createManual && name) {
          console.log('Creating manual student with name:', name);
          
          const randomPassword = randomUUID();
          const hashedPassword = await hash(randomPassword, 10);
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const manualEmail = studentEmail || `manual_${randomSuffix}@senseimath.local`;
          const manualUsername = studentUsername || `student_${randomSuffix}`;

          // Проверяем уникальность
          const existingUser = await db.user.findFirst({
            where: {
              OR: [
                { email: manualEmail.toLowerCase() },
                { username: manualUsername.toLowerCase() }
              ]
            }
          });

          if (existingUser) {
            return NextResponse.json({ error: 'User with this email/username already exists' }, { status: 400 });
          }

          const newStudent = await db.user.create({
            data: {
              email: manualEmail.toLowerCase(),
              username: manualUsername.toLowerCase(),
              password: hashedPassword,
              name: name,
              role: 'STUDENT',
              isManual: true
            }
          });

          // Сразу принимаем связь
          await db.tutorRequest.create({
            data: {
              tutorId: user.id,
              studentId: newStudent.id,
              status: 'ACCEPTED'
            }
          });

          return NextResponse.json({ 
            student: {
              id: newStudent.id,
              name: newStudent.name,
              email: newStudent.email,
              username: newStudent.username,
              isManual: true
            },
            created: true
          });
        }

        return NextResponse.json({ error: 'Student not found. Use createManual=true with name to create.' }, { status: 404 });
      }

      // Ученик найден - отправляем приглашение
      const existingRequest = await db.tutorRequest.findUnique({
        where: {
          tutorId_studentId: {
            tutorId: user.id,
            studentId: student.id
          }
        }
      });

      if (existingRequest) {
        if (existingRequest.status === 'ACCEPTED') {
          return NextResponse.json({ error: 'Student is already assigned to you' }, { status: 400 });
        }
        if (existingRequest.status === 'PENDING') {
          return NextResponse.json({ error: 'Invitation already sent' }, { status: 400 });
        }
      }

      const tutorRequest = await db.tutorRequest.upsert({
        where: {
          tutorId_studentId: {
            tutorId: user.id,
            studentId: student.id
          }
        },
        update: {
          status: 'PENDING'
        },
        create: {
          tutorId: user.id,
          studentId: student.id,
          status: 'PENDING'
        }
      });

      // Create notification for student
      if (!student.isManual) {
        const tutor = await db.user.findUnique({
          where: { id: user.id }
        });

        await db.notification.create({
          data: {
            userId: student.id,
            type: 'TUTOR_INVITE',
            title: 'Приглашение от репетитора',
            message: `Репетитор ${tutor?.name || tutor?.username} приглашает вас к сотрудничеству`,
            data: JSON.stringify({ requestId: tutorRequest.id, tutorId: user.id })
          }
        });
      }

      return NextResponse.json({ request: tutorRequest, student });
    }

    // Ручное создание ученика без email
    if (createManual && name) {
      console.log('Creating manual student with name only:', name);
      
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const randomPassword = randomUUID();
      const hashedPassword = await hash(randomPassword, 10);
      const manualEmail = `manual_${randomSuffix}@senseimath.local`;
      const manualUsername = `student_${randomSuffix}`;

      const newStudent = await db.user.create({
        data: {
          email: manualEmail,
          username: manualUsername,
          password: hashedPassword,
          name: name,
          role: 'STUDENT',
          isManual: true
        }
      });

      // Сразу принимаем связь
      await db.tutorRequest.create({
        data: {
          tutorId: user.id,
          studentId: newStudent.id,
          status: 'ACCEPTED'
        }
      });

      return NextResponse.json({ 
        student: {
          id: newStudent.id,
          name: newStudent.name,
          email: newStudent.email,
          username: newStudent.username,
          isManual: true
        },
        created: true
      });
    }

    return NextResponse.json({ error: 'Invalid request parameters. Provide studentId, studentEmail/studentUsername, or createManual with name.' }, { status: 400 });
  } catch (error) {
    console.error('Add student error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Remove student from tutor
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can remove students' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // Delete the tutor-student relationship
    await db.tutorRequest.deleteMany({
      where: {
        tutorId: user.id,
        studentId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove student error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
