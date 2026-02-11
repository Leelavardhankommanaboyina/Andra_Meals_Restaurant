import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

type UserRole = 'admin' | 'server';

function unauthorizedRedirect(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.delete('auth-token');
  return response;
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  if (!token) {
    return unauthorizedRedirect(request);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return unauthorizedRedirect(request);
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret)
    );

    const role = payload.role as UserRole | undefined;
    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith('/admin') && role !== 'admin') {
      return unauthorizedRedirect(request);
    }

    if (pathname.startsWith('/server') && role !== 'server') {
      return unauthorizedRedirect(request);
    }

    return NextResponse.next();
  } catch {
    return unauthorizedRedirect(request);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/server/:path*'],
};
