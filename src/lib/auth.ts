import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/db';
import { User } from '@/lib/models';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const INSECURE_DEFAULT_JWT_SECRET = 'your-super-secure-jwt-secret-key-change-this-in-production';
const AUTH_USER_CACHE_TTL_MS = Number.parseInt(
  process.env.AUTH_USER_CACHE_TTL_MS || '10000',
  10
);

declare global {
  // eslint-disable-next-line no-var
  var __authUserCache:
    | Map<
        string,
        {
          user: JWTPayload | null;
          expiresAt: number;
        }
      >
    | undefined;
}

function getAuthUserCache() {
  if (!global.__authUserCache) {
    global.__authUserCache = new Map();
  }
  return global.__authUserCache;
}

function getJwtSecret(): string {
  if (!JWT_SECRET || JWT_SECRET.trim().length === 0) {
    throw new Error('JWT_SECRET is not configured');
  }

  if (JWT_SECRET === INSECURE_DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET uses the default insecure value. Set a strong random secret.');
  }

  return JWT_SECRET;
}

export interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'server' | 'servent';
}

export function signToken(payload: JWTPayload): string {
  // @ts-expect-error - expiresIn type issue with jwt library
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
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

  const decoded = verifyToken(token);
  if (!decoded) return null;

  try {
    const cacheKey = decoded.userId;
    const cache = getAuthUserCache();
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      if (!cached.user) {
        return null;
      }

      if (cached.user.role !== decoded.role) {
        return null;
      }

      return cached.user;
    }

    await dbConnect();
    const user = await User.findById(decoded.userId)
      .select('_id username role isActive')
      .lean();

    const resolved =
      user && user.isActive && user.role === decoded.role
        ? {
            userId: user._id.toString(),
            username: user.username,
            role: user.role,
        }
        : null;

    cache.set(cacheKey, {
      user: resolved,
      expiresAt: now + (Number.isFinite(AUTH_USER_CACHE_TTL_MS) ? AUTH_USER_CACHE_TTL_MS : 10000),
    });

    return resolved;
  } catch {
    return null;
  }
}

export function isAdmin(user: JWTPayload | null): boolean {
  return user?.role === 'admin';
}

export function isServer(user: JWTPayload | null): boolean {
  return user?.role === 'server';
}

export function isServent(user: JWTPayload | null): boolean {
  return user?.role === 'servent';
}
