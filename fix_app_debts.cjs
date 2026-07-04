const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Import Debts
if (!code.includes("import Debts from './components/Debts';")) {
  code = code.replace(
    "import { Customers } from './components/Customers';",
    "import { Customers } from './components/Customers';\nimport Debts from './components/Debts';"
  );
}

// 2. Add icon to imports
// let's check what icons are imported from lucide-react
// Let's assume CreditCard is imported, or we can just use Wallet if it's there.
// Instead of modifying the huge import block, we can just use Banknote which is usually imported, or a simple text icon. Or add CreditCard to the imports.
if (!code.includes("CreditCard")) {
  code = code.replace("import { ", "import { CreditCard, ");
}

// 3. Add Tab Button
const customersBtn = `            <button 
              onClick={() => setCurrentTab('customers')} `;

const debtsBtn = `            <button 
              onClick={() => setCurrentTab('debts')} 
              className={\`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition \${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} \${currentTab === 'debts' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}\`}
            >
              <div className={\`flex items-center gap-3.5 \${isRtl ? 'flex-row-reverse' : 'flex-row'}\`}>
                <CreditCard size={16} className={currentTab === 'debts' ? 'text-white' : 'text-slate-500'} />
                <span>ديون المستأجرين</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('customers')} `;

code = code.replace(customersBtn, debtsBtn);

// 4. Render Debts component
const customersRender = `              {currentTab === 'customers' && (
                <Customers user={user} />
              )}`;

const debtsRender = `              {currentTab === 'debts' && (
                <Debts user={user} />
              )}
              {currentTab === 'customers' && (
                <Customers user={user} />
              )}`;

code = code.replace(customersRender, debtsRender);

fs.writeFileSync('src/App.tsx', code);
