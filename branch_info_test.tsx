{(!isSuperAdmin && myCompany?.branches && myCompany.branches.length > 0) && (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-xl flex flex-col space-y-6 text-right">
    <div className="flex items-center justify-between border-b pb-5 border-slate-100 flex-row-reverse">
       <div className="flex items-center gap-3 flex-row-reverse">
          <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-lg shadow-amber-200">
             <MapPin size={18} strokeWidth={2.5} />
          </div>
          <div className="text-right">
            <h2 className="text-base font-black text-slate-900 leading-tight">أداء الفروع</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">مراقبة إيرادات ونشاط الفروع</p>
          </div>
       </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {myCompany.branches.map((branch: any) => {
         const branchContracts = contracts.filter((c: any) => c.branchId === branch.id);
         const branchProfits = branchContracts.filter((c: any) => c.bookingStatus !== 'cancelled').reduce((sum, c) => {
             const val = parseFloat(String(c.rentalCost || 0).replace(/,/g, ''));
             return sum + (isNaN(val) ? 0 : val);
         }, 0);
         
         return (
            <div key={branch.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between flex-row-reverse">
               <div className="flex flex-col text-right">
                 <span className="text-sm font-black text-slate-800 block">{branch.name}</span>
                 <span className="text-[10px] text-slate-500 font-mono mt-1">{branch.email}</span>
               </div>
               <div className="flex flex-col items-center gap-1 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                 <span className="text-[10px] font-bold text-slate-400">إجمالي الإيرادات</span>
                 <span className="text-lg font-black text-emerald-600 font-mono">
                    {new Intl.NumberFormat('en-US').format(branchProfits)} <span className="text-[10px] font-sans">د.ع</span>
                 </span>
               </div>
            </div>
         );
      })}
    </div>
  </div>
)}
