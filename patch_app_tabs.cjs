const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const newTabCode = `
            <button 
              onClick={() => setCurrentTab('employees')} 
              className={\`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition flex-row-reverse text-right \${currentTab === 'employees' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}\`}
            >
              <div className="flex items-center gap-3.5 flex-row-reverse">
                <Users size={16} className={currentTab === 'employees' ? 'text-white' : 'text-slate-500'} />
                <span>{t.employees || "إدارة الموظفين والرواتب"}</span>
              </div>
            </button>
`;

content = content.replace(
    `                <span>{t.maintenanceExpenses}</span>
              </div>
            </button>`,
    `                <span>{t.maintenanceExpenses}</span>
              </div>
            </button>
${newTabCode}`
);

fs.writeFileSync('src/App.tsx', content);
