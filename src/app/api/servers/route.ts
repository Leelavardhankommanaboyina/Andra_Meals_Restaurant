import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { registerServerSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket-emit';

// GET /api/servers - Get all servers (Admin only)
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can view servers');
    }

    const servers = await User.find({ role: 'server' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    return successResponse({
      servers,
      total: servers.length,
    });
  } catch (error) {
    console.error('Get servers error:', error);
    return serverErrorResponse('Failed to fetch servers');
  }
}

// POST /api/servers - Add new server (Admin only)
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can add servers');
    }

    const body = await request.json();

    // Validate input
    const validationResult = registerServerSchema.safeParse(body);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => e.message);
      return errorResponse(errors.join(', '));
    }

    // Check if username already exists
    const existingUser = await User.findOne({
      username: validationResult.data.username,
    });

    if (existingUser) {
      return errorResponse('Username already exists');
    }

    const newServer = await User.create({
      ...validationResult.data,
      role: 'server',
    });

    const serverData = {
      _id: newServer._id,
      username: newServer.username,
      role: newServer.role,
      isActive: newServer.isActive,
      createdAt: newServer.createdAt,
    };

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.SERVER_CREATED, serverData);

    return successResponse(serverData, 'Server added successfully', 201);
  } catch (error) {
    console.error('Add server error:', error);
    return serverErrorResponse('Failed to add server');
  }
}
