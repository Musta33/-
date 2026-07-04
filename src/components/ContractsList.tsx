import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, db, deleteDoc, doc, updateDoc, api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Calendar, Car, Clock, Search, Trash2, X, Ban, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ContractView } from './ContractView';

const CountdownTimer = ({ endDate, endTime, contractId, currentStatus }: { endDate: string, endTime?: string, contractId: string, currentStatus: string }) => {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, mins: number, secs: number} | null>(null);

  useEffect(() => {
    if (currentStatus !== 'active') return;

    const calculateTime = () => {
      const now = new Date().getTime();
      let endString = endDate;
      if (endTime) {
        endString = `${endDate}T${endTime.length === 5 ? endTime + ':00' : endTime}`;
      } else {
        endString = `${endDate}T23:59:59`;
      }
      const end = new Date(endString).getTime();
      const diff = end - now;

      if (diff <= 0) {
        updateDoc(doc(db, 'contracts', contractId), { bookingStatus: 'expired' });
        return null;
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        secs: Math.floor((diff % (1000 * 60)) / 1000)
      };
    };

    const timer = setInterval(() => {
      setTimeLeft(calculateTime());
    }, 1000);

    setTimeLeft(calculateTime());
    return () => clearInterval(timer);
  }, [endDate, endTime, contractId, currentStatus]);

  if (currentStatus !== 'active' || !timeLeft) return null;

  return (
    <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/50">
      <div className="flex items-center justify-between flex-row-reverse mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">الوقت المتبقي</span>
        <div className="flex items-center gap-1 text-emerald-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider">نشط الآن</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2 flex-row-reverse" dir="ltr">
        {[
          { label: 'D', value: timeLeft.days, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'H', value: timeLeft.hours, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'M', value: timeLeft.mins, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'S', value: timeLeft.secs, color: 'text-rose-500 animate-pulse' }
        ].map((unit, i) => (
          <React.Fragment key={unit.label}>
            <div className="flex flex-col items-center min-w-[32px]">
              <span className={`text-lg font-black font-mono leading-none ${unit.color}`}>
                {String(unit.value).padStart(2, '0')}
              </span>
              <span className="text-[8px] font-bold text-neutral-400 uppercase mt-0.5">{unit.label}</span>
            </div>
            {i < 3 && <span className="text-neutral-300 dark:text-neutral-700 font-bold self-start mt-[-2px]">:</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

let cachedContracts: any[] | null = null;
let lastContractsFetch = 0;

export function ContractsList({ company, staff, onNavigate, isSuperAdmin, defaultFilter, isWithDriver, targetContractId, onClearTarget }: { key?: string, company?: any, staff?: any, onNavigate?: (tab: string) => void, isSuperAdmin: boolean, defaultFilter?: 'active' | 'completed' | 'cancelled' | 'expired', isWithDriver?: boolean, targetContractId?: string | null, onClearTarget?: () => void }) {
  const [contracts, setContracts] = useState<any[]>(() => {
    if (cachedContracts && (Date.now() - lastContractsFetch <= 60000)) {
      return cachedContracts;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (cachedContracts && (Date.now() - lastContractsFetch <= 60000)) {
      return false;
    }
    return true;
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed' | 'expired' | 'cancelled'>(defaultFilter || 'active');
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [viewFullContract, setViewFullContract] = useState(false);

  useEffect(() => {
    if (targetContractId && contracts.length > 0) {
      const found = contracts.find(c => c.id === targetContractId);
      if (found) {
        setSelectedContract(found);
      }
    }
  }, [targetContractId, contracts]);

  const closeContractModal = () => {
    setSelectedContract(null);
    setViewFullContract(false);
    if (onClearTarget) onClearTarget();
  };

  const handleStatusUpdate = async (id: string, newStatus: string, carId?: string) => {
    try {
      const toastId = toast.loading('جاري تحديث حالة العقد...');
      await updateDoc(doc(db, 'contracts', id), { 
        bookingStatus: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      if (carId && (newStatus === 'completed' || newStatus === 'cancelled')) {
        await updateDoc(doc(db, 'inventory', carId), { status: 'available' });
      }

      toast.dismiss(toastId);
      toast.success('تم تحديث الحالة بنجاح');
      if (selectedContract?.id === id) {
        setSelectedContract((prev: any) => ({ ...prev, bookingStatus: newStatus }));
      }
    } catch (err) {
      toast.dismiss();
      toast.error('فشل تحديث الحالة');
    }
  };

  useEffect(() => {
    if (!staff?.companyId && !isSuperAdmin) return;

    let q;
    if (isSuperAdmin) {
      q = query(collection(db, 'contracts'));
    } else {
      q = query(
        collection(db, 'contracts'),
        where('companyId', '==', staff.companyId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contractsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      contractsData.forEach(c => {
        if (c.bookingStatus === 'active' && c.rentalEndDate) {
            let endString = c.rentalEndDate;
            if (c.rentalEndTime) {
               endString = `${c.rentalEndDate}T${c.rentalEndTime.length === 5 ? c.rentalEndTime + ':00' : c.rentalEndTime}`;
            } else {
               endString = `${c.rentalEndDate}T23:59:59`;
            }
            const endDate = new Date(endString);
            if (endDate < new Date()) {
                updateDoc(doc(db, 'contracts', c.id), { bookingStatus: 'expired' });
            }
        }
      });
      
      setContracts(contractsData);
      cachedContracts = contractsData;
      lastContractsFetch = Date.now();
      setLoading(false);
    });

    return () => {
      lastContractsFetch = Date.now();
      unsubscribe();
    };
  }, [staff?.companyId]);

  const handleDeleteContract = async (id: string, carId?: string, currentStatus?: string) => {
    if (!isSuperAdmin) {
      toast.error('صلاحيات غير كافية - فقط المالك العام يمكنه الحذف');
      return;
    }
    if (!confirm('هل أنت متأكد من حذف هذا العقد؟ سيتم تحديث الأرباح والواردات تلقائياً.')) return;
    try {
      await deleteDoc(doc(db, 'contracts', id));
      
      // If contract was active, free the car
      if (carId && currentStatus === 'active') {
        try {
          await updateDoc(doc(db, 'inventory', carId), { status: 'available' });
        } catch (e) {
          console.warn("Failed to reset car status on contract deletion", e);
        }
      }
      
      toast.success('تم حذف العقد وتحديث الأرباح بنجاح');
    } catch (err) {
      toast.error('فشل حذف العقد');
    }
  };

  const handleCancelContract = async (id: string, carId: string | undefined | null) => {
    if (!isSuperAdmin) {
      toast.error('صلاحيات غير كافية - فقط المالك العام يمكنه إلغاء العقد');
      return;
    }
    if (!confirm('هل أنت متأكد من إلغاء هذا العقد؟')) return;
    try {
      const toastId = toast.loading('جاري الإلغاء...');
      await updateDoc(doc(db, 'contracts', id), { bookingStatus: 'cancelled' });
      
      if (carId) {
        try {
          await api.put('inventory', carId, { status: 'available' });
        } catch (err) {
          console.error('Failed to update car status:', err);
        }
      }
      
      toast.dismiss(toastId);
      toast.success('تم إلغاء العقد بنجاح');
    } catch (err) {
      toast.dismiss();
      toast.error('فشل إلغاء العقد');
    }
  };

  const handleDeleteAllCompleted = async () => {
    const completed = contracts.filter(c => c.bookingStatus === 'completed');
    if (completed.length === 0) {
      toast.error('لا توجد عقود منجزة لحذفها');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف جميع العقود المنجزة (${completed.length}) نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;

    try {
      const toastId = toast.loading('جاري حذف العقود...');
      const deletePromises = completed.map(c => deleteDoc(doc(db, 'contracts', c.id)));
      await Promise.all(deletePromises);
      toast.dismiss(toastId);
      toast.success('تم حذف جميع العقود المنجزة بنجاح');
    } catch (err) {
      toast.dismiss();
      toast.error('فشل حذف العقود');
    }
  };

  useEffect(() => {
    if (search === debouncedSearch) {
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  const filteredContracts = React.useMemo(() => {
    const now = new Date();
    const searchLower = debouncedSearch.toLowerCase();
    
    return contracts.filter(c => {
      // Check if contract has expired based on rentalEndDate and rentalEndTime
      let isExpired = false;
      if (c.rentalEndDate) {
        let endString = c.rentalEndDate;
        if (c.rentalEndTime) {
           endString = `${c.rentalEndDate}T${c.rentalEndTime.length === 5 ? c.rentalEndTime + ':00' : c.rentalEndTime}`;
        } else {
           endString = `${c.rentalEndDate}T23:59:59`;
        }
        const endDate = new Date(endString);
        isExpired = endDate < now;
      }

      // Determine pseudo-status for filtering logic
      let currentStatus = c.bookingStatus || 'active';
      if (currentStatus === 'active' && isExpired) {
        currentStatus = 'expired';
      }

      const statusMatch = filter === currentStatus;
      
      if (!statusMatch) return false;

      // Filter by type (with driver or not)
      const typeMatch = !!c.isWithDriver === !!isWithDriver;
      if (!typeMatch) return false;

      if (!searchLower) return true;

      return (
        (c.fullName && String(c.fullName).toLowerCase().includes(searchLower)) ||
        (c.id && String(c.id).toLowerCase().includes(searchLower)) ||
        (c.contractCode && String(c.contractCode).toLowerCase().includes(searchLower)) ||
        (c.carModel && String(c.carModel).toLowerCase().includes(searchLower))
      );
    }).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [contracts, filter, isWithDriver, search]);

  return (
    <div className="space-y-8 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">إدارة العقود</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">عرض وتتبع جميع العقود النشطة والمنتهية والملغية.</p>
        </div>
        {filter === 'completed' && isSuperAdmin && (
          <button 
            onClick={handleDeleteAllCompleted}
            className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-all font-black text-sm border border-red-100 shadow-sm"
          >
            <Trash2 size={18} />
            <span>حذف كافة العقود المنجزة</span>
          </button>
        )}
      </header>

      <div className="bg-white dark:bg-neutral-800 p-4 rounded-[2rem] border border-neutral-100 dark:border-neutral-700 shadow-sm flex flex-col md:flex-row-reverse items-center justify-between gap-6">
        
        {/* Search */}
        <div className="relative w-full md:w-[400px] group">
          <div className="absolute inset-0 bg-blue-500/5 blur-xl group-focus-within:bg-blue-500/10 transition-all rounded-2xl" />
          <div className="relative bg-neutral-100 dark:bg-neutral-900 border border-transparent group-focus-within:border-blue-400 group-focus-within:bg-white dark:group-focus-within:bg-neutral-950 rounded-2xl flex items-center transition-all">
            <div className="p-3 pr-4 text-neutral-400 group-focus-within:text-blue-500 transition-colors">
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </div>
            <input
              type="text"
              placeholder="ابحث عن عقد، مستأجر، أو سيارة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none outline-none py-3 px-2 text-sm text-right text-neutral-900 dark:text-white font-bold placeholder:text-neutral-400"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="p-2 ml-2 text-neutral-300 hover:text-neutral-600 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-1 gap-1 flex-row-reverse w-full md:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              filter === 'active' 
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}
          >
            العقود النشطة
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              filter === 'completed' 
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}
          >
            العقود المنجزة
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              filter === 'expired' 
                ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-sm' 
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}
          >
            العقود المنتهية
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
              filter === 'cancelled' 
                ? 'bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 shadow-sm' 
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
            }`}
          >
            العقود الملغية
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full min-h-[400px] flex flex-col items-center justify-center space-y-5">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
              <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-[spin_0.8s_linear_infinite]"></div>
            </div>
            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm tracking-wide animate-pulse">جاري جلب البيانات...</p>
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout" initial={false}>
              {filteredContracts.map((contract, index) => (
            <motion.div
              onClick={() => setSelectedContract(contract)}
              key={contract.id}
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
              className="bg-white dark:bg-neutral-800 rounded-[2rem] border border-neutral-100 dark:border-neutral-700 p-6 flex flex-col items-end text-right hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none transition-all cursor-pointer relative overflow-hidden group"
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${
                filter === 'active' ? 'bg-blue-500' :
                filter === 'completed' ? 'bg-emerald-500' : 
                filter === 'expired' ? 'bg-amber-500' : 'bg-red-500'
              }`} />

              <div className="flex items-center justify-between w-full mb-4 flex-row-reverse">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  filter === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
                  filter === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                  filter === 'expired' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' :
                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                }`}>
                  {filter === 'active' ? 'نشط' : filter === 'completed' ? 'مكتمل' : filter === 'expired' ? 'منتهي الصلاحية' : 'ملغي'}
                </span>
                <span className="text-xs text-neutral-400 font-mono">#{contract.contractCode || contract.id.slice(0, 8)}</span>
                <div className="flex items-center gap-1">
                  {filter === 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelContract(contract.id, contract.carId);
                      }}
                      className="p-1.5 rounded-full hover:bg-amber-50 text-neutral-400 hover:text-amber-500 transition"
                      title="إلغاء العقد"
                    >
                      <Ban size={16} />
                    </button>
                  )}
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteContract(contract.id, contract.carId, contract.bookingStatus);
                      }}
                      className="p-1.5 rounded-full hover:bg-red-50 text-neutral-400 hover:text-red-500 transition"
                    >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white mb-1">{contract.fullName || contract.name || 'بدون اسم'}</h3>
                <div className="flex items-center gap-2 flex-row-reverse text-neutral-500 dark:text-neutral-400 text-sm">
                  <Car size={16} />
                  <span>{contract.carModel} {contract.carType ? `(${contract.carType})` : ''} - {contract.plateNumber} {contract.carOwnerName ? `(المالك: ${contract.carOwnerName})` : ''}</span>
                </div>
              </div>

              <div className="w-full space-y-2 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between flex-row-reverse items-center">
                  <span className="flex items-center gap-2 flex-row-reverse">
                    <Calendar size={14} className="text-neutral-400" /> البداية:
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-200" dir="ltr">{contract.rentalStartDate}</span>
                </div>
                <div className="flex justify-between flex-row-reverse items-center">
                  <span className="flex items-center gap-2 flex-row-reverse">
                    <Clock size={14} className="text-neutral-400" /> النهاية:
                  </span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-200" dir="ltr">{contract.rentalEndDate}</span>
                </div>
                {filter === 'active' && contract.rentalEndDate && (
                  <CountdownTimer 
                    endDate={contract.rentalEndDate}
                    endTime={contract.rentalEndTime}
                    contractId={contract.id} 
                    currentStatus={contract.bookingStatus || 'active'} 
                  />
                )}
              </div>

            </motion.div>
          ))}
        </AnimatePresence>

        {filteredContracts.length === 0 && !loading && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-neutral-400">
            <FileText size={48} className="mb-4 opacity-50" />
            <p className="text-lg">لا توجد عقود تطابق بحثك</p>
          </div>
        )}
        </>
        )}
      </div>

      <AnimatePresence>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md">
            <button
                  onClick={closeContractModal}
                  className="fixed top-6 left-6 z-[70] p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all shadow-2xl group border border-white/20"
                  title="إغلاق"
            >
              <X size={28} className="group-hover:rotate-90 transition-transform" />
            </button>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className={`w-full ${viewFullContract ? 'max-w-5xl h-full' : 'max-w-xl'} bg-white dark:bg-neutral-900 md:rounded-[2.5rem] shadow-2xl overflow-hidden relative transition-all duration-300`}
            >
              <div className={`overflow-y-auto ${viewFullContract ? 'h-full p-4 md:p-8' : 'p-8'} custom-scrollbar`}>
                {viewFullContract ? (
                   <ContractView 
                      contractInitialData={selectedContract}
                      company={company}
                      staff={staff}
                      isWithDriver={selectedContract.isWithDriver || false}
                      readOnly={true}
                   />
                ) : (
                  <div className="text-right flex flex-col items-center">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ${
                      selectedContract.bookingStatus === 'active' ? 'bg-blue-50 text-blue-500' :
                      selectedContract.bookingStatus === 'completed' ? 'bg-emerald-50 text-emerald-500' :
                      selectedContract.bookingStatus === 'expired' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-500'
                    }`}>
                      <FileText size={40} />
                    </div>
                    
                    <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">
                      عقد رقم #{selectedContract.contractCode || selectedContract.id?.slice(-5)}
                    </h2>
                    <p className="text-neutral-500 dark:text-neutral-400 font-bold mb-8">
                      {selectedContract.isWithDriver ? 'عقد سيارة مع سائق' : 'عقد تأجير سيارة'}
                    </p>

                    <div className="w-full space-y-4 bg-neutral-50 dark:bg-neutral-800/50 p-6 rounded-3xl mb-8">
                      <div className="flex justify-between flex-row-reverse border-b border-neutral-100 dark:border-neutral-700 pb-3">
                        <span className="text-neutral-400 font-bold">المستأجر:</span>
                        <span className="font-black text-neutral-900 dark:text-white">{selectedContract.fullName || 'بدون اسم'}</span>
                      </div>
                      <div className="flex justify-between flex-row-reverse border-b border-neutral-100 dark:border-neutral-700 pb-3">
                        <span className="text-neutral-400 font-bold">المركبة:</span>
                        <span className="font-black text-neutral-900 dark:text-white">{selectedContract.carModel} ({selectedContract.plateNumber})</span>
                      </div>
                      <div className="flex justify-between flex-row-reverse border-b border-neutral-100 dark:border-neutral-700 pb-3">
                        <span className="text-neutral-400 font-bold">المبلغ الكلي:</span>
                        <span className="font-black text-blue-600 dark:text-blue-400">{selectedContract.rentalCost?.toLocaleString()} د.ع</span>
                      </div>
                      <div className="flex justify-between flex-row-reverse">
                        <span className="text-neutral-400 font-bold">الحالة:</span>
                        <span className={`font-black ${
                          selectedContract.bookingStatus === 'active' ? 'text-blue-600' :
                          selectedContract.bookingStatus === 'completed' ? 'text-emerald-600' : 'text-amber-600'
                        }`}>
                          {selectedContract.bookingStatus === 'active' ? 'نشط' :
                           selectedContract.bookingStatus === 'completed' ? 'مكتمل' : 
                           selectedContract.bookingStatus === 'expired' ? 'منتهي' : 'ملغي'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 w-full">
                      <button
                        onClick={() => setViewFullContract(true)}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black shadow-lg shadow-blue-100 dark:shadow-none transition-all flex items-center justify-center gap-2"
                      >
                        <FileText size={18} />
                        <span>عرض العقد الكامل</span>
                      </button>

                      {selectedContract.bookingStatus === 'active' && (
                        <button
                          onClick={() => handleStatusUpdate(selectedContract.id, 'completed', selectedContract.carId)}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 dark:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={18} className="w-5 h-5" />
                          <span>إكمال العقد واستلام المركبة</span>
                        </button>
                      )}

                      {selectedContract.bookingStatus === 'active' && (
                        <button
                          onClick={() => handleStatusUpdate(selectedContract.id, 'cancelled', selectedContract.carId)}
                          className="w-full py-4 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                        >
                          <Ban size={18} />
                          <span>إلغاء العقد</span>
                        </button>
                      )}

                      <button
                        onClick={closeContractModal}
                        className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-2xl font-black hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                      >
                        إغلاق النافذة
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
