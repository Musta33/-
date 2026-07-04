const { execSync } = require('child_process');
try {
  console.log(execSync('cat ~/.pm2/logs/*.log | tail -n 100').toString());
} catch(e) { console.error(e.message); }
