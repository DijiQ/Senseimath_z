import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PUT - Accept or decline invitation
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
    const { action } = body;

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const tutorRequest = await db.tutorRequest.findUnique({
      where: { id },
      include: { tutor: true, student: true }
    });

    if (!tutorRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only student can accept/decline
    if (user.role === 'STUDENT' && tutorRequest.studentId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only tutor can cancel
    if (user.role === 'TUTOR' && tutorRequest.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'DECLINED';

    const updatedRequest = await db.tutorRequest.update({
      where: { id },
      data: { status: newStatus }
    });

    // Create notification for tutor
    if (user.role === 'STUDENT') {
      await db.notification.create({
        data: {
          userId: tutorRequest.tutorId,
          type: action === 'accept' ? 'INVITE_ACCEPTED' : 'INVITE_DECLINED',
          title: action === 'accept' ? 'Приглашение принято' : 'Приглашение отклонено',
          message: `Ученик ${tutorRequest.student.name || tutorRequest.student.username} ${action === 'accept' ? 'принял' : 'отклонил'} ваше приглашение`,
          data: JSON.stringify({ studentId: user.id })
        }
      });
    }

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    console.error('Update invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Accept or decline invitation (alternative method for frontend)
export async function PATCH(
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
    const { action } = body;

    if (!['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const tutorRequest = await db.tutorRequest.findUnique({
      where: { id },
      include: { tutor: true, student: true }
    });

    if (!tutorRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // For tutor accepting student's request to join
    if (user.role === 'TUTOR' && tutorRequest.tutorId === user.id && action === 'accept') {
      const updatedRequest = await db.tutorRequest.update({
        where: { id },
        data: { status: 'ACCEPTED' }
      });

      // Create notification for student
      await db.notification.create({
        data: {
          userId: tutorRequest.studentId,
          type: 'INVITE_ACCEPTED',
          title: 'Заявка принята',
          message: `Репетитор ${tutorRequest.tutor.name || tutorRequest.tutor.username} принял вашу заявку`,
          data: JSON.stringify({ tutorId: user.id })
        }
      });

      return NextResponse.json({ request: updatedRequest });
    }

    // Only student can accept/decline tutor's invitation
    if (user.role === 'STUDENT' && tutorRequest.studentId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (user.role === 'TUTOR' && tutorRequest.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const newStatus = action === 'accept' ? 'ACCEPTED' : 'DECLINED';

    const updatedRequest = await db.tutorRequest.update({
      where: { id },
      data: { status: newStatus }
    });

    // Create notification for tutor
    if (user.role === 'STUDENT') {
      await db.notification.create({
        data: {
          userId: tutorRequest.tutorId,
          type: action === 'accept' ? 'INVITE_ACCEPTED' : 'INVITE_DECLINED',
          title: action === 'accept' ? 'Приглашение принято' : 'Приглашение отклонено',
          message: `Ученик ${tutorRequest.student.name || tutorRequest.student.username} ${action === 'accept' ? 'принял' : 'отклонил'} ваше приглашение`,
          data: JSON.stringify({ studentId: user.id })
        }
      });
    }

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    console.error('Update invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Cancel invitation (tutor only)
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

    const tutorRequest = await db.tutorRequest.findUnique({
      where: { id }
    });

    if (!tutorRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (user.role === 'TUTOR' && tutorRequest.tutorId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (user.role === 'STUDENT' && tutorRequest.studentId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.tutorRequest.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invitation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
