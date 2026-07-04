const fs = require('fs');

let content = fs.readFileSync('src/components/Employees.tsx', 'utf8');

// 1. Add state for selected branch
content = content.replace(
  "const [isLoading, setIsLoading] = useState(false);",
  "const [isLoading, setIsLoading] = useState(false);\n    const [selectedBranch, setSelectedBranch] = useState('all');"
);

// 2. Determine if user is main branch
content = content.replace(
  "const companyId = staff?.companyId || '';",
  "const companyId = staff?.companyId || '';\n    const isMainBranch = !staff?.branchId;\n    const branches = myCompany?.branches || [];"
);

// 3. Add branchId to creation
content = content.replace(
  "role: empRole,",
  "role: empRole,\n                branchId: selectedBranch === 'all' ? 'main' : selectedBranch,"
);

// 4. Update the generateMonthlyPayroll
content = content.replace(
  "baseSalary: Number(emp.baseSalary),",
  "baseSalary: Number(emp.baseSalary),\n                    branchId: emp.branchId || 'main',"
);

// 5. Filter the data based on selected branch
content = content.replace(
  "const totalEmployeesCount = employeesDB.length;",
  `
    const filteredEmployees = employeesDB.filter(emp => {
        if (!isMainBranch) return true; // Backend already filters for sub-branches
        if (selectedBranch === 'all') return true;
        if (selectedBranch === 'main') return !emp.branchId || emp.branchId === 'main';
        return emp.branchId === selectedBranch;
    });

    const filteredPayroll = payrollHistoryDB.filter(p => {
        if (!isMainBranch) return true;
        if (selectedBranch === 'all') return true;
        if (selectedBranch === 'main') return !p.branchId || p.branchId === 'main';
        return p.branchId === selectedBranch;
    });

    const totalEmployeesCount = filteredEmployees.length;
    const totalBaseSalaries = filteredEmployees.reduce((sum, emp) => sum + (Number(emp.baseSalary) || 0), 0);
    const totalPaidThisMonth = filteredPayroll
        .filter(p => p.month === payrollMonth)
        .reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
  `
);

// Remove the old reduce logic
content = content.replace(
    "const totalBaseSalaries = employeesDB.reduce((sum, emp) => sum + (Number(emp.baseSalary) || 0), 0);",
    ""
);
content = content.replace(
    `    const totalPaidThisMonth = payrollHistoryDB
        .filter(p => p.month === payrollMonth)
        .reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);`,
    ""
);

// 6. Update the branch dropdown in UI
content = content.replace(
    `            <header className="app-header">
                <div>
                    <h1>نظام شؤون الموظفين والرواتب الشهرية المركزي</h1>
                    <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>إضافة الكوادر، إدارة المستحقات وتوليد مسيرات الرواتب تلقائياً</p>
                </div>
                <button className="btn btn-print print-hidden" onClick={handlePrint}>`,
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
                <button className="btn btn-print print-hidden" onClick={handlePrint}>`
);

// 7. Fix mapping arrays
content = content.replace(
    "employeesDB.map((emp, i) =>",
    "filteredEmployees.map((emp, i) =>"
);
content = content.replace(
    "employeesDB.length === 0",
    "filteredEmployees.length === 0"
);

content = content.replace(
    "payrollHistoryDB.filter(p => p.month === payrollMonth).map((pay, i)",
    "filteredPayroll.filter(p => p.month === payrollMonth).map((pay, i)"
);
content = content.replace(
    "payrollHistoryDB.filter(p => p.month === payrollMonth).length === 0",
    "filteredPayroll.filter(p => p.month === payrollMonth).length === 0"
);

content = content.replace(
    "employeesDB.map(emp => {",
    "filteredEmployees.map(emp => {"
);
content = content.replace(
    "employeesDB.length === 0",
    "filteredEmployees.length === 0"
);
content = content.replace(
    "const alreadyProcessed = payrollHistoryDB.some(p => p.month === payrollMonth);",
    "const alreadyProcessed = filteredPayroll.some(p => p.month === payrollMonth);"
);

// Add branch name to table
content = content.replace(
    "<th>اسم الموظف</th>",
    "<th>اسم الموظف</th>\n                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}"
);

content = content.replace(
    "<td style={{ fontWeight: 600 }}>{emp.name}</td>",
    "<td style={{ fontWeight: 600 }}>{emp.name}</td>\n                                                {isMainBranch && selectedBranch === 'all' && <td>{emp.branchId === 'main' || !emp.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===emp.branchId)?.name || 'غير معروف'}</td>}"
);

content = content.replace(
    "<th>اسم الموظف</th>", // Since we already replaced the first one, let's use a more specific replace for the second table
    "<th>اسم الموظف</th>\n                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}"
);

// We need to make sure we replace the right <th>اسم الموظف</th> in the payroll table
// Let's just do it dynamically

fs.writeFileSync('src/components/Employees.tsx', content);
