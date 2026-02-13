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
import { emitSocketEvent, SOCKET_EVENTS, ROOMS } from '@/lib/socket-emit';
import bcrypt from 'bcryptjs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/servers/[id] - Get single staff account (Admin only)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can view staff details');
    }

    const { id } = await params;
    const server = await User.findOne({ _id: id, role: { $in: ['server', 'servent'] } })
      .select('-password')
      .lean();

    if (!server) {
      return notFoundResponse('Staff not found');
    }

    return successResponse(server);
  } catch (error) {
    console.error('Get staff error:', error);
    return serverErrorResponse('Failed to fetch staff');
  }
}

// PATCH /api/servers/[id] - Update staff (Admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can update staff');
    }

    const { id } = await params;
    const body = await request.json();

    const { username, password, isActive, role } = body;

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

    if (role !== undefined) {
      if (role !== 'server' && role !== 'servent') {
        return errorResponse('Invalid role');
      }
      updateData.role = role;
    }

    const updatedServer = await User.findOneAndUpdate(
      { _id: id, role: { $in: ['server', 'servent'] } },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-password')
      .lean();

    if (!updatedServer) {
      return notFoundResponse('Staff not found');
    }

    // Emit real-time event
    if (isActive !== undefined) {
      emitSocketEvent(SOCKET_EVENTS.SERVER_TOGGLED, updatedServer, ROOMS.ADMIN);
    } else {
      emitSocketEvent(SOCKET_EVENTS.SERVER_UPDATED, updatedServer, ROOMS.ADMIN);
    }

    return successResponse(updatedServer, 'Staff updated successfully');
  } catch (error) {
    console.error('Update staff error:', error);
    return serverErrorResponse('Failed to update staff');
  }
}

// DELETE /api/servers/[id] - Delete staff (Admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    if (!isAdmin(user)) {
      return forbiddenResponse('Only admin can delete staff');
    }

    const { id } = await params;
    const deletedServer = await User.findOneAndDelete({
      _id: id,
      role: { $in: ['server', 'servent'] },
    }).lean();

    if (!deletedServer) {
      return notFoundResponse('Staff not found');
    }

    // Emit real-time event
    emitSocketEvent(SOCKET_EVENTS.SERVER_DELETED, { _id: id }, ROOMS.ADMIN);

    return successResponse(null, 'Staff deleted successfully');
  } catch (error) {
    console.error('Delete staff error:', error);
    return serverErrorResponse('Failed to delete staff');
  }
}
