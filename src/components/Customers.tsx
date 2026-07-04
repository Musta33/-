import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, updateDoc, doc, where, limit } from '../lib/api';
import { 
  User, Phone, MapPin, CreditCard, Calendar, Search, 
  Loader2, UserRound, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

let cachedCustomers: any[] | null = null;
let lastCustomersFetch = 0;

const CustomerRow = React.memo(({ customer, index }: { customer: any, index: number }) => (
  <motion.tr 
    layout
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 10, scale: 0.95 }}
    transition={{ 
      type: "spring", 
      stiffness: 400, 
      damping: 40,
      delay: index < 10 ? index * 0.03 : 0 
    }}
    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group cursor-default"
  >
    <td className="p-5">
      <div className="flex items-center gap-4">
        <div className="relative w-11 h-11 rounded-2xl overflow-hidden ring-4 ring-slate-50 group-hover:ring-blue-50 transition-all shrink-0">
          {customer.imageUrl ? (
            <img src={customer.imageUrl} alt={customer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
              <User size={20} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-black text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">{customer.name}</h3>
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-400 mt-0.5">
            <Phone size={10} className="text-slate-300" />
            {customer.phoneNumber || customer.phone}
          </div>
        </div>
      </div>
    </td>
    
    <td className="p-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 font-mono text-sm font-black text-slate-900">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          {customer.documentNumber || customer.idNumber || '---'}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-orange-600 font-black bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-100/50">انتهاء: {customer.idCardExpiry || '---'}</span>
          {customer.documentType && (
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{customer.documentType}</span>
          )}
        </div>
      </div>
    </td>

    <td className="p-5">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-black text-slate-700 font-mono">
          {customer.drivingLicenseNumber || '---'}
        </span>
        <span className="text-[9px] text-slate-600 font-black bg-slate-100 px-1.5 py-0.5 rounded-full border border-slate-200/50 w-fit">انتهاء: {customer.drivingLicenseExpiry || '---'}</span>
      </div>
    </td>

    <td className="p-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-800 font-mono">
          <Calendar size={10} className="text-slate-400" />
          {customer.renterDateOfBirth || customer.birthDate || '---'}
        </div>
        <div className="flex items-start gap-1">
          <MapPin size={10} className="text-slate-300 mt-0.5 shrink-0" />
          <p className="text-[10px] font-bold text-slate-400 max-w-[160px] truncate leading-tight" title={customer.address}>
            {customer.address || '---'}
          </p>
        </div>
      </div>
    </td>
  </motion.tr>
));

const CustomerListTable = React.memo(({ customers }: { customers: any[] }) => (
  <div className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse" dir="rtl">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-100 text-[11px] uppercase tracking-wider">
            <th className="p-5 text-slate-500 font-black whitespace-nowrap">المستأجر والتواصل</th>
            <th className="p-5 text-slate-500 font-black whitespace-nowrap">الهوية الوطنية</th>
            <th className="p-5 text-slate-500 font-black whitespace-nowrap">رخصة القيادة</th>
            <th className="p-5 text-slate-500 font-black whitespace-nowrap">الميلاد والعنوان</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout" initial={false}>
            {customers.map((customer, index) => (
              <CustomerRow key={customer.id} customer={customer} index={index} />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  </div>
));

export function Customers({ user, isSuperAdmin }: { user?: any, isSuperAdmin?: boolean }) {
  const [customers, setCustomers] = useState<any[]>(() => {
    if (cachedCustomers && (Date.now() - lastCustomersFetch <= 60000)) {
      return cachedCustomers;
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (cachedCustomers && (Date.now() - lastCustomersFetch <= 60000)) {
      return false;
    }
    return true;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchTerm === debouncedSearch) {
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    let q;
    if (isSuperAdmin) {
      q = query(collection(db, 'customers'), orderBy('name', 'asc'), limit(500));
    } else {
      q = query(collection(db, 'customers'), where('companyId', '==', user?.companyId || ''), orderBy('name', 'asc'), limit(500));
    }
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(data);
      cachedCustomers = data;
      lastCustomersFetch = Date.now();
      setLoading(false);
    });
    return () => {
      lastCustomersFetch = Date.now();
      unsubscribe();
    };
  }, [user?.companyId, isSuperAdmin]);

  const filteredCustomers = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return customers.filter(c => 
      (c.name?.toLowerCase().includes(q)) ||
      (c.phone?.includes(debouncedSearch)) ||
      (c.phoneNumber?.includes(debouncedSearch)) ||
      (c.documentNumber?.includes(debouncedSearch)) ||
      (c.drivingLicenseNumber?.includes(debouncedSearch))
    );
  }, [customers, debouncedSearch]);

  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] min-h-screen" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">سجلات العملاء</h1>
            <p className="text-slate-400 font-bold text-sm">إدارة ومتابعة بيانات المستأجرين وسجلاتهم</p>
          </div>
          
          <div className="relative group w-full lg:w-[450px]">
            <div className="absolute inset-0 bg-blue-500/5 blur-2xl group-focus-within:bg-blue-500/10 transition-all rounded-[32px]" />
            <div className="relative bg-white border border-slate-200 group-focus-within:border-blue-400 group-focus-within:ring-4 group-focus-within:ring-blue-500/5 rounded-2xl p-1.5 shadow-sm flex items-center transition-all">
              <div className="p-3 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
              </div>
              <input 
                type="text"
                placeholder="ابحث بالاسم، الهاتف، أو الهوية..."
                className="w-full bg-transparent border-none outline-none text-slate-900 font-bold text-sm pr-2 text-right placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin shadow-inner" />
            </div>
            <p className="text-slate-400 font-black tracking-tighter text-lg">جاري استرجاع السجلات...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-24 text-center"
          >
            <motion.div 
              initial={{ y: 0 }}
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"
            >
              <UserRound className="text-slate-200" size={48} />
            </motion.div>
            <h3 className="text-2xl font-black text-slate-900 mb-3">لا توجد نتائج</h3>
            <p className="text-slate-400 max-w-md mx-auto font-bold text-lg">لم نتمكن من العثور على أي بيانات مطابقة لاستعلامك في السجلات.</p>
          </motion.div>
        ) : (
          <CustomerListTable customers={filteredCustomers} />
        )}
      </div>
    </div>
  );
};


// export default Customers;
