const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("import { CreditCard, io } from 'socket.io-client';", "import { io } from 'socket.io-client';");
if (code.includes('import { Users, ') || code.includes('import { Search, ')) {
  code = code.replace("import { ", "import { CreditCard, ");
} else {
  // Just insert it somewhere near lucide-react
  code = code.replace("from 'lucide-react';", ", CreditCard } from 'lucide-react';");
}

fs.writeFileSync('src/App.tsx', code);
