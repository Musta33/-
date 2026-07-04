const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  'import { Employees } from "./components/Employees";',
  'import { Employees } from "./components/Employees";\nimport { FinancialSystem } from "./components/FinancialSystem";'
);

content = content.replace(
  `              onClick={() => setCurrentTab('employees')} 
              className={\`w-full flex items-center justify-start gap-3 p-3 rounded-2xl transition-all duration-300 relative group \${currentTab === 'employees' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10 scale-100' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/50 hover:text-slate-900 dark:hover:text-white hover:scale-[1.02]'}\`}
            >
              <Users size={20} className={\`transition-transform duration-300 \${currentTab === 'employees' ? 'scale-110' : 'group-hover:scale-110'}\`} />
              <span className="font-bold text-sm">شؤون الموظفين</span>
            </button>`,
  `              onClick={() => setCurrentTab('employees')} 
              className={\`w-full flex items-center justify-start gap-3 p-3 rounded-2xl transition-all duration-300 relative group \${currentTab === 'employees' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10 scale-100' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/50 hover:text-slate-900 dark:hover:text-white hover:scale-[1.02]'}\`}
            >
              <Users size={20} className={\`transition-transform duration-300 \${currentTab === 'employees' ? 'scale-110' : 'group-hover:scale-110'}\`} />
              <span className="font-bold text-sm">شؤون الموظفين</span>
            </button>

            <button 
              onClick={() => setCurrentTab('financial')} 
              className={\`w-full flex items-center justify-start gap-3 p-3 rounded-2xl transition-all duration-300 relative group \${currentTab === 'financial' ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg shadow-black/10 dark:shadow-white/10 scale-100' : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/50 hover:text-slate-900 dark:hover:text-white hover:scale-[1.02]'}\`}
            >
              <TrendingUp size={20} className={\`transition-transform duration-300 \${currentTab === 'financial' ? 'scale-110' : 'group-hover:scale-110'}\`} />
              <span className="font-bold text-sm">النظام المالي المركزي</span>
            </button>`
);

content = content.replace(
  `            {currentTab === 'employees' && (
              <Employees 
                key={\`emp-\${currentTab}\`}
                myCompany={myCompany} 
                staff={user} 
              />
            )}`,
  `            {currentTab === 'employees' && (
              <Employees 
                key={\`emp-\${currentTab}\`}
                myCompany={myCompany} 
                staff={user} 
              />
            )}
            {currentTab === 'financial' && (
              <FinancialSystem 
                key={\`fin-\${currentTab}\`}
                myCompany={myCompany} 
                staff={user} 
              />
            )}`
);

fs.writeFileSync('src/App.tsx', content);
