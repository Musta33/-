/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Car, 
  FileText, 
  Ban, 
  LayoutDashboard, 
  LogOut, 
  Search, 
  Plus,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Check,
  Clock,
  UserCircle,
  Settings,
  X,
  Menu,
  Building2,
  Share2,
  Eye,
  Printer,
  Camera,
  Image,
  Trash2,
  User,
  MapPin,
  Navigation,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Bell,
  Send,
  MessageSquare,
  Phone,
  Mail,
  Key,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Sun,
  Moon,
  FileDown,
  RefreshCcw,
  Languages,
  ScanSearch,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix for Leaflet default icon issues in React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;
import { motion, AnimatePresence } from 'motion/react';
import { 
  api, 
  db, 
  auth, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  limit, 
  orderBy, 
  serverTimestamp, 
  arrayUnion, 
  onSnapshot, 
  signOut, 
  onAuthStateChanged 
} from './lib/api';
import { extractIdInfo } from './lib/gemini';
import { ContractView } from './components/ContractView';
import { ContractsList } from './components/ContractsList';
import { Toaster, toast } from 'react-hot-toast';

// Mock types for compatibility
type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  id?: string;
  isAnonymous?: boolean;
};

interface FirestoreErrorInfo {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const savedUser = localStorage.getItem('auth_user');
  let authInfo = {};
  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      authInfo = {
        userId: u.uid || u.id,
        email: u.email
      };
    } catch(e) {}
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo,
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
  throw new Error(JSON.stringify(errInfo));
}

// --- Image Compression Utility ---
const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// --- Constants ---
const SUPER_ADMIN_EMAIL = 'mustfadd112@gmail.com';

const sendWhatsAppMessage = (phone: string, message: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  
  // Standard window.open is usually better for not interrupting the main app flow
  const win = window.open(url, '_blank');
  
  // Fallback if window.open is blocked/fails
  if (!win || win.closed || typeof win.closed === 'undefined') {
    window.location.assign(url);
  }
};

const createSystemNotification = async (title: string, message: string, type: 'info' | 'warning' | 'error' | 'success', targetCompanyId?: string) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      type,
      companyId: targetCompanyId || 'all',
      readBy: [],
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

// --- Types ---
type ActiveTab = 'dashboard' | 'customers' | 'inventory' | 'blocklist' | 'external_blocklist' | 'plans' | 'companies' | 'gps' | 'notifications' | 'settings' | 'employment' | 'chats' | 'contract' | 'contracts_list' | 'staff';

interface SystemTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
  assignedName?: string;
  createdAt: any;
  priority: 'low' | 'medium' | 'high';
}

interface StaffProfile {
  companyId: string;
  fullName: string;
  role: 'admin' | 'manager' | 'staff';
  phoneNumber?: string;
}

interface Customer {
  id: string;
  fullName: string;
  idNumber: string;
  phoneNumber: string;
  isBlocked: boolean;
  createdAt: any;
  photoUrl?: string; // New field for customer photo
  blockReason?: string;
  companyId?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  status: 'available' | 'rented' | 'maintenance';
  dailyPrice: number;
  companyId: string;
  plateNumber?: string;
  color?: string;
  year?: string;
  createdAt: any;
}

interface Company {
  id: string;
  name: string;
  handle: string; // New unique ID field
  phoneNumber?: string;
  address?: string;
  subscriptionPlan: 'starter' | 'pro' | 'enterprise';
  subscriptionStatus: 'active' | 'expired' | 'trial';
  logoUrl?: string; // Add logoUrl field
  bannerUrl?: string; // New field for banner
  accentColor?: string; // New field for accent color
  approved: boolean;
  createdAt: any;
}

interface Contract {
  id: string;
  fullName: string;
  birthDate: string;
  drivingLicenseNumber: string;
  licenseExpiryDate: string;
  phoneNumber: string;
  address?: string;
  documentType?: string;
  documentNumber?: string;
  nationality?: string;
  carType: string;
  carModel: string;
  plateNumber: string;
  annualNumber: string;
  carColor?: string;
  rentalStartDate: string;
  rentalEndDate: string;
  startTime?: string;
  rentalDays?: number;
  totalAmount?: string;
  bookingStatus: 'active' | 'completed' | 'cancelled';
  notes: string;
  companyId: string;
  companyName?: string;
  companyAddress?: string; // Add companyAddress to contract
  logoUrl?: string; // Add logoUrl to contract
  customerPhotoUrl?: string; // New field for customer photo
  createdAt: any;
}

interface Notification {
  id: string;
  companyId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  readBy: string[];
  createdAt: any;
}

// --- Components ---

function SubscriptionView({ onPlanSelect }: { onPlanSelect: (plan: string) => void }) {
  const plans = [
    { id: 'starter', name: 'الباقة الأساسية', price: '99', features: ['حتى 10 سيارات', 'موظف واحد', 'دعم فني عبر البريد'] },
    { id: 'pro', name: 'الباقة المتقدمة', price: '299', features: ['حتى 50 سيارة', '5 موظفين', 'دعم فني سريع'] },
    { id: 'enterprise', name: 'باقة الشركات', price: '999', features: ['سيارات غير محدودة', 'موظفين غير محدودين', 'مدير حساب مخصص'] },
  ];

  return (
    <div className="space-y-8 text-right">
      <header className="text-center">
        <h1 className="text-4xl font-black mb-4 italic">باقات الاشتراكات</h1>
        <p className="text-neutral-500">اختر الباقة المناسبة لحجم أعمالك في عراق رنتل</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={plan.id}
            className={`p-8 rounded-[40px] border-2 transition-all cursor-pointer hover:scale-[1.02] ${
              i === 1 ? 'border-neutral-900 bg-neutral-900 text-white shadow-2xl scale-105' : 'border-neutral-100 bg-white text-neutral-900 shadow-sm'
            }`}
            onClick={() => onPlanSelect(plan.id)}
          >
            <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-black italic">{plan.price}</span>
              <span className={i === 1 ? 'text-neutral-400' : 'text-neutral-500'}>ر.س / شهر</span>
            </div>
            <ul className="space-y-4 mb-10">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-3 flex-row-reverse">
                  <CheckCircle2 size={18} className={i === 1 ? 'text-blue-400' : 'text-blue-600'} />
                  <span className="text-sm">{f}</span>
                </li>
              ))}
            </ul>
            <button className={`w-full py-4 rounded-2xl font-bold transition-colors ${
              i === 1 ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'
            }`}>
              اشتراك الآن
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function OnboardingScreen({ onComplete, currentUser }: { onComplete: () => void, currentUser: any }) {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyHandle, setCompanyHandle] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCreateCompanyDirectly = async () => {
    console.log('Starting company registration submission...');
    if (!companyName) return toast.error('يرجى إدخال اسم الشركة');
    if (!companyHandle) return toast.error('يرجى إدخال معرف الشركة');
    if (!companyPhone) return toast.error('يرجى إدخال رقم هاتف التواصل');
    if (!companyAddress) return toast.error('يرجى إدخال عنوان الشركة');

    setIsVerifying(true);
    const toastId = toast.loading('جاري إرسال طلبك للإدارة...');
    let currentPath = 'companies';
    try {
      currentPath = 'companies (check)';
      const companyCountQuery = query(collection(db, 'companies'), where('handle', '==', companyHandle.toLowerCase().replace(/\s+/g, '_')));
      const companyCountSnap = await getDocs(companyCountQuery);
      if (!companyCountSnap.empty) {
        setIsVerifying(false);
        toast.dismiss(toastId);
        return toast.error('هذا المعرف محجوز مسبقاً، يرجى اختيار معرف آخر');
      }

      currentPath = 'companies (create)';
      const companyRef = doc(collection(db, 'companies'));
      await setDoc(companyRef, {
        name: companyName.trim(),
        handle: companyHandle.toLowerCase().replace(/\s+/g, '_').trim(),
        phoneNumber: companyPhone.trim(),
        address: companyAddress.trim(),
        adminEmail: (currentUser?.email || '').toLowerCase().trim(),
        subscriptionPlan: 'starter',
        subscriptionStatus: 'trial',
        approved: false,
        createdAt: serverTimestamp()
      });

      currentPath = 'staff (create)';
      await setDoc(doc(db, 'staff', currentUser!.uid || currentUser!.id), {
        companyId: companyRef.id,
        email: currentUser?.email,
        fullName: currentUser?.fullName || currentUser?.displayName || 'مدير النظام',
        role: 'admin',
        createdAt: serverTimestamp()
      });

      currentPath = 'notifications (create)';
      // Notify super admin
      await createSystemNotification(
        'طلب تسجيل شركة جديد',
        `قامت شركة ${companyName} بتقديم طلب تسجيل جديد. يرجى المراجعة والموافقة.`,
        'info'
      );

      setIsSuccess(true);
      toast.success('تم إرسال طلبك بنجاح! بانتظار موافقة الإدارة.', { id: toastId });
    } catch (error: any) {
      console.error('Registration error details:', error);
      toast.error('فشل تقديم الطلب. يرجى المحاولة لاحقاً', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, currentPath);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-right leading-relaxed relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1549413628-98f98a335099?auto=format&fit=crop&q=80&w=2000" 
          alt="Iraqi Heritage" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-100/50 to-neutral-100" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={isSuccess ? 'success' : step}
          initial={{ opacity: 0, scale: 0.9, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, x: -20 }}
          className="bg-white/90 backdrop-blur-md p-12 rounded-[48px] shadow-2xl max-w-xl w-full relative z-10 border border-white/50"
        >
          {isSuccess ? (
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-[32px] mx-auto flex items-center justify-center shadow-lg shadow-emerald-50">
                <Check size={48} />
              </div>
              <h2 className="text-4xl font-black">مبروك!</h2>
              <p className="text-neutral-500 text-lg">تم تسجيل شركة <span className="text-neutral-900 font-bold">{companyName}</span> بنجاح في النظام.</p>
              <div className="bg-neutral-50 p-6 rounded-3xl text-sm space-y-2">
                <p className="font-bold">ماذا يحدث الآن؟</p>
                <p className="text-neutral-400 leading-relaxed">طلبك الآن قيد المراجعة من قبل الإدارة. سيتم إخطارك فور تفعيل حسابك لتتمكن من البدء في إدارة أسطولك.</p>
              </div>
              <button 
                onClick={onComplete}
                className="w-full bg-neutral-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all outline-none"
              >
                دخول لوحة التحكم
              </button>
            </div>
          ) : step === 1 ? (
            <>
              <div className="w-20 h-20 bg-neutral-100 rounded-3xl mx-auto mb-8 flex items-center justify-center text-neutral-900">
                <Car size={40} />
              </div>
              <h2 className="text-3xl font-black mb-4">أهلاً بك في عراق رنتل</h2>
              <p className="text-neutral-500 mb-10">للبدء، نحتاج لتأسيس سجل شركتك في نظامنا الموحد للشرق الأوسط.</p>
              <button 
                onClick={() => setStep(2)}
                className="w-full bg-neutral-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-neutral-800 transition-colors shadow-xl outline-none"
              >
                إنشاء شركة جديدة
              </button>
            </>
          ) : (
            <div className="space-y-6">
              <h2 className="text-3xl font-black mb-2">معلومات الشركة</h2>
              <p className="text-neutral-500 mb-8">أدخل تفاصيل شركتك الرسمية للبدء.</p>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest italic">اسم الشركة</label>
                <input 
                  autoFocus
                  type="text" 
                  placeholder="مثال: شركة الوفاق للتأجير..." 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full p-5 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-xl font-bold"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest italic">معرف الشركة (ID)</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">@</span>
                  <input 
                    type="text" 
                    placeholder="baghdad_rent_1" 
                    value={companyHandle}
                    onChange={(e) => setCompanyHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="w-full p-5 pl-10 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-xl font-bold text-left"
                    dir="ltr"
                  />
                </div>
                <p className="text-[10px] text-neutral-400 mr-2">هذا المعرف سيكون رابطك الخاص وعلامتك في النظام.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest italic">رقم هاتف التواصل</label>
                <input 
                  type="tel" 
                  placeholder="077XXXXXXXX" 
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="w-full p-5 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-xl font-bold text-left"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest italic">عنوان الشركة</label>
                <input 
                  type="text" 
                  placeholder="مثال: بغداد، حي المنصور..." 
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full p-5 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-xl font-bold"
                />
              </div>

              <button 
                onClick={handleCreateCompanyDirectly}
                disabled={isVerifying}
                className="w-full bg-neutral-900 text-white py-5 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 disabled:opacity-70 transition-all outline-none"
              >
                {isVerifying ? (
                   <>
                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                     جاري إرسال الطلب...
                   </>
                ) : (
                   <>
                     إرسال طلب التسجيل <ChevronLeft size={20} />
                   </>
                )}
              </button>

              <button 
                onClick={() => setStep(1)}
                className="w-full text-neutral-400 font-bold hover:text-neutral-900 transition-colors text-xs"
                disabled={isVerifying}
              >
                العودة للخلف
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}


// --- Components ---

function PendingApprovalScreen({ companyName }: { companyName: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-right leading-relaxed relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1549413628-98f98a335099?auto=format&fit=crop&q=80&w=2000" 
          alt="Iraqi Heritage" 
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-100/50 to-neutral-100" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/90 backdrop-blur-md p-10 lg:p-14 rounded-[56px] shadow-2xl max-w-xl w-full relative z-10 border border-white/50 text-center"
      >
        <div className="w-24 h-24 bg-orange-100 rounded-3xl mx-auto mb-8 flex items-center justify-center text-orange-600 shadow-xl shadow-orange-100/50 animate-pulse">
          <Clock size={48} />
        </div>
        <h2 className="text-4xl font-black mb-4">بانتظار الموافقة</h2>
        <div className="inline-block px-4 py-2 bg-neutral-100 rounded-full text-neutral-900 font-black mb-6 border border-neutral-200">
           {companyName}
        </div>
        <p className="text-neutral-500 mb-10 leading-relaxed text-lg">
          شكراً لتسجيل شركتك في عراق رنتل. حسابك الآن قيد المراجعة من قبل إدارة المنصة لضمان أمان وموثوقية الشبكة العالمية. 
          <br /><br />
          سيتم تفعيل دخولك فور الموافقة على الطلب. يمكنك تحديث الصفحة للتأكد.
        </p>
        
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-neutral-900 text-white py-5 rounded-3xl font-black text-xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3"
          >
            تحديث الحالة <RefreshCcw size={20} />
          </button>
          
          <button 
            onClick={() => signOut(auth)}
            className="w-full py-4 rounded-2xl font-bold text-neutral-400 hover:text-red-500 transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between flex-none">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function CustomersView({ staff, isSuperAdmin }: { staff: StaffProfile | null, isSuperAdmin: boolean }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', idNumber: '', phoneNumber: '', photoUrl: '' });
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<Customer | null>(null);
  const [customerContracts, setCustomerContracts] = useState<Contract[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Removed local isSuperAdmin calculation that used auth.currentUser

  useEffect(() => {
    if (!isSuperAdmin && !staff?.companyId) return;
    
    const q = isSuperAdmin 
      ? query(collection(db, 'customers'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'customers'), where('companyId', '==', staff?.companyId), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });
    return () => unsubscribe();
  }, [staff?.companyId, isSuperAdmin]);

  const fetchCustomerHistory = async (customer: Customer) => {
    setSelectedHistoryCustomer(customer);
    setLoadingHistory(true);
    try {
      // Search by phone number or full name since we moved to a flat contract schema
      const q = query(
        collection(db, 'contracts'),
        where('phoneNumber', '==', customer.phoneNumber),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      setCustomerContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `contracts/history/${customer.phoneNumber}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff?.companyId && !isSuperAdmin) return toast.error('خطأ في تحديد الشركة');
    try {
      await addDoc(collection(db, 'customers'), {
        ...formData,
        companyId: staff?.companyId || 'SUPER_ADMIN_SYSTEM',
        isBlocked: false,
        createdAt: serverTimestamp()
      });
      toast.success('تم إضافة العميل بنجاح');
      setIsModalOpen(false);
      setFormData({ fullName: '', idNumber: '', phoneNumber: '', photoUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    }
  };

  const deleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف العميل "${name}"؟`)) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
      toast.success('تم حذف العميل');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await compressImage(file, 600, 600, 0.6);
      setFormData({ ...formData, photoUrl: dataUrl });
    }
  };

  return (
    <div className="space-y-6 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900">إدارة العملاء</h1>
          <p className="text-neutral-500 mt-1">سجل كامل لجميع العملاء المسجلين في النظام.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-neutral-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <Plus size={20} />
          إضافة عميل
        </button>
      </header>

      <div className="bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-x-auto">
        <table className="w-full text-right min-w-[600px] lg:min-w-0">
          <thead className="bg-neutral-50/50 border-b border-neutral-100">
            <tr>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">اسم العميل</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">رقم الهوية</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">رقم الجوال</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">الحالة</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {customers.map((c) => (
              <tr 
                key={c.id} 
                onClick={() => fetchCustomerHistory(c)}
                className="hover:bg-neutral-50/50 transition-colors group cursor-pointer"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center flex-row-reverse gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-100 shadow-sm bg-neutral-50 flex items-center justify-center">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-neutral-300" />
                      )}
                    </div>
                    <span className="font-bold text-sm">{c.fullName}</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-sm font-mono text-neutral-500">{c.idNumber}</td>
                <td className="px-8 py-5 text-sm">{c.phoneNumber}</td>
                <td className="px-8 py-5">
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${c.isBlocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {c.isBlocked ? 'محظور' : 'نشط'}
                  </span>
                </td>
                <td className="px-8 py-5 text-center">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomer(c.id, c.fullName);
                    }}
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all relative z-10"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-neutral-400 italic">لا يوجد عملاء مضافين حالياً</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal 
        isOpen={!!selectedHistoryCustomer} 
        onClose={() => setSelectedHistoryCustomer(null)} 
        title={`سجل الإيجارات: ${selectedHistoryCustomer?.fullName}`}
      >
        <div className="space-y-4 text-right">
          {loadingHistory ? (
            <div className="py-12 text-center">
              <div className="w-8 h-8 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-neutral-500 italic">جاري تحميل السجل...</p>
            </div>
          ) : customerContracts.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 italic">لا توجد عقود سابقة لهذا العميل</div>
          ) : (
            <div className="space-y-4">
              {customerContracts.map((contract) => (
                <div key={contract.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex justify-between items-center flex-row-reverse gap-4">
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 text-sm mb-1">{contract.carType} {contract.carModel}</p>
                    <div className="flex gap-4 text-xs text-neutral-500 flex-row-reverse">
                      <span>من: {contract.rentalStartDate}</span>
                      <span>إلى: {contract.rentalEndDate}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      contract.bookingStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                      contract.bookingStatus === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {contract.bookingStatus === 'active' ? 'نشط' : contract.bookingStatus === 'completed' ? 'مكتمل' : 'ملغي'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button 
            onClick={() => setSelectedHistoryCustomer(null)}
            className="w-full py-4 font-bold text-neutral-400 hover:text-neutral-900 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة عميل جديد">
        <form onSubmit={handleSubmit} className="space-y-5 text-right">
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">الاسم الكامل</label>
            <input 
              required
              type="text" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
              placeholder="مثال: فاروق محمد صالح"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">صورة العميل</label>
            <div className="flex flex-col items-center p-6 bg-neutral-50 rounded-[32px] border-2 border-dashed border-neutral-200 gap-4 mb-4">
              <div className="flex gap-4">
                <div 
                  className="relative w-24 h-24 group cursor-pointer bg-white rounded-2xl flex flex-col items-center justify-center gap-1 border-2 border-transparent hover:border-neutral-900 transition-all overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {formData.photoUrl ? (
                    <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Image size={24} className="text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                      <span className="text-[10px] font-bold text-neutral-400 group-hover:text-neutral-900">من الاستوديو</span>
                    </>
                  )}
                  {formData.photoUrl && (
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFormData({...formData, photoUrl: ''}); }}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <input 
                type="url" 
                value={formData.photoUrl}
                onChange={(e) => setFormData({...formData, photoUrl: e.target.value})}
                className="w-full bg-white px-4 py-2 rounded-xl text-right text-[10px] outline-none border border-neutral-100 focus:border-neutral-900 text-neutral-400 focus:text-neutral-900"
                placeholder="أو ضع رابط الصورة هنا..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">رقم الهوية</label>
              <input 
                required
                type="text" 
                value={formData.idNumber}
                onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                placeholder="رقم البطاقة الوطنية"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">رقم الجوال</label>
              <input 
                required
                type="text" 
                value={formData.phoneNumber}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                placeholder="07XXXXXXXX"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-neutral-800 transition-colors mt-4">
            تأكيد الإضافة
          </button>
        </form>
      </Modal>
    </div>
  );
}

function StaffManagementView({ company, currentUser }: { company: Company | null, currentUser: any }) {
  const [staffList, setStaffList] = useState<(StaffProfile & { id: string })[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', email: '', phoneNumber: '', role: 'staff' as 'admin' | 'manager' | 'staff' });

  useEffect(() => {
    if (!company?.id) return;
    const q = query(collection(db, 'staff'), where('companyId', '==', company.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffProfile & { id: string })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'staff'));
    return () => unsubscribe();
  }, [company?.id]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setLoading(true);
    try {
      // Create a pending staff record using email as identifier if UID is not known
      // We will use a unique ID for this record, or the email itself if we want to be unique
      const staffRef = doc(collection(db, 'staff'));
      await setDoc(staffRef, {
        ...formData,
        email: formData.email.toLowerCase(),
        companyId: company.id,
        createdAt: serverTimestamp(),
        isPending: true // Mark as pending until they log in
      });
      
      toast.success('تم إضافة الموظف بنجاح. سيتم تفعيل حسابه فور تسجيل دخوله.');
      setIsModalOpen(false);
      setFormData({ fullName: '', email: '', phoneNumber: '', role: 'staff' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff');
    } finally {
      setLoading(false);
    }
  };

  const deleteStaff = async (id: string, name: string) => {
    if (id === (currentUser?.uid || currentUser?.id)) return toast.error('لا يمكنك حذف نفسك');
    if (!window.confirm(`هل أنت متأكد من حذف الموظف "${name}"؟`)) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
      toast.success('تم حذف الموظف من النظام');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
    }
  };

  return (
    <div className="space-y-6 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white font-sans">إدارة الموظفين</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">أضف وتحكم في صلاحيات فريق عمل شركتك.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <UserPlus size={20} />
          إضافة موظف
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staffList.map((s) => (
          <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={s.id} 
            className="bg-white dark:bg-neutral-800 p-6 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6 flex-row-reverse">
              <div className="w-14 h-14 bg-neutral-50 dark:bg-neutral-900 rounded-2xl flex items-center justify-center text-neutral-400">
                <User size={28} />
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full mb-2 ${
                  s.role === 'admin' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 
                  s.role === 'manager' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                  'bg-neutral-50 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                }`}>
                  {s.role === 'admin' ? 'مدير نظام' : s.role === 'manager' ? 'مدير فرع' : 'موظف'}
                </span>
                {(s as any).isPending && (
                  <span className="text-[9px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    بانتظار الدخول الأول
                  </span>
                )}
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-1 dark:text-white">{s.fullName}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 lowercase">{s.email}</p>
            
            <div className="pt-4 border-t border-neutral-50 dark:border-neutral-700 flex items-center justify-between flex-row-reverse">
              <div className="text-right">
                <p className="text-[10px] text-neutral-400 font-bold uppercase mb-1">رقم الهاتف</p>
                <p className="text-sm font-mono dark:text-white" dir="ltr">{s.phoneNumber || 'غير مسجل'}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  disabled={s.id === (currentUser?.uid || currentUser?.id)}
                  onClick={() => deleteStaff(s.id, s.fullName)}
                  className="text-neutral-400 hover:text-red-500 transition-colors p-2 disabled:opacity-30"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة موظف جديد">
        <form onSubmit={handleAddStaff} className="space-y-5 text-right font-sans">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-400 uppercase italic">الاسم الكامل</label>
            <input 
              required
              type="text" 
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-2 border-transparent focus:border-neutral-900 dark:focus:border-white rounded-2xl outline-none transition-all text-right font-bold"
              placeholder="اسم الموظف الثلاثي..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-400 uppercase italic text-right">البريد الإلكتروني (Gmail)</label>
              <input 
                required
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-2 border-transparent focus:border-neutral-900 dark:focus:border-white rounded-2xl outline-none transition-all text-left font-mono"
                placeholder="example@gmail.com"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-neutral-400 uppercase italic">رقم الهاتف</label>
              <input 
                type="tel" 
                value={formData.phoneNumber || ''}
                onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-2 border-transparent focus:border-neutral-900 dark:focus:border-white rounded-2xl outline-none transition-all text-left font-mono"
                placeholder="07xxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-400 uppercase italic">رتبة الموظف</label>
            <select 
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value as any})}
              className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-2 border-transparent focus:border-neutral-900 dark:focus:border-white rounded-2xl outline-none transition-all text-right appearance-none font-bold"
            >
              <option value="staff">موظف (إدخال بيانات)</option>
              <option value="manager">مدير (إدارة أسطول وعملاء)</option>
              <option value="admin">مسؤول (تحكم كامل بالشركة)</option>
            </select>
          </div>

          <p className="text-[10px] text-neutral-400 bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl leading-relaxed">
            * ملاحظة: الموظف سيحتاج لتسجيل الدخول باستخدام نفس البريد الإلكتروني الذي أدخلته هنا ليتم ربطه تلقائياً بشركتك.
          </p>

          <button 
            disabled={loading}
            type="submit" 
            className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-5 rounded-2xl font-black text-lg shadow-xl hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-50"
          >
            {loading ? 'جاري الحفظ...' : 'إضافة الموظف للنظام'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function InventoryView({ staff, isSuperAdmin, currentUser }: { staff: StaffProfile | null, isSuperAdmin: boolean, currentUser: any }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: 'سيدان', dailyPrice: 0, plateNumber: '', color: '', year: '' });
  // Removed local isSuperAdmin calculation that used auth.currentUser

  useEffect(() => {
    if (!isSuperAdmin && !staff?.companyId) return;
    
    const q = isSuperAdmin 
      ? query(collection(db, 'inventory'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'inventory'), where('companyId', '==', staff?.companyId), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });
    return () => unsubscribe();
  }, [staff?.companyId, isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff?.companyId && !isSuperAdmin) return toast.error('خطأ في تحديد الشركة');
    try {
      await addDoc(collection(db, 'inventory'), {
        ...formData,
        companyId: staff?.companyId || 'SUPER_ADMIN_SYSTEM',
        status: 'available',
        createdAt: serverTimestamp()
      });
      toast.success('تم إضافة السيارة للأسطول');
      setIsModalOpen(false);
      setFormData({ name: '', category: 'سيدان', dailyPrice: 0, plateNumber: '', color: '', year: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'inventory');
    }
  };

  const deleteItem = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف السيارة "${name}"؟`)) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      toast.success('تم حذف السيارة من الأسطول');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  return (
    <div className="space-y-6 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900">إدارة الأسطول</h1>
          <p className="text-neutral-500 mt-1">إضافة وإدارة السيارات والمعدات المتاحة للتأجير.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-neutral-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={20} />
          إضافة سيارة
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <motion.div 
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={item.id} 
            className="bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-2 h-full ${
              item.status === 'available' ? 'bg-emerald-500' : 
              item.status === 'rented' ? 'bg-blue-500' : 'bg-orange-500'
            }`} />
            
            <div className="flex justify-between items-start mb-4 flex-row-reverse">
              <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-400">
                <Car size={24} />
              </div>
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                item.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 
                item.status === 'rented' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
              }`}>
                {item.status === 'available' ? 'متاحة' : item.status === 'rented' ? 'مؤجرة' : 'في الصيانة'}
              </span>
            </div>
            
            <h3 className="text-lg font-bold mb-1">{item.name}</h3>
            <p className="text-sm text-neutral-500 mb-4">{item.category}</p>
            
            <div className="pt-4 border-t border-neutral-50 flex items-center justify-between flex-row-reverse">
              <div className="text-left">
                <p className="text-xs text-neutral-400 font-bold uppercase">السعر اليومي</p>
                <p className="text-xl font-black italic">{item.dailyPrice} <span className="text-xs not-italic font-normal">ر.س</span></p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => deleteItem(item.id, item.name)}
                  className="text-neutral-500 hover:text-red-600 transition-colors p-2"
                >
                  <Trash2 size={18} />
                </button>
                <button className="text-neutral-400 hover:text-neutral-900 transition-colors p-2">
                  <AlertTriangle size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[40px] border-4 border-dashed border-neutral-100 text-center text-neutral-300">
            <Search size={48} className="mx-auto mb-4 opacity-10" />
            <p className="text-xl font-bold">لا توجد سيارات في الأسطول</p>
            <p className="text-sm">ابدأ بإضافة سيارتك الأولى الآن.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="إضافة مركبة جديدة">
        <form onSubmit={handleSubmit} className="space-y-5 text-right">
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">اسم المركبة / الموديل</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
              placeholder="مثال: تويوتا كامري 2024"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">الفئة</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right appearance-none"
              >
                <option>سيدان</option>
                <option>دفع رباعي</option>
                <option>عائلية</option>
                <option>اقتصادية</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">السعر اليومي (د.ع)</label>
              <input 
                required
                type="number" 
                value={formData.dailyPrice || ''}
                onChange={(e) => setFormData({...formData, dailyPrice: Number(e.target.value)})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">رقم اللوحة</label>
              <input 
                type="text" 
                value={formData.plateNumber}
                onChange={(e) => setFormData({...formData, plateNumber: e.target.value})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                placeholder="رقم اللوحة..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">لون السيارة</label>
              <input 
                type="text" 
                value={formData.color}
                onChange={(e) => setFormData({...formData, color: e.target.value})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                placeholder="اللون..."
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">سنة الصنع</label>
              <input 
                type="text" 
                value={formData.year}
                onChange={(e) => setFormData({...formData, year: e.target.value})}
                className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                placeholder="مثال: 2024"
              />
            </div>
          </div>
          <button type="submit" className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-neutral-800 transition-colors mt-4">
            حفظ في النظام
          </button>
        </form>
      </Modal>
    </div>
  );
}

function AuthScreen({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [view, setView] = useState<'email' | 'register'>('email');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    const toastId = toast.loading('جاري التحقق...');
    setLoading(true);
    try {
      const data = await api.login({ email: email.trim(), password });

      // Save user info locally
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      
      onLoginSuccess(data.user);
      toast.success('تم تسجيل الدخول بنجاح', { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'البريد الإلكتروني أو كلمة المرور غير صحيحة', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    if (password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    const toastId = toast.loading('جاري إنشاء الحساب...');
    setLoading(true);
    try {
      await api.register({ email: email.trim(), password, fullName });
      toast.success('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', { id: toastId });
      setView('email'); 
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'فشل إنشاء الحساب', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden text-right font-sans">
      <Toaster position="top-right" />
      
      {/* Background with Iraqi Heritage */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?q=80&w=1974&auto=format&fit=crop" 
          alt="Iraqi Heritage Background" 
          className="w-full h-full object-cover opacity-30 scale-105"
        />
        <div className="absolute inset-0 opacity-10" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l30 30-30 30L0 30z' fill='%23ffffff' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '40px 40px'
          }} 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/90 backdrop-blur-xl p-8 lg:p-12 rounded-[48px] shadow-2xl max-w-lg w-full relative z-10 border border-white/50"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-neutral-900 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-neutral-200">
             <Building2 className="text-white" size={40} />
          </div>
          <h1 className="text-4xl font-black text-neutral-900 mb-2">عراق رنتل</h1>
          <p className="text-neutral-500 font-bold tracking-widest uppercase text-sm">نظام إدارة مكاتب التأجير</p>
        </div>

        {view === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 mr-2">البريد الإلكتروني</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-100 border-none rounded-2xl py-5 px-6 pr-14 font-bold focus:ring-4 focus:ring-neutral-200 transition-all text-right"
                  placeholder="name@example.com"
                  required
                />
                <Mail className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 mr-2">كلمة المرور</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-100 border-none rounded-2xl py-5 px-6 pr-14 font-bold focus:ring-4 focus:ring-neutral-200 transition-all text-right"
                  placeholder="••••••••"
                  required
                />
                <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-neutral-900 text-white py-5 rounded-3xl font-black text-xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
            </button>

            <button 
              type="button"
              onClick={() => setView('register')}
              className="w-full py-4 text-neutral-500 font-bold hover:text-neutral-900 transition-colors"
            >
              ليس لديك حساب؟ إنشاء حساب جديد
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 mr-2">الاسم الكامل</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-neutral-100 border-none rounded-2xl py-5 px-6 pr-14 font-bold focus:ring-4 focus:ring-neutral-200 transition-all text-right"
                  placeholder="أدخل اسمك الكامل"
                  required
                />
                <User className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 mr-2">البريد الإلكتروني</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-100 border-none rounded-2xl py-5 px-6 pr-14 font-bold focus:ring-4 focus:ring-neutral-200 transition-all text-right"
                  placeholder="name@example.com"
                  required
                />
                <Mail className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 mr-2">كلمة المرور</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-100 border-none rounded-2xl py-5 px-6 pr-14 font-bold focus:ring-4 focus:ring-neutral-200 transition-all text-right"
                  placeholder="6 أحرف على الأقل"
                  required
                />
                <Key className="absolute right-6 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-neutral-900 text-white py-5 rounded-3xl font-black text-xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
            </button>

            <button 
              type="button"
              onClick={() => setView('email')}
              className="w-full py-4 text-neutral-500 font-bold hover:text-neutral-900 transition-colors"
            >
              لديك حساب بالفعل؟ تسجيل الدخول
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

function Sidebar({ 
  activeTab, 
  setActiveTab, 
  staff, 
  company, 
  isOpen, 
  onClose, 
  unreadCount, 
  isDarkMode, 
  setIsDarkMode,
  language,
  setLanguage,
  isSuperAdmin,
  currentUser
}: { 
  activeTab: ActiveTab, 
  setActiveTab: (t: ActiveTab) => void, 
  staff: StaffProfile | null, 
  company: Company | null, 
  isOpen: boolean, 
  onClose: () => void, 
  unreadCount: number, 
  isDarkMode: boolean, 
  setIsDarkMode: (v: boolean) => void,
  language: 'ar' | 'ku',
  setLanguage: (l: 'ar' | 'ku') => void,
  isSuperAdmin: boolean,
  currentUser: any
}) {
  const accentColor = company?.accentColor || '#171717';

  const allMenuItems: { id: ActiveTab | 'logout', label: string, icon: any }[] = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
    { id: 'customers', label: 'العملاء', icon: Users },
    { id: 'inventory', label: 'الأسطول', icon: Car },
    { id: 'gps', label: 'تتبع الأسطول', icon: MapPin },
    { id: 'notifications', label: 'الإشعارات', icon: Bell },
    { id: 'chats', label: 'المحادثات', icon: MessageSquare },
    { id: 'contract', label: 'العقد الإلكتروني', icon: FileText },
    { id: 'blocklist', label: 'قائمة الحظر', icon: Ban },
    { id: 'external_blocklist', label: 'حظر خارجي', icon: ShieldAlert },
    { id: 'plans', label: 'باقات الاشتراك', icon: CheckCircle2 },
    { id: 'companies', label: 'الشركات', icon: Building2 },
    { id: 'employment', label: 'التوظيف والمهام', icon: UserCheck },
    { id: 'staff', label: 'إدارة الموظفين', icon: UserPlus },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
    { id: 'logout', label: 'تسجيل الخروج', icon: LogOut },
  ] as { id: ActiveTab | 'logout'; label: string; icon: any }[];

  const menuItems = allMenuItems.filter(item => {
    if (item.id === 'employment' || item.id === 'companies' || item.id === 'plans') {
      return isSuperAdmin;
    }
    if (item.id === 'staff') {
      return staff?.role === 'admin' || isSuperAdmin;
    }
    return true; // Staff can see everything else
  });

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ x: isOpen ? '0%' : (window.innerWidth < 1024 ? '100%' : '0%') }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed lg:static top-0 right-0 h-full w-72 bg-white dark:bg-neutral-900 border-l border-neutral-100 dark:border-neutral-800 z-50 flex flex-col shadow-2xl lg:shadow-none print:hidden"
      >
        <div className="p-8 pb-4 flex items-center justify-between flex-row-reverse">
          <div className="flex items-center gap-2 flex-row-reverse">
            {company?.logoUrl && !isSuperAdmin ? (
              <div className="w-10 h-10 bg-white p-1 rounded-lg border border-neutral-100 shadow-sm flex items-center justify-center">
                <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <Car className="text-neutral-900 dark:text-white" size={32} />
            )}
            <div className="text-right">
              <h1 className="text-xl font-black italic tracking-tighter dark:text-white leading-tight">
                {isSuperAdmin ? 'عراق رنتل' : (company?.name || 'عراق رنتل')}
              </h1>
              {!isSuperAdmin && company?.handle && (
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">@{company.handle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 overflow-y-auto custom-scrollbar relative">
          <div className="space-y-1 relative">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const isLogout = item.id === 'logout';
              
              return (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  key={item.id}
                  onClick={() => {
                    if (isLogout) {
                      localStorage.removeItem('auth_user');
                      window.location.reload();
                    } else {
                      setActiveTab(item.id as ActiveTab);
                    }
                    onClose();
                  }}
                  className={`relative w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group flex-row-reverse z-10 ${
                    isLogout
                      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'
                      : isActive 
                        ? 'text-white' 
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {/* Sliding Indicator */}
                  {isActive && !isLogout && (
                    <motion.div
                      layoutId="active-nav-bg"
                      className="absolute inset-0 rounded-2xl -z-10 shadow-lg"
                      style={{ backgroundColor: accentColor }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  <div className="relative">
                    <item.icon 
                      size={20} 
                      className={`transition-colors duration-300 ${
                        isActive && !isLogout ? 'text-white dark:text-neutral-900' : isLogout ? 'text-red-400 group-hover:text-red-600' : 'text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-white'
                      }`} 
                    />
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white dark:border-neutral-900 animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  
                  <span className={`font-bold text-sm mr-auto transition-transform duration-300 ${!isActive && !isLogout ? 'group-hover:translate-x-1' : ''}`}>
                    {item.label}
                  </span>

                  {/* Hover Highlight (Non-active) */}
                  {!isActive && !isLogout && (
                    <div className="absolute inset-0 bg-neutral-50 rounded-2xl -z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                </motion.button>
              );
            })}
          </div>
          
          <div className="pt-8 px-2">
            <button 
              onClick={() => {
                setActiveTab('plans');
                onClose();
              }}
              className="w-full p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[24px] text-white text-right relative overflow-hidden group shadow-lg shadow-blue-200"
            >
              <div className="relative z-10">
                <p className="text-[10px] font-bold opacity-80 mb-1 uppercase tracking-wider">اشتراك الباقة</p>
                <p className="text-lg font-black italic capitalize leading-none mb-2">{company?.subscriptionPlan || 'STARTER'}</p>
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">إدارة الاشتراك</span>
                </div>
              </div>
              <Clock className="absolute -left-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform" size={80} />
            </button>
          </div>
        </nav>

        <div className="p-4 mt-auto border-t border-neutral-100 bg-neutral-50/50">
          <div className="flex items-center gap-3 px-2 flex-row-reverse text-right">
            <div className="w-10 h-10 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-600">
              <UserCircle size={24} />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{staff?.fullName || (isSuperAdmin ? 'المالك العام' : 'موظف')}</p>
              <p className="text-xs text-neutral-500 capitalize">{isSuperAdmin ? 'Super Admin' : (staff?.role || 'Staff')}</p>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

function PendingApprovalList({ onNavigate }: { onNavigate: (tab: ActiveTab) => void }) {
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const q = query(collection(db, 'companies'), where('approved', '==', false));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
      console.log('Pending companies fetched:', docs.length);
      setPendingCompanies(docs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error('PendingApprovalList error:', err);
      if (isMounted) {
        setError('فشل تحميل البيانات. تأكد من الصلاحيات.');
        setLoading(false);
      }
    });

    return () => { isMounted = false; unsubscribe(); };
  }, []);

  const approveCompany = async (companyId: string) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        approved: true
      });
      toast.success('تمت الموافقة على الشركة بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'companies');
    }
  };

  if (loading) return <div className="text-center py-4 text-neutral-400">جاري التحميل...</div>;
  if (error) return <div className="text-center py-4 text-red-500 font-bold">{error}</div>;
  if (pendingCompanies.length === 0) return <div className="text-center py-8 text-neutral-400 italic">لا توجد طلبات معلقة حالياً</div>;

  return (
    <div className="space-y-4">
      {pendingCompanies.map(c => (
        <div key={c.id} className="flex items-center justify-between p-5 rounded-[24px] bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 flex-row-reverse">
          <div className="flex items-center gap-4 flex-row-reverse">
            <div className="w-12 h-12 bg-white dark:bg-neutral-800 rounded-2xl shadow-sm flex items-center justify-center text-neutral-400 border border-neutral-100 dark:border-neutral-700">
              <Building2 size={24} />
            </div>
            <div className="text-right">
              <h3 className="font-bold dark:text-white">{c.name}</h3>
              <p className="text-xs text-neutral-500">@{c.handle} • {c.phoneNumber}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => approveCompany(c.id)}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20"
            >
              موافقة
            </button>
            <button 
              onClick={() => onNavigate('companies')}
              className="p-2 bg-white dark:bg-neutral-800 text-neutral-400 border border-neutral-100 dark:border-neutral-700 rounded-xl hover:text-blue-600 transition-all"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardView({ staff, company, onNavigate, isSuperAdmin }: { staff: StaffProfile | null, company: Company | null, onNavigate: (tab: ActiveTab) => void, isSuperAdmin: boolean }) {
  const [stats, setStats] = useState({ contracts: 0, cars: 0, customers: 0, blocked: 0 });
  const [recentContracts, setRecentContracts] = useState<Contract[]>([]);
  const accentColor = company?.accentColor || '#3b82f6';

  useEffect(() => {
    if (!isSuperAdmin && !staff?.companyId) return;

    const baseQuery = (coll: string) => {
      if (isSuperAdmin) return query(collection(db, coll));
      return query(collection(db, coll), where('companyId', '==', staff?.companyId));
    };

    const unsubCars = onSnapshot(baseQuery('inventory'), (s) => {
      setStats(prev => ({ ...prev, cars: s.size }));
    });
    const unsubCustomers = onSnapshot(baseQuery('customers'), (s) => {
      setStats(prev => ({ ...prev, customers: s.size, blocked: s.docs.filter(d => d.data().isBlocked).length }));
    });
    const unsubContracts = onSnapshot(baseQuery('contracts'), (s) => {
      let activeCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      s.docs.forEach(d => {
        const data = d.data();
        let isExpired = false;
        if (data.rentalEndDate) {
          const endDate = new Date(data.rentalEndDate);
          isExpired = endDate < today;
        }
        if (data.bookingStatus === 'active' && !isExpired) {
          activeCount++;
        }
      });
      setStats(prev => ({ ...prev, contracts: activeCount }));
    });

    const recentQuery = isSuperAdmin 
      ? query(collection(db, 'contracts'), orderBy('createdAt', 'desc'), limit(5))
      : query(collection(db, 'contracts'), where('companyId', '==', staff?.companyId), orderBy('createdAt', 'desc'), limit(5));
    
    const unsubRecent = onSnapshot(recentQuery, (s) => {
      setRecentContracts(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract)));
    });

    return () => {
      unsubCars();
      unsubCustomers();
      unsubContracts();
      unsubRecent();
    };
  }, [staff?.companyId, isSuperAdmin]);

  return (
    <div className="space-y-8 text-right">
      {company?.bannerUrl ? (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full h-48 md:h-64 rounded-[40px] overflow-hidden shadow-2xl mb-8 group"
        >
          <img src={company.bannerUrl} alt="Company Banner" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-8 right-8 flex items-center gap-4 flex-row-reverse text-white">
            <div className="w-20 h-20 bg-white p-2 rounded-2xl shadow-xl flex items-center justify-center">
              {company.logoUrl ? (
                <img src={company.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Building2 className="text-neutral-400" size={40} />
              )}
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black italic">{company.name}</h1>
              <p className="text-white/70 text-sm font-medium">@{company.handle}</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <header className="flex justify-between items-center flex-row-reverse">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">نظرة عامة</h1>
            <p className="text-neutral-500 dark:text-neutral-400 mt-1">مرحباً بك في لوحة تحكم عراق رنتل.</p>
          </div>
        </header>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'العقود النشطة', value: stats.contracts.toString(), icon: FileText, tab: 'contracts_list' },
          { label: 'السيارات المتاحة', value: stats.cars.toString(), icon: Car, tab: 'inventory' },
          { label: 'العملاء المسجلين', value: stats.customers.toString(), icon: Users, tab: 'customers' },
          { label: 'عملاء محظورين', value: stats.blocked.toString(), icon: Ban, tab: 'blocklist' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            onClick={() => onNavigate(stat.tab as ActiveTab)}
            className="bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm text-right hover:shadow-md transition-shadow cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <div 
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mr-auto ml-0 shadow-inner`}
              style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
            >
              <stat.icon size={24} />
            </div>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">{stat.label}</p>
            <p className="text-lg font-bold text-neutral-900 dark:text-white my-1">{company?.name || 'عراق رنتل'}</p>
            <p className="text-4xl font-black text-neutral-900 dark:text-white mt-1 italic" style={{ color: accentColor }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {isSuperAdmin && (
        <section 
          id="super-admin-approval-section"
          style={{ backgroundColor: '#9d2727' }}
          className="p-8 rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm text-right text-white"
        >
          <div style={{ width: '319px' }} className="flex items-center justify-between mb-6 flex-row-reverse border-b border-white/20 pb-4">
            <div className="flex items-center gap-3 flex-row-reverse">
              <Building2 className="text-white" size={24} />
              <h2 className="text-xl font-bold">شركات بانتظار الموافقة</h2>
            </div>
            <button 
              onClick={() => onNavigate('companies')} 
              className="text-white/80 text-sm font-bold hover:underline"
            >
              <span style={{ fontStyle: 'italic', textDecorationLine: 'underline' }}>
                عرض جميع الشركات
              </span>
            </button>
          </div>
          <PendingApprovalList onNavigate={onNavigate} />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-neutral-800 p-8 rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm text-right">
          <div className="flex items-center justify-between mb-6 flex-row-reverse">
            <h2 className="text-xl font-bold dark:text-white">آخر العقود</h2>
            <button onClick={() => onNavigate('contracts_list')} className="text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="space-y-4">
            {recentContracts.length > 0 ? (
              recentContracts.map(contract => (
                <div 
                  key={contract.id} 
                  onClick={() => onNavigate('contracts_list')}
                  className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer flex-row-reverse"
                >
                  <div className="flex items-center gap-4 flex-row-reverse">
                    <div className="w-10 h-10 bg-white dark:bg-neutral-900 rounded-xl flex items-center justify-center text-neutral-400 border border-neutral-100 dark:border-neutral-700">
                      <FileText size={18} />
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm dark:text-white">عقد تأجير #{contract.id.slice(0, 8)}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{contract.fullName} - {contract.carType}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start">
                    {(() => {
                      let status = contract.bookingStatus || 'active';
                      if (status === 'active' && contract.rentalEndDate) {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        if (new Date(contract.rentalEndDate) < today) {
                          status = 'completed';
                        }
                      }
                      return (
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                          status === 'active' ? 'bg-blue-100 text-blue-700' :
                          status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-neutral-100 text-neutral-700'
                        }`}>
                          {status === 'active' ? 'نشط' :
                           status === 'completed' ? 'مكتمل' : 'ملغي'}
                        </span>
                      );
                    })()}
                    <span className="text-[10px] text-neutral-400 mt-1 italic">
                      {contract.createdAt?.toDate ? contract.createdAt.toDate().toLocaleDateString('ar-EG') : ''}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-neutral-400 italic text-sm">
                لا توجد عقود مؤخرة
              </div>
            )}
          </div>
        </section>

        <section className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm text-right">
          <div className="flex items-center justify-between mb-6 flex-row-reverse">
            <h2 className="text-xl font-bold">تنبيهات الأسطول</h2>
            <AlertTriangle className="text-orange-500" size={20} />
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-orange-100 bg-orange-50/30 flex gap-4 flex-row-reverse text-right">
              <Clock className="text-orange-600 mt-0.5" size={18} />
              <div>
                <p className="font-bold text-sm text-orange-900 italic">موعد صيانة مجدول</p>
                <p className="text-xs text-orange-700/80">هيونداي إلنترا (LMN-5678) تحتاج لتغيير زيت اليوم.</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/30 flex gap-4 text-xs font-medium text-blue-900 leading-relaxed text-right">
              أسطولك يعمل بنسبة إشغال 82% هذا الأسبوع. أداء ممتاز!
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ContractsView and its associated Modal have been removed.


function CompaniesView({ onNavigate, isSuperAdmin, currentUser }: { onNavigate: (tab: ActiveTab) => void, isSuperAdmin: boolean, currentUser: any }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending'>('all');

  useEffect(() => {
    const q = query(collection(db, 'companies')); // Removed orderBy to prevent missing docs without createdAt
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
      docs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setCompanies(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'companies');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [isSendingMessage, setIsSendingMessage] = useState<{ id: string, name: string } | null>(null);
  const [msgTitle, setMsgTitle] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'warning' | 'success'>('info');
  const [isSubmittingMsg, setIsSubmittingMsg] = useState(false);

  const [isEditingSubscription, setIsEditingSubscription] = useState<Company | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState({ 
    name: '', 
    handle: '', 
    phoneNumber: '', 
    address: '', 
    subscriptionPlan: 'starter' as 'starter' | 'pro' | 'enterprise',
    logoUrl: '',
    accentColor: '#000000'
  });
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean, company: Company | null, mode: 'create' | 'update' | 'update-email' }>({ 
    isOpen: false, 
    company: null, 
    mode: 'create' 
  });
  const [accForm, setAccForm] = useState({ email: '', password: '', fullName: '', companyName: '', accessCode: '', newEmail: '' });
  const [isSubmittingAcc, setIsSubmittingAcc] = useState(false);

  const handleAccountAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountModal.company) return;

    setIsSubmittingAcc(true);
    try {
      if (accountModal.mode === 'create') {
        const response = await api.register({
          email: accForm.email,
          password: accForm.password,
          fullName: accForm.fullName
        });
        
        await setDoc(doc(db, 'staff', response.user.id), {
          companyId: accountModal.company.id,
          fullName: accForm.fullName,
          email: accForm.email,
          role: 'admin',
          createdAt: serverTimestamp()
        });

        if (accForm.accessCode) {
          await updateDoc(doc(db, 'companies', accountModal.company.id), {
            accessCode: accForm.accessCode
          });
        }
        
        toast.success('تم إنشاء الحساب بنجاح');
      } else if (accountModal.mode === 'update') {
        toast.success('تمت إعادة تعيين كلمة المرور (محاكاة)');
      } else if (accountModal.mode === 'update-email') {
        toast.error('لا يمكن تغيير البريد الإلكتروني لأسباب أمنية.');
      }

      setAccountModal({ ...accountModal, isOpen: false });
      setAccForm({ email: '', password: '', fullName: '', companyName: '', accessCode: '', newEmail: '' });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setIsSubmittingAcc(false);
    }
  };

  const generateMissingHandles = async () => {
    if (!window.confirm('هل أنت متأكد من توليد معرفات لجميع الشركات التي لا تملك معرفاً؟')) return;
    setIsMigrating(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'companies'));
      let updatedCount = 0;

      for (const companyDoc of querySnapshot.docs) {
        const data = companyDoc.data();
        if (!data.handle) {
          const generatedHandle = data.name
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '') + '_' + Math.floor(1000 + Math.random() * 9000);
          
          await updateDoc(doc(db, 'companies', companyDoc.id), {
            handle: generatedHandle
          });
          updatedCount++;
        }
      }
      toast.success(`تم تحديث ${updatedCount} شركة بنجاح`);
    } catch (error) {
      console.error(error);
      toast.error('فشل عملية التحديث');
    } finally {
      setIsMigrating(false);
    }
  };

  const toggleApproval = async (companyId: string, currentStatus: boolean) => {
    console.log("ToggleApproval:", { companyId, currentStatus, newStatus: !currentStatus });
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        approved: !currentStatus
      });
      toast.success(currentStatus ? 'تم إلغاء موافقة الشركة' : 'تمت الموافقة على الشركة بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'companies');
    }
  };

  const updateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingSubscription) return;
    
    try {
      await updateDoc(doc(db, 'companies', isEditingSubscription.id), {
        subscriptionPlan: isEditingSubscription.subscriptionPlan,
        subscriptionStatus: isEditingSubscription.subscriptionStatus
      });
      toast.success('تم تحديث بيانات الاشتراك بنجاح');
      setIsEditingSubscription(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'companies');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSendingMessage || !msgTitle || !msgBody) return;

    setIsSubmittingMsg(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        companyId: isSendingMessage.id,
        title: msgTitle,
        message: msgBody,
        type: msgType,
        readBy: [],
        createdAt: serverTimestamp()
      });
      toast.success(`تم إرسال الرسالة إلى ${isSendingMessage.name}`);
      setIsSendingMessage(null);
      setMsgTitle('');
      setMsgBody('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setIsSubmittingMsg(false);
    }
  };

  const deleteCompany = async (companyId: string, companyName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف شركة "${companyName}" نهائياً؟ سيؤدي هذا لتدمير جميع بياناتها.`)) return;
    try {
      // 1. Delete company itself first (rules rely on staff docs existing for some users)
      await deleteDoc(doc(db, 'companies', companyId));

      // 2. Delete associated staff
      const staffQuery = query(collection(db, 'staff'), where('companyId', '==', companyId));
      const staffDocs = await getDocs(staffQuery);
      for (const d of staffDocs.docs) {
        await deleteDoc(d.ref);
      }
      
      toast.success('تم حذف الشركة وجميع الموظفين بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'companies');
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyForm.name || !newCompanyForm.handle) return;
    
    // Check if handle is unique (basic check against local state)
    if (companies.some(c => c.handle === newCompanyForm.handle.toLowerCase())) {
      return toast.error('هذا المعرف مستخدم بالفعل');
    }

    try {
      await addDoc(collection(db, 'companies'), {
        ...newCompanyForm,
        adminEmail: (currentUser?.email || '').toLowerCase().trim(),
        handle: newCompanyForm.handle.toLowerCase().replace(/\s+/g, '_'),
        approved: true,
        subscriptionStatus: 'active',
        createdAt: serverTimestamp()
      });
      toast.success('تمت إضافة الشركة بنجاح');
      setIsAddingCompany(false);
      setNewCompanyForm({ 
        name: '', 
        handle: '', 
        phoneNumber: '', 
        address: '', 
        subscriptionPlan: 'starter',
        logoUrl: '',
        accentColor: '#000000'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'companies');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 200, 200, 0.8);
      setNewCompanyForm({ ...newCompanyForm, logoUrl: compressed });
    } catch (error) {
      toast.error('فشل معالجة الشعار');
    }
  };

  return (
    <div className="space-y-6 text-right">
      {/* Account Assignment Modal */}
      <Modal 
        isOpen={accountModal.isOpen} 
        onClose={() => setAccountModal({ ...accountModal, isOpen: false })} 
        title={accountModal.mode === 'create' ? `إعداد حساب لشركة ${accountModal.company?.name}` : accountModal.mode === 'update' ? `تحديث كلمة مرور شركة ${accountModal.company?.name}` : `تحديث بريد شركة ${accountModal.company?.name}`}
      >
        <form onSubmit={handleAccountAction} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">البريد الإلكتروني</label>
            <input 
              required
              type="email"
              value={accForm.email}
              onChange={e => setAccForm({ ...accForm, email: e.target.value })}
              className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
              placeholder="admin@company.com"
              disabled={accountModal.mode === 'update'}
            />
          </div>
          {accountModal.mode === 'update-email' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-400">البريد الإلكتروني الجديد</label>
              <input 
                required
                type="email"
                value={accForm.newEmail}
                onChange={e => setAccForm({ ...accForm, newEmail: e.target.value })}
                className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
                placeholder="newadmin@company.com"
              />
            </div>
          )}
          {accountModal.mode === 'create' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-400">الاسم الكامل للمدير</label>
              <input 
                required
                value={accForm.fullName}
                onChange={e => setAccForm({ ...accForm, fullName: e.target.value })}
                className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
                placeholder="فلان الفلاني"
              />
            </div>
          )}
          {accountModal.mode === 'create' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-400 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                اسم الشركة
              </label>
              <input 
                required
                value={accForm.companyName}
                onChange={e => setAccForm({ ...accForm, companyName: e.target.value })}
                className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
                placeholder="اسم الشركة"
              />
            </div>
          )}
          {accountModal.mode !== 'update-email' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-400">كلمة المرور أو رمز الدخول</label>
              <input 
                required
                type="text"
                value={accForm.password}
                onChange={e => setAccForm({ ...accForm, password: e.target.value })}
                className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
                placeholder="********"
              />
            </div>
          )}
          {accountModal.mode === 'create' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-400">رمز الوصول (اختياري)</label>
              <input 
                type="text"
                value={accForm.accessCode || ''}
                onChange={e => setAccForm({ ...accForm, accessCode: e.target.value })}
                className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
                placeholder="أدخل رمز دخول خاص للشركة"
              />
            </div>
          )}
          <button 
            type="submit" 
            disabled={isSubmittingAcc}
            className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold shadow-xl hover:bg-neutral-800 transition-colors mt-4 disabled:opacity-50"
          >
            {isSubmittingAcc ? 'جاري التنفيذ...' : (accountModal.mode === 'create' ? 'إنشاء الحساب' : 'تحديث كلمة المرور')}
          </button>
        </form>
      </Modal>

      <Modal 
        isOpen={!!isSendingMessage} 
        onClose={() => setIsSendingMessage(null)} 
        title={`إرسال رسالة إلى ${isSendingMessage?.name}`}
      >
        <form onSubmit={handleSendMessage} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">عنوان الرسالة</label>
            <input 
              required
              value={msgTitle}
              onChange={e => setMsgTitle(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
              placeholder="مثلاً: تنبيه بخصوص الحساب"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">نوع الرسالة</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'success'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMsgType(t)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    msgType === t 
                      ? (t === 'info' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' :
                         t === 'warning' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' :
                         'bg-emerald-600 text-white shadow-lg shadow-emerald-100')
                      : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
                  }`}
                >
                  {t === 'info' ? 'معلومات' : t === 'warning' ? 'تنبيه' : 'نجاح'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">نص الرسالة</label>
            <textarea 
              required
              rows={4}
              value={msgBody}
              onChange={e => setMsgBody(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold resize-none"
              placeholder="اكتب تفاصيل الرسالة هنا..."
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmittingMsg}
            className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-xl"
          >
            {isSubmittingMsg ? 'جاري الإرسال...' : <><Send size={18} /> إرسال الآن</>}
          </button>
        </form>
      </Modal>
      <header className="flex flex-col-reverse sm:flex-row-reverse sm:items-center justify-between gap-6">
        <div className="text-right">
          <h2 className="text-3xl font-black italic text-neutral-900">إدارة الشركات</h2>
          <p className="text-neutral-500 mt-1">التحكم في صلاحيات الوصول للشركات المسجلة.</p>
        </div>
        <div className="flex flex-wrap gap-4 items-center justify-end">
          <button 
            onClick={() => setIsAddingCompany(true)}
            className="w-full sm:w-auto bg-neutral-900 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus size={24} />
            إضافة شركة جديدة
          </button>
          <button 
            onClick={generateMissingHandles}
            disabled={isMigrating}
            className="hidden md:flex bg-blue-600 text-white px-5 py-3 rounded-2xl font-bold items-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/10 text-xs"
          >
            {isMigrating ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Settings size={16} />
            )}
            تحديث المعرفات
          </button>
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text"
              placeholder="ابحث عن شركة..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pr-12 pl-4 py-3 bg-white dark:bg-neutral-900 dark:text-white border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 w-64 text-sm font-bold transition-colors"
            />
          </div>
          <div className="hidden md:flex gap-4">
            <button 
              onClick={() => setFilterStatus(filterStatus === 'approved' ? 'all' : 'approved')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-bold ring-1 transition-all ${
                filterStatus === 'approved' 
                ? 'bg-emerald-600 text-white ring-emerald-600' 
                : 'bg-emerald-50 text-emerald-600 ring-emerald-100 hover:bg-emerald-100'
              }`}
            >
               نشط: {companies.filter(c => c.approved).length}
            </button>
            <button 
              onClick={() => setFilterStatus(filterStatus === 'pending' ? 'all' : 'pending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-bold ring-1 transition-all ${
                filterStatus === 'pending'
                ? 'bg-orange-600 text-white ring-orange-600'
                : 'bg-orange-50 text-orange-600 ring-orange-100 hover:bg-orange-100'
              }`}
            >
               طلب معلق: {companies.filter(c => !c.approved).length}
            </button>
          </div>
        </div>
      </header>

      <Modal 
        isOpen={!!isEditingSubscription} 
        onClose={() => setIsEditingSubscription(null)} 
        title="تعديل باقة الاشتراك"
      >
        {isEditingSubscription && (
          <form onSubmit={updateSubscription} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase italic">باقة الاشتراك</label>
              <select 
                value={isEditingSubscription.subscriptionPlan}
                onChange={e => setIsEditingSubscription({...isEditingSubscription, subscriptionPlan: e.target.value as any})}
                className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none font-bold"
              >
                <option value="starter">STARTER (مبتدئ)</option>
                <option value="pro">PRO (احترافي)</option>
                <option value="enterprise">ENTERPRISE (مؤسسات)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase italic">حالة الاشتراك</label>
              <div className="grid grid-cols-3 gap-2">
                {(['active', 'trial', 'expired'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setIsEditingSubscription({...isEditingSubscription, subscriptionStatus: s})}
                    className={`py-3 rounded-xl text-[10px] font-bold transition-all ${
                      isEditingSubscription.subscriptionStatus === s
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
                    }`}
                  >
                    {s === 'active' ? 'نشط' : s === 'trial' ? 'تجريبي' : 'منتهي'}
                  </button>
                ))}
              </div>
            </div>
            <button className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold hover:bg-neutral-800 transition-colors shadow-xl">
              حفظ التغييرات
            </button>
          </form>
        )}
      </Modal>

      <Modal isOpen={isAddingCompany} onClose={() => setIsAddingCompany(false)} title="إضافة شركة جديدة">
        <form onSubmit={handleAddCompany} className="space-y-4 text-right">
          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="w-24 h-24 bg-neutral-50 dark:bg-neutral-900 rounded-[32px] border-2 border-dashed border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden">
                {newCompanyForm.logoUrl ? (
                  <img src={newCompanyForm.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" />
                ) : (
                  <Building2 className="text-neutral-300" size={32} />
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              <div className="absolute -bottom-2 -right-2 bg-neutral-900 text-white p-2 rounded-xl shadow-lg pointer-events-none group-hover:scale-110 transition-transform">
                <Camera size={14} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase italic">اسم الشركة</label>
              <input 
                required
                value={newCompanyForm.name}
                onChange={e => setNewCompanyForm({...newCompanyForm, name: e.target.value})}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none font-bold"
                placeholder="اسم الشركة بالعربي..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase italic text-right">معرف النظام (Handle)</label>
              <input 
                required
                value={newCompanyForm.handle}
                onChange={e => setNewCompanyForm({...newCompanyForm, handle: e.target.value})}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none font-mono"
                placeholder="iraq_rental"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase italic">رقم الهاتف</label>
              <input 
                value={newCompanyForm.phoneNumber}
                onChange={e => setNewCompanyForm({...newCompanyForm, phoneNumber: e.target.value})}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none font-mono"
                placeholder="07xxxxxxxx"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-neutral-400 uppercase italic">باقة الاشتراك</label>
              <select 
                value={newCompanyForm.subscriptionPlan}
                onChange={e => setNewCompanyForm({...newCompanyForm, subscriptionPlan: e.target.value as any})}
                className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none font-bold appearance-none"
              >
                <option value="starter">الباقة الأساسية</option>
                <option value="pro">الباقة الاحترافية</option>
                <option value="enterprise">باقة الشركات</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase italic">لون هوية الشركة</label>
            <div className="flex gap-2">
              <input 
                type="color"
                value={newCompanyForm.accentColor}
                onChange={e => setNewCompanyForm({...newCompanyForm, accentColor: e.target.value})}
                className="w-20 h-14 bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none p-1 cursor-pointer"
              />
              <input 
                value={newCompanyForm.accentColor}
                onChange={e => setNewCompanyForm({...newCompanyForm, accentColor: e.target.value})}
                className="flex-1 p-4 bg-neutral-50 dark:bg-neutral-900 dark:text-white border border-neutral-100 dark:border-neutral-800 rounded-2xl outline-none font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-5 rounded-2xl font-black text-lg shadow-xl hover:translate-y-[-2px] active:translate-y-[0px] transition-all mt-4"
          >
            إنشاء الشركة الآن
          </button>
        </form>
      </Modal>

      <div className="bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-x-auto">
        <table className="w-full text-right border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-neutral-50/50 border-b border-neutral-100">
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">اسم الشركة</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">المعرف</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">رقم الهاتف</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">الحالة</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">الاشتراك</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">تاريخ التسجيل</th>
              <th className="px-8 py-5 text-xs font-bold text-neutral-400 uppercase tracking-widest italic text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {companies.filter(c => 
              (filterStatus === 'all' || 
               (filterStatus === 'approved' && c.approved) || 
               (filterStatus === 'pending' && !c.approved)) &&
              ((c.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
              (c.id || '').toLowerCase().includes((searchQuery || '').toLowerCase()))
            ).map(c => (
              <tr key={c.id} className="hover:bg-neutral-50/50 transition-colors">
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="font-bold">{c.name}</span>
                    <span className="text-[10px] text-neutral-400 font-mono tracking-tighter">{c.id}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                   <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">@{c.handle || 'N/A'}</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-mono text-xs">{c.phoneNumber || '-'}</span>
                    {c.phoneNumber && (
                      <button 
                        onClick={() => sendWhatsAppMessage(c.phoneNumber!, `مرحباً ${c.name}، نود التواصل معكم من إدارة منصة عراق رنتل.`)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <MessageSquare size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                    c.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {c.approved ? 'موافقة' : 'بانتظار الموافقة'}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <button 
                    onClick={() => setIsEditingSubscription(c)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg block w-fit hover:ring-2 hover:ring-blue-100 transition-all ${
                      c.subscriptionStatus === 'active' ? 'bg-blue-100 text-blue-700' : 
                      c.subscriptionStatus === 'trial' ? 'bg-neutral-100 text-neutral-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {c.subscriptionPlan.toUpperCase()} ({c.subscriptionStatus === 'active' ? 'نشط' : c.subscriptionStatus === 'trial' ? 'تجريبي' : 'منتهي'})
                  </button>
                </td>
                <td className="px-8 py-5 text-xs text-neutral-500">
                  {c.createdAt?.toDate ? c.createdAt.toDate().toLocaleDateString('ar-IQ') : '-'}
                </td>
                <td className="px-8 py-5 text-center flex items-center justify-center gap-2">
                  <button 
                    onClick={() => {
                      // Logic to open chat - for now we just switch tab
                      // In a real app we'd pass state to ChatsView
                      onNavigate('chats');
                    }}
                    title="مراسلة الشركة"
                    className="w-10 h-10 rounded-2xl bg-white border border-neutral-100 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-100 transition-all flex items-center justify-center active:scale-90 shadow-sm"
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button 
                    onClick={() => {
                        setAccountModal({ isOpen: true, company: c, mode: 'update-email' });
                        setAccForm({ email: '', password: '', fullName: c.name, companyName: c.name, accessCode: '', newEmail: '' });
                    }}
                    title="تعديل البريد الإلكتروني"
                    className="w-10 h-10 rounded-2xl bg-white border border-neutral-100 text-neutral-400 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-100 transition-all flex items-center justify-center active:scale-90 shadow-sm"
                  >
                    <Mail size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setAccountModal({ isOpen: true, company: c, mode: 'create' });
                      setAccForm({ email: '', password: '', fullName: c.name, companyName: c.name, accessCode: '', newEmail: '' });
                    }}
                    title="إنشاء حساب مدير"
                    className="w-10 h-10 rounded-2xl bg-white border border-neutral-100 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 transition-all flex items-center justify-center active:scale-90 shadow-sm"
                  >
                    <UserPlus size={18} />
                  </button>
                  <button 
                    onClick={() => {
                      setAccountModal({ isOpen: true, company: c, mode: 'update' });
                      setAccForm({ email: '', password: '', fullName: c.name, companyName: c.name, accessCode: '', newEmail: '' });
                    }}
                    title="تحديث كلمة المرور"
                    className="w-10 h-10 rounded-2xl bg-white border border-neutral-100 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 hover:border-orange-100 transition-all flex items-center justify-center active:scale-90 shadow-sm"
                  >
                    <Key size={18} />
                  </button>
                  <button 
                    onClick={() => setIsSendingMessage({ id: c.id, name: c.name })}
                    title="إرسال تنبيه للنظام"
                    className="w-10 h-10 rounded-2xl bg-white border border-neutral-100 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-100 transition-all flex items-center justify-center active:scale-90 shadow-sm"
                  >
                    <Bell size={18} />
                  </button>
                  <button 
                    onClick={() => toggleApproval(c.id, c.approved)}
                    title={c.approved ? "إلغاء الموافقة" : "موافقة"}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm ${
                      c.approved 
                        ? 'bg-neutral-100 text-neutral-400 hover:bg-orange-50 hover:text-orange-600' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                    }`}
                  >
                    {c.approved ? <ShieldAlert size={20} /> : <UserCheck size={20} />}
                  </button>
                  <button 
                    onClick={() => deleteCompany(c.id, c.name)}
                    title="حذف الشركة"
                    className="w-10 h-10 rounded-2xl bg-white border border-neutral-100 text-neutral-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-all flex items-center justify-center active:scale-90 shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-8 py-10 text-center text-neutral-400 italic">لا توجد شركات مسجلة حالياً</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsView({ company, staff, currentUser }: { company: Company | null, staff: StaffProfile | null, currentUser: any }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl || '');
  const [bannerUrl, setBannerUrl] = useState(company?.bannerUrl || '');
  const [accentColor, setAccentColor] = useState(company?.accentColor || '#3b82f6');
  const [companyAddress, setCompanyAddress] = useState(company?.address || '');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState({
    fullName: staff?.fullName || '',
    phoneNumber: staff?.phoneNumber || ''
  });
  const [companyName, setCompanyName] = useState(company?.name || '');
  const [companyPhone, setCompanyPhone] = useState(company?.phoneNumber || '');

  useEffect(() => {
    if (company?.logoUrl) setLogoUrl(company.logoUrl);
    if (company?.bannerUrl) setBannerUrl(company.bannerUrl);
    if (company?.accentColor) setAccentColor(company.accentColor);
    if (company?.name) setCompanyName(company.name);
    if (company?.phoneNumber) setCompanyPhone(company.phoneNumber);
    if (company?.address) setCompanyAddress(company.address);
  }, [company]);

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (staff?.role !== 'admin') {
      toast.error('عذراً، فقط مدير الشركة يمكنه تغيير شعار الشركة');
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await compressImage(file, 400, 400, 0.7);
      setLogoUrl(dataUrl);
      await saveCompanyInfo(dataUrl, bannerUrl, accentColor, companyAddress, companyName, companyPhone);
    }
  };

  const handleBannerSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (staff?.role !== 'admin') {
      toast.error('عذراً، فقط مدير الشركة يمكنه تغيير غلاف الشركة');
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await compressImage(file, 1200, 400, 0.7);
      setBannerUrl(dataUrl);
      await saveCompanyInfo(logoUrl, dataUrl, accentColor, companyAddress, companyName, companyPhone);
    }
  };


  const saveCompanyInfo = async (logo: string, banner: string, color: string, address: string, name: string, phone: string) => {
    if (!company) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'companies', company.id), {
        logoUrl: logo,
        bannerUrl: banner,
        accentColor: color,
        address: address,
        name: name,
        phoneNumber: phone,
        updatedAt: serverTimestamp()
      });
      toast.success('تم تحديث بيانات الشركة بنجاح');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء الحفظ');
      handleFirestoreError(error, OperationType.UPDATE, 'companies');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (accentColor && accentColor !== company?.accentColor) {
      const timer = setTimeout(() => {
        saveCompanyInfo(logoUrl, bannerUrl, accentColor, companyAddress, companyName, companyPhone);
      }, 1000); // Debounce to avoid constant saves
      return () => clearTimeout(timer);
    }
  }, [accentColor]);

  const handleUpdateCompanyDesign = async () => {
    await saveCompanyInfo(logoUrl, bannerUrl, accentColor, companyAddress, companyName, companyPhone);
  };

  const handleUpdateProfile = async () => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'staff', uid), {
        ...staff,
        fullName: profileData.fullName,
        phoneNumber: profileData.phoneNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('تم تحديث الملف الشخصي بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'staff');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!company) return;
    if (confirmName !== company.name) {
      return toast.error('اسم الشركة غير متطابق');
    }

    if (!window.confirm('بعد الحذف لا يمكن استعادة البيانات نهائياً. هل أنت متأكد؟')) return;

    try {
      setIsDeleting(true);
      
      // 1. Delete company first (security rules rely on staff doc existing)
      await deleteDoc(doc(db, 'companies', company.id));

      // 2. Delete all associated staff
      const staffQuery = query(collection(db, 'staff'), where('companyId', '==', company.id));
      const staffDocs = await getDocs(staffQuery);
      for (const d of staffDocs.docs) {
        await deleteDoc(d.ref);
      }
      
      toast.success('تم حذف الشركة بنجاح');
      signOut(auth);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'companies');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-10 text-right max-w-4xl mx-auto">
      <header>
        <h2 className="text-3xl font-black italic text-neutral-900 dark:text-white flex items-center justify-end gap-3">
          إعدادات الحساب
          <Settings className="text-blue-600 dark:text-blue-400" size={32} />
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">إدارة معلومات شركتك وإعدادات النظام.</p>
      </header>

      <div className="bg-white dark:bg-neutral-800 p-8 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm mb-8">
        <h3 className="text-lg font-bold mb-6 text-right dark:text-white">هوية الشركة البصرية</h3>
        
        <div className="space-y-8">
          <div>
            <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-4 block italic">شعار الشركة</label>
            <div className="flex flex-col items-center gap-4">
              <div 
                onClick={() => logoInputRef.current?.click()}
                className="w-40 h-40 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center cursor-pointer overflow-hidden group relative transition-all hover:border-blue-400 dark:hover:border-blue-500"
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Preview" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-neutral-400 group-hover:text-blue-500">
                    <Image size={40} />
                    <span className="text-[10px] font-bold uppercase">اختر الشعار</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors flex items-center justify-center">
                  <Camera size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <input type="file" ref={logoInputRef} onChange={handleLogoSelect} accept="image/*" className="hidden" />
            </div>
          </div>

          <div>
            <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-4 block italic">صورة الغلاف (Banner)</label>
            <div 
              onClick={() => bannerInputRef.current?.click()}
              className="w-full h-40 rounded-[32px] border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center cursor-pointer overflow-hidden group relative transition-all hover:border-blue-400 dark:hover:border-blue-500"
            >
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-neutral-400 group-hover:text-blue-500">
                  <Image size={40} />
                  <span className="text-[10px] font-bold uppercase">اختر صورة الغلاف</span>
                </div>
              )}
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors flex items-center justify-center">
                <Camera size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <input type="file" ref={bannerInputRef} onChange={handleBannerSelect} accept="image/*" className="hidden" />
          </div>

          <div>
            <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-4 block italic">لون التمييز (Accent Color)</label>
            <div className="flex items-center gap-4 flex-row-reverse">
              <div className="flex-1 grid grid-cols-5 md:grid-cols-10 gap-2">
                {['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#71717a', '#171717', '#d946ef'].map(color => (
                  <button
                    key={color}
                    onClick={() => setAccentColor(color)}
                    className={`w-10 h-10 rounded-full border-4 transition-all ${accentColor === color ? 'border-neutral-900 scale-110 shadow-lg' : 'border-white dark:border-neutral-700 shadow-sm'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <input 
                  type="color" 
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-none p-0 bg-transparent"
                />
                <span className="text-[10px] font-mono font-bold text-neutral-400">{accentColor.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col md:flex-row gap-4">
             <div className="flex-1">
                 <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-4 block italic">اسم الشركة</label>
                 <input
                   type="text"
                   value={companyName}
                   onChange={e => setCompanyName(e.target.value)}
                   className="w-full bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 p-4 rounded-2xl focus:border-neutral-900 outline-none font-bold text-right text-neutral-900 dark:text-white shadow-sm"
                   placeholder="اسم الشركة..."
                 />
             </div>
             <div className="flex-1">
                 <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-4 block italic">رقم الهاتف (الشركة)</label>
                 <input
                   type="tel"
                   value={companyPhone}
                   onChange={e => setCompanyPhone(e.target.value)}
                   className="w-full bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 p-4 rounded-2xl focus:border-neutral-900 outline-none font-bold text-right text-neutral-900 dark:text-white shadow-sm"
                   placeholder="رقم الهاتف..."
                   dir="ltr"
                 />
             </div>
          </div>
          <div className="pt-4">
             <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-4 block italic">عنوان الشركة</label>
             <input
               type="text"
               value={companyAddress}
               onChange={e => setCompanyAddress(e.target.value)}
               className="w-full bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 p-4 rounded-2xl focus:border-neutral-900 outline-none font-bold text-right text-neutral-900 dark:text-white shadow-sm"
               placeholder="أدخل عنوان الشركة..."
             />
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              onClick={handleUpdateCompanyDesign}
              disabled={isUpdating || (logoUrl === company?.logoUrl && bannerUrl === company?.bannerUrl && accentColor === company?.accentColor && companyAddress === (company?.address || '') && companyName === (company?.name || '') && companyPhone === (company?.phoneNumber || ''))}
              className="bg-neutral-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-neutral-800 transition-all shadow-lg disabled:opacity-50"
            >
              {isUpdating ? 'جاري الحفظ...' : 'حفظ تغييرات الهوية'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 p-8 rounded-[32px] border border-neutral-100 dark:border-neutral-700 shadow-sm mb-8">
        <h3 className="text-lg font-bold mb-6 text-right dark:text-white">الملف الشخصي للمالك</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-right">
            <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-2 block italic">الاسم الكامل للمدير</label>
            <input 
              type="text"
              value={profileData.fullName}
              onChange={e => setProfileData({...profileData, fullName: e.target.value})}
              className="w-full bg-white border-2 border-neutral-300 p-4 rounded-2xl focus:border-neutral-900 outline-none font-bold text-right text-neutral-900 shadow-sm"
              placeholder="الاسم الكامل..."
            />
          </div>
          <div className="text-right">
            <label className="text-xs font-black text-neutral-800 dark:text-neutral-200 uppercase mb-2 block italic">رقم الهاتف الشخصي</label>
            <input 
              type="text"
              value={profileData.phoneNumber}
              onChange={e => setProfileData({...profileData, phoneNumber: e.target.value})}
              className="w-full bg-white border-2 border-neutral-300 p-4 rounded-2xl focus:border-neutral-900 outline-none font-bold text-right text-neutral-900 shadow-sm"
              placeholder="07xxxxxxxx..."
              dir="ltr"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button 
            onClick={handleUpdateProfile}
            disabled={isUpdating}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            {isUpdating ? 'جاري التحديث...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {company && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[32px] border border-neutral-100 shadow-sm">
            <h3 className="text-lg font-bold mb-6 text-right">معلومات الشركة</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase italic">اسم الشركة</p>
                <p className="text-xl font-black">{company.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase italic">معرف الشركة (ID)</p>
                <p className="text-xl font-mono text-blue-600" dir="ltr">@{company.handle || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase italic">رقم الهاتف</p>
                <p className="text-xl font-mono" dir="ltr">{company.phoneNumber || 'غير مسجل'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase italic">نوع الاشتراك</p>
                <p className="text-xl font-bold text-blue-600">{company.subscriptionPlan.toUpperCase()}</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-8 rounded-[32px] border border-red-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-red-900 mb-2 text-right">منطقة الخطر</h3>
              <p className="text-sm text-red-600/70 mb-6 leading-relaxed">حذف الشركة سيؤدي لتدمير جميع العقود والعملاء والبيانات المسجلة نهائياً.</p>
            </div>
            
            <div className="space-y-4">
              <label className="text-xs font-black text-red-900 mb-2 block italic uppercase">لتأكيد الحذف النهائي اكتب اسم الشركة</label>
              <input 
                type="text"
                placeholder={`اكتب "${company.name}" ...`}
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                className="w-full bg-white border-2 border-red-300 p-4 rounded-2xl focus:border-red-600 outline-none font-bold text-right text-neutral-900 shadow-sm"
              />
              <button 
                onClick={handleDeleteCompany}
                disabled={isDeleting || confirmName !== company.name}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black italic flex items-center justify-center gap-2 hover:bg-red-700 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-xl shadow-red-100"
              >
                <Trash2 size={18} />
                {isDeleting ? 'جاري الحذف...' : 'تدمير بيانات الشركة نهائياً'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GPSView({ staff }: { staff: StaffProfile | null }) {
  // Mock data for cars
  const [cars] = useState([
    { id: '1', name: 'Toyota Camry 2024', plate: 'بغداد 12345', lat: 33.3152, lng: 44.3661, status: 'moving' },
    { id: '2', name: 'Hyundai Elantra 2023', plate: 'أربيل 67890', lat: 33.3252, lng: 44.3761, status: 'stopped' },
    { id: '3', name: 'Kia Sportage 2024', plate: 'البصرة 11223', lat: 33.3052, lng: 44.3561, status: 'moving' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-row-reverse">
        <div>
          <h2 className="text-3xl font-black italic text-neutral-900">تتبع الأسطول المباشر</h2>
          <p className="text-neutral-500 text-sm mt-1">مراقبة لحظية لمواقع وحالة حركة السيارات (عبر Leaflet المجانية)</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-xs font-bold ring-1 ring-emerald-100 animate-pulse">
          <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
          بث مباشر
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 h-[600px] rounded-3xl overflow-hidden border border-neutral-200 shadow-2xl relative z-0">
          <MapContainer 
            center={[33.3152, 44.3661]} 
            zoom={13} 
            scrollWheelZoom={true}
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {cars.map(car => (
              <Marker key={car.id} position={[car.lat, car.lng]}>
                <Popup>
                  <div className="text-right font-sans">
                    <p className="font-bold">{car.name}</p>
                    <p className="text-xs">{car.plate}</p>
                    <p className={`text-[10px] font-bold ${car.status === 'moving' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {car.status === 'moving' ? 'متحركة' : 'متوقفة'}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <div className="bg-white/90 backdrop-blur shadow-lg border border-neutral-200 p-2 rounded-xl flex gap-4 text-xs font-bold">
              <div className="flex items-center gap-2 flex-row-reverse">
                <span className="w-3 h-3 bg-emerald-500 rounded-full"></span>
                <span>تتحرك</span>
              </div>
              <div className="flex items-center gap-2 flex-row-reverse border-r pr-4 border-neutral-200">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span>متوقفة</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-black text-lg text-neutral-900 text-right mb-4">قائمة السيارات</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {cars.map(car => (
              <div key={car.id} className="bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all hover:-translate-x-1 cursor-pointer text-right group">
                <div className="flex items-start justify-between flex-row-reverse">
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">{car.name}</p>
                    <p className="text-xs text-neutral-400 font-mono mt-0.5 tracking-wider">{car.plate}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${car.status === 'moving' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {car.status === 'moving' ? 'MOVING' : 'STOPPED'}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-neutral-500 bg-neutral-50 p-2 rounded-xl">
                  <span className="flex items-center gap-1 flex-row-reverse">
                    <Navigation size={10} className="text-blue-500" />
                    سرعة: {car.status === 'moving' ? '45 كم/س' : '0 كم/س'}
                  </span>
                  <span className="flex items-center gap-1 flex-row-reverse border-r pr-2 border-neutral-200">
                     إشارة: قوية
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <button className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors mt-auto">
            <Plus size={18} />
            إضافة جهاز تتبع
          </button>
        </div>
      </div>
    </div>
  );
}

function EmploymentView() {
  const [tasks, setTasks] = useState<SystemTask[]>([]);
  const [assistants, setAssistants] = useState<(StaffProfile & { id: string })[]>([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium' as any, assignedTo: '' });
  const [assistantForm, setAssistantForm] = useState({ fullName: '', phoneNumber: '', role: 'staff' as any, email: '' });

  useEffect(() => {
    // Fetch tasks
    const qTasks = query(collection(db, 'system_tasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemTask)));
    }, error => handleFirestoreError(error, OperationType.LIST, 'system_tasks'));

    // Fetch assistants (staff with companyId 'SYSTEM')
    const qAssistants = query(collection(db, 'staff'), where('companyId', '==', 'SYSTEM'));
    const unsubscribeAssistants = onSnapshot(qAssistants, (snapshot) => {
      setAssistants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffProfile & { id: string })));
    }, error => handleFirestoreError(error, OperationType.LIST, 'staff'));

    return () => {
      unsubscribeTasks();
      unsubscribeAssistants();
    };
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assignedName = assistants.find(a => a.id === taskForm.assignedTo)?.fullName || 'غير معين';
      await addDoc(collection(db, 'system_tasks'), {
        ...taskForm,
        assignedName,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setIsTaskModalOpen(false);
      setTaskForm({ title: '', description: '', priority: 'medium', assignedTo: '' });
      toast.success('تم إضافة المهمة بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'system_tasks');
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'system_tasks', taskId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system_tasks');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المهمة؟')) return;
    try {
      await deleteDoc(doc(db, 'system_tasks', taskId));
      toast.success('تم حذف المهمة');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'system_tasks');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-right">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3 justify-end">
            التوظيف والمهام
            <UserCheck className="text-blue-600" size={32} />
          </h2>
          <p className="text-neutral-500 mt-1">إدارة المساعدين والمهام الخاصة بالمالك العام.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button 
            onClick={() => setIsAssistantModalOpen(true)}
            className="bg-white text-neutral-900 border border-neutral-200 px-6 py-3 rounded-2xl font-bold hover:bg-neutral-50 transition-all shadow-sm flex items-center gap-2"
          >
            <UserPlus size={20} />
            إضافة مساعد
          </button>
          <button 
            onClick={() => setIsTaskModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Plus size={20} />
            مهمة جديدة
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Tasks List */}
        <div className="xl:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-right flex items-center gap-2 justify-end">
            المهام النشطة
            <Clock size={20} className="text-blue-500" />
          </h3>
          {tasks.length === 0 ? (
            <div className="bg-white p-12 rounded-[32px] border-2 border-dashed border-neutral-100 text-center">
              <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-300">
                <FileText size={32} />
              </div>
              <p className="text-neutral-400 font-medium">لا توجد مهام حالياً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(task => (
                <div key={task.id} className="bg-white p-6 rounded-[32px] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <button onClick={() => handleDeleteTask(task.id)} className="text-neutral-300 hover:text-red-500 transition-colors">
                      <Trash2 size={18} />
                    </button>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      task.priority === 'high' ? 'bg-red-50 text-red-600' :
                      task.priority === 'medium' ? 'bg-orange-50 text-orange-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {task.priority === 'high' ? 'أولوية عالية' : task.priority === 'medium' ? 'أولوية متوسطة' : 'أولوية عادية'}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold mb-2 text-right">{task.title}</h4>
                  <p className="text-neutral-500 text-sm mb-4 text-right line-clamp-2">{task.description}</p>
                  
                  <div className="flex items-center gap-2 justify-end mb-4">
                    <span className="text-xs font-bold text-neutral-400">{task.assignedName}</span>
                    <UserCircle size={16} className="text-neutral-300" />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => handleUpdateTaskStatus(task.id, 'completed')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                        task.status === 'completed' ? 'bg-green-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-green-50 hover:text-green-600'
                      }`}
                    >
                      مكتملة
                    </button>
                    <button 
                      onClick={() => handleUpdateTaskStatus(task.id, 'in_progress')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                        task.status === 'in_progress' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      قيد التنفيذ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assistants List */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-right flex items-center gap-2 justify-end">
            المساعدون المعينون
            <Users size={20} className="text-blue-500" />
          </h3>
          <div className="bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-hidden">
            {assistants.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-neutral-400 text-sm">لا يوجد مساعدون معينون بعد</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {assistants.map(assistant => (
                  <div key={assistant.id} className="p-4 flex items-center gap-3 flex-row-reverse text-right">
                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                      <User size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{assistant.fullName}</p>
                      <p className="text-[10px] text-neutral-400 italic">{assistant.phoneNumber}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-neutral-50 px-2 py-1 rounded-full text-neutral-500 capitalize">
                      {assistant.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl p-8 relative"
          >
            <button onClick={() => setIsTaskModalOpen(false)} className="absolute top-6 left-6 text-neutral-400 hover:text-neutral-900">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black mb-8 text-right">إضافة مهمة جديدة</h3>
            <form onSubmit={handleAddTask} className="space-y-6">
              <div className="text-right">
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">عنوان المهمة</label>
                <input 
                  required
                  value={taskForm.title}
                  onChange={e => setTaskForm({...taskForm, title: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-right"
                  placeholder="ما هي المهمة؟"
                />
              </div>
              <div className="text-right">
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">التفاصيل</label>
                <textarea 
                  required
                  rows={4}
                  value={taskForm.description}
                  onChange={e => setTaskForm({...taskForm, description: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-medium text-right resize-none"
                  placeholder="وصف مفصل للمهمة..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-right">
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">تعيين إلى</label>
                  <select 
                    value={taskForm.assignedTo}
                    onChange={e => setTaskForm({...taskForm, assignedTo: e.target.value})}
                    className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-right"
                  >
                    <option value="">غير معين</option>
                    {assistants.map(a => (
                      <option key={a.id} value={a.id}>{a.fullName}</option>
                    ))}
                  </select>
                </div>
                <div className="text-right">
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">الأولوية</label>
                  <select 
                    value={taskForm.priority}
                    onChange={e => setTaskForm({...taskForm, priority: e.target.value as any})}
                    className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-right"
                  >
                    <option value="high">عالية</option>
                    <option value="medium">متوسطة</option>
                    <option value="low">عادية</option>
                  </select>
                </div>
              </div>
              <button 
                type="submit"
                className="w-full bg-neutral-900 text-white py-5 rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl shadow-neutral-200 flex items-center justify-center gap-3 mt-4"
              >
                حفظ المهمة
                <CheckCircle2 size={24} />
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Assistant Modal */}
      {isAssistantModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white w-full max-w-md rounded-[40px] shadow-2xl p-8 relative"
          >
            <button onClick={() => setIsAssistantModalOpen(false)} className="absolute top-6 left-6 text-neutral-400 hover:text-neutral-900">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black mb-8 text-right">إضافة مساعد جديد</h3>
            <p className="text-neutral-400 text-sm mb-6 text-right font-medium">سيتم ربط المساعد بحساب "SYSTEM" الخاص بك.</p>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                // Here we would typically use an email/uid, but for now we'll just save the profile
                // In a real app, you'd need the assistant to log in and then assign them
                await addDoc(collection(db, 'staff'), {
                  ...assistantForm,
                  companyId: 'SYSTEM',
                  createdAt: serverTimestamp()
                });
                setIsAssistantModalOpen(false);
                setAssistantForm({ fullName: '', phoneNumber: '', role: 'staff', email: '' });
                toast.success('تم إضافة المساعد بنجاح');
              } catch (error) {
                handleFirestoreError(error, OperationType.CREATE, 'staff');
              }
            }} className="space-y-6">
              <div className="text-right">
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">الاسم الكامل</label>
                <input 
                  required
                  value={assistantForm.fullName}
                  onChange={e => setAssistantForm({...assistantForm, fullName: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-right"
                />
              </div>
              <div className="text-right">
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">رقم الهاتف</label>
                <input 
                  required
                  dir="ltr"
                  value={assistantForm.phoneNumber}
                  onChange={e => setAssistantForm({...assistantForm, phoneNumber: e.target.value})}
                  className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-right"
                  placeholder="07xxxxxxxx"
                />
              </div>
              <div className="text-right">
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block italic">الدور</label>
                <select 
                  value={assistantForm.role}
                  onChange={e => setAssistantForm({...assistantForm, role: e.target.value as any})}
                  className="w-full bg-neutral-50 border border-neutral-200 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-right"
                >
                  <option value="admin">مشرف مسئول</option>
                  <option value="manager">مدير مهام</option>
                  <option value="staff">مساعد إداري</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl"
              >
                تأكيد الإضافة
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function NotificationsView({ companyId, isSuperAdmin, currentUser }: { companyId: string, isSuperAdmin: boolean, currentUser: any }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = isSuperAdmin 
      ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50))
      : query(
          collection(db, 'notifications'), 
          where('companyId', 'in', [companyId, 'all']),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });

    return () => unsubscribe();
  }, [companyId, isSuperAdmin]);

  const markAsRead = async (notificationId: string, readBy: string[]) => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid || readBy.includes(uid)) return;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        readBy: arrayUnion(uid)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  };

  const deleteNotification = async (id: string) => {
    if (!isSuperAdmin) return;
    if (!window.confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('تم حذف الإشعار');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'notifications');
    }
  };

  const [isCreatingGlobal, setIsCreatingGlobal] = useState(false);
  const [globalTitle, setGlobalTitle] = useState('');
  const [globalBody, setGlobalBody] = useState('');
  const [globalType, setGlobalType] = useState<'info' | 'warning' | 'success'>('info');
  const [isSubmittingGlobal, setIsSubmittingGlobal] = useState(false);

  const handleSendGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalTitle || !globalBody) return;

    setIsSubmittingGlobal(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        companyId: 'all',
        title: globalTitle,
        message: globalBody,
        type: globalType,
        readBy: [],
        createdAt: serverTimestamp()
      });
      toast.success('تم إرسال الإشعار لجميع الشركات');
      setIsCreatingGlobal(false);
      setGlobalTitle('');
      setGlobalBody('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } finally {
      setIsSubmittingGlobal(false);
    }
  };

  return (
    <div className="space-y-6 text-right">
      <Modal 
        isOpen={isCreatingGlobal} 
        onClose={() => setIsCreatingGlobal(false)} 
        title="إرسال إشعار لجميع الشركات"
      >
        <form onSubmit={handleSendGlobal} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">عنوان الإشعار</label>
            <input 
              required
              value={globalTitle}
              onChange={e => setGlobalTitle(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold"
              placeholder="مثلاً: تحديث جديد في النظام"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">نوع الإشعار</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'success'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGlobalType(t)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                    globalType === t 
                      ? (t === 'info' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' :
                         t === 'warning' ? 'bg-orange-600 text-white shadow-lg shadow-orange-100' :
                         'bg-emerald-600 text-white shadow-lg shadow-emerald-100')
                      : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
                  }`}
                >
                  {t === 'info' ? 'معلومات' : t === 'warning' ? 'تنبيه' : 'نجاح'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-neutral-400">نص الإشعار</label>
            <textarea 
              required
              rows={4}
              value={globalBody}
              onChange={e => setGlobalBody(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold resize-none"
              placeholder="اكتب تفاصيل الإشعار هنا..."
            />
          </div>
          <button 
            type="submit"
            disabled={isSubmittingGlobal}
            className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-xl"
          >
            {isSubmittingGlobal ? 'جاري الإرسال...' : <><Send size={18} /> إرسال للكل</>}
          </button>
        </form>
      </Modal>
      
      {/* Add Company Modal removed from here as it should be in CompaniesView */}


      <header className="flex items-center justify-between flex-row-reverse">
        <div>
          <h2 className="text-3xl font-black italic text-neutral-900 flex items-center justify-end gap-3">
            مركز الإشعارات
            <Bell className="text-blue-600" size={32} />
          </h2>
          <p className="text-neutral-500 mt-1">آخر الأخبار والتنبيهات من إدارة المنصة.</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => setIsCreatingGlobal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={18} />
            إشعار عالمي
          </button>
        )}
      </header>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-neutral-400">جاري تحميل الإشعارات...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-[48px] p-20 text-center border border-neutral-100 shadow-sm">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300 mx-auto mb-6">
              <Bell size={40} />
            </div>
            <h3 className="text-xl font-bold text-neutral-400">لا توجد إشعارات حالياً</h3>
          </div>
        ) : (
          notifications.map(n => {
            const isRead = n.readBy?.includes(currentUser?.uid || currentUser?.id || '');
            return (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => markAsRead(n.id, n.readBy || [])}
                className={`bg-white p-6 rounded-[32px] border transition-all cursor-pointer group relative overflow-hidden ${
                  isRead ? 'border-neutral-100 opacity-75' : 'border-blue-100 shadow-lg shadow-blue-50/50 ring-1 ring-blue-50'
                }`}
              >
                {!isRead && (
                  <div className="absolute top-0 right-0 w-2 h-full bg-blue-600" />
                )}
                
                <div className="flex flex-col md:flex-row-reverse md:items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-end gap-2 text-xs font-bold mb-1">
                      <span className={`px-2 py-0.5 rounded-full ${
                        n.type === 'success' ? 'bg-emerald-100 text-emerald-700' :
                        n.type === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {n.type === 'success' ? 'نجاح' : n.type === 'warning' ? 'تنبيه' : 'معلومات'}
                      </span>
                      <span className="text-neutral-400 font-mono">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('ar-IQ') : ''}
                      </span>
                    </div>
                    <h4 className={`text-xl font-black ${isRead ? 'text-neutral-700' : 'text-neutral-900 group-hover:text-blue-600 transition-colors'}`}>
                      {n.title}
                    </h4>
                    <p className="text-neutral-500 leading-relaxed text-sm whitespace-pre-wrap">{n.message}</p>
                  </div>

                  {isSuperAdmin && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChatsView({ staff, isSuperAdmin }: { staff: StaffProfile | null, isSuperAdmin: boolean }) {
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const myCompanyId = isSuperAdmin ? 'SUPER_ADMIN_SYSTEM' : staff?.companyId;

  // Fetch my chats
  useEffect(() => {
    if (!myCompanyId) return;
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', myCompanyId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });

    return () => unsubscribe();
  }, [myCompanyId]);

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `chats/${selectedChat.id}/messages`),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      // More performant scroll
      requestAnimationFrame(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${selectedChat.id}/messages`);
    });

    return () => unsubscribe();
  }, [selectedChat]);

  // Fetch companies for starting new chat
  useEffect(() => {
    if (!showNewChatModal) return;
    const unsubscribe = onSnapshot(collection(db, 'companies'), (snapshot) => {
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
    });
    return () => unsubscribe();
  }, [showNewChatModal]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !myCompanyId) return;

    const messageText = newMessage;
    setNewMessage('');

    // Determine sender name
    const senderName = isSuperAdmin ? 'إدارة المنصة' : (selectedChat.names?.[myCompanyId] || (staff as any)?.companyName || 'شركتي');

    try {
      await addDoc(collection(db, `chats/${selectedChat.id}/messages`), {
        senderId: myCompanyId,
        senderName: senderName,
        text: messageText,
        timestamp: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: messageText,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${selectedChat.id}/messages`);
    }
  };

  const startNewChat = async (otherCompany?: Company) => {
    if (!myCompanyId) return;
    
    setLoading(true);
    try {
      if (!isGroupMode && otherCompany) {
        // Individual Chat
        const chatId = [myCompanyId, otherCompany.id].sort().join('_');
        const existingChat = chats.find(c => c.id === chatId);

        if (existingChat) {
          setSelectedChat(existingChat);
          setShowNewChatModal(false);
          return;
        }

        const chatData = {
          participants: [myCompanyId, otherCompany.id],
          type: 'individual',
          lastMessage: 'بدء المحادثة',
          updatedAt: serverTimestamp(),
          createdBy: myCompanyId,
          names: {
            [myCompanyId]: isSuperAdmin ? 'إدارة المنصة' : 'شركتي',
            [otherCompany.id]: otherCompany.name
          }
        };
        await setDoc(doc(db, 'chats', chatId), chatData);
        setSelectedChat({ id: chatId, ...chatData });
      } else {
        // Group Chat
        if (selectedParticipants.length < 1) {
          toast.error('يرجى اختيار شركة واحدة على الأقل');
          return;
        }
        if (!groupName.trim()) {
          toast.error('يرجى إدخال اسم للمجموعة');
          return;
        }

        const participants = Array.from(new Set([myCompanyId, ...selectedParticipants]));
        const chatData = {
          participants,
          type: 'group',
          name: groupName.trim(),
          lastMessage: 'تم إنشاء المجموعة',
          updatedAt: serverTimestamp(),
          createdBy: myCompanyId,
          names: {} // Can be populated if needed, but group has a Name
        };
        const docRef = await addDoc(collection(db, 'chats'), chatData);
        setSelectedChat({ id: docRef.id, ...chatData });
      }
      
      setShowNewChatModal(false);
      setSelectedParticipants([]);
      setGroupName('');
      setIsGroupMode(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    } finally {
      setLoading(false);
    }
  };

  const getChatDisplayName = (chat: any) => {
    if (chat.type === 'group') return chat.name || 'مجموعة بدون اسم';
    const otherId = chat.participants.find((id: string) => id !== myCompanyId);
    return chat.names?.[otherId] || 'مشاريع عراق رنتل';
  };

  return (
    <div className="flex h-[calc(100vh-140px)] lg:gap-6 text-right font-sans relative overflow-hidden">
      {/* Chats List */}
      <motion.div 
        initial={false}
        animate={{ 
          x: (selectedChat && window.innerWidth < 1024) ? '100%' : '0%',
          opacity: (selectedChat && window.innerWidth < 1024) ? 0 : 1
        }}
        className={`
          w-full lg:w-80 bg-white dark:bg-neutral-800 lg:rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm flex flex-col overflow-hidden
          ${selectedChat ? 'absolute lg:relative' : 'relative'}
        `}
      >
        <div className="p-4 lg:p-6 border-b border-neutral-50 dark:border-neutral-700">
          <div className="flex justify-between items-center flex-row-reverse mb-4">
            <h2 className="text-xl font-black text-neutral-900 dark:text-white">المحادثات</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl hover:scale-110 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
            <input 
              type="text" 
              placeholder="بحث في المحادثات..."
              className="w-full pr-10 pl-3 py-2 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-none rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-200"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-50 dark:divide-neutral-700">
          {chats.map(chat => (
            <button
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`w-full p-4 flex flex-row-reverse items-center gap-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/50 ${
                selectedChat?.id === chat.id ? 'bg-neutral-50 dark:bg-neutral-900' : ''
              }`}
            >
              <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center flex-shrink-0">
                <Building2 className="text-neutral-400" size={20} />
              </div>
              <div className="flex-1 text-right overflow-hidden">
                <p className="font-bold text-sm text-neutral-900 dark:text-white truncate">
                  {getChatDisplayName(chat)}
                </p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">{chat.lastMessage}</p>
              </div>
            </button>
          ))}
          {chats.length === 0 && (
            <div className="p-10 text-center text-neutral-400 italic text-sm">
              لا توجد محادثات نشطة
            </div>
          )}
        </div>
      </motion.div>

      {/* Chat Window */}
      <motion.div 
        initial={false}
        animate={{ 
          x: (!selectedChat && window.innerWidth < 1024) ? '-100%' : '0%',
          opacity: (!selectedChat && window.innerWidth < 1024) ? 0 : 1
        }}
        className={`
          flex-1 bg-white dark:bg-neutral-800 lg:rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm flex flex-col overflow-hidden
          ${!selectedChat ? 'absolute lg:relative' : 'relative'}
        `}
      >
        {selectedChat ? (
          <>
            <div className="p-4 lg:p-6 border-b border-neutral-50 dark:border-neutral-700 flex justify-between items-center flex-row-reverse">
              <div className="flex items-center gap-3 flex-row-reverse">
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="lg:hidden p-2 -mr-2 text-neutral-400 hover:text-neutral-900"
                >
                  <ArrowRight size={24} />
                </button>
                <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center">
                  <Building2 className="text-neutral-400" size={18} />
                </div>
                <div className="text-right flex-1">
                  <h3 className="font-bold text-neutral-900 dark:text-white truncate">{getChatDisplayName(selectedChat)}</h3>
                  <button 
                    onClick={() => selectedChat.type === 'group' && setShowParticipants(true)}
                    className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest italic block"
                  >
                    {selectedChat.type === 'group' ? `${selectedChat.participants.length} مشارك` : 'نشط الآن'}
                  </button>
                </div>
                {selectedChat.type === 'group' && (
                  <button 
                    onClick={() => setShowParticipants(true)}
                    className="p-2 text-neutral-400 hover:text-neutral-900"
                  >
                    <Users size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
              {messages.map((msg, index) => {
                const isMine = msg.senderId === myCompanyId;
                const showSenderName = !isMine && selectedChat.type === 'group';
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {showSenderName && (
                      <span className="text-[10px] font-bold text-neutral-400 mb-1 px-2">
                        {msg.senderName || selectedChat.names?.[msg.senderId] || 'مشارك'}
                      </span>
                    )}
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.05 }}
                      className={`max-w-[85%] lg:max-w-[70%] p-3 lg:p-4 rounded-2xl ${
                        isMine 
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-br-none' 
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      <div className={`flex items-center gap-1 mt-1 font-mono italic ${isMine ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-500'}`}>
                        <span className="text-[9px]">
                          {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </span>
                        {isMine && <Check size={10} />}
                      </div>
                    </motion.div>
                  </div>
                );
              })}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 lg:p-6 border-t border-neutral-50 dark:border-neutral-700 flex gap-2 lg:gap-4 bg-white dark:bg-neutral-800">
              <button 
                type="submit"
                disabled={!newMessage.trim()}
                className="w-12 h-12 lg:w-14 lg:h-14 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all flex-shrink-0 disabled:opacity-50"
              >
                <Send size={20} className="rotate-180" />
              </button>
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                className="flex-1 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-none rounded-2xl px-4 lg:px-6 py-3 lg:py-4 text-sm outline-none focus:ring-2 focus:ring-neutral-200 text-right font-bold"
              />
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-900 rounded-3xl flex items-center justify-center mb-6">
              <MessageSquare size={40} className="text-neutral-300" />
            </div>
            <h3 className="text-xl font-black text-neutral-900 dark:text-white mb-2">اختر محادثة للبدء</h3>
            <p className="text-neutral-400 text-sm max-w-xs">يمكنك التواصل مع الشركات الأخرى والمشرفين عبر نظام المحادثات المباشر.</p>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showParticipants && selectedChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowParticipants(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              className="relative w-80 h-full bg-white dark:bg-neutral-900 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-neutral-50 dark:border-neutral-800 flex justify-between items-center flex-row-reverse">
                <h3 className="text-xl font-black italic">مشاركي المجموعة</h3>
                <button onClick={() => setShowParticipants(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl">
                  <X />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedChat.participants.map((pid: string) => (
                  <div key={pid} className="flex flex-row-reverse items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-2xl">
                    <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center">
                      <Building2 size={18} className="text-neutral-500" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="font-bold text-sm text-neutral-900 dark:text-white">
                        {pid === myCompanyId ? 'أنت' : (selectedChat.names?.[pid] || 'شركة')}
                      </p>
                      {selectedChat.createdBy === pid && (
                        <span className="text-[10px] text-neutral-400">مالك المجموعة</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center lg:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => { setShowNewChatModal(false); setIsGroupMode(false); setSelectedParticipants([]); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden lg:block"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full h-full lg:h-auto lg:max-w-md bg-white dark:bg-neutral-900 lg:rounded-[32px] shadow-2xl overflow-hidden border border-neutral-100 dark:border-neutral-800 flex flex-col"
            >
              <div className="p-6 border-b border-neutral-50 dark:border-neutral-800 flex justify-between items-center flex-row-reverse flex-shrink-0">
                <h3 className="text-xl font-black italic">
                  {isGroupMode ? 'إنشاء دردشة جماعية' : 'بدء محادثة جديدة'}
                </h3>
                <button onClick={() => { setShowNewChatModal(false); setIsGroupMode(false); setSelectedParticipants([]); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl">
                  <X />
                </button>
              </div>
              
              <div className="p-4 lg:p-6 overflow-y-auto flex-1">
                <div className="flex gap-2 mb-4 bg-neutral-50 dark:bg-neutral-800 p-1 rounded-2xl">
                  <button 
                    onClick={() => setIsGroupMode(false)}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${!isGroupMode ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'text-neutral-400'}`}
                  >
                    فردية
                  </button>
                  <button 
                    onClick={() => setIsGroupMode(true)}
                    className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${isGroupMode ? 'bg-white dark:bg-neutral-700 shadow-sm' : 'text-neutral-400'}`}
                  >
                    جماعية
                  </button>
                </div>

                {isGroupMode && (
                  <input 
                    type="text" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="اسم المجموعة..."
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-neutral-800 dark:text-white border-2 border-transparent focus:border-neutral-900 dark:focus:border-white rounded-2xl text-sm outline-none text-right mb-4 transition-all"
                  />
                )}

                <div className="relative mb-4">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="ابحث عن شركة..."
                    className="w-full pr-10 pl-4 py-3 bg-neutral-50 dark:bg-neutral-800 dark:text-white border-none rounded-xl text-sm outline-none text-right"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 mb-4">
                  {companies
                    .filter(c => c.id !== myCompanyId && c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(c => {
                      const isSelected = selectedParticipants.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (isGroupMode) {
                              setSelectedParticipants(prev => 
                                isSelected ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            } else {
                              startNewChat(c);
                            }
                          }}
                          disabled={loading}
                          className={`w-full p-4 flex flex-row-reverse items-center gap-3 transition-all rounded-2xl group ${
                            isSelected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-white/20' : 'bg-neutral-100 dark:bg-neutral-700 group-hover:bg-neutral-200'
                          }`}>
                            <Building2 size={18} className={isSelected ? 'text-white' : 'text-neutral-400'} />
                          </div>
                          <div className="flex-1 text-right">
                            <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-neutral-900 dark:text-white'}`}>{c.name}</p>
                            <p className={`text-[10px] font-mono ${isSelected ? 'text-white/60' : 'text-neutral-400'}`}>@{c.handle || 'N/A'}</p>
                          </div>
                          {isGroupMode && (
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'bg-white border-white' : 'border-neutral-200'
                            }`}>
                              {isSelected && <Check size={14} className="text-neutral-900" />}
                            </div>
                          )}
                        </button>
                      );
                    })
                  }
                </div>

                {isGroupMode && (
                  <button
                    onClick={() => startNewChat()}
                    disabled={loading || selectedParticipants.length < 1 || !groupName.trim()}
                    className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-black italic disabled:opacity-50 disabled:cursor-not-allowed h-14 flex items-center justify-center"
                  >
                    {loading ? <div className="w-5 h-5 border-2 border-white dark:border-neutral-900 border-t-transparent animate-spin rounded-full" /> : 'إنشاء المجموعة'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExternalBlocklistView({ staff, currentUser }: { staff: StaffProfile | null, currentUser: any }) {
  const [loading, setLoading] = useState(false);
  const [externalBlocks, setExternalBlocks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    idNumber: '',
    phoneNumber: '',
    source: '',
    reason: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'external_blocklist'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExternalBlocks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'external_blocklist');
    });
    return () => unsubscribe();
  }, []);

  const handleAddExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.source) {
      return toast.error('يرجى ملء الحقول المطلوبة');
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'external_blocklist'), {
        ...formData,
        addedBy: currentUser?.uid || currentUser?.id,
        companyId: staff?.companyId,
        createdAt: serverTimestamp(),
      });
      toast.success('تمت إضافة الاسم للقائمة المتداولة');
      setIsAddModalOpen(false);
      setFormData({ fullName: '', idNumber: '', phoneNumber: '', source: '', reason: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'external_blocklist');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExternal = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الاسم من القائمة المتداولة؟')) return;
    try {
      await deleteDoc(doc(db, 'external_blocklist', id));
      toast.success('تم حذف الاسم من القائمة');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `external_blocklist/${id}`);
    }
  };

  const filteredItems = externalBlocks.filter(item => 
    item.fullName.includes(searchTerm) || 
    item.idNumber?.includes(searchTerm) || 
    item.phoneNumber?.includes(searchTerm)
  );

  return (
    <div className="space-y-8 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">القائمة المتداولة</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">أسماء محظورين من مواقع وتطبيقات أخرى.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <Plus size={20} />
          إضافة اسم جديد
        </button>
      </header>

      <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-100 dark:border-neutral-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-50 dark:border-neutral-700">
          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهوية..." 
              className="w-full pr-12 pl-4 py-3 bg-neutral-50 dark:bg-neutral-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-700 outline-none text-sm text-right"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-neutral-900/50 border-b border-neutral-100 dark:border-neutral-700">
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">الاسم الكامل</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">رقم الهوية</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">المصدر</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">سبب الحظر</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-400 uppercase tracking-widest italic">تاريخ الإضافة</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-700">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors group">
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold dark:text-white">{item.fullName}</p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">{item.phoneNumber}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">{item.idNumber || 'غير متوفر'}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg">
                      {item.source}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xs">{item.reason || 'لا يوجد تفاصيل'}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 italic">
                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString('ar-EG') : 'قيد المعالجة'}
                    </p>
                  </td>
                  <td className="px-6 py-5">
                    <button 
                      onClick={() => handleDeleteExternal(item.id)}
                      className="p-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-neutral-400 italic">
                    لا يوجد نتائج للبحث في القائمة المحملة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[32px] shadow-2xl overflow-hidden border border-neutral-100 dark:border-neutral-800"
            >
              <div className="p-8 border-b border-neutral-50 dark:border-neutral-800 flex justify-between items-center flex-row-reverse">
                <h3 className="text-2xl font-black italic text-neutral-900 dark:text-white">إضافة للقائمة المتداولة</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl">
                  <X />
                </button>
              </div>

              <form onSubmit={handleAddExternal} className="p-8 space-y-6 text-right">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase italic">الاسم الكامل *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 outline-none text-right dark:text-white font-bold"
                      placeholder="اسم الشخص..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase italic">المصدر *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.source}
                      onChange={(e) => setFormData({...formData, source: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 outline-none text-right dark:text-white font-bold"
                      placeholder="مثال: تيليجرام، فيسبوك، تطبيق آخر..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase italic">رقم الهوية</label>
                    <input 
                      type="text" 
                      value={formData.idNumber}
                      onChange={(e) => setFormData({...formData, idNumber: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 outline-none text-right dark:text-white font-bold"
                      placeholder="رقم البطاقة الوطنية..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase italic">رقم الهاتف</label>
                    <input 
                      type="text" 
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 outline-none text-right dark:text-white font-bold"
                      placeholder="07xxxxxxxx..."
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase italic">سبب الحظر / تفاصيل إضافية</label>
                  <textarea 
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 p-4 rounded-2xl focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500 outline-none text-right dark:text-white font-bold h-32"
                    placeholder="لماذا تم حظر هذا الشخص؟"
                  ></textarea>
                </div>

                <button 
                  disabled={loading}
                  className="w-full bg-neutral-900 dark:bg-white dark:text-neutral-900 text-white p-5 rounded-2xl font-black text-lg shadow-xl shadow-neutral-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all disabled:opacity-50"
                  type="submit"
                >
                  {loading ? 'جاري الإضافة...' : 'تأكيد الإضافة للقائمة المتداولة'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BlocklistView({ staff, isSuperAdmin, currentUser }: { staff: StaffProfile | null, isSuperAdmin: boolean, currentUser: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [result, setResult] = useState<{ found: boolean, data?: Customer } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({ fullName: '', idNumber: '', phoneNumber: '', photoUrl: '', blockReason: '', residencyCard: '' });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'blocklist'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecentBlocks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'blocklist');
    });
    return () => unsubscribe();
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRemoveBlocked = async (id: string, name: string, source: string = 'internal') => {
    if (!id) return;
    if (!window.confirm(`هل أنت متأكد من إزالة "${name}" من قائمة الحظر؟`)) return;

  const isSuperAdmin = currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const hasPermission = isSuperAdmin;

    if (!hasPermission) {
      return toast.error('ليس لديك صلاحية لإجراء هذا العمل');
    }

    setIsDeleting(id);
    try {
      const coll = source === 'external' ? 'external_blocklist' : 'blocklist';
      await deleteDoc(doc(db, coll, id));
      toast.success('تمت الإزالة من قائمة الحظر بنجاح');
      if (result?.data?.id === id) {
        setResult(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${source === 'external' ? 'external_blocklist' : 'blocklist'}/${id}`);
    } finally {
      setIsDeleting(null);
    }
  };

  const startCamera = async () => {
    if (isCameraActive) return;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('متصفحك لا يدعم استخدام الكاميرا');
      return;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(s);
      setIsCameraActive(true);
    } catch (err) {
      toast.error('لا يمكن الوصول للكاميرا. يرجى التأكد من منح الإذن للموقع في إعدادات المتصفح.');
      console.error(err);
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoData = canvas.toDataURL('image/jpeg', 0.5);
        setAddFormData({ ...addFormData, photoUrl: photoData });
        stopCamera();
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const dataUrl = await compressImage(file, 500, 500, 0.6);
      setAddFormData({ ...addFormData, photoUrl: dataUrl });
    }
  };

  useEffect(() => {
    if (!isAddModalOpen) {
      stopCamera();
    }
    return () => stopCamera();
  }, [isAddModalOpen]);

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    toast('جاري قراءة البطاقة بواسطة الذكاء الاصطناعي...');

    try {
      const compressedBase64 = await compressImage(file, 1500, 1500, 0.7);
      const extractedInfo = await extractIdInfo(compressedBase64, 'image/jpeg');
      
      if (extractedInfo.idNumber) {
        setSearchTerm(extractedInfo.idNumber);
        toast.success(`تم استخراج الرقم: ${extractedInfo.idNumber}`);
      } else if (extractedInfo.fullName) {
        setSearchTerm(extractedInfo.fullName);
        toast.success(`تم استخراج الاسم: ${extractedInfo.fullName}`);
      } else {
        toast.error('لم يتم التعرف على تفاصيل البطاقة.');
      }
    } catch (error: any) {
      console.error('[handleScanImage] AI Error:', error);
      toast.error(String(error.message || error));
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input so same file can be selected again
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) return toast.error('يرجى إدخال رقم الهوية أوالاسم');
    setLoading(true);
    try {
      const q1 = collection(db, 'blocklist');
      const snapshot1 = await getDocs(q1);
      const allInternal = snapshot1.docs.map(doc => ({ id: doc.id, ...doc.data(), _source: 'internal' }));

      const q2 = collection(db, 'external_blocklist');
      const snapshot2 = await getDocs(q2);
      const allExternal = snapshot2.docs.map(doc => ({ id: doc.id, ...doc.data(), _source: 'external' }));
      
      const all = [...allInternal, ...allExternal];
      
      const found = all.find(person => 
          (person as any).idNumber?.toString().includes(searchTerm) || 
          (person as any).fullName?.includes(searchTerm) ||
          (person as any).residencyCard?.toString().includes(searchTerm)
      );
      
      if (found) {
        setResult({ found: true, data: found as any });
      } else {
        setResult({ found: false });
      }
      setLoading(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'blocklist');
      setLoading(false);
    }
  };

  const handleAddBlocked = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return toast.error('يرجى تسجيل الدخول');
    
    try {
      await addDoc(collection(db, 'blocklist'), {
        fullName: addFormData.fullName,
        idNumber: addFormData.idNumber,
        phoneNumber: addFormData.phoneNumber,
        residencyCard: addFormData.residencyCard,
        photoUrl: addFormData.photoUrl,
        reason: addFormData.blockReason,
        reportedBy: staff?.fullName || currentUser?.email || 'Unknown',
        reportedByCompanyId: staff?.companyId || 'SUPER_ADMIN',
        createdAt: serverTimestamp()
      });

      // Notify super admin
      await createSystemNotification(
        'إضافة لقائمة الحظر',
        `تمت إضافة ${addFormData.fullName} إلى قائمة الحظر بواسطة ${staff?.fullName || 'عضو'}.`,
        'warning'
      );

      toast.success('تمت الإضافة لقائمة الحظر المشتركة');
      setIsAddModalOpen(false);
      setAddFormData({ fullName: '', idNumber: '', phoneNumber: '', photoUrl: '', blockReason: '', residencyCard: '' });
      handleSearch();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'blocklist');
    }
  };

  return (
    <div className="space-y-6 text-right">
      <header className="flex justify-between items-center flex-row-reverse">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-900">قائمة الحظر</h1>
          <p className="text-neutral-500 mt-1">البحث وإضافة سجلات العملاء المحظورين.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="bg-red-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform"
        >
          <Plus size={20} />
          إضافة محظور
        </button>
      </header>

      <div className="bg-red-50 border border-red-100 p-6 rounded-3xl flex gap-4 flex-row-reverse">
        <Ban className="text-red-600 shrink-0" size={24} />
        <div>
          <p className="text-red-900 font-bold">تنبيه أمني</p>
          <p className="text-red-700 text-sm leading-relaxed mt-1">
            قائمة الحظر تحتوي على بيانات حساسة. يرجى التأكد من الرقم التعريفي للعميل قبل اتخاذ أي إجراء قانوني.
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">بحث موحد</h2>
            <p className="text-neutral-500 text-sm">أدخل رقم الهوية أو الاسم للتحقق من السجل الجنائي أو المالي للعميل</p>
          </div>
          
          <div className="flex gap-4 flex-row-reverse">
            <div className="relative flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="رقم الهوية / الاسم..." 
                  className="w-full pr-12 pl-4 py-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                />
              </div>
              <label 
                htmlFor="ai-scan-input"
                className={`flex items-center justify-center bg-white border-2 border-neutral-200 text-neutral-700 p-4 rounded-2xl hover:bg-neutral-50 hover:border-neutral-300 transition-all cursor-pointer shadow-sm ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                title="البحث بواسطة صورة الهوية (AI)"
              >
                <ScanSearch size={20} />
                <input id="ai-scan-input" type="file" accept="image/*" onChange={handleScanImage} className="hidden" />
              </label>
            </div>
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="bg-neutral-900 text-white px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري التحقق...' : 'تحقق الآن'}
            </button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-2xl border-2 ${result.found ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}
              >
                <div className="flex items-center justify-between flex-row-reverse gap-4">
                  <div className="flex items-center flex-row-reverse gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-sm bg-neutral-100 flex items-center justify-center shrink-0">
                      {result.found && (result.data as any).photoUrl ? (
                        <img 
                          src={(result.data as any).photoUrl} 
                          alt={result.data?.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={32} className="text-neutral-300" />
                      )}
                    </div>
                    <div className="text-right text-neutral-900 flex-1">
                      <h3 className="font-bold text-lg">{result.found ? result.data?.fullName : 'السجل نظيف'}</h3>
                      <p className="text-sm opacity-70">
                        {result.found 
                          ? `رقم الهوية: ${result.data?.idNumber || 'غير متوفر'} | بطاقة السكن: ${(result.data as any).residencyCard || 'غير متوفر'}` 
                          : 'لا توجد قيود مسجلة لهذا الرقم في قاعدة البيانات المشتركة'}
                      </p>
                      {result.found && (result.data as any)._source === 'external' && (
                        <p className="text-xs text-blue-600 mt-2 font-bold">مصدر الحظر: {(result.data as any).source || 'قائمة متداولة خارجية'}</p>
                      )}
                      {result.found && (result.data as any).reason && (
                        <p className="text-xs text-red-600 mt-2 font-bold">سبب الحظر: {(result.data as any).reason}</p>
                      )}
                    </div>
                  </div>
                  {result.found ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm shrink-0">محظور</div>
                      {(staff || currentUser?.email === SUPER_ADMIN_EMAIL) && (
                        <button 
                          onClick={() => handleRemoveBlocked(result.data?.id, result.data?.fullName || '', (result.data as any)._source)}
                          disabled={isDeleting === result.data?.id}
                          className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                        >
                          {isDeleting === result.data?.id ? 'جاري الإزالة...' : 'إزالة من الحظر'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm shrink-0">سليم</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-8 grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 flex flex-col items-center justify-center text-center">
              <span className="text-neutral-400 text-xs font-bold uppercase mb-1">المبلغ المطالب به</span>
              <span className="text-2xl font-black italic">0 ر.س</span>
            </div>
            <div className="p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 flex flex-col items-center justify-center text-center">
              <span className="text-neutral-400 text-xs font-bold uppercase mb-1">حالة السجل</span>
              <span className={`text-2xl font-black italic ${result?.found && (result.data as any).isBlocked ? 'text-red-600' : 'text-emerald-600'}`}>
                {result?.found ? 'مطلوب' : 'نظيف'}
              </span>
            </div>
          </div>

          {(staff || currentUser?.email === SUPER_ADMIN_EMAIL) && (
            <div className="pt-12 border-t border-neutral-100">
              <h3 className="text-lg font-extrabold mb-6">سجلات الحظر الأخيرة</h3>
              <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
                <table className="w-full text-right text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100 font-bold">
                    <tr>
                      <th className="px-6 py-4 italic">اسم الشخص</th>
                      <th className="px-6 py-4 italic">رقم الهوية</th>
                      <th className="px-6 py-4 italic">السبب</th>
                      <th className="px-6 py-4 italic text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {recentBlocks.map((b) => (
                      <tr key={b.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center flex-row-reverse gap-3">
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-100 shadow-sm bg-neutral-50 flex items-center justify-center">
                              {b.photoUrl ? (
                                <img src={b.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User size={20} className="text-neutral-300" />
                              )}
                            </div>
                            <span className="font-bold">{b.fullName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-neutral-500">{b.idNumber}</td>
                        <td className="px-6 py-4 text-xs text-red-600 font-bold">{b.reason}</td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleRemoveBlocked(b.id, b.fullName)}
                            disabled={isDeleting === b.id}
                            className="p-2 rounded-lg transition-colors disabled:opacity-50 text-red-600 hover:bg-red-50"
                            title="إزالة من الحظر"
                          >
                            {isDeleting === b.id ? (
                              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                          {confirmDeleteId === b.id && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                              className="text-[10px] text-neutral-400 block mx-auto hover:text-neutral-600"
                            >
                              إلغاء
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {recentBlocks.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-neutral-400 italic">لا توجد سجلات حالياً</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden text-right"
            >
              <div className="p-8 border-b border-neutral-100 flex justify-between items-center flex-row-reverse">
                <h2 className="text-2xl font-black">إضافة شخص للقائمة السوداء</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="text-neutral-400 hover:text-neutral-900">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleAddBlocked} className="p-8 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">الاسم الكامل</label>
                  <input 
                    type="text" 
                    required
                    value={addFormData.fullName}
                    onChange={(e) => setAddFormData({...addFormData, fullName: e.target.value})}
                    className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right"
                    placeholder="الاسم الكامل للعميل"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">رقم الهوية</label>
                    <input 
                      type="text" 
                      required
                      value={addFormData.idNumber}
                      onChange={(e) => setAddFormData({...addFormData, idNumber: e.target.value})}
                      className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-red-600 rounded-2xl outline-none transition-all text-right"
                      placeholder="رقم الهوية / الإقامة"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">بطاقة السكن</label>
                    <input 
                      type="text" 
                      value={addFormData.residencyCard}
                      onChange={(e) => setAddFormData({...addFormData, residencyCard: e.target.value})}
                      className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-red-600 rounded-2xl outline-none transition-all text-right"
                      placeholder="رقم بطاقة السكن"
                    />
                  </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">رقم الهاتف</label>
                    <input 
                      type="tel" 
                      required
                      value={addFormData.phoneNumber}
                      onChange={(e) => setAddFormData({...addFormData, phoneNumber: e.target.value})}
                      className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-left"
                      placeholder="07XXXXXXXX"
                    />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">الصورة الشخصية</label>
                  <div className="flex flex-col items-center p-6 bg-neutral-50 rounded-[32px] border-2 border-dashed border-neutral-200 gap-4 mb-4">
                    <div className="flex gap-4 w-full">
                      <div 
                        className="relative w-32 h-32 group cursor-pointer" 
                        onClick={() => !addFormData.photoUrl && !isCameraActive && startCamera()}
                      >
                        {addFormData.photoUrl && !isCameraActive ? (
                          <div className="w-full h-full text-right relative">
                            <img src={addFormData.photoUrl} alt="Preview" className="w-full h-full object-cover rounded-3xl border-2 border-white shadow-md shadow-neutral-200/50" />
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setAddFormData({...addFormData, photoUrl: ''}); }}
                              className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : isCameraActive ? (
                          <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col items-center justify-center p-4">
                            <div className="relative w-full max-w-md aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border-4 border-white/10">
                              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                            </div>
                            <div className="flex gap-4 mt-8">
                              <button 
                                type="button"
                                onClick={capturePhoto}
                                className="bg-red-600 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-red-600/30 active:scale-95 transition-transform"
                              >
                                التقاط الصورة
                              </button>
                              <button 
                                type="button"
                                onClick={stopCamera}
                                className="bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-2xl font-bold hover:bg-white/30 transition-all"
                              >
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full bg-white rounded-3xl flex flex-col items-center justify-center gap-2 border-2 border-transparent group-hover:border-neutral-900 group-hover:shadow-xl transition-all">
                            <Camera size={32} className="text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                            <span className="text-[10px] font-bold text-neutral-400 group-hover:text-neutral-900">اضغط للالتقاط</span>
                          </div>
                        )}
                      </div>

                      {!addFormData.photoUrl && !isCameraActive && (
                        <div 
                          className="w-32 h-32 bg-white rounded-3xl flex flex-col items-center justify-center gap-2 border-2 border-transparent hover:border-neutral-900 hover:shadow-xl transition-all cursor-pointer group"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Image size={32} className="text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                          <span className="text-[10px] font-bold text-neutral-400 group-hover:text-neutral-900">من الاستوديو</span>
                        </div>
                      )}
                    </div>

                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />
                    
                    {!addFormData.photoUrl && !isCameraActive && (
                      <input 
                        type="url" 
                        value={addFormData.photoUrl}
                        onChange={(e) => setAddFormData({...addFormData, photoUrl: e.target.value})}
                        className="w-full bg-white px-4 py-2 rounded-xl text-right text-[10px] outline-none border border-neutral-100 focus:border-neutral-900 text-neutral-400 focus:text-neutral-900"
                        placeholder="أو ضع رابط الصورة هنا..."
                      />
                    )}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase">سبب الحظر</label>
                  <textarea 
                    value={addFormData.blockReason}
                    onChange={(e) => setAddFormData({...addFormData, blockReason: e.target.value})}
                    className="w-full p-4 bg-neutral-50 border-2 border-transparent focus:border-neutral-900 rounded-2xl outline-none transition-all text-right min-h-[100px]"
                    placeholder="اذكر تفاصيل المخالفة..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-red-600 text-white py-5 rounded-[24px] font-bold shadow-xl shadow-red-600/20 hover:bg-red-700 transition-colors"
                >
                  تأكيد الحظر
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Root Component ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || 
           localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<'ar' | 'ku'>('ar');

  const isSuperAdmin = currentUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      const savedUserString = localStorage.getItem('auth_user');
      let localUser = null;
      if (savedUserString) {
        try { localUser = JSON.parse(savedUserString); } catch (e) {}
      }

      if (fbUser) {
        // If it's an anonymous firebase user but we have a rich local user, prefer local for data
        if (fbUser.isAnonymous && localUser?.email) {
          setCurrentUser({ ...fbUser, ...localUser }); // Merge so we have the Firebase UID but the local Email/Name
        } else {
          setCurrentUser(fbUser);
        }
      } else {
        // No Firebase user, but we have a local session
        if (localUser) {
          setCurrentUser(localUser);
        } else {
          setCurrentUser(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser || (!staff && !isSuperAdmin)) return;

    const companyId = isSuperAdmin ? 'all' : (staff?.companyId || '');
    const q = isSuperAdmin
      ? query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50))
      : query(
          collection(db, 'notifications'), 
          where('companyId', 'in', [companyId, 'all']),
          orderBy('createdAt', 'desc'),
          limit(50)
        );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const unread = snapshot.docs.filter(doc => !doc.data().readBy?.includes(currentUser?.uid)).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [currentUser, staff, isSuperAdmin]);

  useEffect(() => {
    let unsubCompany = () => {};
    const effectiveCompanyId = staff?.companyId || company?.id;
    if (effectiveCompanyId) {
      unsubCompany = onSnapshot(doc(db, 'companies', effectiveCompanyId), (compSnap) => {
        if (compSnap.exists()) {
          setCompany({ id: compSnap.id, ...compSnap.data() } as Company);
        } else {
          setCompany(null);
        }
      });
    }
    return () => unsubCompany();
  }, [staff?.companyId, company?.id]);

  useEffect(() => {
    const checkAuthStatusLocal = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      
      const uid = currentUser.id || currentUser.uid;
      if (!uid) {
        setLoading(false);
        return;
      }

      try {
        const docSnap = await getDoc(doc(db, 'staff', uid));
        if (docSnap.exists()) {
          const staffData = docSnap.data() as StaffProfile;
          setStaff(staffData);
          
          if (staffData.companyId) {
            const compSnap = await getDoc(doc(db, 'companies', staffData.companyId));
            if (compSnap.exists()) {
              setCompany({ id: compSnap.id, ...compSnap.data() } as Company);
            } else {
              setStaff(null); 
              setCompany(null);
            }
          }
        } else if (currentUser.email) {
          const emailLower = currentUser.email.toLowerCase().trim();
          
          // Check for pending staff invitation
          const q = query(collection(db, 'staff'), where('email', '==', emailLower), where('isPending', '==', true), limit(1));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            const pendingDoc = querySnap.docs[0];
            const pendingData = pendingDoc.data();
            
            await setDoc(doc(db, 'staff', uid), {
              ...pendingData,
              isPending: false,
              fullName: currentUser.fullName || pendingData.fullName,
              createdAt: serverTimestamp()
            });
            
            await deleteDoc(pendingDoc.ref);
            
            const staffData = { ...pendingData, isPending: false } as unknown as StaffProfile;
            setStaff(staffData);
            
            if (staffData.companyId) {
               const compSnap = await getDoc(doc(db, 'companies', staffData.companyId));
               if (compSnap.exists()) {
                 setCompany({ id: compSnap.id, ...compSnap.data() } as Company);
               }
            }
            toast.success(`أهلاً بك ${pendingData.fullName}! تم ربط حسابك بالشركة بنجاح.`);
          } else {
            // Check if user is an admin of a company that is still pending or exists
            const qComp = query(collection(db, 'companies'), where('adminEmail', '==', emailLower), limit(1));
            const compQuerySnap = await getDocs(qComp);
            if (!compQuerySnap.empty) {
              const compDoc = compQuerySnap.docs[0];
              setCompany({ id: compDoc.id, ...compDoc.data() } as Company);
            }
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatusLocal();
  }, [currentUser]);

  const checkAuthStatus = async () => {
    if (!currentUser) return;
    const uid = currentUser.id || currentUser.uid;
    if (!uid) return;
    
    setLoading(true);
    try {
      const uid = currentUser.id || currentUser.uid;
      const docSnap = await getDoc(doc(db, 'staff', uid));
      if (docSnap.exists()) {
        const staffData = docSnap.data() as StaffProfile;
        setStaff(staffData);
        
        if (staffData.companyId) {
          const compSnap = await getDoc(doc(db, 'companies', staffData.companyId));
          if (compSnap.exists()) {
            setCompany({ id: compSnap.id, ...compSnap.data() } as Company);
          }
        }
      } else if (currentUser.email) {
        // Double check for company even if staff is not created yet
        const emailLower = currentUser.email.toLowerCase().trim();
        const qComp = query(collection(db, 'companies'), where('adminEmail', '==', emailLower), limit(1));
        const compQuerySnap = await getDocs(qComp);
        if (!compQuerySnap.empty) {
          const compDoc = compQuerySnap.docs[0];
          setCompany({ id: compDoc.id, ...compDoc.data() } as Company);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-12 h-12 border-4 border-neutral-900 dark:border-white border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  if (currentUser && !isSuperAdmin && company && !company.approved) {
    return <PendingApprovalScreen companyName={company.name} />;
  }

  if (currentUser && !isSuperAdmin && (!staff || !staff.companyId)) {
    return <OnboardingScreen onComplete={checkAuthStatus} currentUser={currentUser} />;
  }

  return (
    <div className="min-h-screen font-sans text-neutral-900 overflow-x-hidden print:overflow-visible relative">
      <Toaster position="top-right" />
      
      {/* Heritage Watermark Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-96 h-96 bg-contain bg-no-repeat rotate-12"
          style={{ backgroundImage: 'url("https://www.svgrepo.com/show/401490/iraq-outline.svg")' }}
        />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-contain bg-no-repeat -rotate-12"
          style={{ backgroundImage: 'url("https://www.svgrepo.com/show/339462/lion-of-babylon.svg")' }}
        />
        <div className="absolute inset-0" 
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M40 0l40 40-40 40L0 40z' fill='%23000000' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: '120px 120px'
          }} 
        />
      </div>
      
      {/* Mobile Top Bar */}
      <header className="lg:hidden bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 p-4 sticky top-0 z-30 flex items-center justify-between flex-row-reverse print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold">عراق رنتل</span>
          <Car className="text-neutral-900 dark:text-white" size={24} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 ml-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
            <Languages size={14} className="text-neutral-400 mx-0.5" />
            <button 
              onClick={() => setLanguage('ar')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${language === 'ar' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
            >
              ع
            </button>
            <button 
              onClick={() => setLanguage('ku')}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${language === 'ku' ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
            >
              K
            </button>
          </div>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 text-neutral-600 dark:text-neutral-400"
          >
            {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsSidebarOpen(true)} className="p-2 text-neutral-600 dark:text-neutral-400"
          >
            <Menu size={24} />
          </motion.button>
        </div>
      </header>

      {/* Floating Quick Navigation (Up/Down) */}
      <div className="fixed bottom-8 left-8 z-50 flex flex-col gap-3 group print:hidden">
        <motion.button
          whileHover={{ scale: 1.1, x: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-12 h-12 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all group-hover:shadow-blue-500/10"
          title="صعود للأعلى"
        >
          <ChevronUp size={24} />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.1, x: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          className="w-12 h-12 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all group-hover:shadow-blue-500/10"
          title="نزول للأسفل"
        >
          <ChevronDown size={24} />
        </motion.button>
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        staff={staff} 
        company={company} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        unreadCount={unreadCount}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        language={language}
        setLanguage={setLanguage}
        isSuperAdmin={isSuperAdmin}
        currentUser={currentUser}
      />
      
      <main className="lg:mr-72 p-6 lg:p-10 min-h-screen text-right print:mr-0 print:p-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {activeTab === 'dashboard' && (staff || isSuperAdmin) && <DashboardView staff={staff} company={company} onNavigate={setActiveTab} isSuperAdmin={isSuperAdmin} />}
            {activeTab === 'settings' && <SettingsView company={company} staff={staff} currentUser={currentUser} />}
            {activeTab === 'companies' && isSuperAdmin && <CompaniesView onNavigate={setActiveTab} isSuperAdmin={isSuperAdmin} currentUser={currentUser} />}
            {activeTab === 'gps' && (staff || isSuperAdmin) && <GPSView staff={staff} />}
            {activeTab === 'notifications' && (staff || isSuperAdmin) && <NotificationsView companyId={company?.id || ''} isSuperAdmin={isSuperAdmin} currentUser={currentUser} />}
            {activeTab === 'chats' && (staff || isSuperAdmin) && <ChatsView staff={staff} isSuperAdmin={isSuperAdmin} />}
            {activeTab === 'contract' && <ContractView company={company} staff={staff} />}
            {activeTab === 'contracts_list' && <ContractsList company={company} staff={staff} onNavigate={setActiveTab} />}
            {activeTab === 'blocklist' && <BlocklistView staff={staff} isSuperAdmin={isSuperAdmin} currentUser={currentUser} />}
            {activeTab === 'external_blocklist' && <ExternalBlocklistView staff={staff} currentUser={currentUser} />}
            {activeTab === 'plans' && <SubscriptionView onPlanSelect={(plan) => toast(`تم اختيار باقة ${plan}`)} />}
            {activeTab === 'customers' && (staff || isSuperAdmin) && <CustomersView staff={staff} isSuperAdmin={isSuperAdmin} />}
            {activeTab === 'staff' && <StaffManagementView company={company} currentUser={currentUser} />}
            {activeTab === 'inventory' && (staff || isSuperAdmin) && <InventoryView staff={staff} isSuperAdmin={isSuperAdmin} currentUser={currentUser} />}
            {activeTab === 'employment' && isSuperAdmin && <EmploymentView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
