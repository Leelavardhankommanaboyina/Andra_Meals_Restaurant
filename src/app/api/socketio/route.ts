import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // This endpoint is just a placeholder for the Socket.io path
  // The actual Socket.io handling is done by the custom server
  return NextResponse.json({ message: 'Socket.io endpoint' });
}
