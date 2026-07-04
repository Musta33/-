import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, serverTimestamp, onSnapshot, query, where, orderBy } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Printer, Users, CheckCircle, Calculator, UserPlus } from 'lucide-react';

export const Employees = ({ myCompany, staff }: { myCompany?: any, staff?: any }) => {
    // Form state
    const [empName, setEmpName] = useState('');
    const [empRole, setEmpRole] = useState('');
    const [empSalary, setEmpSalary] = useState('');
    
    const [payrollMonth, setPayrollMonth] = useState('تموز / 2026');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Data state
    const [employeesDB, setEmployeesDB] = useState<any[]>([]);
    const [payrollHistoryDB, setPayrollHistoryDB] = useState<any[]>([]);
    
    const companyId = staff?.companyId || '';
    const isMainBranch = !staff?.branchId;
    const branches = myCompany?.branches || [];

    useEffect(() => {
        if (!companyId) return;

        const qEmp = query(collection(db, 'employees'), where('companyId', '==', companyId));
        const unsubEmp = onSnapshot(qEmp, (snapshot: any) => {
            const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            // sort manually if needed
            data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setEmployeesDB(data);
        });

        const qPay = query(collection(db, 'payrollHistory'), where('companyId', '==', companyId));
        const unsubPay = onSnapshot(qPay, (snapshot: any) => {
            const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setPayrollHistoryDB(data);
        });

        return () => {
            unsubEmp();
            unsubPay();
        };
    }, [companyId]);

    const handleAddEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!empName || !empRole || !empSalary) {
            toast.error('يرجى تعبئة جميع حقول الموظف');
            return;
        }

        setIsLoading(true);
        try {
            await addDoc(collection(db, 'employees'), {
                companyId,
                name: empName,
                role: empRole,
                branchId: selectedBranch === 'all' ? 'main' : selectedBranch,
                baseSalary: Number(empSalary),
                createdAt: serverTimestamp(),
                createdBy: staff?.id || ''
            });
            toast.success('تم تسجيل الموظف بنجاح');
            setEmpName('');
            setEmpRole('');
            setEmpSalary('');
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setIsLoading(false);
        }
    };

    const generateMonthlyPayroll = async () => {
        if (filteredEmployees.length === 0) {
            toast.error('لا يوجد موظفين مسجلين لاحتساب الرواتب');
            return;
        }

        // Check if we already processed this month
        const alreadyProcessed = filteredPayroll.some(p => p.month === payrollMonth);
        if (alreadyProcessed) {
            const confirm = window.confirm('تم احتساب رواتب هذا الشهر مسبقاً، هل تريد الاحتساب مرة أخرى؟');
            if (!confirm) return;
        }

        setIsLoading(true);
        try {
            // Generate payroll for each employee
            const promises = filteredEmployees.map(emp => {
                const allowance = 0; // default
                const deduction = 0; // default
                const netSalary = Number(emp.baseSalary) + allowance - deduction;
                
                return addDoc(collection(db, 'payrollHistory'), {
                    companyId,
                    empId: emp.id,
                    month: payrollMonth,
                    name: emp.name,
                    baseSalary: Number(emp.baseSalary),
                    branchId: emp.branchId || 'main',
                    allowance,
                    deduction,
                    netSalary,
                    status: 'مصروف',
                    createdAt: serverTimestamp(),
                    createdBy: staff?.id || ''
                });
            });

            await Promise.all(promises);
            toast.success(`تم توليد رواتب شهر ${payrollMonth} بنجاح`);
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ أثناء توليد الرواتب');
        } finally {
            setIsLoading(false);
        }
    };

    
    const filteredEmployees = employeesDB.filter(emp => {
        if (searchQuery && !emp.name.includes(searchQuery) && !emp.role.includes(searchQuery)) return false;
        if (!isMainBranch) return true; // Backend already filters for sub-branches
        if (selectedBranch === 'all') return true;
        if (selectedBranch === 'main') return !emp.branchId || emp.branchId === 'main';
        return emp.branchId === selectedBranch;
    });

    const filteredPayroll = payrollHistoryDB.filter(p => {
        if (searchQuery && !p.name.includes(searchQuery)) return false;
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
  
    
    
    // Total paid this month


    const exportToExcel = () => {
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
        const csvContent = "data:text/csv;charset=utf-8,﻿" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `رواتب_${payrollMonth.replace(' / ', '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="dashboard-container" style={{ direction: 'rtl' }}>
            <style>
                {`
                    :root {
                        --primary: #0f172a;
                        --accent: #2563eb;
                        --success: #16a34a;
                        --danger: #dc2626;
                        --background: #f8fafc;
                        --surface: #ffffff;
                        --text: #334155;
                        --border: #e2e8f0;
                    }

                    .dashboard-container { max-width: 1500px; margin: 0 auto; color: var(--text); }
                    
                    /* الرأس */
                    .app-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid var(--border); padding-bottom: 15px; }
                    .app-header h1 { color: var(--primary); font-size: 24px; font-weight: 800; margin: 0; }
                    
                    .btn { color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 8px; transition: all 0.2s ease; }
                    .btn-primary { background-color: var(--accent); }
                    .btn-primary:hover { background-color: #1d4ed8; }
                    .btn-success { background-color: var(--success); }
                    .btn-success:hover { background-color: #15803d; }
                    .btn-print { background-color: var(--primary); }
                    .btn-print:hover { background-color: #1e293b; }
                    .btn:disabled { opacity: 0.6; cursor: not-allowed; }

                    /* الخلاصة الرقمية */
                    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 25px; }
                    .card { background: var(--surface); padding: 20px; border-radius: 8px; border: 1px solid var(--border); border-top: 4px solid var(--accent); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                    .card.success { border-top-color: var(--success); }
                    .card h3 { font-size: 13px; color: #64748b; margin-bottom: 8px; font-weight: 600; }
                    .card .value { font-size: 22px; font-weight: 800; color: var(--primary); }

                    /* تقسيم الواجهة */
                    .main-layout { display: grid; grid-template-columns: 380px 1fr; gap: 25px; align-items: start; }
                    @media (max-width: 1024px) {
                        .main-layout { grid-template-columns: 1fr; }
                    }
                    .panel { background: var(--surface); padding: 20px; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 20px; }
                    .panel h2 { font-size: 16px; margin: 0 0 15px 0; color: var(--primary); font-weight: 800; padding-bottom: 8px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
                    
                    /* عناصر النموذج */
                    .form-group { margin-bottom: 15px; }
                    .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--primary); }
                    .form-control { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px; background-color: #f8fafc; font-family: inherit; }
                    .form-control:focus { outline: 2px solid var(--accent); background-color: #fff; }
                    
                    /* الجداول */
                    .table-wrapper { overflow-x: auto; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); }
                    .table-custom { width: 100%; border-collapse: collapse; text-align: right; }
                    .table-custom th { background-color: #f1f5f9; color: var(--primary); padding: 14px 16px; font-size: 13px; font-weight: 700; border-bottom: 2px solid var(--border); white-space: nowrap; }
                    .table-custom td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                    .table-custom tr:hover { background-color: #f8fafc; }

                    .custom-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background-color: #e2e8f0; display: inline-block; }
                    .custom-badge.success { background-color: #dcfce7; color: #15803d; }
                    
                    /* قوالب الطباعة الصارمة الموحدة */
                    @media print {
                        body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        @page { size: A4 landscape; margin: 15mm 10mm; }
                        .app-header button, .panel-form, .payroll-actions, .print-hidden { display: none !important; }
                        .main-layout { display: block !important; width: 100% !important; grid-template-columns: 1fr !important; }
                        .table-wrapper { border: none !important; box-shadow: none !important; width: 100% !important; margin-bottom: 30px !important; }
                        .table-custom th { background-color: #0f172a !important; color: white !important; border-bottom: 2px solid black !important; }
                        .table-custom td { border-bottom: 1px solid #94a3b8 !important; }
                        .card { border: 1px solid #94a3b8 !important; box-shadow: none !important; }
                    }
                `}
            </style>

            {/* الرأس الرئيسي */}
            <header className="app-header">
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
                    <Printer size={18} />
                    طباعة الكشوفات الورقية
                </button>
            </header>

            {/* لوحة الأرقام الإجمالية للشركة */}
            <section className="summary-grid">
                <div className="card">
                    <h3>إجمالي عدد الموظفين المسجلين</h3>
                    <div className="value">{totalEmployeesCount} موظف</div>
                </div>
                <div className="card success">
                    <h3>مجموع الرواتب الأساسية للشركة</h3>
                    <div className="value">{new Intl.NumberFormat('en-US').format(totalBaseSalaries)} د.ع</div>
                </div>
                <div className="card" style={{ borderTopColor: 'var(--danger)' }}>
                    <h3>إجمالي الرواتب المصروفة (الشهر الحالي)</h3>
                    <div className="value">{new Intl.NumberFormat('en-US').format(totalPaidThisMonth)} د.ع</div>
                </div>
            </section>

            {/* تقسيم الواجهة (يمين: إدخال واحتساب | يسار: جداول العرض) */}
            <main className="main-layout">
                
                {/* قسم النماذج والعمليات (العمود الأيمن) */}
                <div className="side-controls">
                    {/* 1. نموذج إضافة موظف جديد */}
                    <div className="panel panel-form">
                        <h2><UserPlus size={18} /> تسجيل موظف جديد في الشركة</h2>
                        <form onSubmit={handleAddEmployee}>
                            <div className="form-group">
                                <label>اسم الموظف الثلاثي</label>
                                <input type="text" className="form-control" placeholder="مثال: محمد علي حسن" value={empName} onChange={e => setEmpName(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>العنوان الوظيفي / القسم</label>
                                <input type="text" className="form-control" placeholder="مثال: محاسب، مهندس برمجيات" value={empRole} onChange={e => setEmpRole(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>الراتب الأساسي التعاقدي (د.ع)</label>
                                <input type="number" className="form-control" placeholder="مثال: 750000" value={empSalary} onChange={e => setEmpSalary(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }} disabled={isLoading}>
                                ➕ تثبيت الموظف في النظام
                            </button>
                        </form>
                    </div>

                    {/* 2. لوحة ترحيل واحتساب الرواتب الشهرية */}
                    <div className="panel payroll-actions">
                        <h2><Calculator size={18} /> معالجة واحتساب الرواتب الشهرية</h2>
                        <div className="form-group">
                            <label>تحديد الشهر المستهدف</label>
                            <select className="form-control" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}>
                                <option value="حزيران / 2026">حزيران / 2026</option>
                                <option value="تموز / 2026">تموز / 2026</option>
                                <option value="آب / 2026">آب / 2026</option>
                                <option value="أيلول / 2026">أيلول / 2026</option>
                            </select>
                        </div>
                        <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px', lineHeight: '1.5' }}>
                            ملاحظة: عند الضغط على الزر، سيقوم النظام بتوليد قوائم الرواتب لجميع الموظفين المدرجين وتطبيق الحسابات تلقائياً.
                        </p>
                        <button className="btn btn-success" onClick={generateMonthlyPayroll} style={{ width: '100%', justifyContent: 'center' }} disabled={isLoading}>
                            📊 توليد واحتساب رواتب الشهر المختار
                        </button>
                    </div>
                </div>

                {/* قسم جداول العرض والتقارير (العمود الأيسر) */}
                <div className="tables-area">
                    
                    {/* جدول الموظفين الحاليين */}
                    <div className="panel">
                        <h2><Users size={18} /> قائمة ومستودع بيانات الموظفين الحاليين</h2>
                        <div className="table-wrapper">
                            <table className="table-custom">
                                <thead>
                                    <tr>
                                        <th>معرف الموظف</th>
                                        <th>اسم الموظف</th>
                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}
                                        <th>القسم / الوظيفة</th>
                                        <th>الراتب الأساسي الثابت</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEmployees.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>لا يوجد موظفين مسجلين</td></tr>
                                    ) : (
                                        filteredEmployees.map((emp, i) => (
                                            <tr key={emp.id}>
                                                <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{emp.id ? `EMP-${emp.id.substring(0, 4).toUpperCase()}` : `EMP-${i+100}`}</td>
                                                <td style={{ fontWeight: 600 }}>{emp.name}</td>
                                                {isMainBranch && selectedBranch === 'all' && <td>{emp.branchId === 'main' || !emp.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===emp.branchId)?.name || 'غير معروف'}</td>}
                                                <td>{emp.role}</td>
                                                <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{new Intl.NumberFormat('en-US').format(emp.baseSalary)} د.ع</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* جدول مسيرات الرواتب الشهرية التلقائية */}
                    <div className="panel">
                        <h2><CheckCircle size={18} /> كشف مسيرات رواتب الموظفين الصادرة (مرتبة بالأحدث)</h2>
                        
                        <div className="print-hidden" style={{ marginBottom: '15px' }}>
                            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', marginRight: '5px' }}>فلترة حسب الشهر:</label>
                            <select 
                                className="form-control" 
                                style={{ width: 'auto', display: 'inline-block', padding: '6px 12px' }}
                                value={payrollMonth}
                                onChange={e => setPayrollMonth(e.target.value)}
                            >
                                <option value="حزيران / 2026">حزيران / 2026</option>
                                <option value="تموز / 2026">تموز / 2026</option>
                                <option value="آب / 2026">آب / 2026</option>
                                <option value="أيلول / 2026">أيلول / 2026</option>
                            </select>
                        </div>

                        <div className="table-wrapper">
                            <table className="table-custom">
                                <thead>
                                    <tr>
                                        <th>الشهر المالي</th>
                                        <th>اسم الموظف</th>
                                        {isMainBranch && selectedBranch === 'all' && <th>الفرع</th>}
                                        <th>الراتب الأساسي</th>
                                        <th>الحوافز (+)</th>
                                        <th>الاستقطاعات (-)</th>
                                        <th>صافي الراتب النهائي</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPayroll.filter(p => p.month === payrollMonth).length === 0 ? (
                                        <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>لا يوجد سجلات رواتب لهذا الشهر</td></tr>
                                    ) : (
                                        filteredPayroll.filter(p => p.month === payrollMonth).map((pay, i) => (
                                            <tr key={pay.id || i}>
                                                <td>{pay.month}</td>
                                                <td style={{ fontWeight: 600 }}>{pay.name}</td>
                                                {isMainBranch && selectedBranch === 'all' && <td>{pay.branchId === 'main' || !pay.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===pay.branchId)?.name || 'غير معروف'}</td>}
                                                <td>{new Intl.NumberFormat('en-US').format(pay.baseSalary)}</td>
                                                <td style={{ color: 'var(--success)' }}>{new Intl.NumberFormat('en-US').format(pay.allowance)}</td>
                                                <td style={{ color: 'var(--danger)' }}>{new Intl.NumberFormat('en-US').format(pay.deduction)}</td>
                                                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{new Intl.NumberFormat('en-US').format(pay.netSalary)} د.ع</td>
                                                <td><span className="custom-badge success">مصروف</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};
