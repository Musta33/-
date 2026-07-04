const fs = require('fs');
let code = fs.readFileSync('src/components/Debts.tsx', 'utf8');

// Add confirmDialog state
code = code.replace(
  "const [newDebt, setNewDebt] = useState({ customerId: '', customerName: '', customerPhone: '', amount: '', reason: '', dueDate: '' });",
  "const [newDebt, setNewDebt] = useState({ customerId: '', customerName: '', customerPhone: '', amount: '', reason: '', dueDate: '' });\n  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; type: 'pay' | 'delete'; data: any }>({ isOpen: false, type: 'pay', data: null });"
);

// Replace markAsPaid
code = code.replace(
  `  const markAsPaid = async (debt: any) => {
    if (window.confirm('هل أنت متأكد من تسديد هذا المبلغ؟')) {
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
    }
  };`,
  `  const markAsPaid = (debt: any) => {
    setConfirmDialog({ isOpen: true, type: 'pay', data: debt });
  };`
);

// Replace deleteDebt
code = code.replace(
  `  const deleteDebt = async (id: string) => {
    if (window.confirm('هل أنت متأكد من الحذف؟')) {
      try {
        await deleteDoc(doc(db, 'debts', id));
        toast.success('تم الحذف بنجاح');
      } catch (err) {
        toast.error('حدث خطأ أثناء الحذف');
      }
    }
  };`,
  `  const deleteDebt = (id: string) => {
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
  };`
);

// Add confirmation modal to JSX
code = code.replace(
  "    </div>\n  );\n}\n",
  `
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
                className={\`flex-1 text-white py-2.5 rounded-xl text-sm font-bold transition \${
                  confirmDialog.type === 'pay' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }\`}
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
`
);

fs.writeFileSync('src/components/Debts.tsx', code);
