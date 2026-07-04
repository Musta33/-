const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Find the bad replace and fix it
content = content.replace(
  "if (!isGlobal if (!isGlobal && userId && list[index].userId !== userId) {if (!isGlobal && userId && list[index].userId !== userId) { userId if (!isGlobal && userId && list[index].userId !== userId) {if (!isGlobal && userId && list[index].userId !== userId) { list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {",
  "if (!isGlobal && userId && list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {"
);

// Fallback if the exact string match fails, use regex
content = content.replace(/if \(\!isGlobal if \(\!isGlobal[^\n]*\n[^\n]*\n[^\n]*\n/g, "if (!isGlobal && userId && list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {");

content = content.replace(/if \(\!isGlobal if \(\!isGlobal[\s\S]*?superadmin'\) \{/g, "if (!isGlobal && userId && list[index].userId !== userId && list[index].companyId !== req.user?.companyId && req.user?.role !== 'super_admin' && req.user?.role !== 'superadmin') {");


fs.writeFileSync('server.ts', content);
console.log('Fixed PUT route syntax error');
