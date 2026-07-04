import React, { useState, useMemo, useRef } from 'react';
import { 
  Car, Search, ShieldCheck, Percent, User, Trash2, Edit, TrendingUp, Info, Plus, 
  ChevronDown, ChevronUp, Phone, Calendar, Palette, Hash, DollarSign, Clock, Printer, Download, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2pdf from 'html2pdf.js';

export function InvestorCars({
  cars,
  contracts = [],
  setEditingCarId,
  setCarName,
  setCarPlate,
  setCarColor,
  setCarYear,
  setCarPrice,
  setCarImageUrl,
  setCarOwnerName,
  setCarOwnerPhone,
  setCarIsInvested,
  setCarInvestmentPercentage,
  setCarChassis,
  setCarRegNumber,
  setShowCarModal,
  handleDeleteCar,
  handleMarkAsPaid
}: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const downloadPDF = () => {
    const element = printRef.current;
    if (element) {
        setIsGeneratingPdf(true);
        const opt = {
            margin: 10,
            filename: `السيارات_المستثمرة.pdf`,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, windowWidth: 1000 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
        };
        
        const printHiddenElements = element.querySelectorAll('.print\\:hidden');
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

  const investorCars = useMemo(() => cars.filter((car: any) => 
    car.isInvested === true &&
    (car.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (car.plateNumber || car.plate)?.includes(searchTerm) ||
     car.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()))
  ), [cars, searchTerm]);

  const carProfits = useMemo(() => {
    const profitsMap: Record<string, { totalRevenue: number; investorProfit: number; currentProfit: number; isActive: boolean }> = {};
    
    investorCars.forEach((car: any) => {
      const carContracts = contracts.filter((c: any) => 
        (c.carId && String(car.id) === String(c.carId)) || 
        (c.plateNumber && car.plateNumber && String(car.plateNumber).trim() === String(c.plateNumber).trim()) ||
        (c.carName && car.name && String(car.name).trim() === String(c.carName).trim())
      );
      
      const isActive = carContracts.some((c: any) => (c.bookingStatus || 'active') === 'active');
      
      let totalRevenue = 0;
      carContracts.forEach((contract: any) => {
        if (contract.bookingStatus === 'cancelled') return;
        
        let rawAmount = contract.rentalCost || contract.totalAmount;
        if (!rawAmount && contract.dailyAmount && contract.rentalDays) {
          rawAmount = parseFloat(String(contract.dailyAmount).replace(/,/g, '')) * parseInt(contract.rentalDays);
        }
        const amount = parseFloat(typeof rawAmount === 'string' ? String(rawAmount).replace(/,/g, '') : String(rawAmount)) || 0;
        totalRevenue += amount;
      });
      
      const invPercent = parseFloat(car.investmentPercentage) || 0;
      const investorProfit = totalRevenue * (invPercent / 100);
      const paidAmount = parseFloat(car.paidProfits || 0);
      const currentProfit = Math.max(0, investorProfit - paidAmount);
      
      profitsMap[car.id] = { totalRevenue, investorProfit, currentProfit, isActive };
    });
    
    return profitsMap;
  }, [investorCars, contracts]);
  
  const totalInvestorProfits = Object.values(carProfits).reduce((acc: number, curr: any) => acc + curr.currentProfit, 0);
  const totalGlobalRevenue = Object.values(carProfits).reduce((acc: number, curr: any) => acc + curr.totalRevenue, 0);

  return (
    <div className="space-y-8 text-right font-sans" dir="rtl" ref={printRef}>
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden print:hidden">
        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-60 -ml-16 -mt-16" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <ShieldCheck size={28} />
             </div>
             <div>
                <h1 className="text-3xl font-black text-slate-900 leading-tight">السيارات المستثمرة</h1>
                <p className="text-slate-500 font-bold text-sm">إدارة الأصول والشراكات الاستثمارية</p>
             </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center px-6 border-l border-slate-100">
               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">إجمالي المستحقات للمستثمرين</span>
               <span className="text-2xl font-black text-emerald-600 font-mono leading-none">{totalInvestorProfits.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center px-6 border-l border-slate-100">
               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">إجمالي الواردات</span>
               <span className="text-2xl font-black text-slate-900 font-mono leading-none">{totalGlobalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center px-6">
               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">متوسط النسبة</span>
               <span className="text-2xl font-black text-indigo-600 font-mono leading-none">
                  {investorCars.length > 0 
                    ? Math.round(investorCars.reduce((acc: number, car: any) => acc + (Number(car.investmentPercentage) || 0), 0) / investorCars.length) 
                    : 0}%
               </span>
            </div>
          </div>

          <button 
            onClick={() => {
              setEditingCarId(null);
              setCarName('');
              setCarPlate('');
              setCarColor('');
              setCarYear('');
              setCarOwnerName('');
              setCarOwnerPhone('');
              setCarIsInvested(true);
              setCarInvestmentPercentage('50');
              setCarChassis('');
              setCarRegNumber('');
              setCarPrice('75000');
              setCarImageUrl('');
              setShowCarModal(true);
            }} 
            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-8 rounded-2xl text-sm transition-all shadow-lg shadow-emerald-200 transform hover:scale-[1.02]"
          >
            <Plus size={18} strokeWidth={3} />
            <span>إضافة سيارة مستثمرة</span>
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="relative group print:hidden">
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
          <Search size={20} />
        </div>
        <input 
          type="text"
          placeholder="بحث باسم السيارة، اللوحة، أو اسم المستثمر..."
          className="w-full bg-white border-2 border-slate-100 py-5 pr-14 pl-6 rounded-3xl text-right font-black text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500/30 focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Investor Cars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {investorCars.map((car: any) => (
            <motion.div
              key={car.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="group bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden hover:shadow-2xl hover:shadow-emerald-900/5 transition-all duration-500 flex flex-col h-full"
            >
              {/* Image & Overlay */}
              <div className="relative h-56 overflow-hidden">
                {car.imageUrl ? (
                  <img src={car.imageUrl} alt={car.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
                    <Car size={64} strokeWidth={1} />
                  </div>
                )}
                
                {/* Investment Badge */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                  <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
                    <Percent size={14} />
                    <span>نسبة الاستثمار: {car.investmentPercentage || 0}%</span>
                  </div>
                  {carProfits[car.id]?.isActive ? (
                    <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
                      <Clock size={14} />
                      <span>مؤجرة حالياً</span>
                    </div>
                  ) : (
                    <div className="bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2">
                      <Car size={14} />
                      <span>متاحة للإيجار</span>
                    </div>
                  )}
                </div>

                {/* Quick Actions Overlay */}
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 print:hidden">
                  <button 
                    onClick={() => {
                      setEditingCarId(car.id);
                      setCarName(car.name);
                      setCarPlate(car.plateNumber || car.plate || '');
                      setCarColor(car.color || '');
                      setCarYear(car.year || '');
                      setCarPrice(car.dailyPrice || car.price || '75000');
                      setCarImageUrl(car.imageUrl || '');
                      setCarOwnerName(car.ownerName || '');
                      setCarOwnerPhone(car.ownerPhone || '');
                      setCarIsInvested(car.isInvested);
                      setCarInvestmentPercentage(car.investmentPercentage);
                      setCarChassis(car.chassisNumber || car.chassis || '');
                      setCarRegNumber(car.registrationNumber || car.regNumber || '');
                      setShowCarModal(true);
                    }}
                    className="p-3 bg-white text-slate-900 rounded-xl hover:bg-emerald-600 hover:text-white transition-all transform hover:scale-110"
                  >
                    <Edit size={20} />
                  </button>
                  <button 
                    onClick={() => handleDeleteCar(car.id)}
                    className="p-3 bg-white text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all transform hover:scale-110"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-1">{car.name}</h3>
                    <div className="flex items-center gap-2 text-slate-400 font-mono text-sm font-bold">
                      <span>{car.plateNumber || car.plate}</span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full" />
                      <span>{car.year}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setExpandedCarId(expandedCarId === car.id ? null : car.id)}
                    className={`p-2 rounded-xl transition-all print:hidden ${expandedCarId === car.id ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {expandedCarId === car.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                        <User size={18} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest">المستثمر</span>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800">{car.ownerName || 'غير محدد'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl flex items-center justify-between border ${carProfits[car.id]?.isActive ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        {carProfits[car.id]?.isActive ? <Clock size={18} className="text-blue-600" /> : <Car size={18} className="text-slate-400" />}
                      </div>
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">حالة السيارة</span>
                        <span className="text-sm font-black">{carProfits[car.id]?.isActive ? 'مؤجرة حالياً' : 'متاحة للإيجار'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 p-4 rounded-2xl flex items-center justify-between border border-emerald-100/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                        <TrendingUp size={18} />
                      </div>
                      <div>
                        <span className="block text-[10px] text-emerald-600/60 font-black uppercase tracking-widest">ربح المستثمر (الحالي)</span>
                        <span className="text-sm font-black text-emerald-700">{(carProfits[car.id]?.currentProfit || 0).toLocaleString()} د.ع</span>
                      </div>
                    </div>
                    {carProfits[car.id]?.currentProfit > 0 && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsPaid(car.id, carProfits[car.id]?.currentProfit);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-2 rounded-lg transition-all shadow-sm flex items-center gap-1 print:hidden"
                      >
                        <Check size={12} strokeWidth={3} />
                        <span>تم الدفع</span>
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {expandedCarId === car.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden space-y-3"
                      >
                        <div className="bg-slate-900 p-4 rounded-2xl flex flex-col gap-2 text-white">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                               <TrendingUp size={14} className="text-emerald-400" />
                               <span className="text-[10px] font-black uppercase">إجمالي الواردات (تراكمي)</span>
                             </div>
                             <span className="text-sm font-mono font-bold text-slate-300">{(carProfits[car.id]?.totalRevenue || 0).toLocaleString()} د.ع</span>
                           </div>
                           <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-1">
                             <div className="flex items-center gap-2">
                               <ShieldCheck size={14} className="text-emerald-400" />
                               <span className="text-xs font-black uppercase">إجمالي ربح المستثمر</span>
                             </div>
                             <div className="text-right">
                               <span className="text-lg font-black text-emerald-400">{(carProfits[car.id]?.investorProfit || 0).toLocaleString()}</span>
                               <span className="text-[10px] text-emerald-400/60 mr-1 font-bold">({car.investmentPercentage || 0}%)</span>
                             </div>
                           </div>
                           {parseFloat(car.paidProfits) > 0 && (
                             <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                               <div className="flex items-center gap-2">
                                 <DollarSign size={14} className="text-blue-400" />
                                 <span className="text-[10px] font-black uppercase">تم دفعها مسبقاً</span>
                               </div>
                               <span className="text-sm font-mono font-bold text-blue-400">{(parseFloat(car.paidProfits)).toLocaleString()} د.ع</span>
                             </div>
                           )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                            <Phone size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600 font-mono">{car.ownerPhone || '---'}</span>
                          </div>
                          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                            <Palette size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600">{car.color || '---'}</span>
                          </div>
                          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                            <Hash size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600 font-mono">{car.registrationNumber || car.regNumber || '---'}</span>
                          </div>
                          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                            <DollarSign size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-600 font-mono">{Number(car.dailyPrice || car.price || 0).toLocaleString()} د.ع</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer Specs */}
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-tighter">
                <div className="flex items-center gap-1.5">
                  <Info size={12} />
                  <span>الشاصي: {car.chassis || '---'}</span>
                </div>
                <span>{car.regNumber || '---'}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {investorCars.length === 0 && (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-24 text-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Car className="text-slate-200" size={48} />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">لا يوجد سيارات مستثمرة</h3>
          <p className="text-slate-400 font-bold max-w-xs mx-auto">لم يتم العثور على أي مركبات مسجلة تحت نظام الاستثمار حالياً.</p>
        </div>
      )}
    </div>
  );
}
