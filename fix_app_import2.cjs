const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("import { CreditCard, io } from 'socket.io-client';", "import { io } from 'socket.io-client';");

fs.writeFileSync('src/App.tsx', code);
