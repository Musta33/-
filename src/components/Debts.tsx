import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Trash2, CheckCircle, Clock } from 'lucide-react';
import { db, collection, addDoc, updateDoc, doc, deleteDoc, query, onSnapshot, where } from '../lib/api';
import toast from 'react-hot-toast';

export default function Debts({ user, contracts = [], myCompany }: { user: any, contracts?: any[], myCompany?: any }) {
  const [debts, setDebts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDebt, setNewDebt] = useState({ customerId: '', customerName: '', customerPhone: '', amount: '', reason: '', dueDate: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; type: 'pay' | 'delete'; data: any }>({ isOpen: false, type: 'pay', data: null });

  useEffect(() => {
    if (!user) return;
    
    let qDebts;
    if (user.role === 'super_admin') {
       qDebts = query(collection(db, 'debts'));
    } else {
       qDebts = query(collection(db, 'debts'), where('companyId', '==', user.companyId || ''));
    }
    const unsubDebts = onSnapshot(qDebts, (snap: any) => {
      const data = snap.docs ? snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) : Object.values(snap.data || {});
      setDebts(data.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
      setLoading(false);
    });

    let qCust;
    if (user.role === 'super_admin') {
      qCust = query(collection(db, 'customers'));
    } else {
      qCust = query(collection(db, 'customers'), where('companyId', '==', user.companyId || ''));
    }
    const unsubCust = onSnapshot(qCust, (snap: any) => {
      const data = snap.docs ? snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) : Object.values(snap.data || {});
      setCustomers(data);
    });

    return () => {
      unsubDebts();
      unsubCust();
    };
  }, [user]);

  const combinedDebts = useMemo(() => {
    const contractDebts = contracts
      .filter((c: any) => {
        const remaining = parseFloat(String(c.remainingAmount || 0).replace(/,/g, ''));
        return remaining > 0 && c.bookingStatus !== 'cancelled';
      })
      .map((c: any) => {
        const remaining = parseFloat(String(c.remainingAmount || 0).replace(/,/g, ''));
        const totalCost = parseFloat(String(c.rentalCost || 0).replace(/,/g, ''));
        
        // Find branch name
        let branchName = 'الفرع الرئيسي';
        if (c.branchId && myCompany?.branches) {
           const branch = myCompany.branches.find((b: any) => b.id === c.branchId);
           if (branch) branchName = branch.name;
        }

        const customerPhone = c.phoneNumber || c.renterPhone || c.phone || '-';

        return {
          id: `contract-${c.id}`,
          contractId: c.id,
          customerName: c.fullName || c.renterName || 'غير محدد',
          customerPhone,
          branchName,
          amount: remaining,
          totalCost: totalCost,
          reason: `باقي مبلغ العقد (${c.carModel} - ${c.plateNumber})`,
          dueDate: c.returnDate || '-',
          status: 'pending',
          isContractDebt: true,
          createdAt: c.createdAt
        };
      });

    const manualDebts = debts.map(d => {
       let customerPhone = d.customerPhone || '-';
       if (customerPhone === '-' && d.customerName) {
         const cust = customers.find(c => c.name === d.customerName);
         if (cust) customerPhone = cust.phoneNumber || cust.phone || '-';
       }

       let branchName = 'الفرع الرئيسي';
       if (d.branchId && myCompany?.branches) {
           const branch = myCompany.branches.find((b: any) => b.id === d.branchId);
           if (branch) branchName = branch.name;
       } else if (d.branchId && d.branchId !== myCompany?.id) {
           branchName = 'فرع ' + (user?.fullName || '');
       }

       return {
         ...d,
         amount: parseFloat(d.amount) || 0,
         customerPhone,
         branchName
       };
    });
    
    const allDebts = [...manualDebts, ...contractDebts];
    
    return allDebts.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [debts, contracts, myCompany, customers]);

  const handleAddDebt = async () => {
    if (!newDebt.customerName || !newDebt.amount) {
      toast.error('يرجى إدخال اسم المستأجر والمبلغ');
      return;
    }
    try {
      await addDoc(collection(db, 'debts'), {
        ...newDebt,
        companyId: user.companyId || '',
        branchId: user.branchId || '',
        amount: Number(newDebt.amount),
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewDebt({ customerId: '', customerName: '', customerPhone: '', amount: '', reason: '', dueDate: '' });
      toast.success('تمت إضافة الدين بنجاح');
    } catch (err) {
      toast.error('حدث خطأ أثناء الإضافة');
    }
  };

  const markAsPaid = (debt: any) => {
    setConfirmDialog({ isOpen: true, type: 'pay', data: debt });
  };

  const deleteDebt = (id: string) => {
    setConfirmDialog({ isOpen: true, type: 'delete', data: id });
  };

  const confirmAction = async () => {
    if (confirmDialog.type === 'pay') {
      const debt = confirmDialog.data;
      try {
        if (debt.isContractDebt) {
          await updateDoc(doc(db, 'contracts', debt.contractId), {
            paidAmount: debt.totalCost.toLocaleString('en-US'),
            remainingAmount: '0'
          });
        } else {
          await updateDoc(doc(db, 'debts', debt.id), { status: 'paid' });
        }
        toast.success('تم تسجيل السداد بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء التحديث');
      }
    } else if (confirmDialog.type === 'delete') {
      const id = confirmDialog.data;
      try {
        await deleteDoc(doc(db, 'debts', id));
        toast.success('تم الحذف بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    }
    setConfirmDialog({ isOpen: false, type: 'pay', data: null });
  };

  const filteredDebts = combinedDebts.filter(d => 
    d.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.customerPhone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPending = combinedDebts.filter(d => d.status === 'pending').reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPaid = combinedDebts.filter(d => d.status === 'paid').reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <Plus size={16} /> إضافة دين يدوي
        </button>
        <h1 className="text-2xl font-black text-neutral-800 dark:text-white">ديون المستأجرين</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-black rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 flex flex-col items-end">
           <span className="text-neutral-500 text-sm font-bold">إجمالي الديون المعلقة</span>
           <span className="text-2xl font-black text-rose-500">{totalPending.toLocaleString()} د.ع</span>
        </div>
        <div className="bg-white dark:bg-black rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800 flex flex-col items-end">
           <span className="text-neutral-500 text-sm font-bold">إجمالي الديون المسددة</span>
           <span className="text-2xl font-black text-emerald-500">{totalPaid.toLocaleString()} د.ع</span>
        </div>
      </div>

      <div className="bg-white dark:bg-black rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
        <div className="relative mb-6">
          <input
            type="text"
            placeholder="بحث بالاسم، الهاتف أو الملاحظات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-100 dark:bg-neutral-900 border-none rounded-xl px-4 py-3 text-right pr-10 text-sm outline-none text-neutral-800 dark:text-white placeholder-neutral-400"
          />
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-4 text-neutral-400" />
        </div>

        {loading ? (
          <div className="text-center py-8 text-neutral-500">جاري التحميل...</div>
        ) : filteredDebts.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">لا توجد ديون مطابقة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right" dir="rtl">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">الفرع</th>
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">المستأجر</th>
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">المبلغ</th>
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">السبب / الملاحظات</th>
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">تاريخ الاستحقاق</th>
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">الحالة</th>
                  <th className="pb-3 text-sm font-bold text-neutral-500 px-2">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebts.map(debt => (
                  <tr key={debt.id} className="border-b border-neutral-100 dark:border-neutral-900/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition">
                    <td className="py-3 px-2 text-xs font-bold text-neutral-600 dark:text-neutral-400">
                      <span className="bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md">{debt.branchName}</span>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-col text-right">
                        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{debt.customerName}</span>
                        <span className="text-[10px] text-neutral-500 font-mono mt-0.5" dir="ltr">{debt.customerPhone}</span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm font-black text-red-500">{debt.amount.toLocaleString()} د.ع</td>
                    <td className="py-3 px-2 text-xs text-neutral-600 dark:text-neutral-400">
                      {debt.reason || '-'}
                      {debt.isContractDebt && (
                        <span className="mr-2 inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-md font-bold">من العقد</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-xs text-neutral-600 dark:text-neutral-400">{debt.dueDate || '-'}</td>
                    <td className="py-3 px-2">
                      {debt.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-md text-[10px] font-bold">
                          <CheckCircle size={10} /> مسدد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-md text-[10px] font-bold">
                          <Clock size={10} /> معلق
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-2">
                        {debt.status !== 'paid' && (
                          <button
                            onClick={() => markAsPaid(debt)}
                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                            title="تسجيل سداد"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {!debt.isContractDebt && (
                          <button
                            onClick={() => deleteDebt(debt.id)}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-md p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-right text-neutral-800 dark:text-white">إضافة دين جديد</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-right text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">اسم المستأجر</label>
                <input
                  type="text"
                  value={newDebt.customerName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const cust = customers.find(c => c.name === name);
                    setNewDebt({ 
                      ...newDebt, 
                      customerName: name,
                      customerPhone: cust ? (cust.phoneNumber || cust.phone || '') : newDebt.customerPhone
                    });
                  }}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5 text-right text-sm border-none outline-none"
                  placeholder="الاسم"
                  list="customers-list"
                />
                <datalist id="customers-list">
                  {customers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-right text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  value={newDebt.customerPhone}
                  onChange={(e) => setNewDebt({ ...newDebt, customerPhone: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5 text-left text-sm border-none outline-none"
                  placeholder="رقم الهاتف"
                  dir="ltr"
                />
              </div>
              
              <div>
                <label className="block text-right text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">المبلغ (د.ع)</label>
                <input
                  type="number"
                  value={newDebt.amount}
                  onChange={(e) => setNewDebt({ ...newDebt, amount: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5 text-left text-sm border-none outline-none"
                  placeholder="0"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-right text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">تاريخ الاستحقاق (اختياري)</label>
                <input
                  type="date"
                  value={newDebt.dueDate}
                  onChange={(e) => setNewDebt({ ...newDebt, dueDate: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5 text-right text-sm border-none outline-none"
                />
              </div>

              <div>
                <label className="block text-right text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">السبب / ملاحظات</label>
                <textarea
                  value={newDebt.reason}
                  onChange={(e) => setNewDebt({ ...newDebt, reason: e.target.value })}
                  className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl px-4 py-2.5 text-right text-sm border-none outline-none h-20 resize-none"
                  placeholder="سبب الدين..."
                />
              </div>
            </div>

            <div className="flex flex-row-reverse gap-3 mt-6">
              <button
                onClick={handleAddDebt}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition"
              >
                إضافة
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-80"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-sm p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl text-center">
            <h3 className="text-xl font-bold mb-4 text-neutral-800 dark:text-white">
              {confirmDialog.type === 'pay' ? 'تسديد المبلغ' : 'حذف الدين'}
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
              {confirmDialog.type === 'pay' 
                ? 'هل أنت متأكد من أنك تريد تسجيل هذا المبلغ كمسدد؟' 
                : 'هل أنت متأكد من أنك تريد حذف هذا الدين نهائياً؟'}
            </p>
            <div className="flex flex-row-reverse gap-3">
              <button
                onClick={confirmAction}
                className={`flex-1 text-white py-2.5 rounded-xl text-sm font-bold transition ${
                  confirmDialog.type === 'pay' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                تأكيد
              </button>
              <button
                onClick={() => setConfirmDialog({ isOpen: false, type: 'pay', data: null })}
                className="flex-1 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 py-2.5 rounded-xl text-sm font-bold transition hover:opacity-80"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
