import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
            { email: email?.toLowerCase() },
            { username: username?.toLowerCase() }
          ],
          role: 'STUDENT'
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          avatar: true
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
              avatar: true
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

// POST - Send invitation to student (tutor only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can send invitations' }, { status: 403 });
    }

    const body = await request.json();
    const { studentEmail, studentUsername } = body;

    if (!studentEmail && !studentUsername) {
      return NextResponse.json({ error: 'Student email or username is required' }, { status: 400 });
    }

    // Find student
    const student = await db.user.findFirst({
      where: {
        OR: [
          { email: studentEmail?.toLowerCase() },
          { username: studentUsername?.toLowerCase() }
        ],
        role: 'STUDENT'
      }
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

    // Create notification for student
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

    return NextResponse.json({ request: tutorRequest });
  } catch (error) {
    console.error('Send invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
