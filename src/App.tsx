import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { toast, Toaster, resolveValue } from 'react-hot-toast';
import { 
  User, Lock, Mail, Building, Phone, MapPin, CheckCircle, 
  RefreshCw, LogOut, Moon, Sun, Settings, Car, Users, Search,
  Ban, Shield, Map, FileText, Plus, Bell, Loader, Loader2,
  ChevronLeft, ChevronRight, Check, Trash2, Key, Info, Grid, ExternalLink,
  MessageSquare, Briefcase, Award, ShieldAlert, ShieldCheck, ChevronUp, ChevronDown, Upload, Image, Edit, UploadCloud, FileCheck, X, ScanFace, Star, TrendingUp
, CreditCard } from 'lucide-react';
import { api, onAuthStateChanged, collection, query, where, onSnapshot, db, addDoc, deleteDoc, updateDoc, doc } from './lib/api';
import { findMatchingFace } from './lib/faceMatcher';
import { compressImage } from './lib/imageUtils';
import { AuthScreen } from './components/AuthScreen';
import { Conversations } from './components/Conversations';
import { ContractView, defaultTermsNoDriver, defaultTermsWithDriver } from './components/ContractView';
import { ContractsList } from './components/ContractsList';
import { Fleet } from './components/Fleet';
import { Customers } from './components/Customers';
import Debts from './components/Debts';
import { Employees } from "./components/Employees";
import { FinancialSystem } from "./components/FinancialSystem";
import { MaintenanceExpenses } from './components/MaintenanceExpenses';
import { Notifications } from './components/Notifications';
import { ProfitChart } from './components/ProfitChart';
import { ProfitsView } from './components/ProfitsView';
import { InvestorCars } from './components/InvestorCars';
import { translations } from './lib/locales';
import { LanguageSwitcher } from './components/LanguageSwitcher';

// Privacy Watermark Component to deter screenshot leaks
const PrivacyWatermark = ({ userEmail, companyName }: { userEmail: string, companyName?: string }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.15] flex flex-wrap items-center justify-center select-none -rotate-12 scale-150">
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="text-xl md:text-2xl font-black text-black whitespace-nowrap drop-shadow-sm mx-4 my-2 text-center">
          {companyName ? `${companyName} • ` : ''}{new Date().toLocaleDateString('en-GB')}
        </span>
      ))}
    </div>
  );
};

export default function App() {
  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.style.display = 'none', 500);
    }
  }, []);

  const [user, setUser] = useState<any>(null);
  
  const [lang, setLang] = useState(() => {
    const stored = localStorage.getItem('lang');
    return (stored === 'ar' || stored === 'en') ? stored : 'ar';
  });
  const t = translations[lang] || translations.ar;
  const isRtl = lang === 'ar';

  const [publicContractView, setPublicContractView] = useState<{contract: any, company: any} | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Handle Public Verification Routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get('v');
    if (verifyId) {
       handlePublicVerification(verifyId);
    }
  }, []);

  const handlePublicVerification = async (contractId: string) => {
    setIsVerifying(true);
    try {
      // Fetch contract with direct link to avoid complex queries in public view
      const contractRef = doc(db, 'contracts', contractId);
      onSnapshot(contractRef, (snapshot) => {
        if (snapshot.exists()) {
          const cData = { id: snapshot.id, ...snapshot.data() };
          // After getting contract, fetch its company
          const compIdOrName = cData.companyId || cData.companyName;
          if (compIdOrName) {
            // Find company by name or ID
            const q = query(collection(db, 'companies'), where('name', '==', compIdOrName));
            onSnapshot(q, (compSnap) => {
              if (!compSnap.empty) {
                setPublicContractView({
                  contract: cData,
                  company: { id: compSnap.docs[0].id, ...compSnap.docs[0].data() }
                });
              } else {
                setPublicContractView({ contract: cData, company: null });
              }
              setIsVerifying(false);
            });
          } else {
            setPublicContractView({ contract: cData, company: null });
            setIsVerifying(false);
          }
        } else {
          toast.error('العقد غير موجود أو منتهي الصلاحية');
          setIsVerifying(false);
        }
      });
    } catch (e) {
      console.error("Verification error:", e);
      setIsVerifying(false);
    }
  };

  // Quick fix: if email matches, ensure they are treated as super_admin
  const userRole = (user?.email?.toLowerCase() === 'mustfadd112@gmail.com') ? 'super_admin' : (user?.role || 'user');
  const isSuperAdmin = user && (userRole === 'super_admin');
  const isCompanyAdmin = user && (userRole === 'admin');

  console.log('isSuperAdmin value:', isSuperAdmin, 'userRole:', userRole, 'user:', user);
  const hasCompany = user && (!!user.companyId);
  const [authLoading, setAuthLoading] = useState(true);
  const [settingsMainTab, setSettingsMainTab] = useState<'general' | 'terms'>('general');
  const [settingsTermsTab, setSettingsTermsTab] = useState<'without_driver' | 'with_driver'>('without_driver');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    contracts: true,
    security: true,
    subscription: true,
    profits: true
  });
  const toggleGroup = (group: string) => setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  const [contractKey, setContractKey] = useState(Date.now());
  
  // Stats
  const [stats, setStats] = useState({
    activeContracts: 0,
    totalCars: 0,
    blockedCustomers: 0,
    totalProfits: 0
  });

  // Data states
  const [cars, setCars] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [blkList, setBlkList] = useState<any[]>([]);
  const [externalBlkList, setExternalBlkList] = useState<any[]>([]);

  const [notificationsCount, setNotificationsCount] = useState<number>(0);
  const [companies, setCompanies] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [gpsDevices, setGpsDevices] = useState<any[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchEmail, setNewBranchEmail] = useState('');
  const [newBranchPassword, setNewBranchPassword] = useState('');
  const [branchCompanyId, setBranchCompanyId] = useState<string | null>(null);
  const [confirmDeleteCompanyId, setConfirmDeleteCompanyId] = useState<string | null>(null);
  const [targetContractId, setTargetContractId] = useState<string | null>(null);

  // Auto-release logic for cars that might be stuck as 'rented' while having no active contract
  // This helps recover local state for older contracts and handle manual edge cases.
  useEffect(() => {
    // ... (existing code preserved)
  }, [cars, contracts]);

  const [activeCompanyData, setActiveCompanyData] = useState<any>(null);
  const [activeUserData, setActiveUserData] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Activity Heartbeat & Time Update
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // 10 seconds

    const sendHeartbeat = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      try {
        const cleanToken = token.replace(/^"|"$/g, '');
        fetch('/api/user/heartbeat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`
          }
        }).catch(() => {});
      } catch (e) {
        // Silently fail heartbeats
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000); // 30 seconds
    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, [user]);

  // Car Form Modal
  const [showCarModal, setShowCarModal] = useState(false);
  const [editingCarId, setEditingCarId] = useState<string | null>(null);
  const [carName, setCarName] = useState('');
  const [carPlate, setCarPlate] = useState('');
  const [carColor, setCarColor] = useState('');
  const [carChassis, setCarChassis] = useState('');
  const [carRegNumber, setCarRegNumber] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carPrice, setCarPrice] = useState('75000');
  const [carCategory, setCarCategory] = useState('G-Class');
  const [carImageUrl, setCarImageUrl] = useState('');
  const [carOwnerName, setCarOwnerName] = useState('');
  const [carOwnerPhone, setCarOwnerPhone] = useState('');
  const [carIsInvested, setCarIsInvested] = useState(false);
  const [carInvestmentPercentage, setCarInvestmentPercentage] = useState('0');

  // Blocklist Form Modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionTarget, setSubscriptionTarget] = useState<any>(null);
  const [subscriptionDays, setSubscriptionDays] = useState<number>(30);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [blockName, setBlockName] = useState('');
  const [blockPhone, setBlockPhone] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockNationalId, setBlockNationalId] = useState('');
  const [blockIdType, setBlockIdType] = useState('البطاقة الوطنية');
  const [blockImageUrl, setBlockImageUrl] = useState('');
  const [showBulkBlockModal, setShowBulkBlockModal] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [searchBlocklist, setSearchBlocklist] = useState('');
  const [debouncedBlocklistSearch, setDebouncedBlocklistSearch] = useState('');
  const [isSearchingBlocklist, setIsSearchingBlocklist] = useState(false);
  const [isExtractingAi, setIsExtractingAi] = useState(false);
  const [isMatchingFace, setIsMatchingFace] = useState(false);
  const [extractedAiData, setExtractedAiData] = useState<any>(null);
  const [matchedFaceData, setMatchedFaceData] = useState<any>(null);


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Settings states
  const [companyName, setCompanyName] = useState('');
  const [companyPhoneSetting, setCompanyPhoneSetting] = useState('');
  const [companyEmailSetting, setCompanyEmailSetting] = useState('');
  const [companyAddressSetting, setCompanyAddressSetting] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyEstablishmentImageUrl, setCompanyEstablishmentImageUrl] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyContractTerms, setCompanyContractTerms] = useState<string[]>(Array(13).fill(''));
  const [companyDriverContractTerms, setCompanyDriverContractTerms] = useState<string[]>(Array(13).fill(''));
  const [qrCodeFields, setQrCodeFields] = useState<any[]>([
    { id: 'companyName', label: 'اسم الشركة', enabled: true },
    { id: 'contractCode', label: 'رقم العقد', enabled: true },
    { id: 'renterName', label: 'اسم المستأجر', enabled: false },
    { id: 'renterPhone', label: 'هاتف المستأجر', enabled: false },
    { id: 'plateNumber', label: 'رقم اللوحة', enabled: false },
    { id: 'returnDate', label: 'تاريخ انتهاء المدة', enabled: true },
    { id: 'customText', label: 'نص مخصص', enabled: true, value: 'هذا العقد مصدق حتى انتهاء المدة' },
    { id: 'establishmentImage', label: 'صورة تأسيس الشركة (رابط)', enabled: false }
  ]);

  // Handle Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(null, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        // Load settings state if logged in
        setCompanyName(currentUser.companyName || '');
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch real-time data if logged in
  useEffect(() => {
    if (!user) return;

    // --- Notifications Sync ---
    const fetchNotifsCount = async () => {
      try {
          const token = localStorage.getItem('auth_token')?.replace(/^"|"$/g, '');
          if(token) {
              const res = await fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } });
              if(res.ok) {
                  const data = await res.json();
                  setNotificationsCount((data && data.length) || 0);
              }
          }
      } catch (e) {}
    };
    fetchNotifsCount();
    
    const socket = io();
    socket.on('newNotification', () => {
        fetchNotifsCount();
    });
    const notifsInterval = setInterval(fetchNotifsCount, 60000); // 60 seconds interval


    // 1. Fetch Fleet / Inventory
    let qCars;
    if (isSuperAdmin) {
      qCars = query(collection(db, 'inventory'));
    } else {
      qCars = query(collection(db, 'inventory'), where('companyId', '==', user.companyId || ''));
    }

    const unsubCars = onSnapshot(qCars, (snap: any) => {
      const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      console.log('Fetched cars:', items.length, items);
      setCars(items);
    });

    // 2. Fetch all entries in Blacklist globally
    const qBlk = query(collection(db, 'blocklist'));

    const unsubBlk = onSnapshot(qBlk, (snap: any) => {
      const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setBlkList(items);
    });

    const qExtBlk = query(collection(db, 'external_blocklist'));
    const unsubExtBlk = onSnapshot(qExtBlk, (snap: any) => {
      const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setExternalBlkList(items);
    });

    // 4. Fetch Active Contracts count
    let qContracts;
    if (isSuperAdmin) {
      qContracts = query(collection(db, 'contracts'));
    } else {
      qContracts = query(collection(db, 'contracts'), where('companyId', '==', user.companyId || ''));
    }

    const unsubContracts = onSnapshot(qContracts, (snap: any) => {
      const cnts = snap.docs.map((doc: any) => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          // Normalize createdAt for sorting
          _sortTime: data.createdAt?.seconds 
            ? data.createdAt.seconds 
            : (data.createdAt ? new Date(data.createdAt).getTime() / 1000 : Date.now() / 1000 + 1000)
        };
      }).sort((a, b) => b._sortTime - a._sortTime);
      
      const checkExpirations = (contractsArray: any[]) => {
          const now = new Date();
          let needsUpdate = false;
          contractsArray.forEach((c: any) => {
            let endDateVal = c.rentalEndDate || c.returnDate;
            let endTimeVal = c.rentalEndTime || c.returnTime;
            
            if (!endDateVal && c.rentalStartDate && c.rentalDays) {
                const dep = new Date(c.rentalStartDate);
                if (!isNaN(dep.getTime())) {
                    dep.setDate(dep.getDate() + parseInt(c.rentalDays || '0', 10));
                    endDateVal = dep.toISOString().split('T')[0];
                    endTimeVal = c.rentalStartTime || '23:59';
                }
            }
            
            const currentStatus = c.bookingStatus || 'active';
            if (currentStatus === 'active' && endDateVal) {
                let endDateStr = endDateVal.trim();
                if (endTimeVal) {
                    let t = endTimeVal.trim();
                    if (t.split(':').length === 2) t += ':00';
                    endDateStr += `T${t}`;
                } else {
                    endDateStr += `T23:59:59`;
                }
                let endDate = new Date(endDateStr);
                if (isNaN(endDate.getTime())) {
                    endDate = new Date(endDateStr.replace(/-/g, '/').replace('T', ' '));
                }
                if (!isNaN(endDate.getTime()) && endDate < now && c.bookingStatus === 'active') {
                    updateDoc(doc(db, 'contracts', c.id), { bookingStatus: 'expired' });
                    c.bookingStatus = 'expired';
                    
                    let carIdToRelease = c.carId;
                    if (!carIdToRelease) {
                        api.get('inventory').then(invData => {
                            const foundCar = invData.find((car: any) => 
                                (c.chassisNumber && (car.chassisNumber === c.chassisNumber || car.chassis === c.chassisNumber || car.chassis_number === c.chassisNumber)) ||
                                (c.plateNumber && car.plateNumber === c.plateNumber)
                            );
                            if (foundCar) {
                                api.put('inventory', foundCar.id, { status: 'available' });
                            }
                        }).catch(err => console.error("Could not fetch inventory to release car", err));
                    } else {
                        api.put('inventory', carIdToRelease, { status: 'available' }).catch(err => {
                            console.error("Failed to automatically set car status to available:", err);
                        });
                    }
                    
                    needsUpdate = true;
                }
            }
          });
          if (needsUpdate) {
              setContracts([...contractsArray]);
              setStats((prev: any) => ({
                ...prev,
                activeContracts: contractsArray.filter((c: any) => c.bookingStatus === 'active').length,
              }));
          }
      };

      checkExpirations(cnts); // Check immediately on snapshot
      
      setContracts(cnts);
      
      const totalProfits = cnts.filter(c => c.bookingStatus !== 'cancelled').reduce((sum, c) => {
          const cost = parseFloat(String(c.rentalCost || 0).replace(/,/g, ''));
          const rem = parseFloat(String(c.remainingAmount || 0).replace(/,/g, ''));
          const val = (isNaN(cost) ? 0 : cost) - (isNaN(rem) ? 0 : rem);
          return sum + Math.max(0, val);
      }, 0);
      
      setStats(prev => ({
        ...prev,
        activeContracts: cnts.filter((c: any) => c.bookingStatus === 'active').length,
        totalCars: cars.length, 
        totalContracts: cnts.length,
        totalProfits
      }));
      
      if ((window as any).expirationInterval) clearInterval((window as any).expirationInterval);
      (window as any).expirationInterval = setInterval(() => {
          setContracts((currentContracts) => {
              checkExpirations(currentContracts);
              return currentContracts;
          });
      }, 30000);
    });

    // 5. Fetch companies (For Super admin approval flow)
    if (isSuperAdmin) {
      const qCompanies = query(collection(db, 'companies'));
      const unsubComp = onSnapshot(qCompanies, (snap: any) => {
        setCompanies(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      });
      const qUsers = query(collection(db, 'users'));
      const unsubUsers = onSnapshot(qUsers, (snap: any) => {
        setUsersList(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
      });
      return () => {
        if ((window as any).expirationInterval) clearInterval((window as any).expirationInterval);
        clearInterval(notifsInterval);
        socket.off('newNotification');
        socket.disconnect();
        unsubCars();
        unsubBlk();
        unsubExtBlk();
        unsubContracts();
        unsubComp();
        unsubUsers();
      };
    } else {
        return () => {
            if ((window as any).expirationInterval) clearInterval((window as any).expirationInterval);
            clearInterval(notifsInterval);
            socket.off('newNotification');
            socket.disconnect();
            unsubCars();
            unsubBlk();
            unsubExtBlk();
            unsubContracts();
        }
    }
  }, [isSuperAdmin, user?.companyId]);

  // Always fetch users for subscription status (New useEffect)
  useEffect(() => {
    if (!user) return;
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snap: any) => {
        setUsersList(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubUsers();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    // 6. Fetch GPS Mock Devices
    const qGps = isSuperAdmin 
      ? query(collection(db, 'gps_devices'))
      : query(collection(db, 'gps_devices'), where('companyId', '==', user.companyId || ''));
    
    const unsubGps = onSnapshot(qGps, (snap: any) => {
      setGpsDevices(snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })));
    });

    const qMaint = isSuperAdmin 
      ? query(collection(db, 'maintenance'))
      : query(collection(db, 'maintenance'), where('companyId', '==', user.companyId || ''));
      
    const unsubMaint = onSnapshot(qMaint, (snap: any) => {
      const items = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      setMaintenanceRecords(items);
    });

    return () => {
        unsubGps();
        unsubMaint();
    };
  }, [isSuperAdmin, user?.companyId]);

  useEffect(() => {
    if (currentTab === 'new-contract' || currentTab === 'new-contract-driver') {
      setContractKey(Date.now());
    }
    // Reset general filters when changing tabs
    setSearchBlocklist('');
    setDebouncedBlocklistSearch('');

    return () => {
       if (currentTab === 'new-contract') {
          localStorage.removeItem('contractData');
          localStorage.removeItem('contractCustomerImg');
          localStorage.removeItem('contractCarImg');
       }
       if (currentTab === 'new-contract-driver') {
          localStorage.removeItem('contractData_driver');
          localStorage.removeItem('contractCustomerImg_driver');
          localStorage.removeItem('contractCarImg_driver');
       }
    };
  }, [currentTab]);

  useEffect(() => {
    if (searchBlocklist === debouncedBlocklistSearch) {
      setIsSearchingBlocklist(false);
      return;
    }
    
    setIsSearchingBlocklist(true);
    const timer = setTimeout(() => {
      setDebouncedBlocklistSearch(searchBlocklist);
      setIsSearchingBlocklist(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchBlocklist, debouncedBlocklistSearch]);


  // Load Company detailed settings when user logs in - with real-time sync
  useEffect(() => {
    if (!user || !user.companyId) return;
    
    const companyRef = doc(db, 'companies', user.companyId);
    const unsubComp = onSnapshot(companyRef, (docSnap) => {
      if (docSnap.exists()) {
        const compData = { id: docSnap.id, ...docSnap.data() } as any;
        setCompanyName(compData.name || '');
        setCompanyPhoneSetting(compData.phoneNumber || '');
        setCompanyEmailSetting(compData.email || '');
        setCompanyAddressSetting(compData.address || '');
        setCompanyLogoUrl(compData.logoUrl || '');
        setCompanyEstablishmentImageUrl(compData.establishmentImageUrl || '');
        setCompanyTaxId(compData.identityNumber || '');
        
        let terms = compData.contractTerms;
        if (typeof terms === 'string') {
            const split = terms.split('\n').filter((t: string) => t.trim());
            terms = [...split, ...Array(13).fill('')].slice(0, 13);
        }
        if (!Array.isArray(terms)) {
           terms = Array(13).fill('');
        } else if (terms.length < 13) {
           terms = [...terms, ...Array(13 - terms.length).fill('')];
        } else if (terms.length > 13) {
           terms = terms.slice(0, 13);
        }
        setCompanyContractTerms(terms);

        let driverTerms = compData.driverContractTerms;
        if (typeof driverTerms === 'string') {
            const split = driverTerms.split('\n').filter((t: string) => t.trim());
            driverTerms = [...split, ...Array(13).fill('')].slice(0, 13);
        }
        if (!Array.isArray(driverTerms)) {
           driverTerms = Array(13).fill('');
        } else if (driverTerms.length < 13) {
           driverTerms = [...driverTerms, ...Array(13 - driverTerms.length).fill('')];
        } else if (driverTerms.length > 13) {
           driverTerms = driverTerms.slice(0, 13);
        }
        setCompanyDriverContractTerms(driverTerms);
        
        if (compData.qrCodeFields && Array.isArray(compData.qrCodeFields)) {
          setQrCodeFields(compData.qrCodeFields);
        }
      }
    }, (e) => {
      // Only log error if not a 429 Rate Limit
      if (!String(e).includes('Rate exceeded')) {
        console.error("Error watching company settings:", e);
      }
    });

    return () => unsubComp();
  }, [user?.companyId]);

  // Logout Handler
  const handleLogout = () => {
    
    
    setUser(null);
    setCurrentTab('dashboard');
    toast.success(t.logoutSuccess);
  };

  const [activationDate, setActivationDate] = useState<string | null>(() => user ? localStorage.getItem('activation_' + user.email) : null);
  
  useEffect(() => {
    if (user) {
      setActivationDate(localStorage.getItem('activation_' + user.email));
    }
  }, [user]);

  // Maintain live subscription data for the active user and company
  useEffect(() => {
    if (!user) return;
    
    // Listen to user doc
    const unsubUser = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
      if (docSnap.exists()) {
         setActiveUserData({ id: docSnap.id, ...docSnap.data() });
      }
    });

    let unsubCompany = () => {};
    if (user.companyId) {
      unsubCompany = onSnapshot(doc(db, 'companies', user.companyId), (docSnap) => {
        if (docSnap.exists()) {
           setActiveCompanyData({ id: docSnap.id, ...docSnap.data() });
           if (docSnap.data().approved === false) {
             handleLogout();
             window.location.reload();
           }
        }
      });
    }

    return () => {
      unsubUser();
      unsubCompany();
    };
  }, [user?.id, user?.companyId]);

  const activateSubscription = async () => {
    if (user.email !== 'mustfadd112@gmail.com') {
      toast.error('ليس لديك صلاحية تفعيل الاشتراك - فقط المالك يمكنه التفعيل');
      return;
    }
    if (!user.companyId) {
      toast.error('لم يتم العثور على الشركة الخاصة بك.');
      return;
    }
    setSubscriptionTarget(null); // null means own subscription
    setSubscriptionDays(30); // reset default
    setShowSubscriptionModal(true);
  };

  const executeSubscriptionActivation = async () => {
    if (isNaN(subscriptionDays) || subscriptionDays <= 0) {
      toast.error(t.errorSelectDays);
      return;
    }
    
    const now = new Date().toISOString();
    const endDate = new Date(Date.now() + subscriptionDays * 24 * 60 * 60 * 1000).toISOString();
    
    try {
      if (subscriptionTarget === null) {
        // Self activation
        await updateDoc(doc(db, 'companies', user.companyId), {
          subscriptionExpired: false,
          approved: true,
          subscriptionEndDate: endDate
        });
        
        if (user.id) {
          await updateDoc(doc(db, 'users', user.id), {
            subscriptionExpired: false,
            subscriptionEndDate: endDate
          });
        }
        
        setActiveCompanyData((prev: any) => prev ? { ...prev, subscriptionExpired: false, approved: true, subscriptionEndDate: endDate } : prev);
        setActiveUserData((prev: any) => prev ? { ...prev, subscriptionExpired: false, subscriptionEndDate: endDate } : prev);
        setCompanies((prev: any) => prev.map((c: any) => c.id === user.companyId ? { ...c, subscriptionExpired: false, approved: true, subscriptionEndDate: endDate } : c));
        setUsersList((prev: any) => prev.map((u: any) => u.id === user.id ? { ...u, subscriptionExpired: false, subscriptionEndDate: endDate } : u));
        
        setActivationDate(now);
        localStorage.setItem('activation_' + user.email, now);
        toast.success(`تم تفعيل الاشتراك لـ ${subscriptionDays} يوم بنجاح`);
      } else if (subscriptionTarget.isBranch) {
        // Branch activation (Super Admin)
        await updateDoc(doc(db, 'users', subscriptionTarget.id), {
          subscriptionExpired: false,
          subscriptionEndDate: endDate
        });
        
        setUsersList(prev => prev.map(u => u.id === subscriptionTarget.id ? { ...u, subscriptionExpired: false, subscriptionEndDate: endDate } : u));
        
        toast.success(`تم تفعيل الاشتراك للفرع ${subscriptionTarget.name} لـ ${subscriptionDays} يوم بنجاح`);
      } else {
        // Company activation (Super Admin)
        await updateDoc(doc(db, 'companies', subscriptionTarget.id), {
          subscriptionExpired: false,
          approved: true,
          subscriptionEndDate: endDate
        });
        
        const compUsers = usersList.filter(u => (u.companyId === subscriptionTarget.id || (u.email && u.email.toLowerCase() === subscriptionTarget.adminEmail?.toLowerCase())) && u.role !== 'branch');
        await Promise.all(compUsers.map(u => 
          updateDoc(doc(db, 'users', u.id), {
            subscriptionExpired: false,
            subscriptionEndDate: endDate
          }).catch(err => console.error("Could not update user subscription:", err))
        ));
        
        localStorage.setItem('activation_' + subscriptionTarget.adminEmail, now);
        
        setCompanies(prev => prev.map(c => c.id === subscriptionTarget.id ? { ...c, subscriptionExpired: false, approved: true, subscriptionEndDate: endDate } : c));
        setUsersList(prev => prev.map(u => ((u.companyId === subscriptionTarget.id || (u.email && u.email.toLowerCase() === subscriptionTarget.adminEmail?.toLowerCase())) && u.role !== 'branch') ? { ...u, subscriptionExpired: false, subscriptionEndDate: endDate } : u));
        
        setActivationDate(now);
        toast.success(`تم تفعيل الاشتراك لشركة ${subscriptionTarget.name} لـ ${subscriptionDays} يوم بنجاح`);
      }
      setShowSubscriptionModal(false);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تفعيل الاشتراك');
    }
  };

  const handleDeleteCompanyForAdmin = async (compId: string) => {
    if (!isSuperAdmin) {
      toast.error('لا تملك الصلاحية لحذف الشركة');
      return;
    }

    try {
      // 1. users
      const compUsers = usersList.filter(u => u.companyId === compId || (u.email && u.email.toLowerCase() === companies.find(c=>c.id === compId)?.adminEmail?.toLowerCase()));
      for(const cu of compUsers) {
         try { await deleteDoc(doc(db, 'users', cu.id)); } catch(e) { console.warn("Failed to delete user", cu.id, e); }
      }

      // 2. cars
      const compCars = cars.filter(c => c.companyId === compId);
      for(const c of compCars) {
        try { await deleteDoc(doc(db, 'inventory', c.id)); } catch(e) { console.warn("Failed to delete car", c.id, e); }
      }

      // 3. contracts
      const compContracts = contracts.filter(c => c.companyId === compId);
      for(const c of compContracts) {
        try { await deleteDoc(doc(db, 'contracts', c.id)); } catch(e) { console.warn("Failed to delete contract", c.id, e); }
      }

      // 4. maintenance
      const compMaint = maintenanceRecords.filter(m => m.companyId === compId);
      for(const c of compMaint) {
        try { await deleteDoc(doc(db, 'maintenance', c.id)); } catch(e) { console.warn("Failed to delete maintenance", c.id, e); }
      }

      // 5. GPS
      const compGps = gpsDevices.filter(g => g.companyId === compId);
      for(const c of compGps) {
        try { await deleteDoc(doc(db, 'gps_devices', c.id)); } catch(e) { console.warn("Failed to delete gps", c.id, e); }
      }

      // 7. Delete the company 
      try { await deleteDoc(doc(db, 'companies', compId)); } catch(e) { console.warn("Failed to delete company doc", compId, e); }

      toast.success('تم حذف الشركة وبياناتها بنجاح');
      
      // Update local UI immediately
      setCompanies(prev => prev.filter(c => c.id !== compId));
      setUsersList(prev => prev.filter(u => !(u.companyId === compId || (u.email && u.email.toLowerCase() === companies.find(c=>c.id === compId)?.adminEmail?.toLowerCase()))));
      setCars(prev => prev.filter(c => c.companyId !== compId));
      setContracts(prev => prev.filter(c => c.companyId !== compId));
      setMaintenanceRecords(prev => prev.filter(c => c.companyId !== compId));
      setGpsDevices(prev => prev.filter(c => c.companyId !== compId));
    } catch (error) {
      console.error("Error deleting company:", error);
      toast.error("حدث خطأ أثناء محاولة حذف الشركة.");
    }
  };

  const activateCompanySubscription = async (comp: any) => {
    if (user.email !== 'mustfadd112@gmail.com') {
      toast.error('ليس لديك صلاحية تفعيل الاشتراك - فقط المالك يمكنه التفعيل');
      return;
    }
    setSubscriptionTarget(comp);
    setSubscriptionDays(30); // reset default
    setShowSubscriptionModal(true);
  };

  const cancelSubscription = (targetComp?: any) => {
    if (user.email !== 'mustfadd112@gmail.com') {
      toast.error('ليس لديك صلاحية لإلغاء الاشتراك - فقط المالك يمكنه الإلغاء');
      return;
    }
    setCancelTarget(targetComp || null);
    setShowCancelModal(true);
  };

  const executeCancelSubscription = async () => {
    const now = new Date().toISOString();
    const compId = cancelTarget ? cancelTarget.id : user.companyId;

    if (!compId) {
      toast.error('لم يتم العثور على بيانات الشركة');
      return;
    }

    try {
      if (cancelTarget && cancelTarget.isBranch) {
        // Cancel branch subscription
        await updateDoc(doc(db, 'users', cancelTarget.id), {
          subscriptionExpired: true,
          subscriptionEndDate: now
        });
        
        setUsersList((prev: any) => prev.map((u: any) => u.id === cancelTarget.id ? { ...u, subscriptionExpired: true, subscriptionEndDate: now } : u));
        setShowCancelModal(false);
        toast.success('تم إلغاء اشتراك الفرع بنجاح');
        return;
      }

      // Update company
      await updateDoc(doc(db, 'companies', compId), {
        subscriptionExpired: true,
        subscriptionEndDate: now
      });
      
      // Update users
      const targetAdminEmail = cancelTarget ? cancelTarget.adminEmail : user.email;
      const compUsers = usersList.filter((u: any) => (u.companyId === compId || (u.email && u.email.toLowerCase() === targetAdminEmail?.toLowerCase())) && u.role !== 'branch');
      
      await Promise.all(compUsers.map((u: any) => 
        updateDoc(doc(db, 'users', u.id), {
          subscriptionExpired: true,
          subscriptionEndDate: now
        }).catch(err => console.error("Could not update user subscription:", err))
      ));
      
      // Local updates
      if (!cancelTarget || cancelTarget.id === user.companyId) {
        setActiveCompanyData((prev: any) => prev ? { ...prev, subscriptionExpired: true, subscriptionEndDate: now } : prev);
        setActiveUserData((prev: any) => prev ? { ...prev, subscriptionExpired: true, subscriptionEndDate: now } : prev);
      }
      
      setCompanies((prev: any) => prev.map((c: any) => c.id === compId ? { ...c, subscriptionExpired: true, subscriptionEndDate: now } : c));
      setUsersList((prev: any) => prev.map((u: any) => ((u.companyId === compId || (u.email && u.email.toLowerCase() === targetAdminEmail?.toLowerCase())) && u.role !== 'branch') ? { ...u, subscriptionExpired: true, subscriptionEndDate: now } : u));
      
      setShowCancelModal(false);
      toast.success('تم إلغاء الاشتراك بنجاح');
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء إلغاء الاشتراك');
    }
  };

  // Get current company and user for dashboard subscription status
  const myCompany = activeCompanyData || companies.find(c => c.id === user?.companyId);
  const myUser = activeUserData || usersList.find(u => u.id === user?.id);

  const { isExpired: isDashboardExpired, daysRemaining: dashboardDaysRemaining } = useMemo(() => {
    let endDate: Date = new Date();                
    
    try {
      if (myUser?.subscriptionEndDate) {
        endDate = myUser.subscriptionEndDate.toDate ? myUser.subscriptionEndDate.toDate() : new Date(myUser.subscriptionEndDate);
      } else if (myCompany?.subscriptionEndDate) {
        endDate = myCompany.subscriptionEndDate.toDate ? myCompany.subscriptionEndDate.toDate() : new Date(myCompany.subscriptionEndDate);
      } else if (myCompany?.createdAt) {
        const createdDate = myCompany.createdAt.toDate ? myCompany.createdAt.toDate() : new Date(myCompany.createdAt);
        endDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else {
        endDate = new Date(Date.now() - 1000);
      }
    } catch (e) {
      endDate = new Date(Date.now() - 1000);
    }
    
    if (isNaN(endDate.getTime())) {
      endDate = new Date(Date.now() - 1000);
    }

    const diffTime = endDate.getTime() - currentTime;
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const forceExpired = (myUser?.role === 'branch') ? (myUser?.subscriptionExpired === true) : (myCompany?.subscriptionExpired === true);
    return { isExpired: forceExpired || diffTime <= 0 || days <= 0, daysRemaining: forceExpired ? 0 : days };
  }, [myCompany, myUser, currentTime]);
  
  // Keep original state for backwards compatibility if needed, but prioritize myCompany data
  const isExpired = isDashboardExpired;
  const daysRemaining = dashboardDaysRemaining;

  const handleMarkAsPaid = async (carId: string, amount: number) => {
    try {
      const car = cars.find(c => c.id === carId);
      const currentPaid = parseFloat(car?.paidProfits || 0);
      const newPaid = currentPaid + amount;
      
      await updateDoc(doc(db, 'inventory', carId), {
        paidProfits: newPaid
      });
      toast.success('تم تسجيل الدفع بنجاح وصفرت الأرباح الحالية');
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('حدث خطأ أثناء تسجيل الدفع');
    }
  };

  // Add/Save Car Handler
  const handleSaveCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carName || !carPlate) {
      toast.error(t.errorCarNamePlate);
      return;
    }
    if (carIsInvested && !carOwnerName) {
      toast.error(t.errorInvestorName);
      return;
    }
    try {
        const companyId = user?.companyId || '';
        // Removed strict 17-character validation
        if (!carChassis) {
             toast.error(t.errorChassis);
             return;
        }
        if (editingCarId) {
            await api.put('inventory', editingCarId, {
                name: carName,
                plateNumber: carPlate,
                color: carColor,
                ownerName: carOwnerName,
                ownerPhone: carOwnerPhone,
                isInvested: carIsInvested,
                investmentPercentage: parseFloat(carInvestmentPercentage) || 0,
                year: carYear,
                dailyPrice: parseFloat(carPrice),
                category: carCategory,
                status: 'available',
                imageUrl: carImageUrl,
                chassisNumber: carChassis,
                chassis: carChassis,
                chassis_number: carChassis,
                registrationNumber: carRegNumber,
                companyId: companyId
            });
            console.log("Saving car with chassis:", carChassis);
            toast.success('تم تحديث بيانات السيارة بنجاح!');
        } else {
            const payload = {
                name: carName,
                plateNumber: carPlate,
                color: carColor,
                ownerName: carOwnerName,
                ownerPhone: carOwnerPhone,
                isInvested: carIsInvested,
                investmentPercentage: parseFloat(carInvestmentPercentage) || 0,
                year: carYear,
                dailyPrice: parseFloat(carPrice),
                category: carCategory,
                status: 'available',
                imageUrl: carImageUrl,
                chassisNumber: carChassis,
                chassis: carChassis,
                chassis_number: carChassis,
                registrationNumber: carRegNumber,
                companyId: companyId
            };
            console.log("DEBUG: Saving car payload:", payload);
            await api.post('inventory', payload);

            toast.success(`تم إضافة ${carName} لأسطول الشركة بنجاح!`);
        }
      setShowCarModal(false);
      setEditingCarId(null);
      setCarName('');
      setCarPlate('');
      setCarColor('');
      setCarYear('');
      setCarOwnerName('');
      setCarOwnerPhone('');
      setCarIsInvested(false);
      setCarInvestmentPercentage('0');
      setCarImageUrl('');
      setCarChassis('');
      setCarRegNumber('');
      setCarPrice('75000');
    } catch (err: any) {
      console.error('Error saving car:', err);
      let errorMessage = 'حدث خطأ أثناء الحفظ';
      if (err.message.includes('403')) {
          errorMessage = 'تم رفض الطلب (403 Forbidden). قد يكون حجم الصورة كبيراً جداً، حاول حفظ السيارة بدون صورة.';
      } else {
          errorMessage = 'حدث خطأ أثناء الحفظ: ' + (err.message || err);
      }
      toast.error(errorMessage);
    }
  };

  // Delete Car Handler
  const handleDeleteCar = async (id: string) => {
    console.log('Attempting to delete car with ID:', id);
    // if (!confirm('هل أنت متأكد من رغبتك بحذف السيارة من الأسطول؟')) return;
    try {
      console.log('Fetching /delete-car...');
      const response = await fetch("/delete-car", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          id: id
        })
      });
      console.log('Delete status:', response.status);
      const data = await response.json().catch(() => ({}));
      console.log('Delete response data:', data);
      
      if (response.ok) {
        console.log('Delete successful, updating UI...');
        setCars(cars.filter((car: any) => car.id !== id));
        console.log('Showing toast:', data.message || t.logoutSuccess); // fallback
        toast.success(data.message || 'Deleted');
      } else {
        console.log('Delete failed with status:', response.status);
        throw new Error(data.message || t.errorDeleteCar);
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      const errorMessage = err.message || t.errorDeleteCar;
      toast.error(errorMessage);
    }
  };

  // Add Blocklist Entry
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      toast.error('لم يتم الوصول للكاميرا');
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(track => track.stop());
    setShowCamera(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const imageUrl = canvasRef.current.toDataURL('image/jpeg');
      setBlockImageUrl(imageUrl);
      stopCamera();
    }
  };

  const handleBulkBlocklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkData.trim()) {
      toast.error('الرجاء إدخال البيانات');
      return;
    }
    setBulkLoading(true);
    try {
      const rows = bulkData.split('\n');
      let successCount = 0;
      for (const row of rows) {
        if (!row.trim()) continue;
        // Check if there's a comma or tab separator
        const separator = row.includes('\t') ? '\t' : (row.includes(',') ? ',' : ' ');
        // We'll split by the best guess, or just regex split if multiple spaces
        let cols = [];
        if (separator === ' ') {
             // split by multiple spaces
             cols = row.split(/\s{2,}/);
             if (cols.length === 1) cols = row.split(' ');
        } else {
             cols = row.split(separator);
        }

        const name = cols[0] || '';
        const phoneNumber = cols[1] || '';
        const idNumber = cols[2] || '';
        const blockReason = cols.slice(3).join(' ') || 'إضافة بالجملة';
        
        if (name && name.trim()) {
          await api.post('blocklist', {
            name: name.trim(),
            phoneNumber: phoneNumber.trim(),
            blockReason: blockReason.trim(),
            idNumber: idNumber.trim(),
            idType: 'أخرى',
            imageUrl: ''
          });
          successCount++;
        }
      }
      toast.success(`تمت إضافة ${successCount} مستأجر بنجاح إلى قائمة الحظر.`);
      setShowBulkBlockModal(false);
      setBulkData('');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء الإضافة');
    } finally {
      setBulkLoading(false);
    }
  };

  const deleteCompletedContracts = async () => {
    if (userRole !== 'super_admin') {
      toast.error('فقط المالك العام يمكنه القيام بهذا الإجراء');
      return;
    }
    
    const completedContracts = contracts.filter(c => c.bookingStatus === 'completed');
    if (completedContracts.length === 0) {
      toast.error('لا توجد عقود منجزة لحذفها');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف ${completedContracts.length} عقد منجز نهائياً؟ سيتم تحديث الأرباح والواردات تلقائياً. لا يمكن التراجع عن هذا الإجراء.`)) return;

    try {
      const toastId = toast.loading('جاري حذف العقود وتحديث الأرباح...');
      const deletePromises = completedContracts.map(c => deleteDoc(doc(db, 'contracts', c.id)));
      await Promise.all(deletePromises);
      toast.dismiss(toastId);
      toast.success('تم حذف العقود المنجزة وتحديث الأرباح بنجاح');
    } catch (err) {
      toast.dismiss();
      console.error(err);
      toast.error('حدث خطأ أثناء حذف العقود');
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockName || !blockPhone) {
      toast.error(t.errorFieldsRequired);
      return;
    }
    try {
      await api.post('blocklist', {
        name: blockName,
        phoneNumber: blockPhone,
        blockReason,
        idNumber: blockNationalId,
        idType: blockIdType,
        imageUrl: blockImageUrl,
        companyId: user.companyId,
        companyName: user.companyName,
        reportedAt: new Date().toISOString()
      });
      toast.success('تم حظر السائق وتعميمه في قائمة الحظر الموحدة!');
      setShowBlockModal(false);
      setBlockName('');
      setBlockPhone('');
      setBlockReason('');
      setBlockNationalId('');
      setBlockImageUrl('');
      setBlockIdType('البطاقة الوطنية');
    } catch (err) {
      toast.error(t.errorBlockDriver);
    }
  };

  // Delete Blocklist entry
  const handleRemoveBlock = async (id: string) => {
    console.log('--- START handleRemoveBlock ---', id);
    try {
      console.log('--- Calling api.delete ---');
      await api.delete('blocklist', id);
      console.log('--- Delete call completed ---');
      setBlkList(prev => prev.filter(item => item.id !== id));
      toast.success('تم إلغاء الحظر وتحديث القائمة بنجاح');
      console.log('--- Toast success shown ---');
    } catch (err) {
      console.error('--- Error in handleRemoveBlock ---', err);
      toast.error(t.errorUnblock + ': ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    }
  };

  const handleRemoveExternalBlock = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'external_blocklist', id));
      setExternalBlkList(prev => prev.filter(item => item.id !== id));
      toast.success('تم حذف التعميم الخارجي بنجاح');
    } catch (err) {
      console.error('Error removing external block:', err);
      toast.error('حدث خطأ أثناء حذف التعميم الخارجي');
    }
  };

  const handleFaceMatch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsMatchingFace(true);
    setMatchedFaceData(null);
    const toastId = toast.loading('جاري مطابقة الوجه وتحليل الملامح...');
    
    try {
      const base64Data = await compressImage(file);
      
      try {
        // Combine internal and external blocklists for searching
        const combinedList = [...blkList, ...externalBlkList];
        
        const match = await findMatchingFace(base64Data, combinedList);
        
        if (match) {
           setMatchedFaceData(match);
           toast.success('تم العثور على تطابق في قائمة الحظر!', { id: toastId });
        } else {
           toast.success('سجل نظيف, لم يتم العثور على الوجه في قائمة الحظر.', { id: toastId });
        }
      } catch (err: any) {
           toast.error('حدث خطأ أثناء مطابقة الوجه', { id: toastId });
      } finally {
           setIsMatchingFace(false);
      }
    } catch (err) {
      toast.error('حدث خطأ غير متوقع', { id: toastId });
      setIsMatchingFace(false);
    }
    e.target.value = '';
  };

  // Update settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('companies', user.companyId, {
        name: companyName,
        phoneNumber: companyPhoneSetting,
        email: companyEmailSetting,
        address: companyAddressSetting,
        logoUrl: companyLogoUrl,
        establishmentImageUrl: companyEstablishmentImageUrl,
        identityNumber: companyTaxId,
        identityType: 'الهوية الضريبية / السجل التجاري',
        contractTerms: companyContractTerms,
        driverContractTerms: companyDriverContractTerms,
        qrCodeFields: qrCodeFields
      });
      
      // Update local storage representation
      const updatedUser = { 
        ...user, 
        companyName: companyName,
        companyPhone: companyPhoneSetting 
      };
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      toast.success('Settings Saved');
    } catch (e) {
      toast.error(t.errorUpdateCompany);
    }
  };

  // Approve newly registered company (Super admin flow)
  const handleToggleCompanyApproval = async (comp: any) => {
    try {
      const newApprovedState = !comp.approved;
      await api.put('companies', comp.id, {
        approved: newApprovedState,
        subscriptionExpired: !newApprovedState // If not approved, subscription is effectively expired
      });
      toast.success(comp.approved ? 'تم تعطيل الحساب' : 'تم تفعيل واعتماد الشركة');
    } catch (e) {
      toast.error('حدث خطأ أثناء معالجة الطلب');
    }
  };

  const handleUnblockCompany = async (companyId: string) => {
    try {
      await api.unblockCompany(companyId);
      
      // Update Firestore for immediate UI reflection
      const matchedUser = (usersList || []).find((u: any) => u.companyId === companyId);
      if (matchedUser && matchedUser.id) {
          try {
              await updateDoc(doc(db, 'users', matchedUser.id), {
                  lockUntil: null,
                  loginAttempts: 0,
                  isLockedBySystem: false
              });
          } catch (e) {
              console.error("Firestore unblock sync error:", e);
          }
      }
      
      toast.success('Unblocked');
    } catch (e) {
      toast.error(t.errorUnblock);
    }
  };

  const handleToggleBanCompany = async (companyId: string) => {
    try {
      const res = await api.toggleBanCompany(companyId);
      
      // Update Firestore for immediate UI reflection
      try {
          const compRef = doc(db, 'companies', companyId);
          await updateDoc(compRef, { isBanned: res.isBanned });
          
          const usersToUpdate = (usersList || []).filter((u: any) => u.companyId === companyId);
          await Promise.all(usersToUpdate.map(u => 
              updateDoc(doc(db, 'users', u.id), { isBanned: res.isBanned })
          ));
      } catch (e) {
          console.error("Firestore ban sync error:", e);
      }

      toast.success(res.message);
    } catch (e) {
      toast.error(t.errorUnblock);
    }
  };

  const handleApprovePassword = async (companyId: any, userId?: any) => {
    try {
        const resp = await fetch(`/api/approve-password-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')?.replace(/^"|"$/g, '')}` },
            body: JSON.stringify({ companyId, userId })
        });
        const data = await resp.json().catch(() => ({ message: t.errorApprovalProcess }));
        if (resp.ok) {
            toast.success(data.message || 'Approved');
        } else {
            throw new Error(data.message || t.errorApprovalProcess);
        }
    } catch (err: any) {
        toast.error(err.message || 'حدث خطأ أثناء الموافقة');
        console.error(err);
    }
  };

  const handleUpdateUserRole = async (email: string, currentRole: string) => {
    const newRole = currentRole === 'super_admin' ? 'admin' : 'super_admin';
    
    try {
      const token = localStorage.getItem('auth_token')?.replace(/^"|"$/g, '');
      const res = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, newRole })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        // Force refresh users list locally
        setUsersList(prev => prev.map(u => u.email === email ? { ...u, role: newRole } : u));
      } else {
        toast.error(data.message || t.errorUpdateRank);
      }
    } catch (e) {
      console.error('Role update error:', e);
      toast.error('حدث خطأ أثناء تحديث الرتبة');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Loader className="w-8 h-8 text-neutral-400 animate-spin mb-3" />
        <p className="text-sm font-medium text-neutral-400 font-sans">جاري جلب بيانات عراق رنتل...</p>
      </div>
    );
  }

  // If no user is logged in, present pristine White login container
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
           <Loader className="animate-spin text-amber-400" size={48} />
           <p className="font-bold text-xl">جاري التحقق من العقد...</p>
        </div>
      </div>
    );
  }

  if (publicContractView) {
    return (
      <div className="min-h-screen bg-slate-900 p-4 lg:p-10 flex flex-col items-center overflow-y-auto custom-scrollbar">
         {/* Floating Success Indicator */}
         <div className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-black animate-bounce">
            <FileCheck size={24} />
            <span>عقد مصدق ونظامي ✅</span>
         </div>

         <div className="w-full max-w-5xl flex flex-col items-center pb-12">
               <ContractView 
                  contractInitialData={publicContractView.contract}
                  company={publicContractView.company}
                  staff={null}
                  isWithDriver={publicContractView.contract.isWithDriver}
                  readOnly={true}
               />
               
               <div className="mt-8 text-center text-slate-400 text-sm font-bold opacity-60">
                   <p>نظام أوراكل لإدارة عقود تأجير السيارات الذكية</p>
                   <p className="mt-1">تم التحقق من صحة هذا العقد رقم {publicContractView.contract.contractCode} إلكترونياً</p>
               </div>
         </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-center">
          {(t) => (
            <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5 p-4 border-r-4 ${t.type === 'error' ? 'border-red-500' : 'border-green-500'} dark:bg-neutral-900 dark:border-neutral-700`} dir="rtl">
              <div className="flex gap-4 p-2 items-start text-right">
                <div className="flex-shrink-0 pt-0.5">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                    {t.type === 'error' ? <ShieldAlert size={24} className="text-red-600 dark:text-red-400" /> : <CheckCircle size={24} className="text-green-600 dark:text-green-400" />}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                   {t.type === 'custom' ? (
                       resolveValue(t.message, t)
                   ) : (
                     <>
                       <p className="text-base font-bold text-gray-900 dark:text-white">
                         {t.type === 'error' ? 'تنبيه !' : t.type === 'loading' ? 'جاري...' : 'نجاح'}
                       </p>
                       <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                         {resolveValue(t.message, t)}
                       </p>
                     </>
                   )}
                </div>
              </div>
              {t.type !== 'custom' && t.type !== 'loading' && (
                <div className="flex border-t border-gray-100 dark:border-neutral-800 mt-3 pt-3 gap-2">
                  <button onClick={() => toast.dismiss(t.id)} className={`flex-1 flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white transition ${t.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                    تم
                  </button>
                  <button onClick={() => toast.dismiss(t.id)} className="flex-1 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-neutral-800 px-4 py-2 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition">
                    إغلاق
                  </button>
                </div>
              )}
            </div>
          )}
        </Toaster>
        <div className="absolute top-4 right-4 z-50">
          <LanguageSwitcher />
        </div>
        <AuthScreen onLoginSuccess={(u) => { setUser(u); setCurrentTab('dashboard'); }} />
      </>
    );
  }

  return (
    <div className={`min-h-screen bg-white dark:bg-neutral-900 transition-colors duration-300 flex flex-col font-sans ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <Toaster position="top-center">
            {(t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col ring-1 ring-black ring-opacity-5 p-4 border-r-4 ${t.type === 'error' ? 'border-red-500' : 'border-green-500'} dark:bg-neutral-900 dark:border-neutral-700`} dir={isRtl ? 'rtl' : 'ltr'}>
                <div className={`flex gap-4 p-2 items-start ${isRtl ? 'text-right' : 'text-left'}`}>
                  <div className="flex-shrink-0 pt-0.5">
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover border border-gray-100 shadow-sm" loading="lazy" decoding="async" />
                    ) : (
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                        {t.type === 'error' ? <ShieldAlert size={24} className="text-red-600 dark:text-red-400" /> : <CheckCircle size={24} className="text-green-600 dark:text-green-400" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                     {t.type === 'custom' ? (
                         resolveValue(t.message, t)
                     ) : (
                       <>
                         <p className="text-base font-bold text-gray-900 dark:text-white">
                           {t.type === 'error' ? 'تنبيه !' : t.type === 'loading' ? 'جاري...' : 'نجاح'}
                         </p>
                         <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                           {resolveValue(t.message, t)}
                         </p>
                       </>
                     )}
                  </div>
                </div>
                {t.type !== 'custom' && t.type !== 'loading' && (
                  <div className="flex border-t border-gray-100 dark:border-neutral-800 mt-3 pt-3 gap-2">
                    <button onClick={() => toast.dismiss(t.id)} className={`flex-1 flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white transition ${t.type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                      تم
                    </button>
                    <button onClick={() => toast.dismiss(t.id)} className="flex-1 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-neutral-800 px-4 py-2 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition">
                      إغلاق
                    </button>
                  </div>
                )}
              </div>
            )}
          </Toaster>
      
      {/* Top Navbar - visible on mobile only because desktop layout has the full sidebar controls */}
      <header className="lg:hidden bg-white dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 shadow-sm sticky top-0 z-40 px-6 py-4 flex flex-row-reverse items-center justify-between">
        
        {/* Brand / Logo */}
        <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-md shadow-amber-500/10 shrink-0">
            <span className="font-serif font-black text-lg">{isRtl ? 'ع' : 'IR'}</span>
          </div>
          <div className={`${isRtl ? 'text-right' : 'text-left'}`}>
            <h1 className="font-black text-lg text-black leading-tight">{isRtl ? 'عراق رنتل' : 'Iraq Rental'}</h1>
            <p className="text-xs text-amber-600 dark:text-amber-500 font-bold">{isRtl ? 'بوابة شركات التأجير الحديثة' : 'Modern Rental Gateway'}</p>
          </div>
        </div>

        {/* User Card & Controls */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 flex-row-reverse bg-neutral-100 dark:bg-neutral-900 px-4 py-2 rounded-2xl">
            <User size={16} className="text-amber-600" />
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-neutral-900 dark:text-white">{user.fullName}</div>
              <div className="text-[10px] text-neutral-500 font-bold">
                {isSuperAdmin ? 'المالك العام للنظام (Super Admin)' : user.companyName || 'مدير شركة'}
              </div>
            </div>
          </div>

          {/* SignOut Button */}
          <button 
            onClick={handleLogout} 
            className="w-10 h-10 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 flex items-center justify-center transition"
            title="تسجيل الخروج"
          >
            <LogOut size={18} />
          </button>
        </div>

      </header>

      {/* Main Grid / Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        
        {/* Responsive Sidebar - ALWAYS DARK to match the premium mixed interface of the photograph */}
        <aside className="w-full lg:w-60 bg-[#0c1424] border-t lg:border-t-0 border-slate-900 lg:border-r border-slate-900/80 p-4 shrink-0 flex flex-col text-right z-35 text-white sticky top-0 h-screen overflow-y-auto custom-scrollbar">
          
          {/* Logo Brand Area */}
          <div className={`flex flex-col items-center gap-3 justify-center pb-4 mb-4 border-b border-slate-800 text-center`}>
            {companyLogoUrl ? (
              <img src={companyLogoUrl} alt="Logo" className="w-[124px] h-32 -mx-[2px] -mt-[5px] object-contain shrink-0 rounded-xl bg-white p-2 shadow-sm" loading="lazy" decoding="async" />
            ) : (
              <div className="w-[124px] h-32 -mx-[2px] -mt-[5px] bg-slate-800/80 rounded-xl flex items-center justify-center text-white border border-slate-700/60 shadow-inner shrink-0">
                <Car size={48} className="text-[#ed3131]" />
              </div>
            )}
            <div className={`min-w-0 flex-1 w-full`}>
              <h2 className="font-sans font-black text-white text-[16px] tracking-tight w-full break-words leading-tight text-center">{myCompany?.name || user?.companyName || (isRtl ? 'عراق رنتل' : 'Iraq Rental')}</h2>
            </div>
          </div>

          {/* Navigation Links list */}
          <div className={`flex flex-col gap-0.5 w-full text-[14px] leading-[18px] ${isRtl ? 'text-right' : 'text-left'}`}>
            
            <button 
              onClick={() => setCurrentTab('dashboard')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'dashboard' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <Grid size={16} className={currentTab === 'dashboard' ? 'text-white' : 'text-slate-500'} />
                <span>{t.dashboard}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('fleet')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'fleet' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <Car size={16} className={currentTab === 'fleet' ? 'text-white' : 'text-slate-500'} />
                <span>{t.fleet}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('investor-cars')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'investor-cars' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <ShieldCheck size={16} className={currentTab === 'investor-cars' ? 'text-white' : 'text-slate-500'} />
                <span>{t.investorCars}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('debts')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'debts' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <CreditCard size={16} className={currentTab === 'debts' ? 'text-white' : 'text-slate-500'} />
                <span>ديون المستأجرين</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('customers')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'customers' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <Users size={16} className={currentTab === 'customers' ? 'text-white' : 'text-slate-500'} />
                <span>{t.customers}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('gps')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'gps' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <Map size={16} className={currentTab === 'gps' ? 'text-white' : 'text-slate-500'} />
                <span>{t.gpsTracking}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('notifications')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} relative ${currentTab === 'notifications' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <Bell size={16} className={currentTab === 'notifications' ? 'text-white' : 'text-slate-500'} />
                <span className="text-[#9d9d9d]">{t.notifications}</span>
              </div>
              {notificationsCount > 0 && (
                <span className="bg-[#77b74a] text-white font-mono font-black rounded-full px-1 py-0.5 text-[14px]">
                  {notificationsCount}
                </span>
              )}
            </button>

            <button 
              onClick={() => setCurrentTab('conversations')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'conversations' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3.5 flex-row-reverse">
                <MessageSquare size={16} className={currentTab === 'conversations' ? 'text-white' : 'text-slate-500'} />
                <span>{t.conversations}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('maintenance')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'maintenance' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3.5 flex-row-reverse">
                <Settings size={16} className={currentTab === 'maintenance' ? 'text-white' : 'text-slate-500'} />
                <span>{t.maintenanceExpenses}</span>
              </div>
            </button>

            <button 
              onClick={() => setCurrentTab('employees')} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'employees' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className="flex items-center gap-3.5 flex-row-reverse">
                <Users size={16} className={currentTab === 'employees' ? 'text-white' : 'text-slate-500'} />
                <span>{t.employees || "إدارة الموظفين والرواتب"}</span>
              </div>
            </button>


            <div className="my-3 border-t border-slate-700/50"></div>
            
            {/* Collapsible: Contracts */}
            <button 
              onClick={() => toggleGroup('contracts')} 
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black text-slate-400 hover:bg-white/5 hover:text-white transition flex-row-reverse text-right"
            >
              <div className="flex items-center gap-3 flex-row-reverse">
                <FileText size={16} />
                <span>{t.contractsManagement}</span>
              </div>
              {openGroups.contracts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openGroups.contracts && (
              <>
                <button 
                  onClick={() => {
                    localStorage.removeItem('contractData');
                    localStorage.removeItem('contractCustomerImg');
                    localStorage.removeItem('contractCarImg');
                    setCurrentTab('new-contract');
                    setContractKey(Date.now());
                  }} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'new-contract' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.electronicContract}</span>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    localStorage.removeItem('contractData_driver');
                    localStorage.removeItem('contractCustomerImg_driver');
                    localStorage.removeItem('contractCarImg_driver');
                    setCurrentTab('new-contract-driver');
                    setContractKey(Date.now());
                  }} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'new-contract-driver' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.contractWithDriver}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('contracts-list')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'contracts-list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.activeContracts}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('contracts-driver-list')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'contracts-driver-list' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.activeDriverContracts}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('contracts-completed')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'contracts-completed' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.completedContracts}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('contracts-expired')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'contracts-expired' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.expiredContracts}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('contracts-cancelled')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'contracts-cancelled' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>العقود الملغية</span>
                  </div>
                </button>
              </>
            )}

            {/* Collapsible: Security */}
            <button 
              onClick={() => toggleGroup('security')} 
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black text-slate-400 hover:bg-white/5 hover:text-white transition flex-row-reverse text-right"
            >
              <div className="flex items-center gap-3 flex-row-reverse">
                <ShieldAlert size={16} />
                <span>{t.securityManagement}</span>
              </div>
              {openGroups.security ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openGroups.security && (
              <>
                <button 
                  onClick={() => setCurrentTab('blocklist')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'blocklist' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.blocklist}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('external-blocklist')} 
                  className={`w-full flex items-center justify-between px-3 py-2.5 pr-8 rounded-none text-[14px] font-black transition flex-row-reverse text-right ${currentTab === 'external-blocklist' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <span>{t.externalBlocklist}</span>
                  </div>
                </button>
              </>
            )}

            {/* Collapsible: Profits */}
            <button 
              onClick={() => toggleGroup('profits')} 
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-[17px] font-black text-slate-400 hover:bg-white/5 hover:text-white transition flex-row-reverse text-right"
            >
              <div className="flex items-center gap-3.5 flex-row-reverse">
                <Award size={16} />
                <span>{t.profits}</span>
              </div>
              {openGroups.profits ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openGroups.profits && (
              <>
                <button 
                  onClick={() => setCurrentTab('profits-no-driver')} 
                  className={`w-full flex items-center justify-between px-4 py-3 pr-8 rounded-xl text-[15px] font-black transition flex-row-reverse text-right ${currentTab === 'profits-no-driver' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3.5 flex-row-reverse">
                    <span className="truncate">{t.withoutDriver}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('profits-driver')} 
                  className={`w-full flex items-center justify-between px-4 py-3 pr-8 rounded-xl text-[15px] font-black transition flex-row-reverse text-right ${currentTab === 'profits-driver' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3.5 flex-row-reverse">
                    <span className="truncate">{t.withDriver}</span>
                  </div>
                </button>
                <button 
                  onClick={() => setCurrentTab('profits-invested')} 
                  className={`w-full flex items-center justify-between px-4 py-3 pr-8 rounded-xl text-[15px] font-black transition flex-row-reverse text-right ${currentTab === 'profits-invested' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3.5 flex-row-reverse">
                    <span className="truncate">{t.invested}</span>
                  </div>
                </button>
              </>
            )}

            {isSuperAdmin && (
              <>
                <button 
                  onClick={() => setCurrentTab('super-admin')} 
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-black transition flex-row-reverse text-right w-[251px] h-[37.5px] leading-[24.5px] text-[22px] ${currentTab === 'super-admin' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <div className="flex items-center gap-3.5 flex-row-reverse">
                    <Building size={15} className={currentTab === 'super-admin' ? 'text-white' : 'text-slate-500'} />
                    <span className="text-[18px]">{t.companies}</span>
                  </div>
                </button>
              </>
            )}


            <button 
              onClick={() => setCurrentTab('settings')} 
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[11px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} ${currentTab === 'settings' ? 'bg-slate-800 text-white shadow font-black border border-slate-700/60' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <Settings size={15} className={currentTab === 'settings' ? 'text-white' : 'text-slate-500'} />
                <span>{t.settings}</span>
              </div>
            </button>

          </div>


          {/* Divider */}
          <div className="border-t border-slate-800/85 my-2 shrink-0" />

          {/* Subscription Counter Sidebar Widget */}
          <div className="mt-auto mb-3 px-3 py-3 bg-[#080d16] rounded-2xl border border-slate-800/60 shadow-inner">
            <div className={`flex items-center justify-between mb-2 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{isRtl ? 'حالة الاشتراك' : 'Subscription'}</span>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black ${isExpired ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                <div className={`w-1 h-1 rounded-full animate-pulse ${isExpired ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                {isExpired ? (isRtl ? 'منتهي' : 'Expired') : (isRtl ? 'نشط' : 'Active')}
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <div className={`flex items-baseline gap-1 ${isRtl ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`}>
                <span className={`text-xl font-black font-mono ${isExpired ? 'text-red-500' : daysRemaining <= 5 ? 'text-amber-500' : 'text-white'}`}>{daysRemaining}</span>
                <span className="text-[10px] text-slate-500 font-bold">{isRtl ? 'يوم متبقي' : 'days left'}</span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden border border-slate-800/50">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, (daysRemaining / 30) * 100))}%` }}
                  className={`h-full ${isExpired ? 'bg-red-600' : daysRemaining <= 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                />
              </div>
            </div>
          </div>

           {/* User profile panel matching screenshot footer */}
          <div className={`flex items-center gap-3 bg-[#080d16] p-3 rounded-2xl border border-slate-800/60 mt-auto shrink-0 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0">
              <span className="text-xs font-black text-slate-300">{user.fullName?.charAt(0) || 'U'}</span>
            </div>
            <div className={`${isRtl ? 'text-right' : 'text-left'} overflow-hidden`}>
              <p className="text-xs font-black text-white truncate">{user.fullName}</p>
              <motion.p 
                whileHover={{ x: isRtl ? -2 : 2, color: '#f8fafc' }}
                className={`text-[9px] text-slate-400 font-bold truncate cursor-default flex items-center gap-1 group transition-colors duration-200 ${isRtl ? 'justify-end' : 'justify-start'}`}
              >
                {isRtl && (
                  <motion.span 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  ></motion.span>
                )}
                {userRole === 'super_admin' ? (isRtl ? 'المشرف العام' : 'Super Admin') : user.companyName}
                {!isRtl && (
                  <motion.span 
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                  ></motion.span>
                )}
              </motion.p>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800">
            <LanguageSwitcher />
            <button 
              onClick={handleLogout} 
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-none text-[14px] font-black transition ${isRtl ? 'flex-row-reverse text-right' : 'flex-row text-left'} text-red-400 hover:bg-red-950/20 hover:text-red-300`}
            >
              <div className={`flex items-center gap-3.5 ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                <LogOut size={16} />
                <span>{t.logout}</span>
              </div>
            </button>
          </div>
        </aside>

        {/* Content Panel Area with Checkered Argyle pattern background */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full bg-[#ded7d7] transition-colors duration-300 relative">
          
          {/* Transition wrapper */}
          <div className="space-y-6 relative z-10 w-full mb-20 md:mb-0">

             {/* TAB: DASHBOARD */}
             {currentTab === 'dashboard' && (
                <div className={`space-y-6 ${isRtl ? 'text-right' : 'text-left'}`}>
                  
                  <div className={`flex justify-between items-center ${isRtl ? 'flex-row-reverse' : 'flex-row'}`}>
                     <div className={`flex flex-col ${isRtl ? 'items-end text-right' : 'items-start text-left'}`}>
                        <h1 className={`text-2xl font-black text-slate-800 tracking-tight`}>{t.dashboard} ({myCompany?.name || user?.companyName || (isRtl ? 'عراق رنتل' : 'Iraq Rental')})</h1>
                        
                        {/* Subscription Counter Badge */}
                        <div className={`mt-1 flex items-center gap-2 px-3 py-1 rounded-lg border shadow-sm ${isExpired ? 'bg-red-50 border-red-100 text-red-600' : daysRemaining <= 5 ? 'bg-amber-50 border-amber-100 text-amber-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isExpired ? 'bg-red-500' : daysRemaining <= 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            {isExpired ? (isRtl ? 'اشتراك منتهي' : 'Subscription Expired') : (isRtl ? `متبقي ${daysRemaining} يوم في الاشتراك` : `${daysRemaining} days remaining`)}
                          </span>
                        </div>
                     </div>

                     <div className="flex items-center gap-3">
                       <button 
                         onClick={() => setCurrentTab('contracts-cancelled')} 
                         className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl hover:bg-red-100 transition-all font-black text-xs shadow-sm"
                         title="العقود الملغية"
                       >
                         <FileText size={16} />
                         <span>العقود الملغية</span>
                       </button>
                       <button 
                         onClick={() => setCurrentTab('contracts-expired')} 
                         className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl hover:bg-amber-100 transition-all font-black text-xs shadow-sm"
                         title="العقود المنتهية"
                       >
                         <FileText size={16} />
                         <span>العقود المنتهية</span>
                       </button>
                       <button 
                         onClick={() => setCurrentTab('contracts-completed')} 
                         className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-all font-black text-xs shadow-sm"
                         title="تقييم العملاء"
                       >
                         <FileText size={16} />
                         <span>تقييم العملاء</span>
                       </button>
                       <button 
                         onClick={() => setCurrentTab('contracts-list')} 
                         className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-100 transition-all font-black text-xs shadow-sm"
                         title="العقود النشطة"
                       >
                         <FileText size={16} />
                         <span>العقود النشطة</span>
                       </button>
                       {isSuperAdmin && (
                         <button 
                           onClick={() => toast.success('سيتم إضافة هذه الميزة قريباً')} 
                           className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl hover:bg-amber-100 transition-all font-black text-xs shadow-sm"
                           title="اضافة تقييم للعميل"
                         >
                           <span className="text-base">⭐</span>
                           <span>اضافة تقييم للعميل</span>
                         </button>
                       )}
                     </div>
                  </div>
                  
                  {/* Tier 3: Main Dashboard Content (Contracts & Alerts) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Latest Contracts Card */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-xl flex flex-col space-y-6 text-right h-[400px]">
                      <div className="flex items-center justify-between border-b pb-5 border-slate-100 flex-row-reverse">
                        <div className="flex items-center gap-3 flex-row-reverse">
                          <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                             <FileText size={18} />
                          </div>
                          <div className="text-right">
                            <h2 className="text-base font-black text-slate-900 leading-tight">آخر العقود الموثقة</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">سجلات النشاط الأخيرة</p>
                          </div>
                        </div>
                        <button onClick={() => setCurrentTab('contracts-list')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black transition-colors border border-slate-200/50">عرض الكل</button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                         {contracts.length === 0 && (
                           <div className="flex flex-col items-center justify-center pt-12 pb-4 text-slate-300">
                             <FileCheck size={48} className="mb-3 opacity-20" />
                             <p className="text-xs font-black tracking-wide uppercase">{t.noActiveContracts}</p>
                           </div>
                         )}
                        {contracts.slice().sort((a, b) => {
                          let dateA = 0; let dateB = 0;
                          try {
                            if (a.createdAt) dateA = a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
                          } catch(e){}
                          try {
                            if (b.createdAt) dateB = b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
                          } catch(e){}
                          if (isNaN(dateA)) dateA = 0;
                          if (isNaN(dateB)) dateB = 0;
                          return dateB - dateA;
                        }).slice(0, 6).map((contract, i) => (
                           <motion.div 
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             transition={{ delay: i * 0.05 }}
                             whileHover={{ scale: 1.01, x: -2 }}
                             key={contract.id || i} 
                             className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between flex-row-reverse hover:bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
                             onClick={() => {
                               setTargetContractId(contract.id);
                               if (contract.isWithDriver) setCurrentTab('contracts-driver-list');
                               else if (contract.bookingStatus === 'completed') setCurrentTab('contracts-completed');
                               else if (contract.bookingStatus === 'expired') setCurrentTab('contracts-expired');
                               else setCurrentTab('contracts-list');
                             }}
                           >
                             <div className="flex items-center gap-3 flex-row-reverse">
                               <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-colors">
                                 <Users size={18} />
                               </div>
                               <div className="text-right">
                                 <span className="text-xs font-black text-slate-900 block group-hover:text-blue-600 transition-colors">{contract.fullName || contract.renterName || t.noName}</span>
                                 <span className="text-[10px] text-slate-400 font-bold block">{contract.carModel} • {contract.plateNumber}</span>
                               </div>
                             </div>
                             <div className="flex flex-col items-start gap-1">
                               <span className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider ${
                                 contract.bookingStatus === 'active' ? 'bg-emerald-100 text-emerald-700' :
                                 contract.bookingStatus === 'completed' ? 'bg-blue-100 text-blue-700' :
                                 'bg-slate-200 text-slate-600'
                               }`}>
                                 {contract.bookingStatus === 'active' ? t.active : contract.bookingStatus === 'completed' ? t.completed : t.expired}
                               </span>
                               <span className="text-[9px] text-slate-300 font-mono">
                                 {contract.createdAt?.toDate ? contract.createdAt.toDate().toLocaleDateString('en-GB') : new Date(contract.createdAt).toLocaleDateString('en-GB')}
                               </span>
                             </div>
                           </motion.div>
                        ))}
                      </div>
                      <button 
                        onClick={() => { 
                          localStorage.removeItem('contractData');
                          localStorage.removeItem('contractCustomerImg');
                          localStorage.removeItem('contractCarImg');
                          setCurrentTab('new-contract'); 
                          setContractKey(Date.now()); 
                        }} 
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-[12px] font-black shadow-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        {t.createElectronicContract}
                      </button>
                    </div>

                    {/* Fleet Status Card */}
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-xl flex flex-col space-y-6 text-right h-[400px] relative overflow-hidden group">
                       {/* Subtle technical background accent */}
                       <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                       
                      <div className="flex items-center justify-between border-b pb-5 border-slate-100 flex-row-reverse relative z-10">
                        <div className="flex items-center gap-3 flex-row-reverse">
                          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                             <Car size={18} strokeWidth={2.5} />
                          </div>
                          <div className="text-right">
                            <h2 className="text-base font-black text-slate-900 leading-tight">{t.fleetDistribution}</h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.realTimeMonitoring}</p>
                          </div>
                        </div>
                        <button onClick={() => setCurrentTab('fleet')} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200/50 hover:shadow-sm">{t.manageFleet}</button>
                      </div>

                      <div className="flex-1 flex flex-col space-y-4 relative z-10">
                         {/* Distribution List (Menu/Dropdown aesthetic) */}
                         <div className="space-y-2.5 overflow-y-auto custom-scrollbar pr-1 max-h-[220px]">
                            {/* Available Item */}
                            <motion.div 
                              whileHover={{ x: -4 }}
                              className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between flex-row-reverse hover:bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group/item"
                            >
                               <div className="flex items-center gap-4 flex-row-reverse">
                                  <div className="w-10 h-10 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover/item:scale-110 transition-transform">
                                     <Check size={18} strokeWidth={3} />
                                  </div>
                                  <div className="text-right">
                                     <span className="text-xs font-black text-slate-900 block group-hover/item:text-blue-600 transition-colors">{t.availableVehicles}</span>
                                     <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t.readyForRent}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className="text-xl font-black text-slate-900 font-mono">{cars.filter((c: any) => c.status !== 'rented').length}</span>
                                  <ChevronLeft size={14} className="text-slate-300 group-hover/item:text-blue-500 transition-colors" />
                               </div>
                            </motion.div>

                            {/* Rented Item */}
                            <motion.div 
                              whileHover={{ x: -4 }}
                              className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between flex-row-reverse hover:bg-white hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer group/item"
                            >
                               <div className="flex items-center gap-4 flex-row-reverse">
                                  <div className="w-10 h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 group-hover/item:scale-110 transition-transform">
                                     <Car size={18} strokeWidth={3} />
                                  </div>
                                  <div className="text-right">
                                     <span className="text-xs font-black text-slate-900 block group-hover/item:text-blue-600 transition-colors">{t.contractsInProgress}</span>
                                     <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{t.vehiclesInOperation}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className="text-xl font-black text-slate-900 font-mono">{cars.filter((c: any) => c.status === 'rented').length}</span>
                                  <ChevronLeft size={14} className="text-slate-300 group-hover/item:text-blue-500 transition-colors" />
                               </div>
                            </motion.div>

                            {/* Technical Health Item (Placeholder for futurism) */}
                            <motion.div 
                              whileHover={{ x: -4 }}
                              className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between flex-row-reverse hover:bg-slate-800 transition-all cursor-pointer group/item"
                            >
                               <div className="flex items-center gap-4 flex-row-reverse">
                                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover/item:scale-110 transition-transform">
                                     <Settings size={18} strokeWidth={2.5} />
                                  </div>
                                  <div className="text-right">
                                     <span className="text-xs font-black text-white block">{t.fleetTechnicalHealth}</span>
                                     <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">{t.engineEfficiency}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className="text-xl font-black text-white font-mono">98%</span>
                                  <ChevronLeft size={14} className="text-slate-600 group-hover/item:text-blue-500 transition-colors" />
                               </div>
                            </motion.div>
                         </div>
                      </div>
                    </div>

                    {/* Security Alerts Card (3rd Child) */}
                    <div className="bg-slate-900 p-8 rounded-[3rem] border border-slate-800 shadow-2xl flex flex-col md:flex-row-reverse items-center justify-between gap-8 lg:col-span-2 relative overflow-hidden min-h-[160px]">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full -mr-20 -mt-20" />
                       <div className="flex items-center gap-6 flex-row-reverse relative z-10">
                          <div className="w-16 h-16 bg-red-500/20 rounded-[2rem] flex items-center justify-center text-red-500 border border-red-500/20">
                             <Shield size={32} strokeWidth={2.5} />
                          </div>
                          <div className="text-right">
                             <h3 className="text-xl font-black text-white mb-2">{t.nationalProtectionSystem}</h3>
                             <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-md">{t.nationalProtectionDesc}</p>
                          </div>
                       </div>
                       <button onClick={() => setCurrentTab('blocklist')} className="px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl text-sm font-black transition-all transform hover:scale-[1.05] shadow-xl relative z-10 shrink-0">
                          {t.reviewBlacklist}
                       </button>
                    </div>
                  </div>

                  {/* Branches Performance (Conditional) */}
                  {(!isSuperAdmin && myCompany?.branches && myCompany.branches.length > 0) && (
                    <div className="bg-white dark:bg-neutral-950 p-6 rounded-[2.5rem] border border-slate-200/60 dark:border-neutral-800 shadow-xl flex flex-col space-y-6 text-right">
                      <div className="flex items-center justify-between border-b pb-5 border-slate-100 dark:border-neutral-800 flex-row-reverse">
                         <div className="flex items-center gap-3 flex-row-reverse">
                            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-lg shadow-amber-200/20">
                               <MapPin size={18} strokeWidth={2.5} />
                            </div>
                            <div className="text-right">
                              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">أداء الفروع</h2>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">إجمالي الفروع: {myCompany.branches.length}</p>
                            </div>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-4 bg-slate-50/50 dark:bg-neutral-900/50 rounded-2xl border border-slate-100 dark:border-neutral-800 flex items-center justify-between flex-row-reverse hover:border-amber-200 transition-colors">
                           <div className="flex flex-col text-right">
                             <span className="text-sm font-black text-slate-800 dark:text-neutral-200 block">الفرع الرئيسي</span>
                             <span className="text-[10px] text-slate-500 font-mono mt-1">{myCompany.adminEmail}</span>
                           </div>
                           <div className="flex flex-col items-center gap-1 bg-white dark:bg-neutral-900 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-neutral-800">
                             <span className="text-[10px] font-bold text-slate-400">إجمالي الإيرادات</span>
                             <span className="text-lg font-black text-emerald-600 dark:text-emerald-500 font-mono">
                                {new Intl.NumberFormat('en-US').format(
                                  contracts.filter((c: any) => !c.branchId).filter((c: any) => c.bookingStatus !== 'cancelled').reduce((sum, c) => {
                                     const cost = parseFloat(String(c.rentalCost || 0).replace(/,/g, ''));
                                     const rem = parseFloat(String(c.remainingAmount || 0).replace(/,/g, ''));
                                     const val = (isNaN(cost) ? 0 : cost) - (isNaN(rem) ? 0 : rem);
                                     return sum + Math.max(0, val);
                                  }, 0)
                                )} <span className="text-[10px] font-sans">د.ع</span>
                             </span>
                           </div>
                        </div>

                        {myCompany.branches.map((branch: any) => {
                           const branchContracts = contracts.filter((c: any) => c.branchId === branch.id);
                           const branchProfits = branchContracts.filter((c: any) => c.bookingStatus !== 'cancelled').reduce((sum, c) => {
                               const cost = parseFloat(String(c.rentalCost || 0).replace(/,/g, ''));
                               const rem = parseFloat(String(c.remainingAmount || 0).replace(/,/g, ''));
                               const val = (isNaN(cost) ? 0 : cost) - (isNaN(rem) ? 0 : rem);
                               return sum + Math.max(0, val);
                           }, 0);
                           
                           return (
                              <div key={branch.id} className="p-4 bg-slate-50/50 dark:bg-neutral-900/50 rounded-2xl border border-slate-100 dark:border-neutral-800 flex items-center justify-between flex-row-reverse hover:border-amber-200 transition-colors">
                                 <div className="flex flex-col text-right">
                                   <span className="text-sm font-black text-slate-800 dark:text-neutral-200 block">{branch.name}</span>
                                   <span className="text-[10px] text-slate-500 font-mono mt-1">{branch.email}</span>
                                 </div>
                                 <div className="flex flex-col items-center gap-1 bg-white dark:bg-neutral-900 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-neutral-800">
                                   <span className="text-[10px] font-bold text-slate-400">إجمالي الإيرادات</span>
                                   <span className="text-lg font-black text-emerald-600 dark:text-emerald-500 font-mono">
                                      {new Intl.NumberFormat('en-US').format(branchProfits)} <span className="text-[10px] font-sans">د.ع</span>
                                   </span>
                                 </div>
                              </div>
                           );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tier 4: Detailed Profit Chart */}
                  <div className="bg-white dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
                    <ProfitChart contracts={contracts} cars={cars} maintenanceRecords={maintenanceRecords} />
                  </div>

                  {/* Tier 5: Super Admin Context (Conditional) */}
                  {isSuperAdmin && (
                    <div className="bg-neutral-100 dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row-reverse items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-row-reverse text-right">
                        <div className="text-amber-500"><Info size={20} /></div>
                        <span className="font-bold text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">{t.noPendingRequests}</span>
                      </div>
                      <button onClick={() => setCurrentTab('super-admin')} className="py-2.5 px-6 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-xl text-xs font-black">{t.manageCompaniesActivity}</button>
                    </div>
                  )}
                </div>
              )}
             {/* TAB: NEW CONTRACT */}
            {currentTab === 'new-contract' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-black text-black text-right">تحرير العقد الإلكتروني</h1>
                </div>
                {/* Embedded Contract View containing both input panels and high fidelity PDF/A4 printable components */}
                <ContractView 
                   key={`contract-${contractKey}`} 
                   company={{ name: companyName, phoneNumber: companyPhoneSetting, address: companyAddressSetting, logoUrl: companyLogoUrl, establishmentImageUrl: companyEstablishmentImageUrl, contractTerms: companyContractTerms, driverContractTerms: companyDriverContractTerms, qrCodeFields: qrCodeFields }} 
                   staff={user} 
                   isWithDriver={false} 
                   onSaveSuccess={() => {
                      
                      
                      
                      
                   }}
                />
              </div>
            )}

            {currentTab === 'new-contract-driver' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-black text-black text-right">تحرير عقد سيارة مع سائق</h1>
                </div>
                {/* Embedded Contract View containing both input panels and high fidelity PDF/A4 printable components */}
                <ContractView 
                   key={`driver-contract-${contractKey}`} 
                   company={{ name: companyName, phoneNumber: companyPhoneSetting, address: companyAddressSetting, logoUrl: companyLogoUrl, establishmentImageUrl: companyEstablishmentImageUrl, contractTerms: companyContractTerms, driverContractTerms: companyDriverContractTerms, qrCodeFields: qrCodeFields }} 
                   staff={user} 
                   isWithDriver={true} 
                   onSaveSuccess={() => {
                      
                      
                      
                      
                   }}
                />
              </div>
            )}

            {/* TAB: CONTRACTS LISTS */}
            {currentTab === 'contracts-list' && (
              <ContractsList 
                key="contracts-list" 
                company={user} 
                staff={user} 
                isSuperAdmin={!!isSuperAdmin} 
                defaultFilter="active" 
                isWithDriver={false}
                targetContractId={targetContractId}
                onClearTarget={() => setTargetContractId(null)}
              />
            )}
            {currentTab === 'contracts-driver-list' && (
              <ContractsList 
                key="contracts-driver-list" 
                company={user} 
                staff={user} 
                isSuperAdmin={!!isSuperAdmin} 
                defaultFilter="active" 
                isWithDriver={true}
                targetContractId={targetContractId}
                onClearTarget={() => setTargetContractId(null)}
              />
            )}
            {currentTab === 'contracts-completed' && (
              <ContractsList 
                key="contracts-completed" 
                company={user} 
                staff={user} 
                isSuperAdmin={!!isSuperAdmin} 
                defaultFilter="completed" 
                isWithDriver={false}
                targetContractId={targetContractId}
                onClearTarget={() => setTargetContractId(null)}
              />
            )}
            {currentTab === 'contracts-expired' && (
              <ContractsList 
                key="contracts-expired" 
                company={user} 
                staff={user} 
                isSuperAdmin={!!isSuperAdmin} 
                defaultFilter="expired" 
                isWithDriver={false}
                targetContractId={targetContractId}
                onClearTarget={() => setTargetContractId(null)}
              />
            )}

            {/* TAB: PROFITS (NEW) */}
            {currentTab === 'profits-no-driver' && (
              <ProfitsView 
                viewType="profits-no-driver" 
                contracts={contracts} 
                cars={cars} 
                maintenanceRecords={maintenanceRecords || []} 
              />
            )}
            {currentTab === 'profits-driver' && (
              <ProfitsView 
                viewType="profits-driver" 
                contracts={contracts} 
                cars={cars} 
                maintenanceRecords={maintenanceRecords || []} 
              />
            )}
            {currentTab === 'profits-invested' && (
              <ProfitsView 
                viewType="profits-invested" 
                contracts={contracts} 
                cars={cars} 
                maintenanceRecords={maintenanceRecords || []} 
              />
            )}

            {/* TAB: NOTIFICATIONS */}
            {currentTab === 'notifications' && (
              <Notifications />
            )}

            {/* TAB: CONVERSATIONS */}
            {currentTab === 'conversations' && (
              <Conversations />
            )}

            {/* TAB: CUSTOMERS */}
            {currentTab === 'debts' && (
              <Debts user={user} contracts={contracts} myCompany={myCompany} />
            )}
            {currentTab === 'customers' && (
              <Customers user={user} isSuperAdmin={!!isSuperAdmin} />
            )}

            {/* TAB: MAINTENANCE */}

            {currentTab === 'employees' && (
              <Employees 
                key={`emp-${currentTab}`}
                myCompany={myCompany} 
                staff={user} 
              />
            )}
            {currentTab === 'financial' && (
              <FinancialSystem 
                key={`fin-${currentTab}`}
                myCompany={myCompany} 
                staff={user} 
              />
            )}

            {currentTab === 'maintenance' && (
              <MaintenanceExpenses myCompany={myCompany} 
                key={`maint-${currentTab}`}
                cars={cars} 
                records={maintenanceRecords} 
                setRecords={setMaintenanceRecords} 
                staff={user} 
              />
            )}

            {currentTab === 'contracts-cancelled' && (
              <ContractsList 
                key="contracts-cancelled" 
                company={user} 
                staff={user} 
                isSuperAdmin={!!isSuperAdmin} 
                defaultFilter="cancelled" 
                isWithDriver={false}
                targetContractId={targetContractId}
                onClearTarget={() => setTargetContractId(null)}
              />
            )}
            {/* FALLBACK TAB */}
            {![
              'dashboard', 'new-contract', 'new-contract-driver', 'contracts-list', 'contracts-driver-list', 
              'contracts-completed', 'contracts-expired', 'contracts-cancelled', 'profits-no-driver', 'profits-driver', 'profits-invested',
              'notifications', 'conversations', 'maintenance', 'fleet', 'investor-cars', 'customers', 'blocklist', 'external-blocklist', 
              'super-admin', 'settings', 'subscriptions'
            ].includes(currentTab) && (
              <div className="flex flex-col items-center justify-center p-20 text-neutral-400">
                <span className="text-6xl mb-4">🚫</span>
                <h2 className="text-xl font-bold mb-2 text-neutral-700">لا يوجد شيء لعرضه هنا</h2>
                <button 
                  onClick={() => setCurrentTab('dashboard')}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl text-sm font-bold transition"
                >
                  العودة للرئيسية
                </button>
              </div>
            )}

            {/* TAB: FLEET */}
            {currentTab === 'fleet' && (
              <Fleet 
                cars={cars.filter(c => !c.isInvested)}
                setEditingCarId={setEditingCarId}
                setCarName={setCarName}
                setCarPlate={setCarPlate}
                setCarColor={setCarColor}
                setCarYear={setCarYear}
                setCarPrice={setCarPrice}
                setCarImageUrl={setCarImageUrl}
                setCarOwnerName={setCarOwnerName}
                setCarOwnerPhone={setCarOwnerPhone}
                setCarIsInvested={setCarIsInvested}
                setCarInvestmentPercentage={setCarInvestmentPercentage}
                setCarChassis={setCarChassis}
                setCarRegNumber={setCarRegNumber}
                setShowCarModal={setShowCarModal}
                handleDeleteCar={handleDeleteCar}
              />
            )}

            {currentTab === 'investor-cars' && (
              <InvestorCars 
                cars={cars}
                contracts={contracts}
                setEditingCarId={setEditingCarId}
                setCarName={setCarName}
                setCarPlate={setCarPlate}
                setCarColor={setCarColor}
                setCarYear={setCarYear}
                setCarPrice={setCarPrice}
                setCarImageUrl={setCarImageUrl}
                setCarOwnerName={setCarOwnerName}
                setCarOwnerPhone={setCarOwnerPhone}
                setCarIsInvested={setCarIsInvested}
                setCarInvestmentPercentage={setCarInvestmentPercentage}
                setCarChassis={setCarChassis}
                setCarRegNumber={setCarRegNumber}
                setShowCarModal={setShowCarModal}
                handleDeleteCar={handleDeleteCar}
                usersList={usersList}
                handleMarkAsPaid={handleMarkAsPaid}
              />
            )}
            {false && (
              <div className="space-y-6 text-right">
                <div className="flex items-center justify-between flex-row-reverse">
                  <div>
                    <h1 className="text-2xl font-black text-black">أسطول السيارات</h1>
                    <p className="text-sm text-neutral-500 mt-1">عرض جميع السيارات المتاحة للإيجار للمكتب وتغيير حالتها</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingCarId(null);
                      setCarName('');
                      setCarPlate('');
                      setCarColor('');
                      setCarYear('');
                      setCarOwnerName('');
                      setCarIsInvested(false);
                      setCarInvestmentPercentage('0');
                      setCarPrice('75000');
                      setCarImageUrl('');
                      setShowCarModal(true);
                    }} 
                    className="flex items-center gap-2 flex-row-reverse bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-5 rounded-2xl text-sm transition shadow-md"
                  >
                    <Plus size={16} /> إضافة سيارة جديدة
                  </button>
                </div>

                {/* Fleet Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cars.map((car: any, index: number) => (
                    <div key={`${car.id}-${index}`} className="bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col items-end text-right hover:shadow-lg transition">
                      <div className="flex justify-between items-center w-full mb-3 flex-row-reverse">
                        <span className={`text-[11px] font-black px-3 py-1 rounded-full ${car.status === 'rented' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20' : 'bg-green-100 text-green-700 dark:bg-green-500/20'}`}>
                          {car.status === 'rented' ? 'مؤجرة' : 'متوفرة'}
                        </span>
                        <div className="flex gap-2">
                           <button onClick={() => {
                               setEditingCarId(car.id);
                               setCarName(car.name);
                               setCarPlate(car.plateNumber);
                               setCarColor(car.color);
                               setCarYear(car.year);
                               setCarOwnerName(car.ownerName || car.owner || '');
                               setCarChassis(car.chassisNumber || car.chassis || car.chassis_number || '');
                               setCarPrice(String(car.dailyPrice));
                               setCarImageUrl(car.imageUrl || '');
                               setShowCarModal(true);
                           }} className="text-neutral-400 hover:text-amber-500"><Edit size={16} /></button>
                           <button onClick={() => handleDeleteCar(car.id)} className="text-neutral-400 hover:text-red-500"><Trash2 size={16} /></button>
                           <span className="text-xs text-neutral-400 font-mono">#{String(car.id).slice(-6)}</span>
                        </div>
                      </div>

                      {car.imageUrl && (
                        <div className="w-full h-36 bg-neutral-100 dark:bg-neutral-900 rounded-2xl mb-4 overflow-hidden flex items-center justify-center p-2 border border-neutral-200/50 dark:border-neutral-800">
                          <img 
                            src={car.imageUrl} 
                            alt={car.name} 
                            className="max-h-full max-w-full object-contain filter drop-shadow hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}

                      <div className="mb-4">
                        <h3 className="font-black text-lg text-black mb-1">{car.name}</h3>
                        <p className="text-xs text-neutral-500 font-bold flex items-center gap-1.5 flex-row-reverse">
                          <span>اللوحة:</span> <span className="font-mono text-neutral-800 dark:text-neutral-200">{car.plateNumber}</span>
                          {car.color && <span className="mr-2">اللون: {car.color}</span>}
                          {car.year && <span className="mr-1">({car.year})</span>}
                        </p>
                      </div>

                      <div className="w-full bg-neutral-50 dark:bg-neutral-900 p-4 rounded-2xl mb-4 flex items-center justify-between flex-row-reverse">
                        <span className="text-xs text-neutral-500">سعر الإيجار اليومي</span>
                        <span className="font-black text-amber-600 font-mono text-lg">{car.dailyPrice ? car.dailyPrice.toLocaleString('en-US') : '75,000'} <span className="text-xs text-neutral-400 font-normal">د.ع</span></span>
                      </div>

                      <div className="flex gap-2 w-full">
                        <button 
                          onClick={() => {
                            const newStatus = car.status === 'rented' ? 'available' : 'rented';
                            api.put('inventory', car.id, { status: newStatus })
                              .then(() => toast.success('تم تحديث حالة السيارة بنجاح'))
                              .catch(() => toast.error('فشل التحديث'));
                          }}
                          className="flex-1 py-2 rounded-xl border hover:bg-neutral-50 dark:hover:bg-neutral-900 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition"
                        >
                          تغيير الحالة ({car.status === 'rented' ? 'توفير' : 'حجز/تأجير'})
                        </button>
                        <button 
                          onClick={() => handleDeleteCar(car.id)} 
                          className="p-2 border rounded-xl hover:bg-red-50 text-red-600 transition"
                          title="حذف السيارة"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {cars.length === 0 && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center text-neutral-400">
                      <Car size={48} className="mb-4 opacity-50 text-neutral-300" />
                      <p className="text-base">لم تقم بإضافة سيارات لشركتك بعد.</p>
                      <button onClick={() => setShowCarModal(true)} className="mt-3 text-xs bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold transition">أضف سيارة أولى الآن</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: BLOCKLIST */}
            {currentTab === 'blocklist' && (
              <div className="space-y-6 text-right">
                <div className="flex items-center justify-between flex-row-reverse pb-4 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center gap-4 flex-row-reverse">
                    {companyLogoUrl && (
                      <img src={companyLogoUrl} alt="Company Logo" className="h-16 w-16 object-contain rounded-lg border border-gray-100 shadow-sm bg-white" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h1 className="text-2xl font-black text-black">
                        {companyName || 'قائمة التعميم على شركات التاجير'}
                      </h1>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowBulkBlockModal(true)} 
                      className="flex items-center gap-2 flex-row-reverse bg-neutral-800 hover:bg-neutral-900 text-white font-bold py-3 px-5 rounded-2xl text-sm transition shadow-md"
                    >
                      إضافة بالجملة
                    </button>
                    <button 
                      onClick={() => toast.success('سيتم إضافة هذه الميزة قريباً')} 
                      className="flex items-center gap-2 flex-row-reverse bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-5 rounded-2xl text-sm transition shadow-md"
                    >
                      <Star size={16} /> إضافة تقييم للعميل
                    </button>
                    <button 
                      onClick={() => setShowBlockModal(true)} 
                      className="flex items-center gap-2 flex-row-reverse bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-2xl text-sm transition shadow-md"
                    >
                      <Ban size={16} /> إضافة مستاجر الى قائمة الحظر
                    </button>
                  </div>
                </div>



                {/* Blocklist display */}
                <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-neutral-100 font-bold text-sm text-neutral-700 border-b flex justify-between items-center flex-row-reverse">
                    <span>قائمة المستأجرين المحظورين</span>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        {isSearchingBlocklist ? (
                          <Loader2 size={16} className="absolute left-2 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                        ) : (
                          <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
                        )}
                        <input 
                          type="text" 
                          placeholder="بحث عن مستاجر محظور..."
                          value={searchBlocklist}
                          onChange={(e) => { setSearchBlocklist(e.target.value); setExtractedAiData(null); setMatchedFaceData(null); }}
                          className="pl-8 pr-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-[200px] md:max-w-xs"
                        />
                      </div>
                      <label className="relative cursor-pointer group flex items-center justify-center p-1.5 md:p-2 rounded-lg bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm" title="البحث بتطابق الوجه (صورة شخصية)">
                        {isMatchingFace ? <Loader size={18} className="animate-spin text-emerald-500" /> : <ScanFace size={18} className="text-emerald-600" />}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleFaceMatch}
                          disabled={isMatchingFace}
                        />
                      </label>
                    </div>
                  </div>

                  {matchedFaceData && (
                    <div className="p-4 border-b flex justify-between items-start flex-row-reverse text-right relative animate-fade-in shadow-inner bg-red-50 border-red-200 overflow-hidden">
                      <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />
                      <div className="flex-1 relative z-10">
                        <div className="flex items-center gap-2 flex-row-reverse mb-1">
                          <ShieldAlert size={16} className="text-red-600" />
                          <p className="text-sm font-black text-red-900">تحذير: تم مطابقة الوجه بشخص محظور!</p>
                        </div>
                        <div className="flex items-center gap-4 flex-row-reverse my-3">
                           {matchedFaceData.imageUrl && (
                              <img src={matchedFaceData.imageUrl} alt="matched" className="w-16 h-16 rounded-lg object-cover shadow-sm border border-red-200" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                           )}
                           <div>
                             <p className="text-sm text-red-800">الاسم: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm ml-2 text-neutral-800">{matchedFaceData.name || matchedFaceData.fullName || 'غير معروف'}</span></p>
                             <p className="text-sm text-red-800 mt-1">الهوية: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm text-neutral-800">{matchedFaceData.idNumber || 'غير معروف'}</span></p>
                           </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-red-100 mt-2">
                          <p className="text-sm font-bold text-red-700">سبب التعميم: <span className="text-red-900 text-lg">{matchedFaceData.blockReason}</span></p>
                          {matchedFaceData.analysis && <p className="text-sm font-bold text-red-700 mt-1">التحليل الفني: <span className="text-red-900 font-normal">{matchedFaceData.analysis}</span></p>}
                          <p className="text-xs text-neutral-500 mt-1">تاريخ التعميم: {matchedFaceData.reportedAt ? new Date(matchedFaceData.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                          {matchedFaceData.matchPercentage && (
                            <div className="mt-3 pt-3 border-t border-red-50 flex items-center justify-between flex-row-reverse">
                              <span className="text-xs font-bold text-red-600">نسبة التطابق بالذكاء الاصطناعي</span>
                              <span className="text-sm font-black bg-red-100 text-red-800 px-2 py-1 rounded-md" dir="ltr">{matchedFaceData.matchPercentage}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setMatchedFaceData(null)} className="text-neutral-400 hover:text-neutral-700 transition bg-white p-1.5 rounded-full shadow-sm ml-2 z-20 shrink-0">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {extractedAiData && (() => {
                    const matchedInternal = blkList.filter((b: any) => 
                      (extractedAiData.idNumber && b.idNumber && b.idNumber.toLowerCase().includes(extractedAiData.idNumber.toLowerCase())) || 
                      (extractedAiData.fullName && b.fullName && b.fullName.toLowerCase().includes(extractedAiData.fullName.toLowerCase())) || 
                      (extractedAiData.fullName && b.name && b.name.toLowerCase().includes(extractedAiData.fullName.toLowerCase()))
                    );
                    const isBlocked = matchedInternal.length > 0;
                    return (
                    <div className={`p-4 border-b flex justify-between items-start flex-row-reverse text-right relative animate-fade-in shadow-inner ${isBlocked ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} overflow-hidden`}>
                      {isBlocked && <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />}
                      <div className="flex-1 relative z-10">
                        <div className="flex items-center gap-2 flex-row-reverse mb-1">
                          {isBlocked ? <ShieldAlert size={16} className="text-red-600" /> : <CheckCircle size={16} className="text-green-600" />}
                          <p className={`text-sm font-black ${isBlocked ? 'text-red-900' : 'text-green-900'}`}>{isBlocked ? 'تحذير: المستأجر محظور' : 'سجل نظيف: لم يتم العثور على حظر'}</p>
                        </div>
                        <div>
                          <p className={`text-sm mb-3 ${isBlocked ? 'text-red-800' : 'text-green-800'}`}>
                            الاسم: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm ml-3 text-neutral-800">{extractedAiData.fullName || 'غير معروف'}</span>
                            رقم الهوية: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm text-neutral-800">{extractedAiData.idNumber || 'غير معروف'}</span>
                          </p>
                          {isBlocked && matchedInternal.map((match: any, idx: number) => (
                             <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-red-100 mt-2">
                               <p className="text-sm font-bold text-red-700">سبب التعميم: <span className="text-red-900 text-lg">{match.blockReason}</span></p>
                               <p className="text-xs text-neutral-500 mt-1">تاريخ التعميم: {match.reportedAt ? new Date(match.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                             </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => { setExtractedAiData(null); setSearchBlocklist(''); }} className="text-neutral-400 hover:text-neutral-700 transition bg-white p-1.5 rounded-full shadow-sm ml-2 z-20 shrink-0">
                        <X size={16} />
                      </button>
                    </div>
                  );})()}

                  <div className="divide-y divide-neutral-100">
                    {(() => {
                      const q = debouncedBlocklistSearch.toLowerCase();
                      const filteredList = blkList.filter((entry: any) => 
                        entry.name?.toLowerCase().includes(q) || 
                        entry.fullName?.toLowerCase().includes(q) ||
                        entry.idNumber?.toLowerCase().includes(q)
                      ).sort((a: any, b: any) => {
                        const dateA = new Date(a.reportedAt || 0).getTime();
                        const dateB = new Date(b.reportedAt || 0).getTime();
                        return dateB - dateA;
                      });
                      
                      if (debouncedBlocklistSearch && filteredList.length === 0) {
                        return <p className="text-sm text-center text-neutral-500 py-10">عذراً، لم يتم العثور على نتائج تطابق بحثك.</p>;
                      }
                      
                      if (debouncedBlocklistSearch && filteredList.length > 0) {
                        return (
                          <>
                           <p className="text-sm text-center text-green-600 py-2">تم العثور على {filteredList.length} نتائج.</p>
                           {filteredList.map((entry: any, index: number) => (
                              <div key={`${entry.id}-${index}`} className="p-5 flex flex-col md:flex-row-reverse justify-between items-start md:items-center gap-4 text-right transition-colors border-b last:border-0 hover:bg-neutral-50 relative overflow-hidden">
                                <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />
                                <div className="flex-1 relative z-10">
                                  <div className="text-base md:text-lg font-bold text-neutral-700 mt-2 space-y-2">
                                    <p>الاسم: {entry.name || entry.fullName || 'غير معروف'}</p>
                                    <p>المستمسك: {entry.idType || 'غير محدد'} - {entry.idNumber || 'غير متوفر'}</p>
                                    <p>رقم الهاتف: {entry.phoneNumber || 'لا يوجد'}</p>
                                    <p>سبب التعميم: <span className="text-red-600 font-black text-lg md:text-xl">{entry.blockReason || 'عدم التزام أو ضرر'}</span></p>
                                    <p className="text-sm text-neutral-500">تاريخ التعميم: {entry.reportedAt ? new Date(entry.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                                  </div>
                                </div>
                                {entry.imageUrl && (
                                  <div className="md:order-first">
                                    <img src={entry.imageUrl} alt="صورة المحظور" className="w-24 h-24 rounded-xl object-cover border border-neutral-200" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                                  </div>
                                )}
                                {isSuperAdmin && (
                                  <button 
                                    onClick={() => handleRemoveBlock(entry.id)}
                                    className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl font-bold transition mt-2 md:mt-0"
                                  >
                                    إلغاء التعميم
                                  </button>
                                )}
                              </div>
                            ))}
                          </>
                        );
                      }

                      return filteredList.map((entry: any, index: number) => (
                        <div key={`${entry.id}-${index}`} className="p-5 flex flex-col md:flex-row-reverse justify-between items-start md:items-center gap-4 text-right transition-colors border-b last:border-0 hover:bg-neutral-50 relative overflow-hidden">
                          <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />
                          <div className="flex-1 relative z-10">
                            <div className="text-base md:text-lg font-bold text-neutral-700 mt-2 space-y-2">
                              <p>الاسم: {entry.name || entry.fullName || 'غير معروف'}</p>
                              <p>المستمسك: {entry.idType || 'غير محدد'} - {entry.idNumber || 'غير متوفر'}</p>
                              <p>رقم الهاتف: {entry.phoneNumber || 'لا يوجد'}</p>
                              <p>سبب التعميم: <span className="text-red-600 font-black text-lg md:text-xl">{entry.blockReason || 'عدم التزام أو ضرر'}</span></p>
                              <p className="text-sm text-neutral-500">تاريخ التعميم: {entry.reportedAt ? new Date(entry.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                            </div>
                          </div>
                          {entry.imageUrl && (
                            <div className="md:order-first">
                              <img src={entry.imageUrl} alt="صورة المحظور" className="w-24 h-24 rounded-xl object-cover border border-neutral-200" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          {isSuperAdmin && (
                            <button 
                              onClick={() => handleRemoveBlock(entry.id)}
                              className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl font-bold transition mt-2 md:mt-0"
                            >
                              إلغاء التعميم
                            </button>
                          )}
                        </div>
                      ));
                    })()}

                    {blkList.length === 0 && (
                      <p className="text-sm text-neutral-400 pb-12 pt-12 text-center animate-fade-in">لا توجد سجلات في قائمة الحظر حالياً.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: EXTERNAL BLOCKLIST */}
            {currentTab === 'external-blocklist' && (
              <div className="space-y-6 text-right">
                <div className="flex items-center justify-between flex-row-reverse pb-4 border-b border-gray-100 dark:border-neutral-800">
                  <div className="flex items-center gap-4 flex-row-reverse">
                    {companyLogoUrl && (
                      <img src={companyLogoUrl} alt="Company Logo" className="h-16 w-16 object-contain rounded-lg border border-gray-100 shadow-sm bg-white" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h1 className="text-2xl font-black text-black">
                        {companyName || 'قائمة الحظر الخارجي'}
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Local alert context */}
                <div className="p-4 bg-orange-50 border border-orange-200/50 rounded-2xl flex items-start gap-3 flex-row-reverse text-orange-800 text-xs shadow-sm mb-4">
                  <Shield size={24} className="shrink-0 text-orange-600" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-orange-900">ملاحظة الخصوصية:</div>
                    <div className="leading-relaxed">
                      هذه القائمة تحتوي على مستأجرين تم حظرهم من قبل جهات خارجية وتعتبر كمرجع إضافي للحماية.
                    </div>

                  </div>
                </div>

                {/* Blocklist display */}
                <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
                  <div className="p-4 bg-neutral-100 font-bold text-sm text-neutral-700 border-b flex justify-between items-center flex-row-reverse">
                    <span>قائمة المستأجرين المحظورين خارجياً</span>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        {isSearchingBlocklist ? (
                          <Loader2 size={16} className="absolute left-2 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
                        ) : (
                          <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
                        )}
                        <input 
                          type="text" 
                          placeholder="بحث عن مستاجر محظور..."
                          value={searchBlocklist}
                          onChange={(e) => { setSearchBlocklist(e.target.value); setExtractedAiData(null); setMatchedFaceData(null); }}
                          className="pl-8 pr-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-[200px] md:max-w-xs"
                        />
                      </div>
                      <label className="relative cursor-pointer group flex items-center justify-center p-1.5 md:p-2 rounded-lg bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm" title="البحث بتطابق الوجه (صورة شخصية)">
                        {isMatchingFace ? <Loader size={18} className="animate-spin text-emerald-500" /> : <ScanFace size={18} className="text-emerald-600" />}
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={handleFaceMatch}
                          disabled={isMatchingFace}
                        />
                      </label>
                    </div>
                  </div>

                  {matchedFaceData && (
                    <div className="p-4 border-b flex justify-between items-start flex-row-reverse text-right relative animate-fade-in shadow-inner bg-orange-50 border-orange-200">
                      <div>
                        <div className="flex items-center gap-2 flex-row-reverse mb-1">
                          <ShieldAlert size={16} className="text-orange-600" />
                          <p className="text-sm font-black text-orange-900">تحذير: تم مطابقة الوجه بشخص محظور!</p>
                        </div>
                        <div className="flex items-center gap-4 flex-row-reverse my-3">
                           {matchedFaceData.imageUrl && <img src={matchedFaceData.imageUrl} alt="matched" className="w-16 h-16 rounded-lg object-cover shadow-sm border border-orange-200" referrerPolicy="no-referrer" loading="lazy" decoding="async" />}
                           <div>
                             <p className="text-sm text-orange-800">الاسم: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm ml-2 text-neutral-800">{matchedFaceData.name || matchedFaceData.fullName || 'غير معروف'}</span></p>
                             <p className="text-sm text-orange-800 mt-1">الهوية: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm text-neutral-800">{matchedFaceData.idNumber || 'غير معروف'}</span></p>
                           </div>
                        </div>
                        <div className="bg-white p-3 rounded-xl shadow-sm border border-orange-100 mt-2">
                          <p className="text-sm font-bold text-orange-700">سبب التعميم: <span className="text-orange-900 text-lg">{matchedFaceData.blockReason}</span></p>
                          {matchedFaceData.analysis && <p className="text-sm font-bold text-orange-700 mt-1">التحليل الفني: <span className="text-orange-900 font-normal">{matchedFaceData.analysis}</span></p>}
                          <p className="text-xs text-neutral-500 mt-1">تاريخ التعميم: {matchedFaceData.reportedAt ? new Date(matchedFaceData.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                          {matchedFaceData.matchPercentage && (
                            <div className="mt-3 pt-3 border-t border-orange-50 flex items-center justify-between flex-row-reverse">
                              <span className="text-xs font-bold text-orange-600">نسبة التطابق بالذكاء الاصطناعي</span>
                              <span className="text-sm font-black bg-orange-100 text-orange-800 px-2 py-1 rounded-md" dir="ltr">{matchedFaceData.matchPercentage}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => setMatchedFaceData(null)} className="text-neutral-400 hover:text-neutral-700 transition bg-white p-1.5 rounded-full shadow-sm">
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {extractedAiData && (() => {
                    const matchedExternal = externalBlkList.filter((b: any) => 
                      (extractedAiData.idNumber && b.idNumber && b.idNumber.toLowerCase().includes(extractedAiData.idNumber.toLowerCase())) || 
                      (extractedAiData.fullName && b.fullName && b.fullName.toLowerCase().includes(extractedAiData.fullName.toLowerCase())) || 
                      (extractedAiData.fullName && b.name && b.name.toLowerCase().includes(extractedAiData.fullName.toLowerCase()))
                    );
                    const isBlocked = matchedExternal.length > 0;
                    return (
                    <div className={`p-4 border-b flex justify-between items-start flex-row-reverse text-right relative animate-fade-in shadow-inner ${isBlocked ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'} overflow-hidden`}>
                      {isBlocked && <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />}
                      <div className="flex-1 relative z-10">
                        <div className="flex items-center gap-2 flex-row-reverse mb-1">
                          {isBlocked ? <ShieldAlert size={16} className="text-orange-600" /> : <CheckCircle size={16} className="text-green-600" />}
                          <p className={`text-sm font-black ${isBlocked ? 'text-orange-900' : 'text-green-900'}`}>{isBlocked ? 'تحذير: المستأجر محظور خارجياً!' : 'سجل نظيف: لم يتم العثور على حظر'}</p>
                        </div>
                        <div>
                          <p className={`text-sm mb-3 ${isBlocked ? 'text-orange-800' : 'text-green-800'}`}>
                            الاسم: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm ml-3 text-neutral-800">{extractedAiData.fullName || 'غير معروف'}</span>
                            رقم الهوية: <span className="font-black bg-white border border-neutral-200 px-2 py-0.5 rounded-md shadow-sm text-neutral-800">{extractedAiData.idNumber || 'غير معروف'}</span>
                          </p>
                          {isBlocked && matchedExternal.map((match: any, idx: number) => (
                             <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-orange-100 mt-2">
                               <p className="text-sm font-bold text-orange-700">سبب التعميم: <span className="text-orange-900 text-lg">{match.blockReason}</span></p>
                               <p className="text-xs text-neutral-500 mt-1">تاريخ التعميم: {match.reportedAt ? new Date(match.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                             </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => { setExtractedAiData(null); setSearchBlocklist(''); }} className="text-neutral-400 hover:text-neutral-700 transition bg-white p-1.5 rounded-full shadow-sm ml-2 z-20 shrink-0">
                        <X size={16} />
                      </button>
                    </div>
                  );})()}

                  <div className="divide-y divide-neutral-100">
                    {(() => {
                      const q = debouncedBlocklistSearch.toLowerCase();
                      const filteredList = externalBlkList.filter((entry: any) => 
                        entry.name?.toLowerCase().includes(q) || 
                        entry.fullName?.toLowerCase().includes(q) ||
                        entry.idNumber?.toLowerCase().includes(q)
                      ).sort((a: any, b: any) => {
                        const dateA = new Date(a.reportedAt || 0).getTime();
                        const dateB = new Date(b.reportedAt || 0).getTime();
                        return dateB - dateA;
                      });
                      
                      if (debouncedBlocklistSearch && filteredList.length === 0) {
                        return <p className="text-sm text-center text-neutral-500 py-10">عذراً، لم يتم العثور على نتائج تطابق بحثك.</p>;
                      }
                      
                      if (debouncedBlocklistSearch && filteredList.length > 0) {
                        return (
                          <>
                           <p className="text-sm text-center text-green-600 py-2">تم العثور على {filteredList.length} نتائج.</p>
                           {filteredList.map((entry: any, index: number) => (
                              <div key={`${entry.id}-${index}`} className="p-5 flex flex-col md:flex-row-reverse justify-between items-start md:items-center gap-4 text-right transition-colors border-b last:border-0 hover:bg-neutral-50 animate-fade-in relative overflow-hidden">
                                <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />
                                <div className="flex-1 relative z-10">
                                  <div className="text-base md:text-lg font-bold text-neutral-700 mt-2 space-y-2">
                                    <p>الاسم: {entry.name || entry.fullName || 'غير معروف'}</p>
                                    <p>المستمسك: {entry.idType || 'غير محدد'} - {entry.idNumber || 'غير متوفر'}</p>
                                    <p>رقم الهاتف: {entry.phoneNumber || 'لا يوجد'}</p>
                                    <p>سبب التعميم: <span className="text-orange-600 font-black text-lg md:text-xl">{entry.blockReason || 'عدم التزام أو ضرر'}</span></p>
                                    <p className="text-sm text-neutral-500">تاريخ التعميم: {entry.reportedAt ? new Date(entry.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                                  </div>
                                </div>
                                {entry.imageUrl && (
                                  <div className="md:order-first">
                                    <img src={entry.imageUrl} alt={entry.name} className="w-20 h-20 rounded-xl object-cover border border-neutral-200" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                                  </div>
                                )}
                                {isSuperAdmin && (
                                  <button 
                                    onClick={() => handleRemoveExternalBlock(entry.id)}
                                    className="text-xs text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl font-bold transition mt-2 md:mt-0"
                                  >
                                    إلغاء التعميم الخارجي
                                  </button>
                                )}
                              </div>
                            ))}
                          </>
                        );
                      }

                      return filteredList.map((entry: any, index: number) => (
                        <div key={`${entry.id}-${index}`} className="p-5 flex flex-col md:flex-row-reverse justify-between items-start md:items-center gap-4 text-right transition-colors border-b last:border-0 hover:bg-neutral-50 animate-fade-in relative overflow-hidden">
                          <PrivacyWatermark userEmail={user?.email || user?.fullName || 'Unauthorized'} companyName={companyName || user?.companyName} />
                          <div className="flex-1 relative z-10">
                            <div className="text-base md:text-lg font-bold text-neutral-700 mt-2 space-y-2">
                              <p>الاسم: {entry.name || entry.fullName || 'غير معروف'}</p>
                              <p>المستمسك: {entry.idType || 'غير محدد'} - {entry.idNumber || 'غير متوفر'}</p>
                              <p>رقم الهاتف: {entry.phoneNumber || 'لا يوجد'}</p>
                              <p>سبب التعميم: <span className="text-orange-600 font-black text-lg md:text-xl">{entry.blockReason || 'عدم التزام أو ضرر'}</span></p>
                              <p className="text-sm text-neutral-500">تاريخ التعميم: {entry.reportedAt ? new Date(entry.reportedAt).toLocaleDateString('en-GB') : '—'}</p>
                            </div>
                          </div>
                          {entry.imageUrl && (
                            <div className="md:order-first">
                              <img src={entry.imageUrl} alt="صورة المحظور" className="w-24 h-24 rounded-xl object-cover border border-neutral-200" referrerPolicy="no-referrer" />
                            </div>
                          )}
                          {isSuperAdmin && (
                            <button 
                              onClick={() => handleRemoveExternalBlock(entry.id)}
                              className="text-xs text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl font-bold transition mt-2 md:mt-0"
                            >
                              إلغاء التعميم الخارجي
                            </button>
                          )}
                        </div>
                      ));
                    })()}

                    {externalBlkList.length === 0 && (
                      <p className="text-sm text-neutral-400 pb-12 pt-12 text-center animate-fade-in">لا توجد سجلات في القائمة الخارجية حالياً.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GPS DEVICES */}
            {currentTab === 'gps' && (
              <div className="space-y-6 text-right animate-fade-in">
                <div className="flex justify-between items-center flex-row-reverse">
                  <div>
                    <h1 className="text-2xl font-black text-black">تتبع الأسطول والـ GPS الحي</h1>
                    <p className="text-sm text-neutral-500 mt-1">تتبع السيارات وتحديد الإحداثيات على الخارطة المباشرة</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left stats/control panel */}
                  <div className="bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-6 rounded-3xl space-y-4 lg:col-span-1">
                    <h3 className="font-bold text-black border-b pb-3 flex items-center justify-between flex-row-reverse">
                      <span>الأجهزة المتصلة بالنظام</span>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">3 أجهزة متصلة</span>
                    </h3>

                    <div className="space-y-3">
                      <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center flex-row-reverse">
                          <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">G-Class خضراء</span>
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">بث نشط</span>
                        </div>
                        <p className="text-xs text-neutral-500">السرعة: 65 كم/س • الموقع: بغداد - الكرادة</p>
                      </div>

                      <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center flex-row-reverse">
                          <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">ميسان لاندكروزر</span>
                          <span className="text-[10px] bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-full font-bold">متوقفة</span>
                        </div>
                        <p className="text-xs text-neutral-500">السرعة: 0 كم/س • الموقع: النجف - المدينة القديمة</p>
                      </div>

                      <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2">
                        <div className="flex justify-between items-center flex-row-reverse">
                          <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">ديبارت بي ام دبليو</span>
                          <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">بث نشط</span>
                        </div>
                        <p className="text-xs text-neutral-500">السرعة: 110 كم/س • الموقع: طريق حلة - بغداد السريع</p>
                      </div>
                    </div>
                  </div>

                  {/* Right map box placeholder/representation */}
                  <div className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl lg:col-span-2 h-[500px] flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
                    <div className="relative text-center p-6 space-y-4">
                      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <MapPin size={32} />
                      </div>
                      <h4 className="font-bold text-black">خارطة التتبع التفاعلية الحية</h4>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        يتم الآن تتبع الأجهزة عبر الأقمار الصناعية بنظام الإحداثيات الجغرافية المزدوج. الخارطة مدمجة بنطاق الحماية الجغرافية الافتراضي لشركتك.
                      </p>
                      <div className="inline-flex items-center gap-2 text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full font-mono border border-emerald-100 dark:border-emerald-900/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        <span>GPS Link: Signal Strong (98%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SUPER ADMIN */}
            {isSuperAdmin && currentTab === 'super-admin' && (
              <div className="space-y-6 text-right">
                <div>
                  <h1 className="text-2xl font-black text-black flex items-center gap-2 justify-end animate-fade-in">
                    <Building className="text-rose-500" size={24} />
                    <span>لوحة التحكم الخاصة بمالك المنظومة الرئيسي</span>
                  </h1>
                  <p className="text-sm text-neutral-500 mt-1">التحكم في كافة الشركات والمعارض المسجلة على شبكتك وبيانات مستخدميها بالتفصيل</p>
                </div>

                <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-rose-100 dark:border-rose-950/50 overflow-hidden">
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 font-bold text-sm text-rose-800 dark:text-rose-400 border-b border-rose-100 flex justify-between items-center flex-row-reverse">
                    <span>قائمة الشركات المسجلة والمعارض الشريكة مع بيانات الحسابات</span>
                    <span className="text-[19px] leading-[19px] font-['Times_New_Roman'] text-rose-600 dark:text-rose-400 font-bold">إجمالي: <span className="font-sans mx-1">{companies.length}</span> شركات</span>
                  </div>

                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {companies.map((comp: any, index: number) => {
                      const matchedUser = (usersList || []).find((u: any) => u.companyId === comp.id || (u.email && u.email.toLowerCase() === comp.adminEmail?.toLowerCase()));
                      let dateObj = null;
                      if (comp.createdAt) {
                        try {
                          dateObj = comp.createdAt.toDate ? comp.createdAt.toDate() : new Date(comp.createdAt);
                        } catch (e) {
                          dateObj = new Date();
                        }
                      }
                      const formattedRegDate = dateObj && !isNaN(dateObj.getTime())
                        ? dateObj.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                        : 'غير متوفر';
                      const userPhone = matchedUser?.phoneNumber || comp.phoneNumber || 'لا يوجد';
                      const userPass = matchedUser?.plainPassword || 'مخفي آمن (تشفير Bcrypt)';

                      return (
                        <div key={`${comp.id}-${index}`} className="p-6 flex flex-col gap-5 text-right bg-[#fefefe] hover:bg-white transition shadow-sm first:rounded-t-3xl last:rounded-b-3xl">
                          
                          {/* Header of the Company */}
                          <div className="flex flex-col sm:flex-row-reverse justify-between items-start sm:items-center gap-4">
                            <div>
                              <h4 className="font-bold text-lg text-black flex items-center gap-2 flex-row-reverse group">
                                <motion.span 
                                  whileHover={{ scale: 1.05, backgroundColor: '#fecdd3' }}
                                  className="bg-rose-100 text-rose-700 text-[10px] px-2.5 py-1 rounded-xl font-black transition-colors cursor-default"
                                >
                                  شركة
                                </motion.span>
                                <span className="group-hover:text-rose-600 transition-colors">{comp.name || 'بدون اسم'}</span>
                              </h4>
                              <p className="text-xs text-neutral-400 mt-1 font-mono">الرمز التعريفي الفريد: @{comp.handle || 'handle'}</p>
                            </div>

                            <div className="flex items-center gap-2 flex-row-reverse flex-wrap">
                              <span className={`text-[11px] font-black px-3 py-1 rounded-full ${comp.approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {comp.approved ? '● نَشطة ومعتمدة' : '○ متوقفة / بانتظار التفعيل'}
                              </span>

                              {comp.isBanned && (
                                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-red-600 text-white border border-red-700 animate-pulse">
                                  ● حظر نهائي
                                </span>
                              )}

                              {matchedUser?.isLockedBySystem && (
                                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-red-800 text-white border border-red-900">
                                  ● معطل من النظام
                                </span>
                              )}

                              {matchedUser?.lockUntil && new Date(matchedUser.lockUntil) > new Date() && !matchedUser?.isLockedBySystem && (
                                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-amber-500 text-white border border-amber-600">
                                  ● محظور مؤقتاً
                                </span>
                              )}

                              <button 
                                onClick={() => handleToggleCompanyApproval(comp)} 
                                className={`px-4 py-2 rounded-xl text-xs font-black transition ${comp.approved ? 'bg-black text-white hover:bg-neutral-800' : 'bg-green-600 text-white hover:bg-green-700'}`}
                              >
                                {comp.approved ? 'تعطيل الحساب' : 'تفعيل واعتماد الشركة'}
                              </button>

                              {(matchedUser?.isLockedBySystem || (matchedUser?.lockUntil && new Date(matchedUser.lockUntil) > new Date())) && (
                                <button 
                                  onClick={() => handleUnblockCompany(comp.id)} 
                                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-700 transition"
                                >
                                  فك الحظر
                                </button>
                              )}

                              <button 
                                onClick={() => handleToggleBanCompany(comp.id)} 
                                className={`px-4 py-2 rounded-xl text-xs font-black transition ${comp.isBanned ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-950 text-white hover:bg-black'}`}
                              >
                                {comp.isBanned ? 'إلغاء الحظر النهائي' : 'حظر نهائي'}
                              </button>

                              <button 
                                onClick={() => activateCompanySubscription(comp)} 
                                className="bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-rose-700 transition"
                              >
                                تفعيل الاشتراك
                              </button>

                              {!comp.subscriptionExpired && (
                                <button 
                                  onClick={() => cancelSubscription(comp)} 
                                  className="bg-yellow-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-yellow-700 transition"
                                >
                                  إلغاء الاشتراك
                                </button>
                              )}
                              
                              {confirmDeleteCompanyId === comp.id ? (
                                <button 
                                  onClick={() => {
                                    setConfirmDeleteCompanyId(null);
                                    handleDeleteCompanyForAdmin(comp.id);
                                  }} 
                                  className="bg-red-800 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-red-900 transition outline outline-2 outline-offset-2 outline-red-500 animate-pulse"
                                >
                                  تأكيد الحذف نهائياً (باستثناء الحظر)
                                </button>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteCompanyId(comp.id)} 
                                  className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-red-700 transition"
                                >
                                  حذف الشركة
                                </button>
                              )}
                              
                              {matchedUser?.pendingPassword && (
                                <button 
                                  onClick={() => handleApprovePassword(comp.id, matchedUser.id)}
                                  className="bg-sky-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-sky-700 transition"
                                >
                                  موافقة على الرمز
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Beautiful grid outlining all required user and company info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-[#000000] p-4 rounded-2xl border border-neutral-900 shadow-xl">
                            
                            {/* Col 1: Manager Information */}
                            <div className="space-y-2 border-none sm:border-l sm:border-neutral-800 pl-2 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {(() => {
                                  let isOnline = false;
                                  if (matchedUser?.lastSeen) {
                                    try {
                                      const lastSeen = matchedUser.lastSeen.toDate ? matchedUser.lastSeen.toDate() : new Date(matchedUser.lastSeen);
                                      if (!isNaN(lastSeen.getTime())) {
                                        const now = new Date();
                                        const diff = (now.getTime() - lastSeen.getTime()) / 1000;
                                        isOnline = diff < 120; // Active in last 2 minutes
                                      }
                                    } catch (e) {
                                      isOnline = false;
                                    }
                                  }
                                  
                                  if (isOnline) {
                                    return (
                                      <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                        نشط الآن
                                      </span>
                                    );
                                  }
                                  
                                  return (
                                    <span className="flex items-center gap-1 bg-neutral-800/50 text-neutral-500 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-neutral-700">
                                      <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                                      خامل
                                    </span>
                                  );
                                })()}
                                <span className="text-[10px] text-neutral-500 font-bold block">👤 اسم المسؤول والصفة</span>
                              </div>
                              <div className="flex items-center gap-2 justify-end">
                                {isSuperAdmin && matchedUser && (
                                  <button
                                    onClick={() => handleUpdateUserRole(matchedUser.email, matchedUser.role)}
                                    className={`text-[9px] font-black px-2 py-0.5 rounded-md transition ${matchedUser.role === 'super_admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}
                                  >
                                    {matchedUser.role === 'super_admin' ? 'تخفيض' : 'ترقية'}
                                  </button>
                                )}
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${matchedUser?.role === 'super_admin' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}>
                                  {matchedUser?.role === 'super_admin' ? 'سوبر ادمن' : 'مدير (Admin)'}
                                </span>
                                <span className="text-sm font-semibold text-white">
                                  {matchedUser?.fullName || comp.fullName || 'مسؤول الشركة'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 justify-end text-neutral-400">
                                <span className="text-[11px] font-bold">{comp.name || comp.companyName || 'اسم الشركة غير معروف'}</span>
                                <span className="text-[10px]">🏢</span>
                              </div>
                            </div>

                            {/* Col 1.5: Subscription Counter - Interactive */}
                            <div className="space-y-2 border-none lg:border-l lg:border-neutral-800 pl-2 text-right w-full">
                              <span className="text-[10px] text-neutral-500 font-bold block">⏳ مدة وحالة الاشتراك</span>
                              <div className="flex flex-col gap-1.5 items-end">
                                {(() => {
                                  let endDate = new Date();
                                  try {
                                    if (comp.subscriptionEndDate) {
                                      endDate = comp.subscriptionEndDate.toDate ? comp.subscriptionEndDate.toDate() : new Date(comp.subscriptionEndDate);
                                    } else if (comp.createdAt) {
                                      const createdAtDate = comp.createdAt.toDate ? comp.createdAt.toDate() : new Date(comp.createdAt);
                                      endDate = new Date(createdAtDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                                    }
                                  } catch (e) {
                                    endDate = new Date();
                                  }
                                  if (isNaN(endDate.getTime())) endDate = new Date();
                                  const diffTime = endDate.getTime() - new Date().getTime();
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;
                                  const isExpired = diffDays <= 0;
                                  const percentage = Math.max(0, Math.min(100, (diffDays / 30) * 100)) || 0;
                                  let formattedEndDate = 'غير محدد';
                                  try {
                                    formattedEndDate = endDate.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                  } catch (e) { }
                                  
                                  return (
                                    <motion.div className="w-full space-y-1.5 flex flex-col justify-end">
                                      <div className={`text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1.5 justify-end w-fit ml-auto shadow-sm ${comp.subscriptionExpired ? 'bg-red-500/20 text-red-400 border border-red-500/30' : diffDays <= 5 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${comp.subscriptionExpired ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                        {comp.subscriptionExpired ? 'تم إلغاء الاشتراك / منتهي' : `ينتهي في ${formattedEndDate} (متبقي ${diffDays} يوم)`}
                                      </div>
                                      <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-neutral-800" dir="ltr">
                                        <motion.div 
                                          initial={{ width: 0 }}
                                          animate={{ width: `${percentage}%` }}
                                          transition={{ duration: 1.5, ease: "circOut" }}
                                          className={`h-full ${comp.subscriptionExpired ? 'bg-red-500' : diffDays <= 5 ? 'bg-orange-500' : 'bg-emerald-400'}`}
                                        />
                                      </div>
                                    </motion.div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Col 2: Email & Phone Number */}
                            <div className="space-y-2 border-none sm:border-l sm:border-neutral-800 pl-2 text-right">
                              <span className="text-[10px] text-neutral-500 font-bold block">📞 رقم الهاتف والإيميل</span>
                              <div className="space-y-1">
                                <p className="text-xs text-neutral-300">
                                  الهاتف: <strong className="font-bold text-white tracking-widest">{userPhone}</strong>
                                </p>
                                <p className="text-xs text-neutral-300">
                                  البريد: <strong className="font-mono text-rose-400">{comp.adminEmail || matchedUser?.email}</strong>
                                </p>
                              </div>
                            </div>

                            {/* Col 3: Password & Registration Date */}
                            <div className="space-y-2 text-right">
                              <span className="text-[10px] text-neutral-500 font-bold block">🔑 الرمز السري وتاريخ التسجيل</span>
                              <div className="space-y-1">
                                <p className="text-xs text-neutral-300">
                                  تاريخ التسجيل: <span className="font-bold text-rose-500 uppercase">{formattedRegDate}</span>
                                </p>
                                <p className="text-xs text-neutral-300">
                                  الرمز السري: {isSuperAdmin ? (
                                    <span className="font-mono rounded bg-white/10 text-white px-1.5 py-0.5 text-[11px] font-black tracking-widest">{userPass}</span>
                                  ) : (
                                    <span className="text-neutral-500 italic text-[11px]">مخفي</span>
                                  )}
                                </p>
                              </div>
                            </div>

                           </div>
                           
                           {/* Branches Section */}
                           <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl p-4 border border-neutral-200 dark:border-neutral-800">
                             <div className="flex items-center justify-between flex-row-reverse mb-3">
                               <h5 className="font-bold text-sm text-neutral-800 dark:text-neutral-200 flex items-center gap-2 flex-row-reverse">
                                 <Building size={16} className="text-amber-500" />
                                 الفروع
                               </h5>
                               <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded-full">الحساب المسجل حالياً يمثل الفرع الرئيسي</span>
                             </div>
                             
                             <div className="space-y-3">
                               {(comp.branches || []).map((branch: any) => {
                                 const branchUser = usersList.find((u: any) => u.id === branch.id);
                                 let diffDays = 0;
                                 let percentage = 0;
                                 let formattedEndDate = '---';
                                 
                                 if (branchUser) {
                                   try {
                                     let endDate = new Date();
                                     if (branchUser.subscriptionEndDate) {
                                       endDate = branchUser.subscriptionEndDate.toDate ? branchUser.subscriptionEndDate.toDate() : new Date(branchUser.subscriptionEndDate);
                                     } else if (branchUser.createdAt) {
                                       const createdAtDate = branchUser.createdAt.toDate ? branchUser.createdAt.toDate() : new Date(branchUser.createdAt);
                                       endDate = new Date(createdAtDate.getTime() + 30 * 24 * 60 * 60 * 1000);
                                     }
                                     diffDays = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                     percentage = Math.max(0, Math.min(100, (diffDays / 30) * 100));
                                     formattedEndDate = endDate.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
                                   } catch (e) { }
                                 }

                                 return (
                                 <div key={branch.id} className="flex flex-col gap-2 bg-white dark:bg-black p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                                   <div className="flex items-center justify-between flex-row-reverse">
                                     <div className="flex items-center gap-3 flex-row-reverse">
                                       <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                                         <MapPin size={14} />
                                       </div>
                                       <div className="text-right">
                                         <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{branch.name}</div>
                                         <div className="text-xs text-neutral-500 font-mono mt-0.5">{branch.email}</div>
                                       </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                       {isSuperAdmin && branchUser && (
                                         <>
                                           {branchUser.subscriptionExpired ? (
                                             <button
                                               onClick={() => {
                                                 setSubscriptionTarget({ ...branchUser, isBranch: true });
                                                 setSubscriptionDays(30);
                                                 setShowSubscriptionModal(true);
                                               }}
                                               className="bg-amber-500 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-600 transition"
                                             >
                                               تفعيل
                                             </button>
                                           ) : (
                                             <button
                                               onClick={() => {
                                                 setCancelTarget({ ...branchUser, isBranch: true });
                                                 setShowCancelModal(true);
                                               }}
                                               className="bg-red-500/10 text-red-500 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-500/20 transition border border-red-500/20"
                                             >
                                               إلغاء
                                             </button>
                                           )}
                                         </>
                                       )}
                                       <button
                                         onClick={async () => {
                                            try {
                                              const branches = comp.branches || [];
                                              await updateDoc(doc(db, 'companies', comp.id), {
                                                branches: branches.filter((b: any) => b.id !== branch.id)
                                              });
                                              toast.success('تم حذف الفرع بنجاح');
                                            } catch (err) {
                                              toast.error('فشل حذف الفرع');
                                            }
                                         }}
                                         className="text-red-500 hover:text-red-600 p-2 bg-red-50 hover:bg-red-100 rounded-lg transition"
                                       >
                                         <Trash2 size={14} />
                                       </button>
                                     </div>
                                   </div>
                                   {branchUser && (
                                     <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/50 flex flex-col gap-1">
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="font-mono text-neutral-500">{branchUser.plainPassword} :الرمز السري</span>
                                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${branchUser.subscriptionExpired ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                            {branchUser.subscriptionExpired ? 'منتهي/ملغى' : `نشط - ينتهي في ${formattedEndDate}`}
                                          </span>
                                        </div>
                                     </div>
                                   )}
                                 </div>
                               )})}
                               
                               {branchCompanyId === comp.id ? (
                                 <div className="flex flex-col gap-2 bg-white dark:bg-black p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
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
                                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')?.replace(/^"|"$/g, '')}`
                                                },
                                                body: JSON.stringify({
                                                    branchName: newBranchName.trim(),
                                                    email: newBranchEmail.trim(),
                                                    password: newBranchPassword.trim(),
                                                    companyId: comp.id
                                                })
                                            });
                                            if (!res.ok) {
                                                const err = await res.json();
                                                throw new Error(err.message || 'فشل إضافة الفرع');
                                            }
                                            
                                            // The backend already adds it to the company's `branches` array and creates a user, but we update locally to reflect immediately or let onSnapshot handle it
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
                                 </div>
                               ) : (
                                 <button
                                   onClick={() => setBranchCompanyId(comp.id)}
                                   className="w-full py-2 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-2 flex-row-reverse"
                                 >
                                   <Plus size={14} /> إضافة فرع جديد
                                 </button>
                               )}
                             </div>
                           </div>

                         </div>
                      );
                    })}

                    {companies.length === 0 && (
                      <div className="flex flex-col items-center justify-center text-neutral-400 py-20 px-4">
                        <Building size={64} className="mb-6 opacity-20" />
                        <h3 className="text-xl font-black text-neutral-600 dark:text-neutral-300 mb-2">لا يوجد شركات مسجلة</h3>
                        <p className="text-sm text-center max-w-md">لا توجد شركات مسجلة في قاعدة البيانات حالياً. كافة الشركات والمعارض التي تقوم بالتسجيل ستظهر هنا ليتسنى لك مراجعتها وتفعيلها.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SETTINGS */}
            {currentTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-6 text-right">
                <div>
                  <h1 className="text-2xl font-black text-black text-center">إعدادات الشركة وشروط العقد</h1>
                  <p className="text-sm mt-1 text-center text-neutral-500">تحديث معلومات الهوية، العقد، والترويسات الرسمية لشركتك</p>
                </div>

                <form onSubmit={handleSaveSettings} className="bg-[#336b73] p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                  <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5 mb-6 relative z-10 w-full">
                    <button
                      type="button"
                      onClick={() => setSettingsMainTab('terms')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-black transition-all ${
                        settingsMainTab === 'terms'
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <FileText size={16} />
                      <span>شروط العقد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsMainTab('general')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-black transition-all ${
                        settingsMainTab === 'general'
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Settings size={16} />
                      <span>إعدادات عامة</span>
                    </button>
                  </div>

                  {settingsMainTab === 'general' && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">اسم صالة أو شركة التأجير</label>
                    <input 
                      type="text" 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="مثال: شركة بوابة الرافدين لتأجير السيارات"
                      className="w-full bg-[#c0cae4] border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">رقم الهاتف الرسمي للتواصل والواتساب</label>
                    <input 
                      type="text" 
                      value={companyPhoneSetting}
                      onChange={(e) => setCompanyPhoneSetting(e.target.value)}
                      placeholder="مثال: 9647700000000+"
                      className="w-full bg-[#b8c2d6] border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">البريد الإلكتروني للشركة</label>
                    <input 
                      type="email" 
                      value={companyEmailSetting}
                      onChange={(e) => setCompanyEmailSetting(e.target.value)}
                      placeholder="مثال: info@company.com"
                      className="w-full bg-[#b8c2d6] border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">العنوان الرسمي للمكتب</label>
                    <input 
                      type="text" 
                      value={companyAddressSetting}
                      onChange={(e) => setCompanyAddressSetting(e.target.value)}
                      placeholder="مثال: بغداد - الكرادة - تقاطع سبع قصور"
                      className="w-full bg-[#b8c6e0] border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-neutral-700 dark:text-neutral-300">السجل التجاري أو الرقم الضريبي (اختياري)</label>
                    <input 
                      type="text" 
                      value={companyTaxId}
                      onChange={(e) => setCompanyTaxId(e.target.value)}
                      placeholder="مثال: 228912-IRAQ"
                      className="w-full bg-[#bdc5d9] border border-neutral-200 dark:border-neutral-800 p-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-amber-500 text-right"
                    />
                  </div>

                  <div className="space-y-2 text-right">
                    <label className="text-sm font-black text-white block">شعار صالة أو شركة التأجير (Logo)</label>
                    
                    {/* Main control wrapper */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#234b51] p-4 rounded-2xl border border-neutral-700/40 text-right">
                      
                      {/* Left: Upload and controls */}
                      <div className="flex flex-col justify-center gap-3">
                        <div className="relative border-2 border-dashed border-[#c1c6d2]/40 hover:border-white/60 transition-colors p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-black/10 text-center"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              compressImage(file).then(base64 => {
                                setCompanyLogoUrl(base64);
                                toast.success('تم تحميل الشعار بنجاح!');
                              }).catch(err => {
                                toast.error('حدث خطأ أثناء معالجة الصورة');
                              });
                            }
                          }}
                        >
                          <input 
                            type="file" 
                            accept="image/*" 
                            id="logo-file-input" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                compressImage(file).then(base64 => {
                                  setCompanyLogoUrl(base64);
                                  toast.success('تم تحميل الشعار بنجاح!');
                                }).catch(err => {
                                  toast.error('حدث خطأ أثناء معالجة الصورة');
                                });
                              }
                            }}
                          />
                          <label htmlFor="logo-file-input" className="cursor-pointer flex flex-col items-center gap-2 text-white">
                            <Upload size={24} className="text-amber-400 animate-pulse" />
                            <span className="text-xs font-black">اسحب وأسقط الشعار هنا</span>
                            <span className="text-[10px] text-neutral-300">أو اضغط لاختيار ملف من الحاسبة</span>
                          </label>
                        </div>

                        {companyLogoUrl && (
                          <button 
                            type="button"
                            onClick={() => {
                              setCompanyLogoUrl('');
                              toast.success('تم إزالة الشعار');
                            }}
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/30 hover:bg-red-600 border border-red-500/40 text-white rounded-xl text-xs font-bold transition-all"
                          >
                            <Trash2 size={14} />
                            <span>إزالة الشعار الحالي</span>
                          </button>
                        )}
                      </div>

                      {/* Right: Preview & URL Input */}
                      <div className="flex flex-col gap-3 justify-between bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-neutral-300 block mb-1.5">معاينة الشعار الحالي</span>
                          <div className="h-24 bg-slate-900/60 rounded-lg flex items-center justify-center p-3 relative overflow-hidden border border-neutral-700/50 [background-image:radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:10px_10px]">
                            {companyLogoUrl ? (
                              <img 
                                src={companyLogoUrl} 
                                alt="Company Logo Preview" 
                                className="max-h-full max-w-full object-contain filter drop-shadow-md"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="text-center text-neutral-500 flex flex-col items-center gap-1.5">
                                <Image size={24} className="opacity-30" />
                                <span className="text-[10px]">لا يوجد شعار محدد</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 text-right">
                          <span className="text-[10px] font-bold text-neutral-300">أو يمكنك لصق رابط الشعار يدويًا:</span>
                          <input 
                            type="text" 
                            value={companyLogoUrl}
                            onChange={(e) => setCompanyLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            className="w-full bg-[#bdc5d9]/20 text-white placeholder-neutral-400 border border-white/10 p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500 text-left font-mono"
                          />
                        </div>
                      </div>

                    </div>
                    <p className="text-[10px] text-white/70 text-right">ستظهر هذه التفاصيل فورياً في أعلى هيدر العقد الإلكتروني والـ PDF المتولد.</p>
                  </div>

                  <div className="space-y-2 text-right">
                    <label className="text-sm font-black text-white block">صورة تأسيس الشركة (Establishment Certificate)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#234b51] p-4 rounded-2xl border border-neutral-700/40 text-right">
                      <div className="flex flex-col justify-center gap-3">
                        <div className="relative border-2 border-dashed border-[#c1c6d2]/40 hover:border-white/60 transition-colors p-6 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-black/10 text-center"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              compressImage(file).then(base64 => {
                                setCompanyEstablishmentImageUrl(base64);
                                toast.success('تم تحميل صورة التأسيس بنجاح!');
                              }).catch(err => {
                                toast.error('حدث خطأ أثناء معالجة الصورة');
                              });
                            }
                          }}
                        >
                          <input 
                            type="file" 
                            accept="image/*" 
                            id="establishment-file-input" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                compressImage(file).then(base64 => {
                                  setCompanyEstablishmentImageUrl(base64);
                                  toast.success('تم تحميل صورة التأسيس بنجاح!');
                                }).catch(err => {
                                  toast.error('حدث خطأ أثناء معالجة الصورة');
                                });
                              }
                            }}
                          />
                          <label htmlFor="establishment-file-input" className="cursor-pointer flex flex-col items-center gap-2 text-white">
                            <UploadCloud size={24} className="text-amber-400 animate-pulse" />
                            <span className="text-xs font-black">اسحب وأسقط صورة التأسيس هنا</span>
                            <span className="text-[10px] text-neutral-300">أو اضغط لاختيار ملف</span>
                          </label>
                        </div>
                        {companyEstablishmentImageUrl && (
                          <button 
                            type="button"
                            onClick={() => {
                              setCompanyEstablishmentImageUrl('');
                              toast.success('تم إزالة صورة التأسيس');
                            }}
                            className="flex items-center justify-center gap-2 py-2 px-3 bg-red-600/30 hover:bg-red-600 border border-red-500/40 text-white rounded-xl text-xs font-bold transition-all"
                          >
                            <Trash2 size={14} />
                            <span>إزالة صورة التأسيس</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 justify-between bg-black/20 p-3.5 rounded-xl border border-white/5">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-neutral-300 block mb-1.5">معاينة صورة التأسيس</span>
                          <div className="h-24 bg-slate-900/60 rounded-lg flex items-center justify-center p-3 relative overflow-hidden border border-neutral-700/50">
                            {companyEstablishmentImageUrl ? (
                              <img src={companyEstablishmentImageUrl} alt="Establishment Preview" className="max-h-full max-w-full object-contain filter drop-shadow-md" referrerPolicy="no-referrer" />
                            ) : (
                                <div className="text-center text-neutral-500 flex flex-col items-center gap-1.5">
                                  <FileText size={24} className="opacity-30" />
                                  <span className="text-[10px]">لا توجد صورة تأسيس</span>
                                </div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-1 text-right">
                          <span className="text-[10px] font-bold text-neutral-300">رابط صورة التأسيس يدويًا:</span>
                          <input 
                            type="text" 
                            value={companyEstablishmentImageUrl}
                            onChange={(e) => setCompanyEstablishmentImageUrl(e.target.value)}
                            placeholder="https://example.com/cert.png"
                            className="w-full bg-[#bdc5d9]/20 text-white placeholder-neutral-400 border border-white/10 p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500 text-left font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  </div>
                  )}

                  {settingsMainTab === 'terms' && (
                  <div className="space-y-4">
                  <div className="bg-[#234b51] p-4 rounded-2xl border border-neutral-700/40">
                    <div className="flex bg-black/20 p-1.5 rounded-xl border border-white/5 mb-4 relative z-10 w-fit ml-auto">
                      <button
                        type="button"
                        onClick={() => setSettingsTermsTab('with_driver')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-black transition-all ${
                          settingsTermsTab === 'with_driver'
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <Car size={14} />
                        <span>شروط العقد مع سائق</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsTermsTab('without_driver')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-black transition-all ${
                          settingsTermsTab === 'without_driver'
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        <FileText size={14} />
                        <span>شروط العقد بدون سائق</span>
                      </button>
                    </div>

                    {settingsTermsTab === 'without_driver' && (
                      <div className="space-y-2">
                        {companyContractTerms.map((term, idx) => (
                          <div key={idx} className="flex items-center gap-3 mb-2">
                            <div className="flex-shrink-0 w-16 h-8 bg-black/20 text-white rounded-lg flex items-center justify-center font-bold text-xs border border-white/10">
                              شرط {idx + 1}
                            </div>
                            <textarea 
                              rows={3}
                              value={term}
                              onChange={(e) => {
                                const newTerms = [...companyContractTerms];
                                newTerms[idx] = e.target.value;
                                setCompanyContractTerms(newTerms);
                              }}
                              placeholder={defaultTermsNoDriver[idx] || `الشرط رقم ${idx + 1}`}
                              className="w-full bg-[#bdc5d9] border border-neutral-200 dark:border-neutral-800 p-2.5 rounded-xl text-xs leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 text-right resize-none placeholder-gray-600 font-medium"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {settingsTermsTab === 'with_driver' && (
                      <div className="space-y-2">
                        {companyDriverContractTerms.map((term, idx) => (
                          <div key={idx} className="flex items-center gap-3 mb-2">
                            <div className="flex-shrink-0 w-16 h-8 bg-black/20 text-white rounded-lg flex items-center justify-center font-bold text-xs border border-white/10">
                              شرط {idx + 1}
                            </div>
                            <textarea 
                              rows={3}
                              value={term}
                              onChange={(e) => {
                                const newTerms = [...companyDriverContractTerms];
                                newTerms[idx] = e.target.value;
                                setCompanyDriverContractTerms(newTerms);
                              }}
                              placeholder={defaultTermsWithDriver[idx] || `الشرط رقم ${idx + 1}`}
                              className="w-full bg-[#bdc5d9] border border-neutral-200 dark:border-neutral-800 p-2.5 rounded-xl text-xs leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 text-right resize-none placeholder-gray-600 font-medium"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </div>
                  )}



                  <button 
                    type="submit" 
                    className="w-full py-3 bg-[#736c5e] text-white font-black text-sm rounded-2xl shadow-lg transition mt-6"
                  >
                    حفظ التغييرات واعتماد المكتب رسميًا
                  </button>
                </form>
              </div>
            )}

          </div>

        </main>

      </div>

      {/* FOOTER */}
      <footer className="bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 py-4 text-center text-xs text-neutral-400 font-medium -ml-[3px]">
        حقوق الطبع والنشر والتأجير محفوظة لبرنامج عراق رنتل © ٢٠٢٦
      </footer>

      {/* --- MODALS --- */}
      
      {/* 1. Modal: Add Car */}
      {showCarModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#fbfbfb] dark:bg-neutral-950 rounded-none p-6 max-w-md w-full text-right space-y-4 shadow-xl border border-neutral-100 dark:border-neutral-850"
          >
            <h3 className="font-black text-xl text-black pb-2 border-b">{editingCarId ? 'تعديل بيانات السيارة' : 'إضافة سيارة جديدة لأسطولك'}</h3>
            
            <form onSubmit={handleSaveCar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">اسم السيارة</label>
                  <input 
                    type="text" 
                    value={carName}
                    onChange={e => setCarName(e.target.value)}
                    placeholder="مثال: Hyundai Elantra"
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">لوحة المركبة</label>
                  <input 
                    type="text" 
                    value={carPlate}
                    onChange={e => setCarPlate(e.target.value)}
                    placeholder="مثال: 94112 بغداد / خصوصي"
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">اسم المستثمر</label>
                  <input 
                    type="text" 
                    value={carOwnerName}
                    onChange={e => setCarOwnerName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">رقم هاتف المستثمر</label>
                  <input 
                    type="text" 
                    value={carOwnerPhone}
                    onChange={e => setCarOwnerPhone(e.target.value)}
                    placeholder="مثال: 0770..."
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right font-mono"
                  />
                </div>
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">رقم الشاصي</label>
                  <input 
                    type="text" 
                    value={carChassis}
                    onChange={e => setCarChassis(e.target.value)}
                    placeholder="مثال: JHM..."
                    required
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">رقم السنوية</label>
                  <input 
                    type="text" 
                    value={carRegNumber}
                    onChange={e => setCarRegNumber(e.target.value)}
                    placeholder="مثال: A123..."
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">لون المركبة</label>
                  <input 
                    type="text" 
                    value={carColor}
                    onChange={e => setCarColor(e.target.value)}
                    placeholder="مثال: أسود"
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">سنة الصنع</label>
                  <input 
                    type="text" 
                    value={carYear}
                    onChange={e => setCarYear(e.target.value)}
                    placeholder="مثال: 2024"
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-600 font-bold">الإيجار اليومي (د.ع)</label>
                  <input 
                    type="text" 
                    value={carPrice}
                    onChange={e => setCarPrice(e.target.value)}
                    placeholder="75000"
                    className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1 text-right">
                <label className="text-xs text-neutral-600 font-bold flex items-center gap-1.5 justify-end mb-1">
                  <span>صورة السيارة (إختياري)</span>
                  <Image size={14} className="text-amber-500" />
                </label>
                <div className="grid grid-cols-1 gap-2 bg-neutral-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                  <div 
                    className="border-2 border-dashed border-neutral-300 hover:border-amber-550 transition-colors p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white text-center sm:p-5 dark:bg-black/20"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        compressImage(file).then(base64 => {
                          setCarImageUrl(base64);
                          toast.success('تم تحميل صورة السيارة بنجاح!');
                        }).catch(err => {
                          toast.error('حدث خطأ أثناء معالجة الصورة');
                        });
                      }
                    }}
                  >
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="car-image-upload-input" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImage(file).then(base64 => {
                            setCarImageUrl(base64);
                            toast.success('تم تحميل صورة السيارة بنجاح!');
                          }).catch(err => {
                            toast.error('حدث خطأ أثناء معالجة الصورة');
                          });
                        }
                      }}
                    />
                    <label htmlFor="car-image-upload-input" className="cursor-pointer flex flex-col items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                      {carImageUrl ? (
                        <div className="relative group w-full h-20 flex items-center justify-center">
                          <img src={carImageUrl} alt="Car" className="h-20 object-contain rounded-lg filter drop-shadow" referrerPolicy="no-referrer" loading="lazy" decoding="async" />
                        </div>
                      ) : (
                        <>
                          <Image size={24} className="text-amber-500 hover:scale-110 transition-transform" />
                          <span className="text-[11px] font-black">اسحب أو اضغط لرفع صورة السيارة</span>
                          <span className="text-[9px] text-neutral-400">ملف JPG, PNG اقل من 2 ميغابايت</span>
                        </>
                      )}
                    </label>
                  </div>
                  
                  {carImageUrl && (
                    <button 
                      type="button" 
                      onClick={() => setCarImageUrl('')}
                      className="py-1 px-3 bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-950/40 text-[10px] rounded-lg transition"
                    >
                      إزالة الصورة المثبتة
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl text-sm transition"
                >
                  تأكيد الإضافة والتعميم
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCarModal(false);
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
                  }}
                  className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-sm font-bold text-neutral-600"
                >
                  إلغاء للاحقاً
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkBlockModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-none p-6 max-w-lg w-full text-right space-y-4 shadow-xl border border-neutral-100"
          >
            <h3 className="font-black text-xl text-black pb-2 border-b">إضافة مستأجرين بالجملة</h3>
            <p className="text-xs text-neutral-500">
              قم بلصق الحقول من ملف الإكسل (أو كملف نصي) بحيث يكون كل مستأجر في سطر جديد.<br/>
              الترتيب المطلوب: الاسم ، رقم الهاتف ، رقم الهوية ، سبب الحظر (يفصل بينهم بمسافة أو Tab أو فاصلة).
            </p>
            <form onSubmit={handleBulkBlocklist} className="space-y-4">
              <textarea
                value={bulkData}
                onChange={e => setBulkData(e.target.value)}
                placeholder="علي احمد, 07800000000, 1234567, إتلاف سيارة\nمحمد قاسم, 07700000000, 9876543, تأخير عن الدفع"
                className="w-full h-48 p-4 bg-gray-50 border rounded-xl text-sm outline-none text-right placeholder-gray-400 font-mono"
                dir="rtl"
              ></textarea>
              <div className="flex gap-2 justify-end font-bold pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBulkBlockModal(false);
                    setBulkData('');
                  }} 
                  className="px-6 py-2 bg-neutral-100 text-neutral-700 rounded-xl hover:bg-neutral-200 transition"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={bulkLoading}
                  className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition shadow"
                >
                  {bulkLoading ? 'جاري الإضافة...' : 'استيراد الأسماء'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Modal: Add Driver Blocklist */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 rounded-none p-6 max-w-md w-full text-right space-y-4 shadow-xl border border-neutral-100 dark:border-neutral-800"
          >
            <h3 className="font-black text-xl text-black pb-2 border-b">تعميم سائق محظور على مستوى العراق</h3>
            
            <form onSubmit={handleAddBlock} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-600">اسم السائق الثلاثي والكامل</label>
                <input 
                  type="text" 
                  value={blockName}
                  onChange={e => setBlockName(e.target.value)}
                  placeholder="مثال: عمر ميثم جاسم الونداوي"
                  className="w-full p-3 bg-[#dedede] border rounded-xl text-sm outline-none text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-600">رقم هاتف السائق الفعلي</label>
                <input 
                  type="text" 
                  value={blockPhone}
                  onChange={e => setBlockPhone(e.target.value)}
                  placeholder="07700000000"
                  className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-600">نوع المستمسك</label>
                <select 
                  value={blockIdType}
                  onChange={e => setBlockIdType(e.target.value)}
                  className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right"
                >
                  <option value="البطاقة الوطنية">البطاقة الوطنية</option>
                  <option value="هوية الأحوال المدنية">هوية الأحوال المدنية</option>
                  <option value="جواز السفر">جواز السفر</option>
                  <option value="إجازة السوق">إجازة السوق</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-600">رقم التعميم أو المستمسك</label>
                <input 
                  type="text" 
                  value={blockNationalId}
                  onChange={e => setBlockNationalId(e.target.value)}
                  placeholder="مثال: 199402281292"
                  className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-600">رابط صورة المستأجر أو رفع صورة (اختياري)</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={blockImageUrl}
                    onChange={e => setBlockImageUrl(e.target.value)}
                    placeholder="رابط الصورة"
                    className="flex-1 p-3 bg-white border rounded-xl text-sm outline-none text-right font-mono"
                  />
                  <label className="shrink-0 cursor-pointer bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-3 rounded-xl flex items-center justify-center transition">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImage(file).then(base64 => {
                            setBlockImageUrl(base64);
                          }).catch(err => {
                            toast.error('حدث خطأ أثناء معالجة الصورة');
                          });
                        }
                      }}
                    />
                    <span className="text-xl">📁</span>
                  </label>
                  <button type="button" onClick={startCamera} className="shrink-0 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-3 rounded-xl flex items-center justify-center transition">
                     <span className="text-xl">📸</span>
                  </button>
                </div>
                {blockImageUrl && (
                  <div className="mt-2">
                    <img src={blockImageUrl} alt="Preview" className="w-20 h-20 rounded-xl object-cover border" loading="lazy" decoding="async" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-600">سبب الحظر (بوضوح تام للمكاتب الأخرى)</label>
                <textarea 
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  rows={3}
                  placeholder="مثال: لم يدفع مستحقات العقد وامتنع عن رد المكالمات ولديه مخالفات سرعة عالية"
                  className="w-full p-3 bg-white border rounded-xl text-sm outline-none text-right resize-none"
                />
              </div>

              {showCamera && (
                <div className="fixed inset-0 bg-black/80 z-999 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
                    <div className="flex justify-between items-center border-b pb-2">
                      <h3 className="font-bold text-lg text-black">التقاط صورة السائق المحظور</h3>
                      <button type="button" onClick={stopCamera} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 font-bold p-2 text-xl">✕</button>
                    </div>
                    <div className="relative bg-black rounded-lg overflow-hidden flex flex-col justify-center items-center h-[300px]">
                      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                      <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                    <div className="flex gap-4 justify-center mt-2">
                      <button type="button" onClick={captureImage} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition text-lg">
                        تصوير
                      </button>
                      <button type="button" onClick={stopCamera} className="bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold py-3 px-8 rounded-xl transition text-lg">
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-red-650 hover:bg-red-700 bg-red-600 text-white font-bold rounded-xl text-sm transition"
                >
                  عمم الآن فورياً 💥
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowBlockModal(false);
                    setBlockName('');
                    setBlockPhone('');
                    setBlockReason('');
                    setBlockNationalId('');
                    setBlockImageUrl('');
                    setBlockIdType('البطاقة الوطنية');
                  }}
                  className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-sm font-bold text-neutral-600"
                >
                  إلغاء للاحقاً
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-sm w-full text-right space-y-6 shadow-2xl border border-neutral-100 dark:border-neutral-800"
          >
            <div>
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 ml-auto border border-amber-100 dark:border-amber-500/20">
                <Award className="text-amber-500" size={28} />
              </div>
              <h3 className="font-black text-2xl text-black dark:text-white">تفعيل الاشتراك</h3>
              <p className="text-sm font-medium text-neutral-500 mt-2">
                اختر المدة التي تريد إضافتها للاشتراك {subscriptionTarget ? `لشركة (${subscriptionTarget.name})` : 'الخاص بك'}
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-neutral-600 dark:text-neutral-400 font-bold block mb-1 flex justify-end">المدة المقترحة</label>
              <div className="grid grid-cols-2 gap-2 text-right">
                <button
                  type="button"
                  onClick={() => setSubscriptionDays(30)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${subscriptionDays === 30 ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-400'}`}
                >
                  شهر واحد (30)
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionDays(3)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${subscriptionDays === 3 ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-400'}`}
                >
                  3 أيام (تمديد)
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionDays(90)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${subscriptionDays === 90 ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-400'}`}
                >
                  3 أشهر (90)
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionDays(60)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all ${subscriptionDays === 60 ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-400'}`}
                >
                  شهران (60)
                </button>
                <button
                  type="button"
                  onClick={() => setSubscriptionDays(365)}
                  className={`py-3 px-2 rounded-xl text-sm font-bold border transition-all col-span-2 ${subscriptionDays === 365 ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-amber-400'}`}
                >
                  سنة كاملة (365)
                </button>
              </div>
              
              <div className="pt-2">
                 <label className="text-xs text-neutral-600 dark:text-neutral-400 font-bold block mb-2 flex justify-end">أو أدخل عدد أيام مخصص</label>
                 <input 
                   type="number"
                   value={subscriptionDays}
                   onChange={(e) => setSubscriptionDays(parseInt(e.target.value) || 0)}
                   className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-center font-mono font-bold text-lg dark:text-white"
                 />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={executeSubscriptionActivation}
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                تفعيل الاشتراك الآن
              </button>
              <button 
                type="button" 
                onClick={() => setShowSubscriptionModal(false)}
                className="px-5 py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 transition"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-sm w-full text-right space-y-6 shadow-2xl border border-neutral-100 dark:border-neutral-800"
          >
            <div>
              <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 ml-auto border border-red-100 dark:border-red-500/20">
                <Ban className="text-red-500" size={28} />
              </div>
              <h3 className="font-black text-2xl text-black dark:text-white">إلغاء الاشتراك</h3>
              <p className="text-sm font-medium text-neutral-500 mt-2">
                هل أنت متأكد من رغبتك في إلغاء الاشتراك {cancelTarget ? `لشركة (${cancelTarget.name})` : 'الخاص بك'} فوراً؟
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                onClick={executeCancelSubscription}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl text-sm transition shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
              >
                تأكيد الإلغاء
              </button>
              <button 
                type="button" 
                onClick={() => setShowCancelModal(false)}
                className="px-5 py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 transition"
              >
                تراجع
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Expired Subscription Blocking Modal */}
      {!isSuperAdmin && isExpired && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-red-100 dark:border-red-900/30 flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <ShieldAlert size={40} className="text-red-500" />
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">
              انتهت صلاحية الاشتراك
            </h2>
            
            <p className="text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
              عذراً، لقد انتهت صلاحية اشتراك شركتك في نظام عراق رنتل. يرجى تجديد الاشتراك للتمكن من متابعة استخدام النظام وإدارة بياناتك.
            </p>
            
            <div className="w-full space-y-3">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition shadow-lg shadow-red-500/25"
              >
                <LogOut size={20} />
                تسجيل الخروج
              </button>
            </div>
            
            <p className="text-xs text-neutral-400 mt-6">
              للاستفسار أو تجديد الاشتراك، يرجى التواصل مع إدارة النظام.
            </p>
          </motion.div>
        </div>
      )}

    </div>
  );
}
