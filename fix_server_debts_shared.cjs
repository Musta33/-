const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// GET /api/data/:collection
code = code.replace(
  "if (req.user?.branchId) ownerData.branchId = req.user.branchId;",
  "if (req.user?.branchId && collection !== 'debts') ownerData.branchId = req.user.branchId;"
);

// GET /api/data/:collection/:id
code = code.replace(
  "if (req.user?.branchId) filter.branchId = req.user.branchId;",
  "if (req.user?.branchId && collection !== 'debts') filter.branchId = req.user.branchId;"
);

// POST /api/data/:collection
code = code.replace(
  "if (req.user?.branchId) ownerData.branchId = req.user.branchId;",
  "if (req.user?.branchId && collection !== 'debts') ownerData.branchId = req.user.branchId;"
);

// PUT /api/data/:collection/:id
code = code.replace(
  "if (req.user?.branchId) ownerData.branchId = req.user.branchId;",
  "if (req.user?.branchId && collection !== 'debts') ownerData.branchId = req.user.branchId;"
);

fs.writeFileSync('server.ts', code);
