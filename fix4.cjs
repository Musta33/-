const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Find the bad syntax
content = content.replace(
  "if (!isGlobal && userId && list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {\n    data[collection][index] =",
  "if (!isGlobal && userId && list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {\n      return res.status(403).json({ message: \"غير مسموح لك بتعديل هذا العنصر\" });\n    }\n    data[collection][index] ="
);

fs.writeFileSync('server.ts', content);
console.log('Fixed PUT route syntax error (missing bracket and return)');
