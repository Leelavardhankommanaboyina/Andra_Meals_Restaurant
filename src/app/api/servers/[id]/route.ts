import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { User } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { emitSocketEvent, SOCKET_EVENTS } from '@/lib/socket-emit';
import bcrypt from 'bcryptjs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/servers/[id] - Get single server (Admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can view server details');
    }

    const { id } = await params;
    const server = await User.findOne({ _id: id, role: 'server' })
      .select('-password')
      .lean();

    if (!server) {
      return notFoundResponse('Server not found');
    }

    return successResponse(server);
  } catch (error) {
    console.error('Get server error:', error);
    return serverErrorResponse('Failed to fetch server');
  }
}

// PATCH /api/servers/[id] - Update server (Admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can update servers');
    }

    const { id } = await params;
    const body = await request.json();

    const { username, password, isActive } = body;

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (username !== undefined) {
      // Check if username already exists
      const existingUser = await User.findOne({
        username,
        _id: { $ne: id },
      });

      if (existingUser) {
        return errorResponse('Username already exists');
      }

      updateData.username = username;
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return errorResponse('Password must be at least 6 characters');
      }
      const salt = await bcrypt.genSalt(12);
      updateData.password = await bcrypt.hash(password, salt);
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const updatedServer = await User.findOneAndUpdate(
      { _id: id, role: 'server' },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-password')
      .lean();

    if (!updatedServer) {
      return notFoundResponse('Server not found');
    }

    // Emit real-time event
    if (isActive !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.SERVER_TOGGLED, updatedServer);
    } else {
      emitSocketEvent(SOCKET_EVENTS.SERVER_UPDATED, updatedServer);
    }

    return successResponse(updatedServer, 'Server updated successfully');
  } catch (error) {
    console.error('Update server error:', error);
    return serverErrorResponse('Failed to update server');
  }
}

// DELETE /api/servers/[id] - Delete server (Admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can delete servers');
    }

    const { id } = await params;
    const deletedServer = await User.findOneAndDelete({
      _id: id,
      role: 'server',
    }).lean();

    if (!deletedServer) {
      return notFoundResponse('Server not found');
    }

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.SERVER_DELETED, { _id: id });

    return successResponse(null, 'Server deleted successfully');
  } catch (error) {
    console.error('Delete server error:', error);
    return serverErrorResponse('Failed to delete server');
  }
}
