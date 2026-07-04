import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, where } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Printer, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle } from 'lucide-react';

export const FinancialSystem = ({ myCompany, staff }: { myCompany?: any, staff?: any }) => {
    const [txType, setTxType] = useState('expense');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('مصروفات تشغيلية');
    const [date, setDate] = useState('تموز / 2026');
    
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    
    const [records, setRecords] = useState<any[]>([]);
    const [employeesDB, setEmployeesDB] = useState<any[]>([]);
    
    const [isLoading, setIsLoading] = useState(false);

    const companyId = staff?.companyId || '';
    const isMainBranch = !staff?.branchId;
    const branches = myCompany?.branches || [];

    useEffect(() => {
        if (!companyId) return;

        const qRecords = query(collection(db, 'financialRecords'), where('companyId', '==', companyId));
        const unsubRecords = onSnapshot(qRecords, (snapshot: any) => {
            const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setRecords(data);
        });

        const qEmp = query(collection(db, 'employees'), where('companyId', '==', companyId));
        const unsubEmp = onSnapshot(qEmp, (snapshot: any) => {
            const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            setEmployeesDB(data);
        });

        return () => {
            unsubRecords();
            unsubEmp();
        };
    }, [companyId]);

    const handleAddRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description) {
            toast.error('يرجى ملء كافة الحقول المطلوبة');
            return;
        }

        setIsLoading(true);
        try {
            await addDoc(collection(db, 'financialRecords'), {
                companyId,
                branchId: selectedBranch === 'all' ? 'main' : selectedBranch,
                type: txType,
                category,
                amount: Number(amount),
                description,
                date,
                createdBy: staff?.id || 'admin',
                createdAt: new Date().toISOString()
            });

            toast.success('تم تسجيل القيد المالي بنجاح');
            setAmount('');
            setDescription('');
        } catch (error) {
            console.error('Error adding record:', error);
            toast.error('حدث خطأ أثناء التسجيل');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredRecords = records.filter(r => {
        if (!isMainBranch) return true;
        if (selectedBranch !== 'all') {
            if (selectedBranch === 'main') {
                if (r.branchId && r.branchId !== 'main') return false;
            } else {
                if (r.branchId !== selectedBranch) return false;
            }
        }
        if (searchQuery && !r.description.includes(searchQuery) && !r.category.includes(searchQuery)) return false;
        if (typeFilter !== 'all' && r.type !== typeFilter) return false;
        return true;
    });

    const filteredEmployees = employeesDB.filter(emp => {
        if (!isMainBranch) return true;
        if (selectedBranch !== 'all') {
            if (selectedBranch === 'main') {
                if (emp.branchId && emp.branchId !== 'main') return false;
            } else {
                if (emp.branchId !== selectedBranch) return false;
            }
        }
        return true;
    });

    const totalIncome = filteredRecords.filter(r => r.type === 'income').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalExpense = filteredRecords.filter(r => r.type === 'expense').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const netProfit = totalIncome - totalExpense;
    
    // Simple audit alert check: Negative profit or unusually high expenses
    const showAuditAlert = netProfit < 0 || (totalExpense > totalIncome && totalIncome > 0);

    const exportToExcel = () => {
        const headers = ['التاريخ/الشهر', 'نوع المعاملة', 'التصنيف', 'الفرع', 'البيان', 'المبلغ'];
        const rows = filteredRecords.map(r => [
            r.date,
            r.type === 'income' ? 'إيراد' : 'مصروف',
            r.category,
            r.branchId === 'main' || !r.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===r.branchId)?.name || 'غير معروف',
            r.description,
            r.amount
        ]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\\n" + rows.map(e => e.join(",")).join("\\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "القيود_المالية.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6" dir="rtl" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif" }}>
            <header className="flex justify-between items-start mb-6 border-b-2 border-slate-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">نظام الإدارة المالية الشامل للأرباح والخسائر والفروع</h1>
                    <p className="text-sm text-slate-500 mt-1">الجيل المتطور: تتبع الإيرادات، الصرفيات، كتلة الأجور، والتدقيق المحاسبي المانع للأخطاء</p>
                    
                    <div className="mt-4 flex items-center gap-4 flex-wrap print-hidden">
                        {isMainBranch && branches.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-sky-700">الفرع الجاري النشط:</span>
                                <select 
                                    className="p-2 border border-sky-600 rounded-md bg-white font-bold text-slate-800"
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                >
                                    <option value="all">كافة الفروع</option>
                                    <option value="main">الفرع الرئيسي (المركز الرئيسي للشركة)</option>
                                    {branches.map((b: any) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">البحث:</span>
                            <input 
                                type="text"
                                className="p-2 border border-slate-300 rounded-md bg-white"
                                placeholder="ابحث بالتفاصيل..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">نوع المعاملة:</span>
                            <select 
                                className="p-2 border border-slate-300 rounded-md bg-white"
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                            >
                                <option value="all">كل القيود المحاسبية</option>
                                <option value="income">الإيرادات والمبيعات فقط</option>
                                <option value="expense">المصروفات العامة والرواتب</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2 print-hidden">
                    <button className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-md font-bold" onClick={exportToExcel}>
                        <TrendingUp size={18} />
                        تصدير القيد لـ Excel
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-md font-bold" onClick={handlePrint}>
                        <Printer size={18} />
                        طباعة الحسابات
                    </button>
                </div>
            </header>

            {showAuditAlert && (
                <div className="bg-orange-50 border border-orange-200 text-orange-700 p-3 rounded-md mb-5 font-semibold text-sm print-hidden">
                    <AlertTriangle size={16} className="inline ml-2" />
                    تنبيه مالي محاسبي: تم رصد تجاوز المصروفات للإيرادات أو وجود خسائر تشغيلية في النطاق المحدد.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
                <div className="bg-white p-5 rounded-lg border border-slate-200 border-t-4 border-t-green-600 shadow-sm">
                    <h3 className="text-sm text-slate-500 mb-2">إجمالي الإيرادات / المقبوضات</h3>
                    <div className="text-2xl font-extrabold text-green-600">
                        {new Intl.NumberFormat('en-US').format(totalIncome)} د.ع
                    </div>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200 border-t-4 border-t-red-600 shadow-sm">
                    <h3 className="text-sm text-slate-500 mb-2">إجمالي المصاريف والرواتب</h3>
                    <div className="text-2xl font-extrabold text-red-600">
                        {new Intl.NumberFormat('en-US').format(totalExpense)} د.ع
                    </div>
                </div>
                <div className="bg-purple-50 p-5 rounded-lg border border-slate-200 border-t-4 border-t-purple-600 shadow-sm">
                    <h3 className="text-sm text-slate-500 mb-2">صافي الأرباح التشغيلية للشركة</h3>
                    <div className="text-2xl font-extrabold text-purple-600" dir="ltr" style={{ textAlign: 'right' }}>
                        {new Intl.NumberFormat('en-US').format(netProfit)} د.ع
                    </div>
                </div>
                <div className="bg-white p-5 rounded-lg border border-slate-200 border-t-4 border-t-slate-800 shadow-sm">
                    <h3 className="text-sm text-slate-500 mb-2">عدد الموظفين بالنطاق</h3>
                    <div className="text-2xl font-extrabold text-slate-900">
                        {filteredEmployees.length} موظف
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 print-hidden">
                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            📥 تسجيل حركة مالية ({selectedBranch === 'main' || selectedBranch === 'all' ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===selectedBranch)?.name})
                        </h2>
                        <form onSubmit={handleAddRecord}>
                            <div className="mb-3">
                                <label className="block text-sm font-semibold mb-1">نوع المعاملة المالية</label>
                                <select 
                                    className="w-full p-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={txType}
                                    onChange={e => setTxType(e.target.value)}
                                    required
                                >
                                    <option value="expense">مصروفات عامة / فواتير وتشغيل</option>
                                    <option value="income">إيرادات ومبيعات / مقبوضات</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="block text-sm font-semibold mb-1">تصنيف الحركة</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="مثال: مبيعات عقود، صيانة، رواتب، كهرباء"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="block text-sm font-semibold mb-1">المبلغ (د.ع)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="القيمة الرقمية"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="block text-sm font-semibold mb-1">البيان / التفاصيل</label>
                                <input 
                                    type="text" 
                                    className="w-full p-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="شرح مختصر للعملية المحاسبية"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-semibold mb-1">تاريخ الاستحقاق (الشهر المالي)</label>
                                <select 
                                    className="w-full p-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    required
                                >
                                    <option value="حزيران / 2026">حزيران / 2026</option>
                                    <option value="تموز / 2026">تموز / 2026</option>
                                    <option value="آب / 2026">آب / 2026</option>
                                    <option value="أيلول / 2026">أيلول / 2026</option>
                                </select>
                            </div>
                            <button 
                                type="submit" 
                                className={`w-full p-2.5 text-white font-bold rounded-md ${txType === 'income' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                                disabled={isLoading}
                            >
                                {isLoading ? 'جاري الترحيل...' : '➕ ترحيل القيد المالي'}
                            </button>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
                            📑 دفتر الأستاذ للقيود المالية {selectedBranch === 'all' ? '(كافة الفروع)' : ''}
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-3 bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold text-sm">التاريخ</th>
                                        <th className="p-3 bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold text-sm">النوع</th>
                                        {isMainBranch && selectedBranch === 'all' && <th className="p-3 bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold text-sm">الفرع</th>}
                                        <th className="p-3 bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold text-sm">التصنيف</th>
                                        <th className="p-3 bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold text-sm">البيان</th>
                                        <th className="p-3 bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold text-sm">المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={isMainBranch && selectedBranch === 'all' ? 6 : 5} className="text-center p-6 text-slate-500">
                                                لا توجد قيود مالية مسجلة لهذه الفلاتر
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map(r => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="p-3 border-b border-slate-100 text-sm">{r.date}</td>
                                                <td className="p-3 border-b border-slate-100">
                                                    <span className={`px-2 py-1 text-xs font-bold rounded-md ${r.type === 'income' ? 'bg-teal-100 text-teal-800' : 'bg-red-50 text-red-700'}`}>
                                                        {r.type === 'income' ? 'إيراد' : 'مصروف'}
                                                    </span>
                                                </td>
                                                {isMainBranch && selectedBranch === 'all' && (
                                                    <td className="p-3 border-b border-slate-100 text-sm text-sky-700 font-semibold">
                                                        {r.branchId === 'main' || !r.branchId ? 'الفرع الرئيسي' : branches.find((b:any)=>b.id===r.branchId)?.name || 'غير معروف'}
                                                    </td>
                                                )}
                                                <td className="p-3 border-b border-slate-100 text-sm font-semibold">{r.category}</td>
                                                <td className="p-3 border-b border-slate-100 text-sm">{r.description}</td>
                                                <td className={`p-3 border-b border-slate-100 text-sm font-extrabold ${r.type === 'income' ? 'text-green-600' : 'text-red-600'}`} dir="ltr" style={{ textAlign: 'right' }}>
                                                    {r.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('en-US').format(r.amount)} د.ع
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
