import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  
  if (!user) {
    return unauthorizedResponse('Not authenticated');
  }

  return successResponse({
    user: {
      id: user.userId,
      username: user.username,
      role: user.role,
    },
  });
}
