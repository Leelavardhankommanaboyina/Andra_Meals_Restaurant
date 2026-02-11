import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { Order, Table } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { ensureDefaultTablesConfigured } from '@/lib/tables';

const ACTIVE_ORDER_STATUSES = ['ongoing', 'completed'];

interface RouteParams {
  params: Promise<{ tableNumber: string }>;
}

function parseNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

async function getOccupiedSeats(tableNumber: number) {
  const occupancySummary = await Order.aggregate([
    {
      $match: {
        tableNumber,
        status: { $in: ACTIVE_ORDER_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        occupiedSeats: {
          $sum: {
            $let: {
              vars: { groupSize: { $ifNull: ['$groupSize', 0] } },
              in: { $cond: [{ $gt: ['$$groupSize', 0] }, '$$groupSize', 0] },
            },
          },
        },
      },
    },
  ]);

  return occupancySummary[0]?.occupiedSeats || 0;
}

// PATCH /api/tables/[tableNumber] - Update chair mapping for one table (Admin only)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();
    await ensureDefaultTablesConfigured();

    const user = await getCurrentUser(request);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse('Only admin can update table chair mapping');

    const { tableNumber: tableNumberParam } = await params;
    const tableNumber = Number(tableNumberParam);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      return errorResponse('Invalid table number');
    }

    const body = await request.json();
    const chairsTop = parseNonNegativeInt(body.chairsTop);
    const chairsBottom = parseNonNegativeInt(body.chairsBottom);

    if (chairsTop === null || chairsBottom === null) {
      return errorResponse('Chair counts must be non-negative whole numbers');
    }

    if (chairsTop > 20 || chairsBottom > 20) {
      return errorResponse('Chair counts cannot exceed 20');
    }

    const table = await Table.findOne({ tableNumber });
    if (!table) {
      return notFoundResponse('Table not found');
    }

    const occupiedSeats = await getOccupiedSeats(tableNumber);
    const newTotalSeats = chairsTop + chairsBottom;

    if (newTotalSeats < occupiedSeats) {
      return errorResponse(
        `Cannot set ${newTotalSeats} seats while ${occupiedSeats} seats are occupied`
      );
    }

    table.chairsTop = chairsTop;
    table.chairsBottom = chairsBottom;
    await table.save();

    return successResponse(
      {
        _id: table._id,
        tableNumber: table.tableNumber,
        chairsTop: table.chairsTop,
        chairsBottom: table.chairsBottom,
        totalSeats: newTotalSeats,
        occupiedSeats,
        availableSeats: newTotalSeats - occupiedSeats,
      },
      'Table chair mapping updated successfully'
    );
  } catch (error) {
    console.error('Update table chair mapping error:', error);
    return serverErrorResponse('Failed to update table chair mapping');
  }
}
