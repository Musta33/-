const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'app.post("/api/register-branch", authenticateToken, async (req, res) => {',
  'app.post("/api/register-branch", authenticateToken, async (req: any, res: any) => {'
);

code = code.replace(/let ownerData = \{\};/g, 'let ownerData: any = {};');

fs.writeFileSync('server.ts', code);
