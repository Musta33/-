import mongoose from 'mongoose';
import { InventoryItem } from './models/inventory.ts';

const Schema = mongoose.Schema;

const companySchema = new Schema({
  id: { type: String, default: () => Date.now().toString() },
  name: String,
  handle: { type: String },
  adminEmail: String,
  logoUrl: String,
  bannerUrl: String,
  accentColor: String,
  address: String,
  phoneNumber: String,
  approved: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  identityType: String,
  identityNumber: String,
  identityIssuer: String,
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const userSchema = new Schema({
  id: { type: String, default: () => Date.now().toString() },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: String,
  role: String,
  companyId: String,
  phoneNumber: String,
  plainPassword: String,
  pendingPassword: String,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  isLockedBySystem: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const contractSchema = new Schema({
  id: { type: String, default: () => Date.now().toString() },
  companyId: String,
  contractCode: String,
  renterName: String,
  renterPhone: String,
  carId: String,
  carModel: String,
  plateNumber: String,
  rentalDays: Number,
  dailyAmount: Number,
  rentalCost: Number,
  departureDate: Date,
  returnDate: Date,
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const gpsDeviceSchema = new Schema({
  id: { type: String, default: () => Date.now().toString() },
  companyId: String,
  userId: String,
  name: String,
  plate: String,
  lat: { type: Number, default: 33.3152 },
  lng: { type: Number, default: 44.3661 },
  status: { type: String, default: 'moving' },
  speed: { type: String, default: '45 كم/س' },
  deviceId: String,
  createdAt: { type: Date, default: Date.now }
});

// For other collections, we can use Schema.Types.Mixed if we don't have schemas yet
// To keep it simple for now, I'll use Mixed for others.

export const models = {
  Company: mongoose.model('Company', companySchema),
  User: mongoose.model('User', userSchema),
  InventoryItem: InventoryItem,
  Contract: mongoose.model('Contract', contractSchema),
  Staff: mongoose.model('Staff', new Schema({}, { strict: false })),
  Task: mongoose.model('Task', new Schema({}, { strict: false })),
  Customer: mongoose.model('Customer', new Schema({}, { strict: false })),
  Blocklist: mongoose.model('Blocklist', new Schema({}, { strict: false })),
  ExternalBlocklist: mongoose.model('ExternalBlocklist', new Schema({}, { strict: false })),
  Notification: mongoose.model('Notification', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    companyId: String,
    userId: String,
    message: String,
    type: String,
    createdAt: { type: Date, default: Date.now, expires: '24h' }
  }, { strict: false })),
  Chat: mongoose.model('Chat', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    type: { type: String, enum: ['group', 'personal'], default: 'personal' },
    participants: [String], // Array of user IDs
    name: String, // Chat name (optional for personal)
    createdAt: { type: Date, default: Date.now }
  })),
  Message: mongoose.model('Message', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    chatId: String,
    senderId: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
  })),
  Identity: mongoose.model('Identity', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    fullName: String,
    idNumber: String,
    scannedAt: { type: Date, default: Date.now }
  }, { strict: false })),
  GpsDevice: mongoose.model('GpsDevice', gpsDeviceSchema),
  Debt: mongoose.model('Debt', new Schema({}, { strict: false })),

  Employee: mongoose.model('Employee', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    companyId: String,
    name: String,
    role: String,
    baseSalary: Number,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }, { strict: false })),
  
  FinancialRecord: mongoose.model('FinancialRecord', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    companyId: String,
    branchId: String,
    type: { type: String, enum: ['income', 'expense'] },
    category: String,
    amount: Number,
    description: String,
    date: { type: String }, // e.g. "تموز / 2026" or ISO string
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }, { strict: false })),

  PayrollHistory: mongoose.model('PayrollHistory', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    companyId: String,
    empId: String,
    month: String,
    name: String,
    baseSalary: Number,
    allowance: Number,
    deduction: Number,
    netSalary: Number,
    status: String,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }, { strict: false })),

  Maintenance: mongoose.model('Maintenance', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    companyId: String,
    selectedCarId: String,
    total: Number,
    date: String,
    createdAt: { type: Date, default: Date.now }
  }, { strict: false }))
};

export const collectionModelMap: Record<string, any> = {
  'companies': models.Company,
  'users': models.User,
  'inventory': models.InventoryItem,
  'contracts': models.Contract,
  'staff': models.Staff,
  'system_tasks': models.Task,
  'customers': models.Customer,
  'blocklist': models.Blocklist,
  'external_blocklist': models.ExternalBlocklist,
  'notifications': models.Notification,
  'chats': models.Chat,
  'messages': models.Message,
  'identities': models.Identity,
  'gps_devices': models.GpsDevice,
  'maintenance': models.Maintenance,
  'debts': models.Debt,
  'employees': models.Employee,
  'payrollHistory': models.PayrollHistory,
  'financialRecords': models.FinancialRecord
};
