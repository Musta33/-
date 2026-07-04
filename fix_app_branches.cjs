const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add new state variables
code = code.replace(
  "const [newBranchName, setNewBranchName] = useState('');",
  "const [newBranchName, setNewBranchName] = useState('');\n  const [newBranchEmail, setNewBranchEmail] = useState('');\n  const [newBranchPassword, setNewBranchPassword] = useState('');"
);

// Replace branch creation UI and logic
const oldBranchUI = `                                 <div className="flex gap-2 flex-row-reverse items-center bg-white dark:bg-black p-2 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                   <input
                                     type="text"
                                     placeholder="اسم الفرع الجديد..."
                                     value={newBranchName}
                                     onChange={(e) => setNewBranchName(e.target.value)}
                                     className="flex-1 bg-transparent text-sm border-none outline-none text-right px-2 placeholder-neutral-400"
                                     autoFocus
                                   />
                                   <button
                                     onClick={async () => {
                                        if (!newBranchName.trim()) return;
                                        try {
                                          const branches = comp.branches || [];
                                          const newBranch = { id: Date.now().toString(), name: newBranchName.trim() };
                                          await updateDoc(doc(db, 'companies', comp.id), {
                                            branches: [...branches, newBranch]
                                          });
                                          setNewBranchName('');
                                          setBranchCompanyId(null);
                                          toast.success('تم إضافة الفرع بنجاح');
                                        } catch (err) {
                                          toast.error('فشل إضافة الفرع');
                                        }
                                     }}
                                     className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold"
                                   >
                                     حفظ
                                   </button>
                                   <button
                                     onClick={() => {
                                       setBranchCompanyId(null);
                                       setNewBranchName('');
                                     }}
                                     className="bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-4 py-1.5 rounded-lg text-xs font-bold"
                                   >
                                     إلغاء
                                   </button>
                                 </div>`;

const newBranchUI = `                                 <div className="flex flex-col gap-2 bg-white dark:bg-black p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                   <div className="flex gap-2 flex-row-reverse">
                                     <input
                                       type="text"
                                       placeholder="اسم الفرع..."
                                       value={newBranchName}
                                       onChange={(e) => setNewBranchName(e.target.value)}
                                       className="flex-1 bg-neutral-50 dark:bg-neutral-900 rounded-lg p-2 text-sm border-none outline-none text-right placeholder-neutral-400"
                                       autoFocus
                                     />
                                     <input
                                       type="email"
                                       placeholder="البريد الإلكتروني للفرع..."
                                       value={newBranchEmail}
                                       onChange={(e) => setNewBranchEmail(e.target.value)}
                                       className="flex-1 bg-neutral-50 dark:bg-neutral-900 rounded-lg p-2 text-sm border-none outline-none text-right placeholder-neutral-400"
                                     />
                                     <input
                                       type="text"
                                       placeholder="كلمة المرور..."
                                       value={newBranchPassword}
                                       onChange={(e) => setNewBranchPassword(e.target.value)}
                                       className="flex-1 bg-neutral-50 dark:bg-neutral-900 rounded-lg p-2 text-sm border-none outline-none text-right placeholder-neutral-400"
                                     />
                                   </div>
                                   <div className="flex gap-2 flex-row-reverse mt-2">
                                     <button
                                       onClick={async () => {
                                          if (!newBranchName.trim() || !newBranchEmail.trim() || !newBranchPassword.trim()) {
                                            toast.error('يرجى ملء جميع الحقول');
                                            return;
                                          }
                                          try {
                                            const res = await fetch('/api/register-branch', {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': \`Bearer \${localStorage.getItem('auth_token')?.replace(/^"|"$/g, '')}\`
                                                },
                                                body: JSON.stringify({
                                                    branchName: newBranchName.trim(),
                                                    email: newBranchEmail.trim(),
                                                    password: newBranchPassword.trim()
                                                })
                                            });
                                            if (!res.ok) {
                                                const err = await res.json();
                                                throw new Error(err.message || 'فشل إضافة الفرع');
                                            }
                                            
                                            // The backend already adds it to the company's \`branches\` array and creates a user, but we update locally to reflect immediately or let onSnapshot handle it
                                            setNewBranchName('');
                                            setNewBranchEmail('');
                                            setNewBranchPassword('');
                                            setBranchCompanyId(null);
                                            toast.success('تم إضافة الفرع بنجاح');
                                          } catch (err: any) {
                                            toast.error(err.message || 'فشل إضافة الفرع');
                                          }
                                       }}
                                       className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold w-full"
                                     >
                                       حفظ وإنشاء الحساب
                                     </button>
                                     <button
                                       onClick={() => {
                                         setBranchCompanyId(null);
                                         setNewBranchName('');
                                         setNewBranchEmail('');
                                         setNewBranchPassword('');
                                       }}
                                       className="bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-4 py-1.5 rounded-lg text-xs font-bold w-full"
                                     >
                                       إلغاء
                                     </button>
                                   </div>
                                 </div>`;

code = code.replace(oldBranchUI, newBranchUI);

fs.writeFileSync('src/App.tsx', code);
