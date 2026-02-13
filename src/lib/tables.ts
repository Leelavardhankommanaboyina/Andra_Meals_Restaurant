import { Table } from '@/lib/models';

const DEFAULT_TABLE_COUNT = parseInt(process.env.NEXT_PUBLIC_MAX_TABLE_NUMBER || '20', 10);
const DEFAULT_CHAIRS_TOP = parseInt(process.env.DEFAULT_TABLE_CHAIRS_TOP || '2', 10);
const DEFAULT_CHAIRS_BOTTOM = parseInt(process.env.DEFAULT_TABLE_CHAIRS_BOTTOM || '2', 10);

declare global {
  // eslint-disable-next-line no-var
  var __tablesConfigured: boolean | undefined;
}

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function normalizeChairCount(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 0) {
    return fallback;
  }
  return Math.min(20, value);
}

export function getDefaultTableSettings() {
  return {
    tableCount: normalizePositiveInt(DEFAULT_TABLE_COUNT, 20),
    chairsTop: normalizeChairCount(DEFAULT_CHAIRS_TOP, 2),
    chairsBottom: normalizeChairCount(DEFAULT_CHAIRS_BOTTOM, 2),
  };
}

export async function ensureDefaultTablesConfigured(): Promise<void> {
  if (global.__tablesConfigured) return;

  const existingCount = await Table.countDocuments();
  if (existingCount > 0) {
    global.__tablesConfigured = true;
    return;
  }

  const defaults = getDefaultTableSettings();
  const documents = Array.from({ length: defaults.tableCount }, (_, index) => ({
    tableNumber: index + 1,
    chairsTop: defaults.chairsTop,
    chairsBottom: defaults.chairsBottom,
  }));

  try {
    await Table.insertMany(documents, { ordered: false });
  } catch (error) {
    // Ignore duplicate insert races across concurrent requests.
    if (!(error instanceof Error) || !error.message.includes('E11000')) {
      throw error;
    }
  }

  global.__tablesConfigured = true;
}
