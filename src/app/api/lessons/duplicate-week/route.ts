import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { addDays } from 'date-fns';

// POST - Duplicate all week lessons to next week
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can duplicate lessons' }, { status: 403 });
    }

    const body = await request.json();
    const { weekStart } = body;

    if (!weekStart) {
      return NextResponse.json({ error: 'Week start date is required' }, { status: 400 });
    }

    // Calculate week end (6 days after start)
    const startDate = new Date(weekStart);
    const endDate = addDays(startDate, 6);

    // Get all lessons for the specified week
    const lessons = await db.lesson.findMany({
      where: {
        tutorId: user.id,
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: { students: true }
    });

    if (lessons.length === 0) {
      return NextResponse.json({ message: 'No lessons to duplicate', createdLessons: [] });
    }

    // Duplicate each lesson
    const createdLessons = [];
    for (const lesson of lessons) {
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

      createdLessons.push(newLesson);
    }

    return NextResponse.json({ 
      message: `Duplicated ${createdLessons.length} lessons`,
      createdLessons 
    });
  } catch (error) {
    console.error('Duplicate week error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
