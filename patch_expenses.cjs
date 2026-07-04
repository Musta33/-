const fs = require('fs');

const content = `import React, { useState, useRef } from 'react';
import { db, collection, addDoc, serverTimestamp } from '../lib/api';
import { toast } from 'react-hot-toast';
import { Printer, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export const MaintenanceExpenses = ({ cars = [], records = [], setRecords = (val: any[]) => {}, staff }: { key?: string, cars?: any[], records?: any[], setRecords?: (val: any[]) => void, staff?: any }) => {
    const [expenseType, setExpenseType] = useState('car_maintenance');
    const [expenseTitle, setExpenseTitle] = useState('');
    const [expenseAmount, setExpenseAmount] = useState<string | number>('');
    const [expenseNote, setExpenseNote] = useState('');

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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    
    // State for viewing/searching
    const [viewFilter, setViewFilter] = useState('all');
    const [viewCarId, setViewCarId] = useState('');

    const handlePrint = () => {
        window.print();
    };

    const downloadPDF = () => {
        const element = printRef.current;
        if (element) {
            setIsGeneratingPdf(true);
            const opt = {
                margin: 10,
                filename: \`سجل_الصرفيات.pdf\`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, windowWidth: 1000 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            const printHiddenElements = element.querySelectorAll('.print\\\\:hidden');
            printHiddenElements.forEach(el => (el as HTMLElement).style.display = 'none');

            setTimeout(() => {
                html2pdf().from(element).set(opt).save().then(() => {
                    printHiddenElements.forEach(el => (el as HTMLElement).style.display = '');
                    setIsGeneratingPdf(false);
                }).catch((err: any) => {
                    console.error("PDF generation error:", err);
                    printHiddenElements.forEach(el => (el as HTMLElement).style.display = '');
                    setIsGeneratingPdf(false);
                });
            }, 300);
        }
    };

    const handleAdd = async () => {
        setIsLoading(true);
        try {
            let total = 0;
            let data: any = {
                companyId: staff?.companyId || '',
                date: new Date().toLocaleDateString('en-GB'),
                createdAt: serverTimestamp(),
                expenseType: expenseType || 'car_maintenance'
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
            } else {
                if (!expenseTitle || !expenseAmount) {
                    toast.error('يرجى إدخال العنوان والمبلغ');
                    setIsLoading(false);
                    return;
                }
                total = Number(expenseAmount);
                data = {
                    ...data,
                    title: expenseTitle,
                    amount: total,
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
            
            if (expenseType === 'car_maintenance') {
                setTires(''); setTiresPrice('');
                setOil(''); setOilPrice('');
                setBrakes(''); setBrakesPrice('');
                setFrontEnd(''); setFrontEndPrice('');
                setSelectedCarId('');
            } else {
                setExpenseTitle(''); setExpenseAmount(''); setExpenseNote('');
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

    const filteredRecords = records.filter((r: any) => {
        if (viewFilter !== 'all' && (r.expenseType || 'car_maintenance') !== viewFilter) return false;
        if (viewFilter === 'car_maintenance' && viewCarId && r.selectedCarId !== viewCarId) return false;
        
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

    const getExpenseTypeName = (type: string) => {
        switch (type) {
            case 'car_maintenance': return 'صيانة سيارة';
            case 'rent': return 'إيجار';
            case 'salaries': return 'الرواتب والأجور';
            case 'other': return 'أخرى';
            default: return 'صيانة سيارة';
        }
    };

    let currentTotal = 0;
    if (expenseType === 'car_maintenance') {
        currentTotal = Number(tiresPrice) + Number(oilPrice) + Number(brakesPrice) + Number(frontEndPrice);
    } else {
        currentTotal = Number(expenseAmount);
    }

    // Calculations for Summary Cards
    const totalMonthExpenses = filteredRecords.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
    const expensesByCategory = filteredRecords.reduce((acc: any, r: any) => {
        const type = r.expenseType || 'car_maintenance';
        acc[type] = (acc[type] || 0) + (Number(r.total) || 0);
        return acc;
    }, {});
    
    let highestCategory = 'لا يوجد';
    let maxAmount = 0;
    for (const [key, amount] of Object.entries(expensesByCategory)) {
        if ((amount as number) > maxAmount) {
            maxAmount = amount as number;
            highestCategory = getExpenseTypeName(key);
        }
    }
    
    const numberOfTransactions = filteredRecords.length;

    return (
        <div className="space-y-6 text-right font-sans" ref={printRef}>
            <style>
                {\`
                    @media print {
                        body {
                            background-color: white;
                            margin: 0;
                            padding: 10mm;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 0;
                        }
                        .print-container {
                            box-shadow: none !important;
                            padding: 0 !important;
                            max-width: 100% !important;
                            border: none !important;
                        }
                        th {
                            background-color: #2c3e50 !important;
                            color: white !important;
                        }
                        tr:nth-child(even) {
                            background-color: #f8f9fa !important;
                        }
                        .summary-card {
                            border-right: 5px solid #007bff !important;
                            background: #f1f3f5 !important;
                        }
                        .summary-card.danger {
                            border-right-color: #dc3545 !important;
                        }
                    }
                \`}
            </style>
            
            <div className="flex justify-between items-center mb-6 print:hidden flex-row-reverse">
                <h1 className="text-2xl font-black text-black">الصرفيات</h1>
                <div className="flex gap-3">
                    <button onClick={handlePrint} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 transition flex items-center gap-2">
                        <Printer size={16} />
                        <span>طباعة</span>
                    </button>
                    <button disabled={isGeneratingPdf} onClick={downloadPDF} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
                        <Download size={16} />
                        <span>{isGeneratingPdf ? 'جاري المعالجة...' : 'تحميل PDF'}</span>
                    </button>
                </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-200 print:hidden">
                <h2 className="text-lg font-bold mb-4">إضافة مصروف جديد</h2>
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-neutral-700 mb-2">نوع المصروف</label>
                    <select value={expenseType} onChange={e => setExpenseType(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50">
                        <option value="car_maintenance">صيانة سيارة</option>
                        <option value="rent">إيجار</option>
                        <option value="salaries">رواتب موظفين</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>

                {expenseType === 'car_maintenance' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <select value={selectedCarId} onChange={e => setSelectedCarId(e.target.value)} className="p-3 border rounded-xl bg-slate-50">
                            <option value="">اختر السيارة</option>
                            {cars.map((car: any) => <option key={car.id} value={car.id}>{car.name}</option>)}
                        </select>
                        <div className="flex gap-2">
                            <input value={tires} onChange={e => setTires(e.target.value)} placeholder="حالة الإطارات" className="p-3 border rounded-xl bg-slate-50 flex-1" />
                            <input type="number" value={tiresPrice} onChange={e => setTiresPrice(e.target.value)} placeholder="سعر" className="p-3 border rounded-xl bg-slate-50 w-24" />
                        </div>
                        <div className="flex gap-2">
                            <input value={oil} onChange={e => setOil(e.target.value)} placeholder="تبديل الزيت" className="p-3 border rounded-xl bg-slate-50 flex-1" />
                            <input type="number" value={oilPrice} onChange={e => setOilPrice(e.target.value)} placeholder="سعر" className="p-3 border rounded-xl bg-slate-50 w-24" />
                        </div>
                        <div className="flex gap-2">
                            <input value={brakes} onChange={e => setBrakes(e.target.value)} placeholder="الفرامل" className="p-3 border rounded-xl bg-slate-50 flex-1" />
                            <input type="number" value={brakesPrice} onChange={e => setBrakesPrice(e.target.value)} placeholder="سعر" className="p-3 border rounded-xl bg-slate-50 w-24" />
                        </div>
                        <div className="flex gap-2">
                            <input value={frontEnd} onChange={e => setFrontEnd(e.target.value)} placeholder="صيانة صدر السيارة" className="p-3 border rounded-xl bg-slate-50 flex-1" />
                            <input type="number" value={frontEndPrice} onChange={e => setFrontEndPrice(e.target.value)} placeholder="سعر" className="p-3 border rounded-xl bg-slate-50 w-24" />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input value={expenseTitle} onChange={e => setExpenseTitle(e.target.value)} placeholder="العنوان (مثال: إيجار شهر 5)" className="p-3 border rounded-xl bg-slate-50" />
                        <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="المبلغ الكلي" className="p-3 border rounded-xl bg-slate-50" />
                        <textarea value={expenseNote} onChange={e => setExpenseNote(e.target.value)} placeholder="ملاحظات (اختياري)" className="p-3 border rounded-xl bg-slate-50 md:col-span-2 min-h-[100px]" />
                    </div>
                )}

                <button disabled={isLoading} onClick={handleAdd} className="mt-6 bg-slate-900 text-white px-6 py-2.5 rounded-xl disabled:opacity-50 font-bold transition hover:bg-slate-800">
                    {isLoading ? 'جاري الإضافة...' : \`إضافة (إجمالي: \${currentTotal})\`}
                </button>
            </div>

            {/* Print Container Starts Here */}
            <div className="print-container bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
                
                {/* Header for Print Only */}
                <h1 className="hidden print:block text-center text-[#2c3e50] text-3xl font-black mb-8">سجل صرفيات الشركة</h1>

                {/* Summary Cards */}
                <div className="flex flex-col md:flex-row gap-4 mb-8 flex-row-reverse">
                    <div className="summary-card danger flex-1 bg-[#f1f3f5] p-4 rounded-md text-center border-r-[5px] border-r-[#dc3545]">
                        <h3 className="m-0 mb-2 text-sm text-[#6c757d] font-bold">إجمالي مصروفات الشهر</h3>
                        <p className="m-0 text-xl font-bold">{new Intl.NumberFormat('en-US').format(totalMonthExpenses)} د.ع</p>
                    </div>
                    <div className="summary-card flex-1 bg-[#f1f3f5] p-4 rounded-md text-center border-r-[5px] border-r-[#007bff]">
                        <h3 className="m-0 mb-2 text-sm text-[#6c757d] font-bold">أعلى فئة صرف</h3>
                        <p className="m-0 text-xl font-bold">{highestCategory}</p>
                    </div>
                    <div className="summary-card flex-1 bg-[#f1f3f5] p-4 rounded-md text-center border-r-[5px] border-r-[#007bff]">
                        <h3 className="m-0 mb-2 text-sm text-[#6c757d] font-bold">عدد العمليات</h3>
                        <p className="m-0 text-xl font-bold">{numberOfTransactions} عملية</p>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-col md:flex-row-reverse items-start md:items-center justify-between mb-4 gap-4 print:hidden">
                    <h2 className="text-lg font-bold">سجل الصرفيات ({new Date().toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' })})</h2>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select value={viewFilter} onChange={e => setViewFilter(e.target.value)} className="text-sm p-2.5 border rounded-xl flex-1 md:w-40 bg-slate-50">
                            <option value="all">كل الصرفيات</option>
                            <option value="car_maintenance">صيانة السيارات</option>
                            <option value="rent">إيجارات</option>
                            <option value="salaries">رواتب</option>
                            <option value="other">أخرى</option>
                        </select>
                        
                        {viewFilter === 'car_maintenance' && (
                            <select value={viewCarId} onChange={e => setViewCarId(e.target.value)} className="text-sm p-2.5 border rounded-xl flex-1 md:w-40 bg-slate-50">
                                <option value="">كل السيارات</option>
                                {cars.map((car: any) => <option key={car.id} value={car.id}>{car.name}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                {/* Table Data */}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse mt-2 text-right dir-rtl">
                        <thead>
                            <tr>
                                <th className="bg-[#2c3e50] text-white font-bold p-3 border-b border-[#dee2e6] text-right">التاريخ</th>
                                <th className="bg-[#2c3e50] text-white font-bold p-3 border-b border-[#dee2e6] text-right">رقم السند</th>
                                <th className="bg-[#2c3e50] text-white font-bold p-3 border-b border-[#dee2e6] text-right">فئة المصروف</th>
                                <th className="bg-[#2c3e50] text-white font-bold p-3 border-b border-[#dee2e6] text-right">البيان / الوصف</th>
                                <th className="bg-[#2c3e50] text-white font-bold p-3 border-b border-[#dee2e6] text-right">الجهة المستفيدة</th>
                                <th className="bg-[#2c3e50] text-white font-bold p-3 border-b border-[#dee2e6] text-right">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-10 text-neutral-400 font-medium">
                                        لا توجد صرفيات مسجلة لهذا الشهر
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((r: any, i: number) => {
                                    const type = r.expenseType || 'car_maintenance';
                                    const voucherNum = r.id ? \`#EX-\${r.id.substring(r.id.length - 4).toUpperCase()}\` : \`#EX-90\${i + 1}\`;
                                    
                                    let description = '';
                                    if (type === 'car_maintenance') {
                                        const details = [];
                                        if (r.tires) details.push(\`إطارات (\${r.tires})\`);
                                        if (r.oil) details.push(\`زيت (\${r.oil})\`);
                                        if (r.brakes) details.push(\`فرامل (\${r.brakes})\`);
                                        if (r.frontEnd) details.push(\`صدر (\${r.frontEnd})\`);
                                        description = details.join('، ');
                                    } else {
                                        description = r.note || '-';
                                    }

                                    let beneficiary = '-';
                                    if (type === 'car_maintenance') {
                                        beneficiary = \`السيارة: \${cars.find((c: any) => c.id === r.selectedCarId)?.name || 'غير معروف'}\`;
                                    } else {
                                        beneficiary = r.title || '-';
                                    }

                                    return (
                                        <tr key={i} className="even:bg-[#f8f9fa] border-b border-[#dee2e6]">
                                            <td className="p-3">{r.date}</td>
                                            <td className="p-3 font-mono text-xs font-bold text-slate-500">{voucherNum}</td>
                                            <td className="p-3">
                                                <span className="bg-[#e9ecef] px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                    {getExpenseTypeName(type)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm">{description}</td>
                                            <td className="p-3 text-sm">{beneficiary}</td>
                                            <td className="p-3 font-bold text-[#dc3545] whitespace-nowrap">
                                                {new Intl.NumberFormat('en-US').format(r.total)} <span className="text-xs">د.ع</span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
`
fs.writeFileSync('src/components/MaintenanceExpenses.tsx', content);
