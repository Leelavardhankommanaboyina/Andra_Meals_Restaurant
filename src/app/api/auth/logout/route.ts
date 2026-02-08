import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const response = successResponse(null, 'Logged out successfully');
  
  // Clear the auth cookie
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
