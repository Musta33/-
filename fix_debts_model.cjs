const fs = require('fs');
let code = fs.readFileSync('server/models.ts', 'utf8');

if (!code.includes('Debt: mongoose.model')) {
    code = code.replace(
        "Maintenance: mongoose.model('Maintenance', new Schema({",
        "Debt: mongoose.model('Debt', new Schema({}, { strict: false })),\n  Maintenance: mongoose.model('Maintenance', new Schema({"
    );
}

if (!code.includes("'debts': models.Debt")) {
    code = code.replace(
        "'maintenance': models.Maintenance",
        "'maintenance': models.Maintenance,\n  'debts': models.Debt"
    );
}

fs.writeFileSync('server/models.ts', code);
