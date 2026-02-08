import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMenuItem extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  price: number;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      unique: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for search functionality
MenuItemSchema.index({ name: 'text', category: 'text' });
MenuItemSchema.index({ category: 1, isActive: 1 });
MenuItemSchema.index({ isActive: 1 });

const MenuItem: Model<IMenuItem> =
  mongoose.models.MenuItem || mongoose.model<IMenuItem>('MenuItem', MenuItemSchema);

export default MenuItem;
