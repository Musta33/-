import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const inventoryItemSchema = new Schema({
  id: { type: String, default: () => Date.now().toString() },
  companyId: String,
  name: String,
  category: String,
  dailyPrice: Number,
  plateNumber: String,
  color: String,
  year: String,
  imageUrl: String,
  chassisNumber: String,
  engineNumber: String,
  ownerName: String,
  isInvested: { type: Boolean, default: false },
  investmentPercentage: { type: Number, default: 0 },
  status: { type: String, default: 'available' },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

export const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
