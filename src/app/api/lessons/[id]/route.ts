import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET - Get specific lesson
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const lesson = await db.lesson.findUnique({
      where: { id },
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
        files: true,
        whiteboard: true
      }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Check access
    if (user.role === 'TUTOR' && lesson.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (user.role === 'STUDENT') {
      const isStudent = lesson.students.some(s => s.studentId === user.id);
      if (!isStudent) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error('Get lesson error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update lesson
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can update lessons' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, date, duration, studentIds } = body;

    const existingLesson = await db.lesson.findUnique({
      where: { id },
      include: { students: true }
    });

    if (!existingLesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    if (existingLesson.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update lesson
    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = new Date(date);
    if (duration !== undefined) updateData.duration = duration;

    // Update students if provided
    if (studentIds && studentIds.length > 0) {
      // Verify students
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

      // Delete existing student relations
      await db.lessonStudent.deleteMany({
        where: { lessonId: id }
      });

      // Create new student relations
      await db.lessonStudent.createMany({
        data: studentIds.map((studentId: string) => ({
          lessonId: id,
          studentId
        }))
      });

      // Notify new students
      const newStudentIds = studentIds.filter(
        (sId: string) => !existingLesson.students.some(s => s.studentId === sId)
      );

      if (newStudentIds.length > 0) {
        await db.notification.createMany({
          data: newStudentIds.map((studentId: string) => ({
            userId: studentId,
            type: 'NEW_LESSON',
            title: 'Новый урок',
            message: `Вас добавили на урок "${title || existingLesson.title}" на ${new Date(date || existingLesson.date).toLocaleString('ru-RU')}`,
            data: JSON.stringify({ lessonId: id })
          }))
        });
      }
    }

    const lesson = await db.lesson.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json({ lesson });
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete lesson
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can delete lessons' }, { status: 403 });
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

    // Notify students
    await db.notification.createMany({
      data: lesson.students.map(s => ({
        userId: s.studentId,
        type: 'LESSON_CANCELLED',
        title: 'Урок отменён',
        message: `Урок "${lesson.title}" был отменён`,
        data: JSON.stringify({ lessonId: id })
      }))
    });

    await db.lesson.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete lesson error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
