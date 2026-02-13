import mongoose, { Schema, Document, Model } from 'mongoose';

export type OrderStatus = 'ongoing' | 'completed' | 'paid' | 'cancelled';

export interface IOrderItem {
  _id?: mongoose.Types.ObjectId;
  menuItem: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  isDelivered: boolean;
  // Track which server added this item for distributed delivery
  addedByServerId: mongoose.Types.ObjectId;
  addedByServerName: string;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  tableNumber: number;
  customerName: string;
  clientRequestId?: string;
  groupSize?: number | null;
  items: IOrderItem[];
  status: OrderStatus;
  serverId: mongoose.Types.ObjectId; // Original server who created the order
  serverName: string;
  deliveryAssigneeId?: mongoose.Types.ObjectId;
  deliveryAssigneeName?: string;
  deliveryAssigneeRole?: 'server' | 'servent';
  assignedById?: mongoose.Types.ObjectId;
  assignedByName?: string;
  assignedAt?: Date;
  totalAmount: number;
  paidAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    menuItem: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    isDelivered: {
      type: Boolean,
      default: false,
    },
    // Server who added this item - they are responsible for delivery
    addedByServerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    addedByServerName: {
      type: String,
      required: true,
    },
  }
);

const OrderSchema = new Schema<IOrder>(
  {
    tableNumber: {
      type: Number,
      required: [true, 'Table number is required'],
      min: [1, 'Table number must be at least 1'],
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: [50, 'Customer name cannot exceed 50 characters'],
    },
    clientRequestId: {
      type: String,
      trim: true,
      maxlength: [120, 'Client request ID cannot exceed 120 characters'],
    },
    groupSize: {
      type: Number,
      min: [1, 'Group size must be at least 1'],
      max: [30, 'Group size cannot exceed 30'],
      default: null,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: function (items: IOrderItem[]) {
          return items.length > 0;
        },
        message: 'Order must have at least one item',
      },
    },
    status: {
      type: String,
      enum: ['ongoing', 'completed', 'paid', 'cancelled'],
      default: 'ongoing',
    },
    serverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serverName: {
      type: String,
      required: true,
    },
    deliveryAssigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    deliveryAssigneeName: {
      type: String,
    },
    deliveryAssigneeRole: {
      type: String,
      enum: ['server', 'servent'],
    },
    assignedById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedByName: {
      type: String,
    },
    assignedAt: {
      type: Date,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    paidAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Calculate total amount before saving
OrderSchema.pre('save', function () {
  this.totalAmount = this.items.reduce((total, item) => {
    return total + item.price * item.quantity;
  }, 0);
});

// Compound indexes for efficient queries
OrderSchema.index({ tableNumber: 1, status: 1 });
OrderSchema.index({ serverId: 1, status: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ tableNumber: 1, customerName: 1, status: 1 });
OrderSchema.index({ paidAt: -1 });
// Index for finding orders where a specific server has items to deliver
OrderSchema.index({ 'items.addedByServerId': 1, 'items.isDelivered': 1, status: 1 });
OrderSchema.index({ deliveryAssigneeId: 1, status: 1 });
OrderSchema.index({ deliveryAssigneeRole: 1, status: 1 });
OrderSchema.index({ clientRequestId: 1 }, { unique: true, sparse: true });

const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);

export default Order;
