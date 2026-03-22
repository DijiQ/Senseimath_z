import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST - Duplicate lesson to next week
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can duplicate lessons' }, { status: 403 });
    }

    const { id } = await params;

    const lesson = await db.lesson.findUnique({
      where: { id },
      include: { students: true }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (lesson.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Add 7 days to the lesson date
    const newDate = new Date(lesson.date);
    newDate.setDate(newDate.getDate() + 7);

    const newLesson = await db.lesson.create({
      data: {
        tutorId: user.id,
        title: lesson.title,
        description: lesson.description,
        date: newDate,
        duration: lesson.duration,
        students: {
          create: lesson.students.map(s => ({
            studentId: s.studentId
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

    // Notify students
    await db.notification.createMany({
      data: lesson.students.map(s => ({
        userId: s.studentId,
        type: 'NEW_LESSON',
        title: 'Новый урок',
        message: `Запланирован урок "${lesson.title}" на ${newDate.toLocaleString('ru-RU')}`,
        data: JSON.stringify({ lessonId: newLesson.id })
      }))
    });

    return NextResponse.json({ lesson: newLesson });
  } catch (error) {
    console.error('Duplicate lesson error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
