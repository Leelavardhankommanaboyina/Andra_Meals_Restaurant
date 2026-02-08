import { NextResponse } from 'next/server';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function successResponse<T>(data: T, message?: string, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    { status }
  );
}

export function errorResponse(error: string, status: number = 400): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status }
  );
}

export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return errorResponse(message, 403);
}

export function notFoundResponse(message: string = 'Not found'): NextResponse {
  return errorResponse(message, 404);
}

export function validationErrorResponse(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      details: errors,
    },
    { status: 400 }
  );
}

export function serverErrorResponse(message: string = 'Internal server error'): NextResponse {
  console.error('Server error:', message);
  return errorResponse(message, 500);
}
