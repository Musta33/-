import React, { useState, useRef, useMemo } from 'react';
import { db, collection, addDoc, serverTimestamp } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Printer } from 'lucide-react';

export const MaintenanceExpenses = ({ cars = [], records = [], setRecords = (val: any[]) => {}, staff, myCompany }: { key?: string, cars?: any[], records?: any[], setRecords?: (val: any[]) => void, staff?: any, myCompany?: any }) => {
    const [expenseType, setExpenseType] = useState('operational'); // 'operational', 'maintenance', 'car_maintenance', 'salary', 'hospitality'
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseAmount, setExpenseAmount] = useState<string | number>('');
    const [expenseNote, setExpenseNote] = useState('');
    const [beneficiary, setBeneficiary] = useState('');
    const [expenseBranchId, setExpenseBranchId] = useState('');

    // Salary fields
    const [baseSalary, setBaseSalary] = useState<string | number>('');
    const [allowances, setAllowances] = useState<string | number>('');
    const [deductions, setDeductions] = useState<string | number>('');

    // Car maintenance fields
    const [selectedCarId, setSelectedCarId] = useState('');
    const [tires, setTires] = useState('');
    const [tiresPrice, setTiresPrice] = useState<string | number>('');
    const [oil, setOil] = useState('');
    const [oilPrice, setOilPrice] = useState<string | number>('');
    const [brakes, setBrakes] = useState('');
    const [brakesPrice, setBrakesPrice] = useState<string | number>('');
    const [frontEnd, setFrontEnd] = useState('');
    const [frontEndPrice, setFrontEndPrice] = useState<string | number>('');

    const [isLoading, setIsLoading] = useState(false);
    
    // State for viewing/searching
    const [viewFilter, setViewFilter] = useState('all');
    const [viewCarId, setViewCarId] = useState('');
    const [viewBranchFilter, setViewBranchFilter] = useState('all');

    const handlePrint = () => {
        window.print();
    };

    const isBranchUser = staff?.role === 'branch';
    const branches = myCompany?.branches || [];
    const hasBranches = branches.length > 0;

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            let total = 0;
            const branchIdToSave = isBranchUser ? staff.id : expenseBranchId;
            
            let data: any = {
                companyId: staff?.companyId || '',
                date: new Date().toLocaleDateString('en-GB'),
                createdAt: serverTimestamp(),
                expenseType: expenseType || 'operational',
                branchId: branchIdToSave
            };

            if (expenseType === 'car_maintenance') {
                if (!selectedCarId) {
                    toast.error('يرجى اختيار السيارة');
                    setIsLoading(false);
                    return;
                }
                total = Number(tiresPrice) + Number(oilPrice) + Number(brakesPrice) + Number(frontEndPrice);
                data = {
                    ...data,
                    selectedCarId, 
                    tires, tiresPrice, 
                    oil, oilPrice, 
                    brakes, brakesPrice, 
                    frontEnd, frontEndPrice, 
                    total
                };
            } else if (expenseType === 'salary') {
                if (!expenseTitle || (!baseSalary && !allowances)) {
                    toast.error('يرجى إدخال اسم الموظف والراتب الأساسي');
                    setIsLoading(false);
                    return;
                }
                total = Number(baseSalary || 0) + Number(allowances || 0) - Number(deductions || 0);
                data = {
                    ...data,
                    title: expenseTitle, // Employee name or title
                    baseSalary: Number(baseSalary || 0),
                    allowances: Number(allowances || 0),
                    deductions: Number(deductions || 0),
                    beneficiary: beneficiary || expenseTitle,
                    note: expenseNote,
                    total
                };
            } else {
                if (!expenseTitle || !expenseAmount) {
                    toast.error('يرجى إدخال البيان والمبلغ');
                    setIsLoading(false);
                    return;
                }
                total = Number(expenseAmount);
                data = {
                    ...data,
                    title: expenseTitle,
                    amount: total,
                    beneficiary: beneficiary,
                    note: expenseNote,
                    total
                };
            }

            const tempRecord = { ...data, createdAt: { seconds: Date.now() / 1000 } };
            setRecords([tempRecord, ...records]);
            
            const docRef = await addDoc(collection(db, 'maintenance'), data);
            
            // Assign ID to the new record
            setRecords((prev: any[]) => prev.map((r, i) => i === 0 ? { ...r, id: docRef.id } : r));

            toast.success('تمت الإضافة بنجاح');
            
            // Reset fields
            if (expenseType === 'car_maintenance') {
                setTires(''); setTiresPrice('');
                setOil(''); setOilPrice('');
                setBrakes(''); setBrakesPrice('');
                setFrontEnd(''); setFrontEndPrice('');
                setSelectedCarId('');
            } else if (expenseType === 'salary') {
                setExpenseTitle(''); setBaseSalary(''); setAllowances(''); setDeductions(''); setExpenseNote(''); setBeneficiary('');
            } else {
                setExpenseTitle(''); setExpenseAmount(''); setExpenseNote(''); setBeneficiary('');
            }
        } catch (err) {
            console.error(err);
            toast.error('حدث خطأ أثناء الحفظ');
        } finally {
            setIsLoading(false);
        }
    };

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const filteredRecords = useMemo(() => {
        return records.filter((r: any) => {
            if (viewFilter !== 'all' && (r.expenseType || 'car_maintenance') !== viewFilter) return false;
            if (viewFilter === 'car_maintenance' && viewCarId && r.selectedCarId !== viewCarId) return false;
            
            // Filter by branch
            if (viewBranchFilter !== 'all' && r.branchId !== viewBranchFilter) return false;
            // If branch user, only see their branch
            if (isBranchUser && r.branchId !== staff.id) return false;
            
            let dateObj = new Date();
            if (r.createdAt?.seconds) dateObj = new Date(r.createdAt.seconds * 1000);
            else if (typeof r.createdAt === 'number') dateObj = new Date(r.createdAt * 1000);
            else if (typeof r.createdAt === 'string') dateObj = new Date(r.createdAt);
            
            return dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear;
        }).sort((a: any, b: any) => {
            let timeA = Date.now() / 1000;
            let timeB = Date.now() / 1000;
            
            if (a.createdAt?.seconds) timeA = a.createdAt.seconds;
            else if (typeof a.createdAt === 'number') timeA = a.createdAt;
            else if (typeof a.createdAt === 'string') timeA = new Date(a.createdAt).getTime() / 1000;
            
            if (b.createdAt?.seconds) timeB = b.createdAt.seconds;
            else if (typeof b.createdAt === 'number') timeB = b.createdAt;
            else if (typeof b.createdAt === 'string') timeB = new Date(b.createdAt).getTime() / 1000;
            
            return timeB - timeA;
        });
    }, [records, viewFilter, viewCarId, viewBranchFilter, currentMonth, currentYear, isBranchUser, staff]);

    const getExpenseTypeName = (type: string) => {
        switch (type) {
            case 'car_maintenance': return 'صيانة سيارات';
            case 'maintenance': return 'صيانة ومعدات';
            case 'operational': return 'مصاريف تشغيلية';
            case 'salary': return 'الرواتب والأجور';
            case 'hospitality': return 'ضيافة ونثريات';
            case 'rent': return 'إيجارات';
            case 'other': return 'أخرى';
            default: return 'غير مصنف';
        }
    };

    const getBadgeClass = (type: string) => {
        switch (type) {
            case 'salary': return 'salary';
            case 'operational': return 'operational';
            case 'maintenance': 
            case 'car_maintenance': return 'maintenance';
            default: return '';
        }
    };

    // Calculations for Summary Cards
    const totalMonthExpenses = filteredRecords.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const totalOperational = filteredRecords.filter(r => r.expenseType === 'operational' || r.expenseType === 'hospitality' || r.expenseType === 'rent').reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const totalSalaries = filteredRecords.filter(r => r.expenseType === 'salary').reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    
    const numberOfTransactions = filteredRecords.length;

    let currentTotal = 0;
    if (expenseType === 'car_maintenance') {
        currentTotal = Number(tiresPrice) + Number(oilPrice) + Number(brakesPrice) + Number(frontEndPrice);
    } else if (expenseType === 'salary') {
        currentTotal = Number(baseSalary || 0) + Number(allowances || 0) - Number(deductions || 0);
    } else {
        currentTotal = Number(expenseAmount);
    }

    return (
        <div className="dashboard-container" style={{ direction: 'rtl' }}>
            <style>
                {`
                    /* --- المغيرات الرئيسية والألوان الثابتة --- */
                    :root {
                        --primary: #1e293b;
                        --secondary: #0f172a;
                        --accent: #2563eb;
                        --success: #16a34a;
                        --danger: #dc2626;
                        --background: transparent;
                        --surface: #ffffff;
                        --text: #334155;
                        --text-light: #64748b;
                        --border: #e2e8f0;
                    }

                    .dashboard-container {
                        max-width: 1500px;
                        margin: 0 auto;
                        color: var(--text);
                    }
                    
                    /* --- رأس النظام --- */
                    .app-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 25px;
                        border-bottom: 2px solid var(--border);
                        padding-bottom: 15px;
                    }
                    .app-header h1 {
                        color: var(--primary);
                        font-size: 26px;
                        font-weight: 900;
                        margin: 0;
                    }
                    .btn-group { display: flex; gap: 10px; }
                    .btn {
                        background-color: var(--accent);
                        color: white;
                        padding: 10px 18px;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 14px;
                        transition: all 0.2s ease;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .btn:hover { background-color: #1d4ed8; }
                    .btn-print { background-color: var(--primary); }
                    .btn-print:hover { background-color: var(--secondary); }
                    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

                    /* --- شريط التصفية والفرز بين الفروع --- */
                    .filter-bar {
                        background: var(--surface);
                        padding: 15px;
                        border-radius: 8px;
                        border: 1px solid var(--border);
                        margin-bottom: 25px;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    .filter-title { font-weight: bold; color: var(--primary); font-size: 14px; }

                    /* --- كروت الخلاصة التلقائية الذكية --- */
                    .metrics-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .metric-card {
                        background: var(--surface);
                        padding: 20px;
                        border-radius: 8px;
                        border: 1px solid var(--border);
                        border-top: 4px solid var(--accent);
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    }
                    .metric-card.total-expenses { border-top-color: var(--danger); }
                    .metric-card.total-salaries { border-top-color: var(--success); }
                    .metric-card h3 { font-size: 13px; color: var(--text-light); margin: 0 0 8px 0; font-weight: bold; }
                    .metric-card .value { font-size: 22px; font-weight: 800; color: var(--primary); }

                    /* --- التقسيم لعمودين (الإدخال والعرض) --- */
                    .main-content {
                        display: grid;
                        grid-template-columns: 360px 1fr;
                        gap: 30px;
                        align-items: start;
                    }
                    @media (max-width: 1024px) {
                        .main-content {
                            grid-template-columns: 1fr;
                        }
                    }

                    /* --- استمارة الإدخال الاحترافية --- */
                    .form-panel {
                        background: var(--surface);
                        padding: 20px;
                        border-radius: 8px;
                        border: 1px solid var(--border);
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    }
                    .form-panel h2 { font-size: 17px; margin: 0 0 15px 0; font-weight: 800; color: var(--primary); padding-bottom: 8px; border-bottom: 1px solid var(--border); }
                    .form-group { margin-bottom: 14px; }
                    .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; color: var(--text); }
                    .form-control {
                        width: 100%;
                        padding: 10px;
                        border: 1px solid var(--border);
                        border-radius: 6px;
                        font-size: 14px;
                        color: var(--text);
                        background-color: #f8fafc;
                        font-family: inherit;
                    }
                    .form-control:focus { outline: 2px solid var(--accent); background-color: #fff; }
                    
                    /* الحقول الفرعية الديناميكية للرواتب */
                    .salary-fields-box {
                        background: #f1f5f9;
                        padding: 10px;
                        border-radius: 6px;
                        margin-top: 10px;
                        border: 1px dashed #cbd5e1;
                    }

                    /* --- جدول استعراض الصرفيات المرتب تلقائياً --- */
                    .table-panel {
                        background: var(--surface);
                        border-radius: 8px;
                        border: 1px solid var(--border);
                        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                        overflow: hidden;
                    }
                    .table-panel-header {
                        padding: 16px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: white;
                        border-bottom: 1px solid var(--border);
                    }
                    .table-panel-header h2 {
                        margin: 0;
                        font-size: 18px;
                        font-weight: 800;
                    }
                    .table-wrapper { overflow-x: auto; }
                    .table-custom { width: 100%; border-collapse: collapse; text-align: right; }
                    .table-custom th { background-color: #f1f5f9; color: var(--primary); padding: 14px 16px; font-size: 13px; font-weight: 700; border-bottom: 2px solid var(--border); white-space: nowrap; }
                    .table-custom td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                    .table-custom tr:hover { background-color: #f8fafc; }
                    
                    /* الأوسمة والمبالغ المعبرة */
                    .custom-badge {
                        background-color: #e2e8f0;
                        color: var(--primary);
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        display: inline-block;
                    }
                    .custom-badge.branch { background-color: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
                    .custom-badge.salary { background-color: #dcfce7; color: #15803d; }
                    .custom-badge.operational { background-color: #dbeafe; color: #1d4ed8; }
                    .custom-badge.maintenance { background-color: #fef9c3; color: #a16207; }
                    
                    .amount-display { font-weight: 700; color: var(--danger); font-size: 15px; white-space: nowrap; }
                    .salary-details-text { font-size: 11px; color: var(--text-light); display: block; margin-top: 2px; }

                    /* --- قوانين هندسة الطباعة الصارمة الموحدة للأجهزة --- */
                    @media print {
                        body {
                            background: white !important;
                            color: black !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        @page {
                            size: A4 landscape;
                            margin: 15mm 10mm;
                        }
                        .app-header button, .form-panel, .filter-bar, .btn-group, .print-hidden {
                            display: none !important;
                        }
                        .main-content {
                            display: block !important;
                            width: 100% !important;
                            grid-template-columns: 1fr !important;
                        }
                        .table-panel {
                            border: none !important;
                            box-shadow: none !important;
                            width: 100% !important;
                        }
                        .table-custom th {
                            background-color: #1e293b !important;
                            color: white !important;
                            border-bottom: 2px solid black !important;
                        }
                        .table-custom td { border-bottom: 1px solid #94a3b8 !important; }
                        .custom-badge { border: 1px solid #cbd5e1 !important; background: transparent !important; color: black !important; }
                    }
                `}
            </style>

            {/* رأس لوحة التحكم */}
            <header className="app-header">
                <div>
                    <h1>نظام إدارة صرفيات ورواتب الفروع المتعددة</h1>
                    <p style={{ color: 'var(--text-light)', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>التحكم المالي المركزي ومراقبة ميزانيات الفروع</p>
                </div>
                <div className="btn-group print-hidden">
                    <button className="btn btn-print" onClick={handlePrint}>
                        <Printer size={18} />
                        طباعة تقرير الفروع
                    </button>
                </div>
            </header>

            {/* شريط التصفية والفرز المحاسبي بين الفروع */}
            {(!isBranchUser && hasBranches) && (
                <section className="filter-bar print-hidden">
                    <span className="filter-title">🔍 استعراض تقرير فرع محدد:</span>
                    <select className="form-control" style={{ maxWidth: '250px', backgroundColor: '#fff' }} value={viewBranchFilter} onChange={e => setViewBranchFilter(e.target.value)}>
                        <option value="all">كل الفروع (مركزي)</option>
                        {branches.map((branch: any) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                </section>
            )}

            {/* بطاقات الحسابات التلقائية المباشرة */}
            <section className="metrics-grid">
                <div className="metric-card">
                    <h3>المصاريف العامة للفرع المحدد</h3>
                    <div className="value">{new Intl.NumberFormat('en-US').format(totalOperational)} د.ع</div>
                </div>
                <div className="metric-card total-salaries">
                    <h3>رواتب موظفي الفرع المحدد</h3>
                    <div className="value">{new Intl.NumberFormat('en-US').format(totalSalaries)} د.ع</div>
                </div>
                <div className="metric-card total-expenses">
                    <h3>الإنفاق الكلي (للفلتر الحالي)</h3>
                    <div className="value">{new Intl.NumberFormat('en-US').format(totalMonthExpenses)} د.ع</div>
                </div>
                <div className="metric-card" style={{ borderTopColor: 'var(--text-light)' }}>
                    <h3>عدد السندات المسجلة</h3>
                    <div className="value">{numberOfTransactions}</div>
                </div>
            </section>

            {/* المحتوى الفعلي للمنظومة */}
            <main className="main-content">
                {/* لوحة مدخلات الصرفيات والرواتب الديناميكية */}
                <div className="form-panel print-hidden">
                    <h2>تسجيل سند صرف لفرع</h2>
                    <form onSubmit={handleAdd}>
                        
                        {(!isBranchUser && hasBranches) && (
                            <div className="form-group">
                                <label>الفرع المسؤول عن المصروف</label>
                                <select className="form-control" value={expenseBranchId} onChange={e => setExpenseBranchId(e.target.value)}>
                                    <option value="">الشركة المركزية</option>
                                    {branches.map((branch: any) => (
                                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="form-group">
                            <label>فئة وبند الصرف</label>
                            <select className="form-control" value={expenseType} onChange={e => setExpenseType(e.target.value)} required>
                                <option value="operational">مصاريف تشغيلية / فواتير</option>
                                <option value="maintenance">صيانة ومعدات</option>
                                <option value="car_maintenance">صيانة سيارات الشركة</option>
                                <option value="salary">رواتب وأجور موظفين</option>
                                <option value="hospitality">ضيافة ونثريات</option>
                            </select>
                        </div>

                        {expenseType === 'salary' ? (
                            <>
                                <div className="form-group">
                                    <label>اسم الموظف / المستفيد</label>
                                    <input type="text" className="form-control" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} required />
                                </div>
                                <div className="salary-fields-box">
                                    <div className="form-group">
                                        <label>الراتب الأساسي الثابت (د.ع)</label>
                                        <input type="number" className="form-control" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} required />
                                    </div>
                                    <div className="form-group">
                                        <label>الحوافز والإضافي والمكافآت (+)</label>
                                        <input type="number" className="form-control" value={allowances} onChange={e => setAllowances(e.target.value)} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>الاستقطاعات والخصومات (-)</label>
                                        <input type="number" className="form-control" value={deductions} onChange={e => setDeductions(e.target.value)} />
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: '15px' }}>
                                    <label>ملاحظات (اختياري)</label>
                                    <input type="text" className="form-control" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} />
                                </div>
                            </>
                        ) : expenseType === 'car_maintenance' ? (
                            <>
                                <div className="form-group">
                                    <label>السيارة</label>
                                    <select className="form-control" value={selectedCarId} onChange={e => setSelectedCarId(e.target.value)} required>
                                        <option value="">اختر السيارة</option>
                                        {cars.map((car: any) => <option key={car.id} value={car.id}>{car.name}</option>)}
                                    </select>
                                </div>
                                <div className="salary-fields-box">
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', marginBottom: '10px' }}>
                                        <input value={tires} onChange={e => setTires(e.target.value)} placeholder="الإطارات" className="form-control" style={{ fontSize: '12px' }} />
                                        <input type="number" value={tiresPrice} onChange={e => setTiresPrice(e.target.value)} placeholder="سعر" className="form-control" style={{ fontSize: '12px' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', marginBottom: '10px' }}>
                                        <input value={oil} onChange={e => setOil(e.target.value)} placeholder="الزيت" className="form-control" style={{ fontSize: '12px' }} />
                                        <input type="number" value={oilPrice} onChange={e => setOilPrice(e.target.value)} placeholder="سعر" className="form-control" style={{ fontSize: '12px' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', marginBottom: '10px' }}>
                                        <input value={brakes} onChange={e => setBrakes(e.target.value)} placeholder="الفرامل" className="form-control" style={{ fontSize: '12px' }} />
                                        <input type="number" value={brakesPrice} onChange={e => setBrakesPrice(e.target.value)} placeholder="سعر" className="form-control" style={{ fontSize: '12px' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px' }}>
                                        <input value={frontEnd} onChange={e => setFrontEnd(e.target.value)} placeholder="الصدر" className="form-control" style={{ fontSize: '12px' }} />
                                        <input type="number" value={frontEndPrice} onChange={e => setFrontEndPrice(e.target.value)} placeholder="سعر" className="form-control" style={{ fontSize: '12px' }} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label>البيان / الوصف</label>
                                    <input type="text" className="form-control" placeholder="مثال: فاتورة إنترنت" value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label>الجهة المستفيدة</label>
                                    <input type="text" className="form-control" placeholder="مثال: شركة الاتصالات" value={beneficiary} onChange={e => setBeneficiary(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>المبلغ الكلي (د.ع)</label>
                                    <input type="number" className="form-control" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} required />
                                </div>
                                <div className="form-group">
                                    <label>ملاحظات (اختياري)</label>
                                    <textarea className="form-control" rows={2} value={expenseNote} onChange={e => setExpenseNote(e.target.value)}></textarea>
                                </div>
                            </>
                        )}

                        <div className="form-group" style={{ marginTop: '20px', marginBottom: 0 }}>
                            <button type="submit" className="btn w-full justify-center" disabled={isLoading} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
                                {isLoading ? 'جاري الحفظ...' : `حفظ السند (المبلغ: ${new Intl.NumberFormat('en-US').format(currentTotal)})`}
                            </button>
                        </div>
                    </form>
                </div>

                {/* جدول استعراض الصرفيات المرتب تلقائياً */}
                <div className="table-panel">
                    <div className="table-panel-header print-hidden">
                        <h2>سجل حركات الصرف</h2>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select className="form-control" style={{ width: 'auto', padding: '6px 12px' }} value={viewFilter} onChange={e => setViewFilter(e.target.value)}>
                                <option value="all">جميع الفئات</option>
                                <option value="operational">مصاريف تشغيلية</option>
                                <option value="maintenance">صيانة</option>
                                <option value="car_maintenance">صيانة سيارات</option>
                                <option value="salary">رواتب</option>
                                <option value="hospitality">ضيافة</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table className="table-custom">
                            <thead>
                                <tr>
                                    <th>التاريخ</th>
                                    <th>رقم السند</th>
                                    {(!isBranchUser && viewBranchFilter === 'all') && <th>الفرع</th>}
                                    <th>فئة المصروف</th>
                                    <th>البيان / الوصف</th>
                                    <th>الجهة المستفيدة</th>
                                    <th>المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                                            لا توجد بيانات مسجلة في هذه الفترة
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((r: any, i: number) => {
                                        const type = r.expenseType || 'car_maintenance';
                                        const voucherNum = r.id ? `#EX-${r.id.substring(r.id.length - 4).toUpperCase()}` : `#EX-90${i + 1}`;
                                        
                                        let description = '';
                                        if (type === 'car_maintenance') {
                                            const details = [];
                                            if (r.tires) details.push(`إطارات (${r.tires})`);
                                            if (r.oil) details.push(`زيت (${r.oil})`);
                                            if (r.brakes) details.push(`فرامل (${r.brakes})`);
                                            if (r.frontEnd) details.push(`صدر (${r.frontEnd})`);
                                            description = details.length > 0 ? details.join('، ') : 'صيانة دورية';
                                        } else if (type === 'salary') {
                                            description = `راتب شهر ${new Date().getMonth() + 1}`;
                                            if (r.note) description += ` - ${r.note}`;
                                        } else {
                                            description = r.title || r.note || '-';
                                        }

                                        let displayBeneficiary = '-';
                                        if (type === 'car_maintenance') {
                                            displayBeneficiary = cars.find((c: any) => c.id === r.selectedCarId)?.name || 'سيارة غير معروفة';
                                        } else {
                                            displayBeneficiary = r.beneficiary || r.title || '-';
                                        }
                                        
                                        const branchName = r.branchId ? branches.find((b: any) => b.id === r.branchId)?.name || 'فرع مجهول' : 'المركز الرئيسي';

                                        return (
                                            <tr key={r.id || i}>
                                                <td>{r.date}</td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--text-light)' }}>{voucherNum}</td>
                                                {(!isBranchUser && viewBranchFilter === 'all') && (
                                                    <td>
                                                        <span className="custom-badge branch">
                                                            {branchName}
                                                        </span>
                                                    </td>
                                                )}
                                                <td>
                                                    <span className={`custom-badge ${getBadgeClass(type)}`}>
                                                        {getExpenseTypeName(type)}
                                                    </span>
                                                </td>
                                                <td>{description}</td>
                                                <td>{displayBeneficiary}</td>
                                                <td className="amount-display">
                                                    {new Intl.NumberFormat('en-US').format(r.total)} د.ع
                                                    {type === 'salary' && (
                                                        <span className="salary-details-text">
                                                            الأساسي: {new Intl.NumberFormat('en-US').format(r.baseSalary || 0)} | 
                                                            الإضافي: {new Intl.NumberFormat('en-US').format(r.allowances || 0)} |
                                                            الخصم: {new Intl.NumberFormat('en-US').format(r.deductions || 0)}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};
