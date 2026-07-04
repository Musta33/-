const fs = require('fs');

let content = fs.readFileSync('src/components/Employees.tsx', 'utf8');

// Fix first table duplicate
content = content.replace(
    "                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}\n                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}",
    "                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}"
);

// Add to second table
content = content.replace(
    "                                        <th>اسم الموظف</th>\n                                        <th>الراتب الأساسي</th>",
    "                                        <th>اسم الموظف</th>\n                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}\n                                        <th>الراتب الأساسي</th>"
);

content = content.replace(
    "                                                <td style={{ fontWeight: 600 }}>{pay.name}</td>\n                                                <td>{new Intl.NumberFormat('en-US').format(pay.baseSalary)}</td>",
    "                                                <td style={{ fontWeight: 600 }}>{pay.name}</td>\n                                                {isMainBranch && selectedBranch === 'all' && <td>{pay.branchId === 'main' || !pay.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===pay.branchId)?.name || 'غير معروف'}</td>}\n                                                <td>{new Intl.NumberFormat('en-US').format(pay.baseSalary)}</td>"
);


fs.writeFileSync('src/components/Employees.tsx', content);
