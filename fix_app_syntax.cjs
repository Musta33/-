const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("} , CreditCard } from 'lucide-react';", ", CreditCard } from 'lucide-react';");

fs.writeFileSync('src/App.tsx', code);
