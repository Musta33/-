const fs = require('fs');

let content = fs.readFileSync('server/models.ts', 'utf8');

const additionalSchemas = `
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
`;

content = content.replace(
  "PayrollHistory: mongoose.model('PayrollHistory', new Schema({",
  additionalSchemas + "\n  PayrollHistory: mongoose.model('PayrollHistory', new Schema({"
);

content = content.replace(
  "'payrollHistory': models.PayrollHistory",
  "'payrollHistory': models.PayrollHistory,\n  'financialRecords': models.FinancialRecord"
);

fs.writeFileSync('server/models.ts', content);
