import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search, X, Car, MapPin, Palette, Calendar, DollarSign, Fingerprint, ShieldCheck, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Fleet({
  cars,
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
  usersList = [],
  title = "أسطول السيارات الرقمي",
  subtitle = "نظام المراقبة والتحكم الشامل في أصول الشركة"
}: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [expandedCarId, setExpandedCarId] = useState<number | string | null>(null);

  React.useEffect(() => {
    if (searchQuery === debouncedSearch) {
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch]);

  const filteredCars = React.useMemo(() => {
    return cars.filter((car: any) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch = (car.name || '').toLowerCase().includes(q) || 
                            (car.plateNumber || '').toLowerCase().includes(q) || 
                            (car.registrationNumber || '').toLowerCase().includes(q) ||
                            (car.chassisNumber || car.chassis || '').toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [cars, debouncedSearch]);

  return (
    <div className="space-y-8 text-right font-sans">
      {/* Search & Filter Section */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <div className="relative group flex-1">
          <div className="absolute inset-0 bg-blue-500/5 blur-2xl group-focus-within:bg-blue-500/10 transition-all rounded-[2rem]" />
          <div className="relative bg-white border-2 border-slate-100 group-focus-within:border-blue-400 group-focus-within:ring-4 group-focus-within:ring-blue-500/5 p-1.5 rounded-[2rem] flex items-center shadow-sm transition-all">
            <div className="p-3.5 pr-5 text-slate-400 group-focus-within:text-blue-500 transition-colors">
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </div>
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن مركبة (اسم، لوحة، شاصي)..."
              className="w-full bg-transparent border-none outline-none text-slate-900 font-bold text-sm pr-2 text-right placeholder:text-slate-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="p-3 ml-2 text-slate-300 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        <button 
          onClick={() => {
            setEditingCarId(null);
            setCarName('');
            setCarPlate('');
            setCarColor('');
            setCarYear('');
            setCarPrice('75000');
            setCarImageUrl('');
            setCarOwnerName('');
            setCarOwnerPhone('');
            setCarIsInvested(false);
            setCarInvestmentPercentage('0');
            setCarChassis('');
            setCarRegNumber('');
            setShowCarModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-[2rem] font-black text-sm shadow-xl shadow-blue-100 transition-all flex items-center justify-center gap-3 active:scale-95 shrink-0"
        >
          <span>إضافة سيارة للأسطول</span>
          <Plus size={20} />
        </button>
      </div>

      {/* Fleet Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredCars.map((car: any, index: number) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 25,
                delay: index < 9 ? index * 0.05 : 0 
              }}
              key={`${car.id}-${index}`} 
              className="bg-white rounded-[2.5rem] border border-slate-200/60 flex flex-col overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 group"
            >
              {/* Card Header: Image & Status */}
              <div className="relative h-56 bg-slate-50 overflow-hidden flex items-center justify-center p-6">
                {/* Status Badge */}
                <div className="absolute top-5 right-5 z-20">
                   <div className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-sm border ${
                      car.status === 'rented' 
                      ? 'bg-blue-500 text-white border-blue-400' 
                      : 'bg-emerald-500 text-white border-emerald-400'
                   }`}>
                      {car.status === 'rented' ? 'مؤجرة حالياً' : 'متاحة للطلب'}
                   </div>
                </div>

                {/* Technical Icons Layer */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                   <div className="absolute top-4 left-4"><Fingerprint size={80} /></div>
                   <div className="absolute bottom-4 right-4"><ShieldCheck size={80} /></div>
                </div>

                {car.imageUrl ? (
                  <img 
                    src={car.imageUrl} 
                    alt={car.name} 
                    className="max-h-full max-w-full object-contain filter drop-shadow-2xl group-hover:scale-110 transition-transform duration-700 cursor-pointer"
                    onClick={() => setSelectedImage(car.imageUrl)}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300">
                     <Car size={64} strokeWidth={1} />
                     <span className="text-[10px] font-black uppercase tracking-widest mt-2">No Visual Asset</span>
                  </div>
                )}
                
                {/* ID Overlay */}
                <div className="absolute bottom-4 left-6 bg-white/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/50 shadow-sm">
                   <span className="text-[10px] font-mono font-black text-slate-500">#{String(car.id).slice(-6).toUpperCase()}</span>
                </div>
              </div>

              {/* Card Body: Specs & Details */}
              <div className="p-7 flex flex-col flex-1">
                <div className="flex items-start justify-between flex-row-reverse mb-6">
                   <div className="text-right">
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{car.name}</h3>
                      <div className="flex items-center gap-2 flex-row-reverse mt-1">
                         <MapPin size={12} className="text-slate-400" />
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                            المقر الرئيسي
                         </span>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingCarId(car.id);
                          setCarName(car.name);
                          setCarPlate(car.plateNumber);
                          setCarColor(car.color || '');
                          setCarYear(car.year || '');
                          setCarOwnerName(car.ownerName || car.owner || '');
                          setCarIsInvested(car.isInvested || false);
                          setCarInvestmentPercentage(String(car.investmentPercentage || '0'));
                          setCarChassis(car.chassisNumber || car.chassis || car.chassis_number || '');
                          setCarRegNumber(car.registrationNumber || car.engineNumber || '');
                          setCarOwnerPhone(car.ownerPhone || '');
                          setCarPrice(String(car.dailyPrice));
                          setCarImageUrl(car.imageUrl || '');
                          setShowCarModal(true);
                        }}
                        className="w-10 h-10 bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-xl flex items-center justify-center transition-colors border border-slate-100"
                      >
                         <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCar(car.id)}
                        className="w-10 h-10 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl flex items-center justify-center transition-colors border border-slate-100"
                      >
                         <Trash2 size={16} />
                      </button>
                   </div>
                </div>

                {/* Tech Specs Grid */}
                <button 
                  onClick={() => setExpandedCarId(expandedCarId === car.id ? null : car.id)}
                  className="flex items-center justify-between w-full bg-slate-50 hover:bg-slate-100 p-3 rounded-2xl border border-slate-100 transition-colors mb-4"
                >
                  <span className="text-xs font-black text-slate-700">معلومات السيارة</span>
                  {expandedCarId === car.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </button>

                <AnimatePresence>
                  {expandedCarId === car.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 mb-6">
                         <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
                            <div className="flex items-center gap-2 flex-row-reverse mb-1 text-slate-400">
                               <Calendar size={12} />
                               <span className="text-[9px] font-black uppercase">الموديل</span>
                            </div>
                            <span className="text-xs font-black text-slate-700 font-mono block text-right">{car.year || '----'}</span>
                         </div>
                         <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
                            <div className="flex items-center gap-2 flex-row-reverse mb-1 text-slate-400">
                               <Palette size={12} />
                               <span className="text-[9px] font-black uppercase">اللون</span>
                            </div>
                            <span className="text-xs font-black text-slate-700 block text-right">{car.color || '----'}</span>
                         </div>
                         <div className="bg-slate-50/80 rounded-2xl p-3 border border-slate-100 col-span-2">
                            <div className="flex items-center gap-2 flex-row-reverse mb-1 text-slate-400">
                               <Fingerprint size={12} />
                               <span className="text-[9px] font-black uppercase">رقم اللوحة الرقمي</span>
                            </div>
                            <span className="text-sm font-black text-slate-900 font-mono block text-right tracking-widest">{car.plateNumber}</span>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer: Price & Investment */}
                <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-end flex-row-reverse">
                   <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">التعرفة اليومية</span>
                      <div className="flex items-baseline gap-1 flex-row-reverse">
                         <span className="text-xl font-black text-blue-600 font-mono">
                            {parseFloat(String(car.dailyPrice || '0')).toLocaleString('en-US')}
                         </span>
                         <span className="text-[10px] font-black text-slate-400">د.ع</span>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredCars.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="col-span-full bg-white border-2 border-dashed border-slate-200 rounded-[3rem] p-24 text-center"
          >
            <motion.div 
              initial={{ y: 0 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-slate-100"
            >
               <Car size={48} className="text-slate-200" />
            </motion.div>
            <h3 className="text-2xl font-black text-slate-900 mb-3">لم يتم العثور على مركبات</h3>
            <p className="text-slate-400 max-w-md mx-auto font-bold text-lg mb-10">جرب البحث بكلمات مختلفة أو إضافة مركبة جديدة للأسطول الرقمي.</p>
            <button 
              onClick={() => setShowCarModal(true)} 
              className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black text-sm shadow-xl shadow-blue-100 transition-all transform hover:scale-105 active:scale-95"
            >
              أضف مركبة الآن
            </button>
          </motion.div>
        )}
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-6xl w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
              <button 
                className="absolute top-0 right-0 text-white bg-white/10 hover:bg-white/20 rounded-2xl p-4 transition z-10"
                onClick={() => setSelectedImage(null)}
              >
                <X size={24} />
              </button>
              <motion.img 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={selectedImage} 
                alt="Car Preview" 
                className="max-w-full max-h-[85vh] object-contain rounded-3xl shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

