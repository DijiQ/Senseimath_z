import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET - Get notes (for tutor or student)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (user.role === 'TUTOR') {
      // Tutor gets notes for a specific student or all their notes
      const whereClause: { tutorId: string; studentId?: string } = {
        tutorId: user.id
      };

      if (studentId) {
        whereClause.studentId = studentId;
      }

      const notes = await db.note.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({ notes });
    } else {
      // Student gets notes written about them
      const notes = await db.note.findMany({
        where: {
          studentId: user.id
        },
        include: {
          tutor: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({ notes });
    }
  } catch (error) {
    console.error('Get notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new note (tutor only)
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'TUTOR') {
      return NextResponse.json({ error: 'Only tutors can create notes' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, title, content } = body;

    if (!studentId || !title || !content) {
      return NextResponse.json({ error: 'Student ID, title and content are required' }, { status: 400 });
    }

    // Verify student is assigned to this tutor
    const tutorStudent = await db.tutorRequest.findFirst({
      where: {
        tutorId: user.id,
        studentId,
        status: 'ACCEPTED'
      }
    });

    if (!tutorStudent) {
      return NextResponse.json({ error: 'Student is not assigned to you' }, { status: 400 });
    }

    const note = await db.note.create({
      data: {
        tutorId: user.id,
        studentId,
        title,
        content
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Create note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a note
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { noteId, title, content } = body;

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const note = await db.note.findUnique({
      where: { id: noteId }
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updatedNote = await db.note.update({
      where: { id: noteId },
      data: {
        title: title || note.title,
        content: content || note.content
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json({ note: updatedNote });
  } catch (error) {
    console.error('Update note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const note = await db.note.findUnique({
      where: { id: noteId }
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    if (note.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.note.delete({
      where: { id: noteId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
