const fs = require('fs');

let content = fs.readFileSync('server/models.ts', 'utf8');

const additionalSchemas = `
  Employee: mongoose.model('Employee', new Schema({
    id: { type: String, default: () => Date.now().toString() },
    companyId: String,
    name: String,
    role: String,
    baseSalary: Number,
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
`;

content = content.replace(
  "Debt: mongoose.model('Debt', new Schema({}, { strict: false })),",
  "Debt: mongoose.model('Debt', new Schema({}, { strict: false })),\n" + additionalSchemas
);

content = content.replace(
  "'debts': models.Debt",
  "'debts': models.Debt,\n  'employees': models.Employee,\n  'payrollHistory': models.PayrollHistory"
);

fs.writeFileSync('server/models.ts', content);
