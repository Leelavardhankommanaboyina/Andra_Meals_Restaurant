import dbConnect from '@/lib/db';
import { User, MenuItem } from '@/lib/models';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api-response';

// Seed function - shared between GET and POST
async function seedDatabase() {
  try {
    await dbConnect();

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      return errorResponse('Database already seeded');
    }

    // Create admin user
    const admin = await User.create({
      username: 'admin',
      password: 'admin123', // Change this in production!
      role: 'admin',
      isActive: true,
    });

    // Create a sample server
    const server = await User.create({
      username: 'server1',
      password: 'server123',
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

    return successResponse(
      {
        admin: { username: admin.username, role: admin.role },
        server: { username: server.username, role: server.role },
        menuItemsCount: menuItems.length,
      },
      'Database seeded successfully',
      201
    );
  } catch (error) {
    console.error('Seed error:', error);
    return serverErrorResponse('Failed to seed database');
  }
}

// GET /api/seed - Seed database (for easy browser access)
export async function GET() {
  return seedDatabase();
}

// POST /api/seed - Seed database
export async function POST() {
  return seedDatabase();
}
