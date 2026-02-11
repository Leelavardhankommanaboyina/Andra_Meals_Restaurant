import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db';
import { User, MenuItem, Table } from '@/lib/models';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { ensureDefaultTablesConfigured } from '@/lib/tables';

// Seed function - shared between GET and POST
async function seedDatabase() {
  try {
    const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const serverUsername = process.env.SEED_SERVER_USERNAME || 'server1';
    const serverPassword = process.env.SEED_SERVER_PASSWORD;

    if (!adminPassword || !serverPassword) {
      return errorResponse(
        'Seed credentials are not configured. Set SEED_ADMIN_PASSWORD and SEED_SERVER_PASSWORD.',
        500
      );
    }

    await dbConnect();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return errorResponse('Database already seeded');
    }

    // Create admin user
    const admin = await User.create({
      username: adminUsername,
      password: adminPassword,
      role: 'admin',
      isActive: true,
    });

    // Create a sample server
    const server = await User.create({
      username: serverUsername,
      password: serverPassword,
      role: 'server',
      isActive: true,
    });

    // Create sample menu items
    const menuItems = await MenuItem.insertMany([
      { name: 'Chicken Biryani', price: 180, category: 'Main Course', isActive: true },
      { name: 'Mutton Biryani', price: 250, category: 'Main Course', isActive: true },
      { name: 'Veg Biryani', price: 120, category: 'Main Course', isActive: true },
      { name: 'Chicken Curry', price: 150, category: 'Main Course', isActive: true },
      { name: 'Mutton Curry', price: 200, category: 'Main Course', isActive: true },
      { name: 'Dal Fry', price: 80, category: 'Main Course', isActive: true },
      { name: 'Paneer Butter Masala', price: 160, category: 'Main Course', isActive: true },
      { name: 'Butter Naan', price: 30, category: 'Breads', isActive: true },
      { name: 'Roti', price: 15, category: 'Breads', isActive: true },
      { name: 'Garlic Naan', price: 40, category: 'Breads', isActive: true },
      { name: 'Plain Rice', price: 50, category: 'Rice', isActive: true },
      { name: 'Jeera Rice', price: 70, category: 'Rice', isActive: true },
      { name: 'Raita', price: 40, category: 'Sides', isActive: true },
      { name: 'Papad', price: 20, category: 'Sides', isActive: true },
      { name: 'Gulab Jamun', price: 50, category: 'Desserts', isActive: true },
      { name: 'Ice Cream', price: 60, category: 'Desserts', isActive: true },
      { name: 'Cold Drink', price: 40, category: 'Beverages', isActive: true },
      { name: 'Lassi', price: 50, category: 'Beverages', isActive: true },
      { name: 'Buttermilk', price: 30, category: 'Beverages', isActive: true },
      { name: 'Water Bottle', price: 20, category: 'Beverages', isActive: true },
    ]);
    await ensureDefaultTablesConfigured();
    const tablesCount = await Table.countDocuments();

    return successResponse(
      {
        admin: { username: admin.username, role: admin.role },
        server: { username: server.username, role: server.role },
        menuItemsCount: menuItems.length,
        tablesCount,
      },
      'Database seeded successfully',
      201
    );
  } catch (error) {
    console.error('Seed error:', error);
    return serverErrorResponse('Failed to seed database');
  }
}

function authorizeSeed(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return errorResponse('Seed endpoint is disabled in production', 403);
  }

  const seedKey = process.env.SEED_KEY;
  if (!seedKey) {
    return errorResponse('SEED_KEY is not configured', 403);
  }

  const providedKey = request.headers.get('x-seed-key');
  if (providedKey !== seedKey) {
    return errorResponse('Invalid seed key', 403);
  }

  return null;
}

// GET /api/seed - Seed database (for easy browser access)
export async function GET(request: NextRequest) {
  const authError = authorizeSeed(request);
  if (authError) return authError;
  return seedDatabase();
}

// POST /api/seed - Seed database
export async function POST(request: NextRequest) {
  const authError = authorizeSeed(request);
  if (authError) return authError;
  return seedDatabase();
}
