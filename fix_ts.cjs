const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  "          const filter = { \n            id: id, \n            ...(isGlobal ? {} : { userId: userId }) \n          };",
  "          const filter: any = { \n            id: id, \n            ...(isGlobal ? {} : { userId: userId }) \n          };"
);

fs.writeFileSync('server.ts', content);
console.log('Fixed ts error');
