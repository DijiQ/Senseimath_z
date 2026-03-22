import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET - Get lessons (tutor's lessons or student's lessons)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get('weekStart');
    const weekEnd = searchParams.get('weekEnd');

    let lessons;

    if (user.role === 'TUTOR') {
      // Get tutor's lessons
      const whereClause: Record<string, unknown> = { tutorId: user.id };
      
      if (weekStart && weekEnd) {
        whereClause.date = {
          gte: new Date(weekStart),
          lte: new Date(weekEnd)
        };
      }

      lessons = await db.lesson.findMany({
        where: whereClause,
        include: {
          students: {
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
          },
          files: true
        },
        orderBy: { date: 'asc' }
      });
    } else {
      // Get student's lessons
      const whereClause: Record<string, unknown> = {};
      
      if (weekStart && weekEnd) {
        whereClause.date = {
          gte: new Date(weekStart),
          lte: new Date(weekEnd)
        };
      }

      lessons = await db.lesson.findMany({
        where: {
          ...whereClause,
          students: {
            some: { studentId: user.id }
          }
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
          },
          students: {
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
          },
          files: true
        },
        orderBy: { date: 'asc' }
      });
    }

    return NextResponse.json({ lessons });
  } catch (error) {
    console.error('Get lessons error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new lesson (tutor only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can create lessons' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, date, duration, studentIds } = body;

    if (!title || !date || !studentIds || studentIds.length === 0) {
      return NextResponse.json({ error: 'Title, date and at least one student are required' }, { status: 400 });
    }

    // Verify students are assigned to this tutor
    const assignedStudents = await db.tutorRequest.findMany({
      where: {
        tutorId: user.id,
        studentId: { in: studentIds },
        status: 'ACCEPTED'
      }
    });

    if (assignedStudents.length !== studentIds.length) {
      return NextResponse.json({ error: 'Some students are not assigned to you' }, { status: 400 });
    }

    const lesson = await db.lesson.create({
      data: {
        tutorId: user.id,
        title,
        description,
        date: new Date(date),
        duration: duration || 60,
        students: {
          create: studentIds.map((studentId: string) => ({
            studentId
          }))
        }
      },
      include: {
        students: {
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
        }
      }
    });

    // Create notifications for students
    await db.notification.createMany({
      data: studentIds.map((studentId: string) => ({
        userId: studentId,
        type: 'NEW_LESSON',
        title: 'Новый урок',
        message: `Запланирован урок "${title}" на ${new Date(date).toLocaleString('ru-RU')}`,
        data: JSON.stringify({ lessonId: lesson.id })
      }))
    });

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error('Create lesson error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
