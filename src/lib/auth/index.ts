import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { User } from '@prisma/client';

const SESSION_COOKIE_NAME = 'senseimath_session';
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createSession(userId: string): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify({
    userId,
    token: sessionToken,
    expiresAt: expiresAt.toISOString()
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt
  });
  
  return sessionToken;
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionCookie.value);
    
    if (new Date(session.expiresAt) < new Date()) {
      return null;
    }
    
    return { userId: session.userId };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  
  if (!session) {
    return null;
  }
  
  const user = await db.user.findUnique({
    where: { id: session.userId }
  });
  
  return user;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

function generateSessionToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function requireAuth(redirectTo?: string) {
  return async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }
    return user;
  };
}

export function requireRole(role: 'TUTOR' | 'STUDENT') {
  return async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }
    if (user.role !== role) {
      throw new Error('Forbidden');
    }
    return user;
  };
}
