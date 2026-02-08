import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'server';
}

export function signToken(payload: JWTPayload): string {
  // @ts-expect-error - expiresIn type issue with jwt library
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token');
  return token?.value || null;
}

export function getTokenFromRequest(request: NextRequest): string | null {
  // Try to get from Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get from cookies
  const token = request.cookies.get('auth-token');
  return token?.value || null;
}

export async function getCurrentUser(request: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export function isAdmin(user: JWTPayload | null): boolean {
  return user?.role === 'admin';
}

export function isServer(user: JWTPayload | null): boolean {
  return user?.role === 'server';
}
