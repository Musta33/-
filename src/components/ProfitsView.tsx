import React, { useMemo, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Award, Car, User, ShieldCheck, Calendar, ChevronDown, Printer, Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface Props {
  viewType: 'profits-no-driver' | 'profits-driver' | 'profits-invested';
  contracts: any[];
  cars: any[];
  maintenanceRecords: any[];
}

export function ProfitsView({ viewType, contracts, cars, maintenanceRecords }: Props) {
  
  const [period, setPeriod] = useState<'current_month' | 'last_month' | 'specific_month' | 'specific_year'>('current_month');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    let income = 0;
    let totalCompanyIncome = 0;
    let totalMaintenance = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const lastMonthRaw = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = lastMonthRaw.getMonth();
    const lastMonthYear = lastMonthRaw.getFullYear();

    const isDateInPeriod = (dateObj: Date | null) => {
        if (!dateObj || isNaN(dateObj.getTime())) return true; // fallback if invalid
        if (period === 'specific_year') {
            return dateObj.getFullYear() === selectedYear;
        }
        if (period === 'current_month') {
            return dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear;
        }
        if (period === 'last_month') {
            return dateObj.getMonth() === lastMonth && dateObj.getFullYear() === lastMonthYear;
        }
        if (period === 'specific_month' && selectedMonth) {
            const [yearStr, monthStr] = selectedMonth.split('-');
            return dateObj.getFullYear() === parseInt(yearStr, 10) && dateObj.getMonth() === parseInt(monthStr, 10) - 1;
        }
        return true;
    };

    const getDateFromField = (field: any) => {
        if (!field) return null;
        if (field.seconds) return new Date(field.seconds * 1000);
        if (typeof field === 'number') return new Date(field * 1000);
        if (typeof field === 'string') return new Date(field);
        return new Date(); // fallback
    };

    // Filter maintenance
    maintenanceRecords.forEach(r => {
        const dateObj = getDateFromField(r.createdAt) || new Date();
        if (isDateInPeriod(dateObj)) {
            totalMaintenance += Number(r.total || 0);
        }
    });
    
    let baseContracts = contracts;

    // Calculate total company income from all valid contracts (filtered by period)
    baseContracts.filter(c => c.bookingStatus !== 'cancelled').forEach(contract => {
        const dateObj = getDateFromField(contract.createdAt || contract.rentalStartDate);
        if (isDateInPeriod(dateObj)) {
            const rawAmount = contract.rentalCost || contract.totalAmount || 0;
            const amount = parseFloat(typeof rawAmount === 'string' ? String(rawAmount).replace(/,/g, '') : String(rawAmount));
            if (!isNaN(amount)) {
                totalCompanyIncome += amount;
            }
        }
    });

    // Filter contracts based on view and period
    let relevantContracts = baseContracts.filter(c => c.bookingStatus !== 'cancelled');

    relevantContracts = relevantContracts.filter(c => {
        const dateObj = getDateFromField(c.createdAt || c.rentalStartDate);
        return isDateInPeriod(dateObj);
    });

    if (viewType === 'profits-no-driver') {
      relevantContracts = relevantContracts.filter(c => !c.isWithDriver);
    } else if (viewType === 'profits-driver') {
      relevantContracts = relevantContracts.filter(c => c.isWithDriver);
    } else if (viewType === 'profits-invested') {
      relevantContracts = relevantContracts.filter(c => {
        const car = cars.find(car => 
            (c.carId && String(car.id) === String(c.carId)) || 
            (c.plateNumber && car.plateNumber && String(car.plateNumber).trim() === String(c.plateNumber).trim()) ||
            (c.carName && car.name && String(car.name).trim() === String(c.carName).trim())
        );
        return car && (car.isInvested || car.investmentPercentage > 0);
      });
    }

    relevantContracts.forEach(contract => {
        let rawAmount = contract.rentalCost || contract.totalAmount;
        if (!rawAmount && contract.dailyAmount && contract.rentalDays) {
            rawAmount = parseFloat(String(contract.dailyAmount).replace(/,/g, '')) * parseInt(contract.rentalDays);
        }
        const amount = parseFloat(typeof rawAmount === 'string' ? String(rawAmount).replace(/,/g, '') : String(rawAmount)) || 0;
        
        if (!isNaN(amount)) {
            let investorShare = 0;
            let companyPercentage = 0;
            if (viewType === 'profits-invested') {
                const car = cars.find(car => 
                    (contract.carId && String(car.id) === String(contract.carId)) || 
                    (contract.plateNumber && car.plateNumber && String(car.plateNumber).trim() === String(contract.plateNumber).trim()) ||
                    (contract.carName && car.name && String(car.name).trim() === String(contract.carName).trim())
                );
                
                if (car && car.investmentPercentage !== undefined) {
                    companyPercentage = parseFloat(car.investmentPercentage) || 0;
                    const companyShareAmount = amount * (companyPercentage / 100);
                    investorShare = amount - companyShareAmount;
                } else {
                    // Default to 100% investor if not specified
                    investorShare = amount;
                }
            }
            
            income += amount;
            contract._investorShare = investorShare;
            contract._companyPercentage = companyPercentage;
            contract._amount = amount;
        }
    });

    let totalInvestorShares = relevantContracts.reduce((sum, c) => sum + (c._investorShare || 0), 0);

    return { income, totalCompanyIncome, totalMaintenance, relevantContracts, totalInvestorShares };
  }, [contracts, cars, viewType, maintenanceRecords, period, selectedMonth]);

  const titles = {
    'profits-no-driver': 'أرباح السيارات بدون سائق',
    'profits-driver': 'أرباح السيارات مع سائق',
    'profits-invested': 'أرباح السيارات المستثمرة'
  };

  const icons = {
    'profits-no-driver': <Car className="text-blue-500" size={32} />,
    'profits-driver': <User className="text-emerald-500" size={32} />,
    'profits-invested': <ShieldCheck className="text-purple-500" size={32} />
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = () => {
    const element = printRef.current;
    if (element) {
        setIsGeneratingPdf(true);
        const opt = {
            margin: 10,
            filename: `تقرير_${titles[viewType].replace(/ /g, '_')}.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, windowWidth: 1000 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
        };
        
        // Hide print:hidden elements for html2canvas
        const printHiddenElements = element.querySelectorAll('.print\\:hidden');
        printHiddenElements.forEach(el => (el as HTMLElement).style.display = 'none');

        // Let React render without print:hidden elements briefly if needed
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

  return (
    <div className="space-y-6 animate-fade-in text-right ml-0" ref={printRef}>
      <header className="flex justify-between items-center mb-8 flex-row-reverse flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 flex items-center gap-3 flex-row-reverse">
            {icons[viewType]}
            <span>{titles[viewType]}</span>
          </h1>
          <p className="text-neutral-500 mt-2 flex flex-row-reverse items-center gap-2 print:hidden">عرض الأرباح التفصيلية لهذه الفئة من السيارات والعقود المكتملة أو النشطة.</p>
        </div>
        
        <div className="flex gap-3 print:hidden">
            <button onClick={handlePrint} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 transition flex items-center gap-2">
                <Printer size={16} />
                <span>طباعة</span>
            </button>
            <button disabled={isGeneratingPdf} onClick={downloadPDF} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
                <Download size={16} />
                <span>{isGeneratingPdf ? 'جاري المعالجة...' : 'تحميل PDF'}</span>
            </button>
        </div>
        
        <div className="flex flex-wrap gap-3 print:hidden">
          <div className="relative">
              <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold bg-white text-slate-800 outline-none ring-2 ring-slate-200 focus:ring-blue-500 w-full sm:w-64 text-right cursor-pointer flex items-center justify-between flex-row-reverse"
              >
                <span>
                    {period === 'specific_year' && `الارباح السنوية (${selectedYear})`}
                    {period === 'current_month' && `الشهر الحالي (${new Date().toLocaleString('ar-SA', { month: 'long' })})`}
                    {period === 'last_month' && `الشهر السابق (${new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleString('ar-SA', { month: 'long' })})`}
                    {period === 'specific_month' && selectedMonth && (() => {
                        const [y, m] = selectedMonth.split('-');
                        const d = new Date(parseInt(y), parseInt(m)-1, 1);
                        return `${d.toLocaleString('ar-SA', { month: 'long' })} ${d.getFullYear()}`;
                    })()}
                </span>
                <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
                <div className="absolute top-12 left-0 w-full sm:w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 overflow-hidden text-right flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <button 
                        onClick={() => { setPeriod('current_month'); setIsDropdownOpen(false); }}
                        className={`text-right w-full px-3 py-2 text-sm font-bold rounded-lg transition ${period === 'current_month' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                        الشهر الحالي ({new Date().toLocaleString('ar-SA', { month: 'long' })})
                    </button>
                    <button 
                        onClick={() => { setPeriod('last_month'); setIsDropdownOpen(false); }}
                        className={`text-right w-full px-3 py-2 text-sm font-bold rounded-lg transition ${period === 'last_month' ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                        الشهر السابق ({new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleString('ar-SA', { month: 'long' })})
                    </button>
                    <div className="h-px bg-slate-100 my-1"></div>
                    <div className="px-3 py-1 text-xs text-slate-400 font-bold">حسب السنة:</div>
                    {[2027, 2026].map((y) => {
                        return (
                            <div key={`year-group-${y}`} className="mb-2">
                                <button 
                                    onClick={() => { setPeriod('specific_year'); setSelectedYear(y); setIsDropdownOpen(false); }}
                                    className={`text-right w-full px-3 py-2 text-sm font-bold rounded-lg transition ${period === 'specific_year' && selectedYear === y ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    الارباح السنوية ({y})
                                </button>
                                <div className="grid grid-cols-3 gap-1 mt-1 px-1 flex-row-reverse" dir="rtl">
                                    {Array.from({ length: 12 }).map((_, mIndex) => {
                                        const m = 12 - mIndex;
                                        const d = new Date(y, m - 1, 1);
                                        const valStr = `${y}-${String(m).padStart(2, '0')}`;
                                        const labelStr = d.toLocaleString('ar-SA', { month: 'long' });

                                        return (
                                            <button 
                                                key={valStr}
                                                onClick={() => { setPeriod('specific_month'); setSelectedMonth(valStr); setIsDropdownOpen(false); }}
                                                className={`text-center px-1 py-1.5 text-[11px] font-bold rounded-md transition ${period === 'specific_month' && selectedMonth === valStr ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'}`}
                                            >
                                                {labelStr}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 w-full">
        <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-end relative overflow-hidden text-right">
          <span className="text-neutral-500 font-bold mb-2">إجمالي الواردات الكلية لهذه الفئة</span>
          <span className="text-3xl font-black text-slate-800 tracking-tight">
              {data.income.toLocaleString('en-US')} <span className="text-lg text-slate-400 font-normal">د.ع</span>
          </span>
        </div>

        {viewType === 'profits-invested' ? (
          <div className="bg-white p-6 rounded-3xl border border-indigo-200 shadow-sm flex flex-col items-end relative overflow-hidden text-right">
            <span className="text-indigo-500 font-bold mb-2">إجمالي حصص المستثمرين</span>
            <span className="text-3xl font-black text-indigo-700 tracking-tight">
                {data.totalInvestorShares.toLocaleString('en-US')} <span className="text-lg text-indigo-400 font-normal">د.ع</span>
            </span>
            <div className="absolute left-0 -top-10 opacity-5 pointer-events-none text-indigo-900">
                <ShieldCheck size={150} />
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col items-end relative overflow-hidden text-right">
            <span className="text-neutral-500 font-bold mb-2">إجمالي صرفيات الصيانة (هذا الشهر)</span>
            <span className="text-3xl font-black text-red-600 tracking-tight">
                {data.totalMaintenance.toLocaleString('en-US')} <span className="text-lg text-slate-400 font-normal">د.ع</span>
            </span>
          </div>
        )}

        <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-sm flex flex-col items-end relative overflow-hidden text-right col-span-1 md:col-span-2">
          <span className="text-slate-400 font-bold mb-2">
            {viewType === 'profits-invested' 
                ? 'صافي أرباح الشركة من السيارات المستثمرة' 
                : data.totalMaintenance > 0 
                    ? 'صافي الأرباح الكلية للشركة (بعد خصم الصيانة)' 
                    : 'صافي الأرباح الكلية للشركة'}
          </span>
          <span className="text-4xl font-black text-white tracking-tight">
              {viewType === 'profits-invested' 
                ? (data.income - data.totalInvestorShares).toLocaleString('en-US')
                : (data.totalCompanyIncome - data.totalMaintenance).toLocaleString('en-US')} <span className="text-xl text-slate-500 font-normal">د.ع</span>
          </span>
          <div className="absolute left-0 -top-10 opacity-5 pointer-events-none text-white">
              <Award size={150} />
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-neutral-800 mt-8 mb-4">قائمة العقود الخاصة بهذه الفئة</h3>
      <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden">
        {data.relevantContracts.length === 0 ? (
           <div className="p-12 text-center text-neutral-400 flex flex-col items-center">
               <Car size={48} className="mb-4 opacity-30" />
               <p className="text-lg font-bold">لا توجد أرباح أو عقود مسجلة لهذه الفئة حتى الآن</p>
           </div>
        ) : (
           <div className="overflow-x-auto">
               <table className="w-full text-right">
                 <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-sm">
                   <tr>
                     {viewType === 'profits-invested' && (
                         <>
                             <th className="p-4 text-center">حصة المستثمر</th>
                             <th className="p-4 text-center">صافي الشركة</th>
                         </>
                     )}
                     <th className="p-4 text-center">المبلغ المستحصل</th>
                     <th className="p-4 text-center">اسم السيارة</th>
                     <th className="p-4 text-center">رقم السيارة</th>
                     <th className="p-4 text-center">العميل</th>
                     <th className="p-4 text-center">رقم العقد</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {data.relevantContracts.map((contract, i) => {
                        const rawAmount = contract.rentalCost || contract.totalAmount || 0;
                        const amount = parseFloat(typeof rawAmount === 'string' ? String(rawAmount).replace(/,/g, '') : String(rawAmount));
                        return (
                            <tr key={i} className="hover:bg-slate-50 transition">
                                {viewType === 'profits-invested' && (
                                    <>
                                        <td className="p-4 text-center text-indigo-600 font-bold font-mono">
                                            {(contract._investorShare || 0).toLocaleString('en-US')} د.ع
                                        </td>
                                        <td className="p-4 text-center text-amber-600 font-bold font-mono">
                                            {((amount || 0) - (contract._investorShare || 0)).toLocaleString('en-US')} د.ع
                                            <span className="text-[10px] text-amber-400 block -mt-1">%{(contract._companyPercentage || 0)}</span>
                                        </td>
                                    </>
                                )}
                                <td className="p-4 text-center text-emerald-600 font-bold font-mono">
                                    {(amount || 0).toLocaleString('en-US')} د.ع
                                </td>
                                <td className="p-4 text-center font-bold text-blue-700">{contract.carName || (cars.find(c => c.id === contract.carId || c.plateNumber === contract.plateNumber)?.name) || '-'}</td>
                                <td className="p-4 text-center font-bold text-neutral-700">{contract.plateNumber || '-'}</td>
                                <td className="p-4 text-center font-bold">{contract.renterName || contract.name || '-'}</td>
                                <td className="p-4 text-center font-mono text-neutral-400 text-xs">#{String(contract.id || '').slice(0, 8)}</td>
                            </tr>
                        );
                    })}
                 </tbody>
               </table>
           </div>
        )}
      </div>

    </div>
  );
}
