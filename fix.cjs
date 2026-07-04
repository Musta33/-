const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Fix update-role
content = content.replace(
  "if (req.user.role !== 'super_admin' && req.user.email !== 'mustfadd112@gmail.com') return res.sendStatus(403);",
  "if (req.user.role !== 'super_admin' && req.user.email !== 'mustfadd112@gmail.com') return res.sendStatus(403);" // already ok
);

// We need to fix the GET route item.userId check
content = content.replace(
  /if \(\!isGlobal[^\n]*\n[^\n]*\n[^\n]*\n/s, 
  ''
);
fs.writeFileSync('server.ts', content);
