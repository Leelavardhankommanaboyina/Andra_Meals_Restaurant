import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { Order, Table } from '@/lib/models';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { ensureDefaultTablesConfigured, getDefaultTableSettings } from '@/lib/tables';

const ACTIVE_ORDER_STATUSES = ['ongoing', 'completed'];

function parseNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function withOccupancy(
  tables: Array<{ _id: unknown; tableNumber: number; chairsTop: number; chairsBottom: number }>,
  occupancyMap: Map<number, number>
) {
  return tables.map((table) => {
    const totalSeats = table.chairsTop + table.chairsBottom;
    const occupiedSeats = occupancyMap.get(table.tableNumber) || 0;
    const availableSeats = Math.max(totalSeats - occupiedSeats, 0);
    const overflowSeats = Math.max(occupiedSeats - totalSeats, 0);

    return {
      ...table,
      totalSeats,
      occupiedSeats,
      availableSeats,
      overflowSeats,
    };
  });
}

async function getOccupancyMap() {
  const occupancyRows = await Order.aggregate([
    {
      $match: {
        status: { $in: ACTIVE_ORDER_STATUSES },
      },
    },
    {
      $group: {
        _id: '$tableNumber',
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

  const occupancyMap = new Map<number, number>();
  for (const row of occupancyRows) {
    occupancyMap.set(Number(row._id), Number(row.occupiedSeats) || 0);
  }

  return occupancyMap;
}

// GET /api/tables - Get all table configs with live occupancy
export async function GET(request: NextRequest) {
  try {
    await dbConnect();
    await ensureDefaultTablesConfigured();

    const user = await getCurrentUser(request);
    if (!user) return unauthorizedResponse();

    const tables = await Table.find()
      .sort({ tableNumber: 1 })
      .select('_id tableNumber chairsTop chairsBottom')
      .lean();

    const occupancyMap = await getOccupancyMap();
    const tablesWithOccupancy = withOccupancy(tables, occupancyMap);

    const totalSeats = tablesWithOccupancy.reduce((sum, table) => sum + table.totalSeats, 0);
    const occupiedSeats = tablesWithOccupancy.reduce((sum, table) => sum + table.occupiedSeats, 0);
    const availableSeats = Math.max(totalSeats - occupiedSeats, 0);

    return successResponse({
      tables: tablesWithOccupancy,
      summary: {
        totalTables: tablesWithOccupancy.length,
        totalSeats,
        occupiedSeats,
        availableSeats,
      },
    });
  } catch (error) {
    console.error('Get tables error:', error);
    return serverErrorResponse('Failed to fetch table configuration');
  }
}

// PUT /api/tables - Update table count (Admin only)
export async function PUT(request: NextRequest) {
  try {
    await dbConnect();
    await ensureDefaultTablesConfigured();

    const user = await getCurrentUser(request);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse('Only admin can configure tables');

    const body = await request.json();
    const totalTables = parsePositiveInt(body.totalTables);
    if (totalTables === null) {
      return errorResponse('Total tables must be a positive whole number');
    }
    if (totalTables > 200) {
      return errorResponse('Total tables cannot exceed 200');
    }

    const defaults = getDefaultTableSettings();
    const defaultChairsTop =
      body.defaultChairsTop === undefined
        ? defaults.chairsTop
        : parseNonNegativeInt(body.defaultChairsTop);
    const defaultChairsBottom =
      body.defaultChairsBottom === undefined
        ? defaults.chairsBottom
        : parseNonNegativeInt(body.defaultChairsBottom);

    if (defaultChairsTop === null || defaultChairsBottom === null) {
      return errorResponse('Default chair values must be non-negative whole numbers');
    }

    if (defaultChairsTop > 20 || defaultChairsBottom > 20) {
      return errorResponse('Default chair values cannot exceed 20');
    }

    const highestActiveOrder = await Order.findOne({
      status: { $in: ACTIVE_ORDER_STATUSES },
    })
      .sort({ tableNumber: -1 })
      .select('tableNumber')
      .lean();

    if (highestActiveOrder && totalTables < highestActiveOrder.tableNumber) {
      return errorResponse(
        `Cannot reduce tables below ${highestActiveOrder.tableNumber} while active orders exist`
      );
    }

    const existingTables = await Table.find()
      .sort({ tableNumber: 1 })
      .select('tableNumber')
      .lean();
    const existingNumbers = new Set(existingTables.map((table) => table.tableNumber));

    const tablesToInsert: Array<{ tableNumber: number; chairsTop: number; chairsBottom: number }> =
      [];
    for (let tableNumber = 1; tableNumber <= totalTables; tableNumber++) {
      if (!existingNumbers.has(tableNumber)) {
        tablesToInsert.push({
          tableNumber,
          chairsTop: defaultChairsTop,
          chairsBottom: defaultChairsBottom,
        });
      }
    }

    if (tablesToInsert.length > 0) {
      try {
        await Table.insertMany(tablesToInsert, { ordered: false });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('E11000')) {
          throw error;
        }
      }
    }

    await Table.deleteMany({ tableNumber: { $gt: totalTables } });

    const updatedTables = await Table.find()
      .sort({ tableNumber: 1 })
      .select('_id tableNumber chairsTop chairsBottom')
      .lean();

    const occupancyMap = await getOccupancyMap();
    const tablesWithOccupancy = withOccupancy(updatedTables, occupancyMap);

    const totalSeats = tablesWithOccupancy.reduce((sum, table) => sum + table.totalSeats, 0);
    const occupiedSeats = tablesWithOccupancy.reduce((sum, table) => sum + table.occupiedSeats, 0);
    const availableSeats = Math.max(totalSeats - occupiedSeats, 0);

    return successResponse(
      {
        tables: tablesWithOccupancy,
        summary: {
          totalTables: tablesWithOccupancy.length,
          totalSeats,
          occupiedSeats,
          availableSeats,
        },
      },
      'Table count updated successfully'
    );
  } catch (error) {
    console.error('Update table count error:', error);
    return serverErrorResponse('Failed to update table count');
  }
}
