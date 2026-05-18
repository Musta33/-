import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, db } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Calendar, Car, Clock, Search, ExternalLink } from 'lucide-react';

export function ContractsList({ company, staff, onNavigate }: { company?: any, staff?: any, onNavigate?: (tab: string) => void }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'completed' | 'cancelled'>('active');

  useEffect(() => {
    if (!staff?.companyId) return;

    let q = query(
      collection(db, 'contracts'),
      where('companyId', '==', staff.companyId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [staff?.companyId]);

  const filteredContracts = contracts.filter(c => {
    // Check if contract has expired based on rentalEndDate
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    
    let isExpired = false;
    if (c.rentalEndDate) {
      const endDate = new Date(c.rentalEndDate);
      isExpired = endDate < today;
    }

    // Determine pseudo-status for filtering logic
    let currentStatus = c.bookingStatus || 'active';
    if (currentStatus === 'active' && isExpired) {
      currentStatus = 'completed'; // Treat expired active contracts as completed
    }

    const statusMatch = filter === currentStatus;
    
    if (!statusMatch) return false;

    if (!search) return true;
    return (
      (c.fullName && c.fullName.includes(search)) ||
      (c.id && c.id.includes(search)) ||
      (c.carModel && c.carModel.includes(search))
    );
  });

  return (
    <div className="space-y-8 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">إدارة العقود</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">عرض وتتبع جميع العقود النشطة والمنتهية والملغية.</p>
        </div>
      </header>

      <div className="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm flex flex-col md:flex-row-reverse items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="ابحث عن عقد، مستأجر، أو سيارة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-2xl py-3 px-12 text-sm text-right focus:ring-2 focus:ring-blue-500 transition-all dark:text-white"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
        </div>

        {/* Filters */}
        <div className="flex bg-neutral-100 dark:bg-neutral-900 rounded-2xl p-1 gap-1 flex-row-reverse">
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'active' 
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            العقود النشطة
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'completed' 
                ? 'bg-white dark:bg-neutral-800 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            العقود المنتهية
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === 'cancelled' 
                ? 'bg-white dark:bg-neutral-800 text-red-600 dark:text-red-400 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            العقود الملغية
          </button>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredContracts.map((contract, index) => (
            <motion.div
              key={contract.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700 p-6 flex flex-col items-end text-right hover:shadow-lg transition-shadow relative overflow-hidden group"
            >
              <div className={`absolute top-0 left-0 w-1 h-full ${
                filter === 'active' ? 'bg-blue-500' :
                filter === 'completed' ? 'bg-emerald-500' : 'bg-red-500'
              }`} />

              <div className="flex items-center justify-between w-full mb-4 flex-row-reverse">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  filter === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' :
                  filter === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                  'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                }`}>
                  {filter === 'active' ? 'نشط' : filter === 'completed' ? 'مكتمل' : 'ملغي'}
                </span>
                <span className="text-xs text-neutral-400 font-mono">#{contract.id.slice(0, 8)}</span>
              </div>

              <div className="mb-4">
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white mb-1">{contract.fullName || 'بدون اسم'}</h3>
                <div className="flex items-center gap-2 flex-row-reverse text-neutral-500 dark:text-neutral-400 text-sm">
                  <Car size={16} />
                  <span>{contract.carModel} {contract.carType ? `(${contract.carType})` : ''} - {contract.plateNumber}</span>
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
      </div>
    </div>
  );
}
