import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/lib/models';
import { signToken } from '@/lib/auth';
import { loginSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { checkRateLimit, getClientIP, resetRateLimit } from '@/lib/rate-limit';
import { RATE_LIMITS, VALIDATION_MESSAGES, API_MESSAGES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`login:${clientIP}`, {
      maxAttempts: RATE_LIMITS.LOGIN_ATTEMPTS,
      windowMs: RATE_LIMITS.LOGIN_WINDOW_MS,
    });

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000);
      return errorResponse(
        `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        429
      );
    }

    await dbConnect();

    const body = await request.json();
    
    // Validate input
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => e.message);
      return errorResponse(errors.join(', '));
    }

    const { username, password } = validationResult.data;

    // Find user with password field
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return errorResponse(VALIDATION_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Check if user is active
    if (!user.isActive) {
      return errorResponse(VALIDATION_MESSAGES.USER_INACTIVE, 401);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return errorResponse(VALIDATION_MESSAGES.INVALID_CREDENTIALS, 401);
    }

    // Reset rate limit on successful login
    resetRateLimit(`login:${clientIP}`);

    // Generate JWT token
    const token = signToken({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    });

    // Create response with cookie
    const response = successResponse(
      {
        user: {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
        },
        token,
      },
      API_MESSAGES.LOGIN_SUCCESS
    );

    // Set HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return serverErrorResponse('An error occurred during login');
  }
}
