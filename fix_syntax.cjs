const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// The replacement was: companyHandle -> companyHandle,\n          branchId: user.branchId

// Fix line 690: const { email, password, fullName, companyName, companyHandle,\n          branchId: user.branchId, phoneNumber } = req.body;
code = code.replace(/companyHandle,\n\s*branchId: user\.branchId,\s*phoneNumber/g, "companyHandle, phoneNumber");
code = code.replace(/companyHandle,\n\s*branchId: user\.branchId\)/g, "companyHandle)");
code = code.replace(/companyHandle,\n\s*branchId: user\.branchId \!/g, "companyHandle !");
code = code.replace(/companyHandle,\n\s*branchId: user\.branchId\.toLowerCase/g, "companyHandle.toLowerCase");
code = code.replace(/companyHandle,\n\s*branchId: user\.branchId/g, "companyHandle");

// Re-apply the ONLY correct branchId usages in server.ts
// 1. sendSuccess
code = code.replace(
  "const sendSuccess = (user: any, companyName: string, companyHandle: string) => {",
  "const sendSuccess = (user: any, companyName: string, companyHandle: string) => {"
);
// Wait, the correct token sign is:
code = code.replace(/const token = jwt\.sign\(\{ id: user\.id \|\| user\.uid, email: user\.email, role: user\.role, companyId: user\.companyId, branchId: user\.branchId \}\), JWT_SECRET, \{ expiresIn: '24h' \}\);/g, 
  "const token = jwt.sign({ id: user.id || user.uid, email: user.email, role: user.role, companyId: user.companyId, branchId: user.branchId }, JWT_SECRET, { expiresIn: '24h' });");

// Return response in sendSuccess:
const returnTokenBlockOld = `        token,
        user: {
          id: user.id || user.uid,
          uid: user.id || user.uid,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          companyId: user.companyId,
          companyName,
          companyHandle
        }`;
const returnTokenBlockNew = `        token,
        user: {
          id: user.id || user.uid,
          uid: user.id || user.uid,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          companyId: user.companyId,
          companyName,
          companyHandle,
          branchId: user.branchId
        }`;
code = code.replace(returnTokenBlockOld, returnTokenBlockNew);

fs.writeFileSync('server.ts', code);
