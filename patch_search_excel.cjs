const fs = require('fs');

let content = fs.readFileSync('src/components/Employees.tsx', 'utf8');

// Add search state
content = content.replace(
  "const [selectedBranch, setSelectedBranch] = useState('all');",
  "const [selectedBranch, setSelectedBranch] = useState('all');\n    const [searchQuery, setSearchQuery] = useState('');"
);

// Add export function
content = content.replace(
  "const handlePrint = () => {",
  `const exportToExcel = () => {
        const headers = ['الشهر المالي', 'اسم الموظف', 'الفرع', 'الراتب الأساسي', 'الحوافز', 'الاستقطاعات', 'صافي الراتب', 'الحالة'];
        const rows = filteredPayroll.filter(p => p.month === payrollMonth).map(pay => [
            pay.month,
            pay.name,
            pay.branchId === 'main' || !pay.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===pay.branchId)?.name || 'غير معروف',
            pay.baseSalary,
            pay.allowance || 0,
            pay.deduction || 0,
            pay.netSalary,
            'مصروف'
        ]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\\n" + rows.map(e => e.join(",")).join("\\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", \`رواتب_\${payrollMonth.replace(' / ', '_')}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {`
);

// Apply search filter to employees
content = content.replace(
    "const filteredEmployees = employeesDB.filter(emp => {",
    "const filteredEmployees = employeesDB.filter(emp => {\n        if (searchQuery && !emp.name.includes(searchQuery) && !emp.role.includes(searchQuery)) return false;"
);

// Apply search filter to payroll
content = content.replace(
    "const filteredPayroll = payrollHistoryDB.filter(p => {",
    "const filteredPayroll = payrollHistoryDB.filter(p => {\n        if (searchQuery && !p.name.includes(searchQuery)) return false;"
);

// Update Header UI
content = content.replace(
    `            <header className="app-header">
                <div>
                    <h1>نظام شؤون الموظفين والرواتب الشهرية المركزي</h1>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>إضافة الكوادر، إدارة المستحقات وتوليد مسيرات الرواتب تلقائياً</p>
                    
                    {isMainBranch && branches.length > 0 && (
                        <div className="print-hidden" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>عرض حسب الفرع:</span>
                            <select 
                                className="form-control" 
                                style={{ width: '250px', padding: '6px' }}
                                value={selectedBranch}
                                onChange={e => setSelectedBranch(e.target.value)}
                            >
                                <option value="all">كافة الفروع</option>
                                <option value="main">الفرع الرئيسي</option>
                                {branches.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <button className="btn btn-print print-hidden" onClick={handlePrint}>
                    🖨️ طباعة البيانات الحالية
                </button>
            </header>`,
    `            <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1>نظام إدارة شؤون فروع الشركة والرواتب المركزي الذكي</h1>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>نسخة تكنولوجية متقدمة تدعم البحث، التصفية الذكية، وتصدير التقارير الفورية</p>
                    
                    <div className="print-hidden" style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        {isMainBranch && branches.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>عرض حسب الفرع:</span>
                                <select 
                                    className="form-control" 
                                    style={{ width: '250px', padding: '8px', border: '1px solid #0284c7', fontWeight: 'bold' }}
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                >
                                    <option value="all">كافة الفروع</option>
                                    <option value="main">الفرع الرئيسي</option>
                                    {branches.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>البحث:</span>
                            <input 
                                type="text"
                                className="form-control"
                                style={{ width: '250px', padding: '8px' }}
                                placeholder="ابحث باسم الموظف أو الوظيفة..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                <div className="print-hidden" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn" style={{ backgroundColor: '#15803d', color: 'white' }} onClick={exportToExcel}>
                        📊 تصدير إلى Excel
                    </button>
                    <button className="btn btn-print" onClick={handlePrint}>
                        🖨️ طباعة السجلات
                    </button>
                </div>
            </header>`
);

// Fix colSpan
content = content.replace(
    `<tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>لا يوجد موظفين مسجلين</td></tr>`,
    `<tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>لا يوجد موظفين مسجلين</td></tr>`
);

content = content.replace(
    `<tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>لا يوجد سجلات رواتب لهذا الشهر</td></tr>`,
    `<tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>لا يوجد سجلات رواتب لهذا الشهر</td></tr>`
);

fs.writeFileSync('src/components/Employees.tsx', content);
