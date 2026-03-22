import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = '/home/z/my-project/upload';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// GET - Get files for a lesson
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = searchParams.get('lessonId');

    if (!lessonId) {
      return NextResponse.json({ error: 'Lesson ID is required' }, { status: 400 });
    }

    // Check access to lesson
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
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

    const files = await db.lessonFile.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Get files error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Upload file to lesson
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const lessonId = formData.get('lessonId') as string;

    if (!file || !lessonId) {
      return NextResponse.json({ error: 'File and lesson ID are required' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Check access to lesson
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { students: true }
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Only tutor can upload files
    if (lesson.tutorId !== user.id) {
      return NextResponse.json({ error: 'Only tutors can upload files' }, { status: 403 });
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const ext = path.extname(file.name);
    const filename = `${timestamp}-${randomString}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save to database - try with uploaderId first, fallback without
    let lessonFile;
    try {
      lessonFile = await db.lessonFile.create({
        data: {
          lessonId,
          uploaderId: user.id,
          filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          path: filePath
        }
      });
    } catch {
      // Fallback without uploaderId if schema doesn't have it
      lessonFile = await db.lessonFile.create({
        data: {
          lessonId,
          filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          path: filePath
        }
      });
    }

    // Notify students
    if (lesson.students.length > 0) {
      await db.notification.createMany({
        data: lesson.students.map(s => ({
          userId: s.studentId,
          type: 'NEW_FILE',
          title: 'Новый файл',
          message: `Загружен файл "${file.name}" к уроку "${lesson.title}"`,
          data: JSON.stringify({ lessonId, fileId: lessonFile.id })
        }))
      });
    }

    return NextResponse.json({ file: lessonFile });
  } catch (error) {
    console.error('Upload file error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
