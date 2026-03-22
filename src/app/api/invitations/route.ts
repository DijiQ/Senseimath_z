import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET - Get pending invitations for student
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role === 'TUTOR') {
      // Get pending requests sent by tutor
      const requests = await db.tutorRequest.findMany({
        where: {
          tutorId: user.id,
          status: 'PENDING'
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
      return NextResponse.json({ requests });
    } else {
      // Get pending invitations for student
      const requests = await db.tutorRequest.findMany({
        where: {
          studentId: user.id,
          status: 'PENDING'
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
      return NextResponse.json({ requests });
    }
  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
