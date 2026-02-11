import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITable extends Document {
  _id: mongoose.Types.ObjectId;
  tableNumber: number;
  chairsTop: number;
  chairsBottom: number;
  createdAt: Date;
  updatedAt: Date;
}

const TableSchema = new Schema<ITable>(
  {
    tableNumber: {
      type: Number,
      required: [true, 'Table number is required'],
      unique: true,
      min: [1, 'Table number must be at least 1'],
    },
    chairsTop: {
      type: Number,
      required: [true, 'Top chair count is required'],
      min: [0, 'Top chair count cannot be negative'],
      max: [20, 'Top chair count cannot exceed 20'],
      default: 2,
    },
    chairsBottom: {
      type: Number,
      required: [true, 'Bottom chair count is required'],
      min: [0, 'Bottom chair count cannot be negative'],
      max: [20, 'Bottom chair count cannot exceed 20'],
      default: 2,
    },
  },
  {
    timestamps: true,
  }
);

const Table: Model<ITable> =
  mongoose.models.Table || mongoose.model<ITable>('Table', TableSchema);

export default Table;
