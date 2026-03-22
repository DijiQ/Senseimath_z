import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET - Get whiteboard state
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

    // Check access to lesson
    const lesson = await db.lesson.findUnique({
      where: { id },
      include: { students: true }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const hasAccess = 
      lesson.tutorId === user.id ||
      lesson.students.some(s => s.studentId === user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const whiteboard = await db.whiteboardState.findUnique({
      where: { lessonId: id }
    });

    return NextResponse.json({ 
      whiteboard: whiteboard ? JSON.parse(whiteboard.data) : null 
    });
  } catch (error) {
    console.error('Get whiteboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Save whiteboard state
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { data } = body;

    // Check access to lesson
    const lesson = await db.lesson.findUnique({
      where: { id },
      include: { students: true }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const hasAccess = 
      lesson.tutorId === user.id ||
      lesson.students.some(s => s.studentId === user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Upsert whiteboard state
    const whiteboard = await db.whiteboardState.upsert({
      where: { lessonId: id },
      update: { data: JSON.stringify(data) },
      create: {
        lessonId: id,
        data: JSON.stringify(data)
      }
    });

    return NextResponse.json({ whiteboard });
  } catch (error) {
    console.error('Save whiteboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Clear whiteboard
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check access to lesson
    const lesson = await db.lesson.findUnique({
      where: { id },
      include: { students: true }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Only tutor can clear whiteboard
    if (lesson.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.whiteboardState.deleteMany({
      where: { lessonId: id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear whiteboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
