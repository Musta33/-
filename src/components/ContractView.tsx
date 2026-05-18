
import React, { useRef, useState, useEffect } from 'react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-hot-toast';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, db } from '../lib/api';

export function ContractView({ company, staff }: { company?: any, staff?: any }) {
  const contractRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Check if the contract was printed or downloaded previously
    if (localStorage.getItem('contractPrinted') === 'true') {
        setContractData(prev => ({
            ...prev,
            contractCode: String(Math.floor(Math.random() * 90000) + 10000),
            renterName: '',
            renterPhone: '',
            renterAddress: '',
            documentType: '',
            documentNumber: '',
            carModel: '',
            plateNumber: '',
            carColor: '',
            manufactureYear: '',
            rentalCost: '',
            dailyKmLimit: '',
            extraKmPenaltyRate: '',
            departureDate: new Date().toISOString().split('T')[0],
            returnDate: '',
            rentalDays: '',
            dailyAmount: ''
        }));
        setCustomerImg('');
        localStorage.removeItem('contractCustomerImg');
        localStorage.removeItem('contractPrinted');
        toast.success('تم فتح العقد ببيانات جديدة للحفاظ على الخصوصية');
    }
  }, []);

  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [customerImg, setCustomerImg] = useState<string>(() => localStorage.getItem('contractCustomerImg') || '');
  const [logoImg, setLogoImg] = useState<string>(() => localStorage.getItem('contractLogoImg') || '');
  
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
      if (staff && staff.companyId) {
          const q = query(collection(db, 'inventory'), where('companyId', '==', staff.companyId));
          const unsubscribe = onSnapshot(q, (snapshot) => {
              setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          });
          return () => unsubscribe();
      }
  }, [staff]);

  useEffect(() => {
      if (company) {
          if (company.logoUrl) {
              setLogoImg(company.logoUrl);
          }
      }
  }, [company]);
  
  const [textAlign, setTextAlign] = useState<'right' | 'center' | 'left'>('right');
  const [swapHeader, setSwapHeader] = useState<boolean>(false);
  
  // Print / PDF Settings
  const [pdfFileName, setPdfFileName] = useState('عقد_تأجير');
  const [pdfMargin, setPdfMargin] = useState(0);
  const [hideQrCode, setHideQrCode] = useState(false);
  const [hideSignatures, setHideSignatures] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [contractData, setContractData] = useState(() => {
    const savedData = localStorage.getItem('contractData');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.renterName === 'عمر طلال') parsed.renterName = '';
        if (parsed.renterPhone === '0776683571') parsed.renterPhone = '';
        if (parsed.renterAddress === 'ديالى') parsed.renterAddress = '';
        if (parsed.documentType === 'بطاقة وطنية') parsed.documentType = '';
        if (parsed.documentNumber === 'A1278655') parsed.documentNumber = '';
        if (parsed.carModel === 'موديل السيارة') parsed.carModel = '';
        if (parsed.plateNumber === 'رقم اللوحة') parsed.plateNumber = '';
        if (parsed.carColor === 'لون السيارة') parsed.carColor = '';
        if (parsed.manufactureYear === 'سنة الصنع') parsed.manufactureYear = '';
        if (parsed.dailyKmLimit === '150') parsed.dailyKmLimit = '';
        if (parsed.extraKmPenaltyRate === '50000') parsed.extraKmPenaltyRate = '';
        return parsed;
      } catch (e) {
        console.error("Failed to parse", e);
      }
    }
    return {
      companyName: 'اسم الشركة',
      companyPhone: '07726683571',
      companyAddress: 'بغداد - الزعفرانية',
      contractCode: '1334',
      renterName: '',
      renterPhone: '',
      renterAddress: '',
      documentType: '',
      documentNumber: '',
      carModel: '',
      plateNumber: '',
      carColor: '',
      manufactureYear: '',
      rentalCost: '100',
      dailyKmLimit: '',
      extraKmPenaltyRate: '',
      departureDate: '2024-08-19',
      departureTime: '10:00',
      returnDate: '2024-08-20',
      returnTime: '10:00',
      rentalDays: '1',
      dailyAmount: '100',
    };
  });

  useEffect(() => {
    localStorage.setItem('contractData', JSON.stringify(contractData));
  }, [contractData]);

  useEffect(() => {
    localStorage.setItem('contractCustomerImg', customerImg);
  }, [customerImg]);

  useEffect(() => {
    localStorage.setItem('contractLogoImg', logoImg);
  }, [logoImg]);

  useEffect(() => {
    // Generate QR Code
    const qrCanvas = document.getElementById('qrcode') as HTMLCanvasElement;
    if (qrCanvas) {
        const qrText = `${company?.name || 'اسم الشركة'}\nرقم العقد: ${contractData.contractCode}\nتاريخ انتهاء المدة: ${contractData.returnDate}\nهذا العقد مصدق حتى انتهاء المدة`;
        QRCode.toCanvas(qrCanvas, qrText, { width: 80, margin: 1 }, (error) => {
             if (error) console.error(error);
        });
    }
  }, [company?.name, contractData.contractCode, contractData.returnDate]);

  useEffect(() => {
      const days = parseInt(contractData.rentalDays);
      const daily = parseFloat(contractData.dailyAmount);
      if (!isNaN(days) && !isNaN(daily)) {
          // Avoid infinite loops by checking before updating
          if (contractData.rentalCost !== (days * daily).toString()) {
            setContractData(prev => ({
                ...prev,
                rentalCost: (days * daily).toString()
            }));
          }
      }
  }, [contractData.rentalDays, contractData.dailyAmount, contractData.rentalCost]);

  useEffect(() => {
      if (contractData.departureDate && contractData.returnDate) {
          const departure = new Date(contractData.departureDate);
          const returnD = new Date(contractData.returnDate);
          const diffTime = Math.abs(returnD.getTime() - departure.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (!isNaN(diffDays)) {
              const daysStr = diffDays > 0 ? diffDays.toString() : '1';
              if (contractData.rentalDays !== daysStr) {
                setContractData(prev => ({ ...prev, rentalDays: daysStr }));
              }
          }
      }
  }, [contractData.departureDate, contractData.returnDate, contractData.rentalDays]);

  const loadCustomer = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomerImg(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
    } catch (err) {
        toast.error("لا يمكن الوصول للكاميرا");
        setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
            setCustomerImg(dataUrl);
            stopCamera();
        }
    }
  };

  const printPage = async () => {
    await saveContractToSystem();
    window.print();
  };

  const sendViaWhatsApp = async () => {
    await saveContractToSystem();
    if (!contractData.renterPhone) {
      toast.error('يرجى إدخال رقم هاتف المستأجر لتتمكن من إرسال الواتساب');
      return;
    }
    const txt = `مرحباً بك ${contractData.renterName}،\nتم إصدار عقد تأجير سيارة خاص بك بنجاح. رقم العقد: ${contractData.contractCode}\nالسيارة: ${contractData.carModel} - ${contractData.plateNumber}\n\nنتمنى لك رحلة سعيدة!`;
    const url = `https://wa.me/${contractData.renterPhone.replace(/\\D/g, '')}?text=${encodeURIComponent(txt)}`;
    window.open(url, '_blank');
  };

  const downloadPDF = async () => {
    await saveContractToSystem();
    const element = contractRef.current;
    if (element) {
        setIsGeneratingPdf(true);
        localStorage.setItem('contractPrinted', 'true');
        try {
            const opt = {
              margin: [0, 0, 0, 0] as [number, number, number, number], // Remove margins so it fits exactly
              filename: `${pdfFileName}_${contractData.contractCode}.pdf`,
              image: { type: 'jpeg' as const, quality: 1 },
              html2canvas: { 
                scale: 2, 
                useCORS: true,
                windowWidth: orientation === 'portrait' ? 794 : 1122
              },
              jsPDF: { unit: 'mm', format: 'a4', orientation: orientation }
            };
            await html2pdf().set(opt).from(element).save();
        } finally {
            setIsGeneratingPdf(false);
        }
    }
  };

  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  const saveContractToSystem = async () => {
    if (savedDocId) return savedDocId;
    if (!staff?.companyId && !company?.id) {
      toast.error('لم يتم التعرف على الشركة. يرجى تسجيل الدخول مجدداً.');
      return null;
    }
    
    setIsSavingSystem(true);
    try {
      const docRef = await addDoc(collection(db, 'contracts'), {
        ...contractData,
        fullName: contractData.renterName,
        phoneNumber: contractData.renterPhone,
        carType: contractData.carModel,
        rentalStartDate: contractData.departureDate,
        rentalEndDate: contractData.returnDate,
        companyId: company?.id || staff?.companyId || '',
        companyName: company?.name || 'اسم الشركة',
        bookingStatus: 'active',
        createdAt: serverTimestamp(),
      });
      setSavedDocId(docRef.id);
      toast.success('تم حفظ العقد في النظام بنجاح!');
      localStorage.setItem('contractPrinted', 'true');
      return docRef.id;
    } catch(err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ العقد في النظام.');
      return null;
    } finally {
      setIsSavingSystem(false);
    }
  };

  return (
    <div className="p-6 bg-neutral-100 min-h-screen print:p-0 print:bg-white" dir="rtl">
        <style>{`
          @media print {
            @page {
              size: A4 ${orientation};
              margin: 10mm;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              zoom: 0.95;
            }
            #contract {
              page-break-after: avoid;
              page-break-before: avoid;
              page-break-inside: avoid;
              max-height: ${orientation === 'portrait' ? '277mm' : '190mm'} !important;
            }
          }
        `}</style>
        {/* Form Container */}
        <div className="bg-white p-6 rounded-3xl shadow-lg mb-8 print:hidden">
            <h2 className="text-2xl font-black text-center mb-6">بيانات العقد</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
                {/* Appearance Group */}
                <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-6 items-center flex-wrap">
                    <h3 className="font-bold text-gray-700">إعدادات المظهر:</h3>
                    
                    <div className="flex bg-white rounded-lg p-1 border">
                        <button onClick={() => setTextAlign('right')} className={`px-4 py-2 rounded-md transition ${textAlign === 'right' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>يمين</button>
                        <button onClick={() => setTextAlign('center')} className={`px-4 py-2 rounded-md transition ${textAlign === 'center' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>وسط</button>
                        <button onClick={() => setTextAlign('left')} className={`px-4 py-2 rounded-md transition ${textAlign === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>يسار</button>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 transition">
                        <input type="checkbox" checked={swapHeader} onChange={(e) => setSwapHeader(e.target.checked)} className="w-5 h-5" />
                        <span className="font-medium text-gray-700">عكس ترتيب الترويسة (يمين/يسار)</span>
                    </label>

                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border">
                        <span className="font-medium text-gray-700">اتجاه الورقة:</span>
                        <select value={orientation} onChange={e => setOrientation(e.target.value as 'portrait' | 'landscape')} className="p-1 border rounded bg-gray-50 outline-none text-sm font-medium">
                            <option value="portrait">عمودي (Portrait)</option>
                            <option value="landscape">أفقي (Landscape)</option>
                        </select>
                    </div>
                </div>

                {/* Group 1: Company */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">بيانات الشركة (من الإعدادات)</h3>
                    <input value={contractData.contractCode} onChange={e => setContractData({...contractData, contractCode: e.target.value})} placeholder="رمز العقد" className="w-full p-3 border rounded-xl bg-white" />
                </div>

                {/* Group 4: Rental & Payment */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">معلومات الإيجار والدفع</h3>
                    <div className="flex gap-2">
                        <div className="w-1/2">
                            <div className="text-sm text-gray-500 font-medium px-1">تاريخ الخروج</div>
                            <input type="date" value={contractData.departureDate} onChange={e => setContractData({...contractData, departureDate: e.target.value})} className="w-full p-3 border rounded-xl bg-white" />
                        </div>
                        <div className="w-1/2">
                            <div className="text-sm text-gray-500 font-medium px-1">وقت الخروج</div>
                            <input type="time" value={contractData.departureTime} onChange={e => setContractData({...contractData, departureTime: e.target.value})} className="w-full p-3 border rounded-xl bg-white" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-1/2">
                            <div className="text-sm text-gray-500 font-medium px-1">تاريخ العودة</div>
                            <input type="date" value={contractData.returnDate} onChange={e => setContractData({...contractData, returnDate: e.target.value})} className="w-full p-3 border rounded-xl bg-white" />
                        </div>
                        <div className="w-1/2">
                            <div className="text-sm text-gray-500 font-medium px-1">وقت العودة</div>
                            <input type="time" value={contractData.returnTime} onChange={e => setContractData({...contractData, returnTime: e.target.value})} className="w-full p-3 border rounded-xl bg-white" />
                        </div>
                    </div>
                    <input value={contractData.rentalDays} onChange={e => setContractData({...contractData, rentalDays: e.target.value})} placeholder="عدد أيام التأجير" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.dailyAmount} onChange={e => setContractData({...contractData, dailyAmount: e.target.value})} placeholder="المبلغ اليومي" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.rentalCost} onChange={e => setContractData({...contractData, rentalCost: e.target.value})} placeholder="المبلغ الكلي" className="w-full p-3 border rounded-xl bg-white" />
                </div>

                {/* Group 2: Renter */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">بيانات المستأجر</h3>
                    <input value={contractData.renterName} onChange={e => setContractData({...contractData, renterName: e.target.value})} placeholder="اسم المستأجر" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.renterPhone} onChange={e => setContractData({...contractData, renterPhone: e.target.value})} placeholder="رقم المستأجر" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.renterAddress} onChange={e => setContractData({...contractData, renterAddress: e.target.value})} placeholder="عنوان المستأجر" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.documentType} onChange={e => setContractData({...contractData, documentType: e.target.value})} placeholder="نوع الوثيقة" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.documentNumber} onChange={e => setContractData({...contractData, documentNumber: e.target.value})} placeholder="رقم الوثيقة" className="w-full p-3 border rounded-xl bg-white" />
                </div>

                {/* Group 3: Vehicle & Limitations */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-2 border-b pb-2 flex justify-between items-center">
                        <span>بيانات المركبة والشروط</span>
                        {inventory.length > 0 && (
                            <select 
                                className="text-xs p-1 border rounded bg-white font-normal outline-none"
                                onChange={(e) => {
                                    const id = e.target.value;
                                    if (!id) return;
                                    const car = inventory.find(c => c.id === id);
                                    if (car) {
                                        setContractData(prev => ({
                                            ...prev,
                                            carModel: car.name || prev.carModel,
                                            plateNumber: car.plateNumber || prev.plateNumber,
                                            carColor: car.color || prev.carColor,
                                            manufactureYear: car.year || prev.manufactureYear,
                                            dailyAmount: car.dailyPrice ? car.dailyPrice.toString() : prev.dailyAmount,
                                        }));
                                    }
                                }}
                            >
                                <option value="">-- اختيار سيارة من الأسطول --</option>
                                {inventory.map(car => (
                                    <option key={car.id} value={car.id}>{car.name} {car.plateNumber ? `(${car.plateNumber})` : ''}</option>
                                ))}
                            </select>
                        )}
                    </h3>
                    <input value={contractData.carModel} onChange={e => setContractData({...contractData, carModel: e.target.value})} placeholder="موديل السيارة" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.plateNumber} onChange={e => setContractData({...contractData, plateNumber: e.target.value})} placeholder="رقم اللوحة" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.carColor} onChange={e => setContractData({...contractData, carColor: e.target.value})} placeholder="لون السيارة" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.manufactureYear} onChange={e => setContractData({...contractData, manufactureYear: e.target.value})} placeholder="سنة الصنع" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.dailyKmLimit} onChange={e => setContractData({...contractData, dailyKmLimit: e.target.value})} placeholder="حد الكيلومتر اليومي" className="w-full p-3 border rounded-xl bg-white" />
                    <input value={contractData.extraKmPenaltyRate} onChange={e => setContractData({...contractData, extraKmPenaltyRate: e.target.value})} placeholder="غرامة الكيلومتر الإضافي" className="w-full p-3 border rounded-xl bg-white" />
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="font-bold text-gray-700 mb-4 text-center">خيارات التصدير والطباعة</h3>
                <div className="flex flex-wrap justify-center gap-6 mb-6 bg-gray-50 p-4 rounded-xl">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">اسم ملف الـ PDF:</label>
                        <input value={pdfFileName} onChange={e => setPdfFileName(e.target.value)} className="p-2 border rounded-lg text-sm w-32" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">هامش الـ PDF (ملم):</label>
                        <input type="number" value={pdfMargin} onChange={e => setPdfMargin(Number(e.target.value))} className="p-2 border rounded-lg text-sm w-20" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={hideQrCode} onChange={e => setHideQrCode(e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm font-medium">إخفاء الـ QR Code</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={hideSignatures} onChange={e => setHideSignatures(e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm font-medium">إخفاء التواقيع</span>
                    </label>
                </div>
                <div className="flex flex-wrap gap-4 justify-center">
                    <button onClick={sendViaWhatsApp} className="py-3 px-6 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:bg-green-600 transition">💬 إرسال عبر واتساب</button>
                    <button onClick={printPage} className="py-3 px-6 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition">🖨 طباعة العقد</button>
                    <button onClick={downloadPDF} disabled={isGeneratingPdf} className={`py-3 px-6 bg-gray-800 text-white font-bold rounded-xl shadow-lg transition ${isGeneratingPdf ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-900'}`}>
                        {isGeneratingPdf ? '⏳ جاري التحميل...' : '⬇ تحميل PDF'}
                    </button>
                </div>
            </div>
        </div>

        {/* A4 Preview */}
        <div className="text-center mb-4 text-blue-600 font-bold bg-blue-50 p-3 rounded-xl border border-blue-100 print:hidden">
            💡 يمكنك النقر على أي نص أو عنوان داخل العقد بالأسفل لتعديله بحرية قبل الطباعة
        </div>
        <div className="w-full overflow-x-auto flex justify-center pb-8 print:block print:overflow-visible print:pb-0 print:w-auto">
            <div ref={contractRef} className={`page ${orientation === 'portrait' ? 'w-[210mm] min-h-[297mm]' : 'w-[297mm] min-h-[210mm]'} bg-white p-8 md:p-12 md:px-24 px-16 print:py-0 print:px-24 shadow-2xl relative shrink-0 print:shadow-none`} id="contract">
            {/* Header */}
            <div className={`header border-b-2 border-black flex justify-between items-start pb-6 ${swapHeader ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Right: Customer Image */}
                <div className={`w-[130px] shrink-0 ${swapHeader ? 'text-left' : 'text-center'}`}>
                    <div className="flex flex-col gap-1 mb-2 print:hidden">
                        <label className="text-xs bg-gray-200 hover:bg-gray-300 py-1 px-2 rounded cursor-pointer text-center">
                            رفع صورة
                            <input type="file" accept="image/*" onChange={loadCustomer} className="hidden" />
                        </label>
                        <button onClick={startCamera} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-2 rounded transition">
                            📷 التقاط بالكاميرا
                        </button>
                    </div>
                    {customerImg ? (
                        <img src={customerImg} alt="Customer" className="w-[100px] h-[100px] object-cover border-2 border-gray-800 rounded mx-auto print:color-adjust-exact print:!grayscale-0" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                    ) : (
                        <div className="w-[100px] h-[100px] border-2 border-dashed border-gray-400 rounded mx-auto print:border-solid print:border-gray-200 flex items-center justify-center text-gray-300 text-xs text-center"><span className="print:hidden">صورة الزبون</span></div>
                    )}
                </div>

                {/* Center: Company Logo and Name */}
                <div className="flex-1 flex flex-col items-center justify-center px-4">
                    {logoImg ? (
                        <img src={logoImg} alt="Logo" className="w-[120px] h-[120px] object-contain mx-auto print:color-adjust-exact" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                    ) : (
                        <div className="w-[120px] h-[120px] border-2 border-dashed border-gray-400 rounded mx-auto print:border-solid print:border-transparent flex items-center justify-center text-gray-300 text-xs"><span className="print:hidden">شعار الشركة</span></div>
                    )}
                    <h1 className="font-black text-2xl mt-4 text-center">{company?.name || 'اسم الشركة'}</h1>
                </div>

                {/* Left: Phone, Address, and QR */}
                <div className={`w-[180px] shrink-0 space-y-3 pt-2 ${swapHeader ? 'text-left' : 'text-right'}`}>
                    <div className="text-sm">
                        <span className="font-bold block w-full">الهاتف:</span>
                        <div dir="ltr" className="text-right inline-block text-gray-800 font-mono mt-1">{company?.phoneNumber || 'رقم الهاتف'}</div>
                    </div>
                    <div className="text-sm">
                        <span className="font-bold block w-full">العنوان:</span>
                        <div className="text-gray-800 mt-1 leading-relaxed">{company?.address || 'عنوان الشركة'}</div>
                    </div>
                </div>
                
            </div>
            
            {!hideQrCode && (
              <div className={`absolute top-[200px] ${swapHeader ? 'right-10' : 'left-10'}`}>
                   <canvas id="qrcode" className="w-[80px] h-[80px]"></canvas>
              </div>
            )}

            {/* Contract Body */}
            <div className={`mt-8 text-${textAlign}`}>
                <h3 className="text-2xl font-bold mb-6 text-center underline underline-offset-8 editable" contentEditable suppressContentEditableWarning>تفاصيل عقد تأجير مركبة</h3>
                
                <div className="grid grid-cols-3 gap-4 text-xs font-medium">
                    <div className="border-2 border-gray-400 p-3 rounded-lg relative group">
                        <h4 className="font-bold border-b border-gray-400 pb-2 mb-2 text-base text-center bg-gray-50 editable block" contentEditable suppressContentEditableWarning>معلومات الإيجار والدفع</h4>
                        <div className="space-y-2 mt-3">
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>رمز العقد:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.contractCode}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>الخروج:</strong> <span dir="ltr" className="editable" contentEditable suppressContentEditableWarning>{contractData.departureDate} {contractData.departureTime}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>العودة:</strong> <span dir="ltr" className="editable" contentEditable suppressContentEditableWarning>{contractData.returnDate} {contractData.returnTime}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>مدة الإيجار:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.rentalDays} يوم</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>المبلغ اليومي:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.dailyAmount}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>المبلغ الكلي:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.rentalCost}</span></p>
                        </div>
                    </div>

                    <div className="border-2 border-gray-400 p-3 rounded-lg relative group">
                        <h4 className="font-bold border-b border-gray-400 pb-2 mb-2 text-base text-center bg-gray-50 editable block" contentEditable suppressContentEditableWarning>بيانات المستأجر</h4>
                        <div className="space-y-2 mt-3">
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>الاسم:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.renterName}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>الهاتف:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.renterPhone}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>العنوان:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.renterAddress}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>الوثيقة:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.documentType}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>رقم الوثيقة:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.documentNumber}</span></p>
                        </div>
                    </div>

                    <div className="border-2 border-gray-400 p-3 rounded-lg relative group">
                        <h4 className="font-bold border-b border-gray-400 pb-2 mb-2 text-base text-center bg-gray-50 editable block" contentEditable suppressContentEditableWarning>بيانات المركبة والشروط</h4>
                        <div className="space-y-2 mt-3">
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>المركبة:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.carModel}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>اللوحة:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.plateNumber}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>اللون:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.carColor}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>الموديل:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.manufactureYear}</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>الحد اليومي:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.dailyKmLimit} كم</span></p>
                            <p><strong className="editable" contentEditable suppressContentEditableWarning>غرامة التأخير:</strong> <span className="editable" contentEditable suppressContentEditableWarning>{contractData.extraKmPenaltyRate} د.ع/كم</span></p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 mb-4 p-4 border border-gray-300 rounded-lg text-[10px] md:text-xs">
                    <h4 className="font-bold border-b border-gray-300 pb-1 mb-2 text-center text-gray-800 editable block" contentEditable suppressContentEditableWarning>الشروط والأحكام</h4>
                    <ol className="list-decimal list-outside pr-4 space-y-1 text-gray-800 text-justify leading-snug">
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يقرّ المستأجر بأنه استلم المركبة بحالة فنية جيدة وصالحة للاستعمال، بعد فحصها ومعاينتها، ويتحمل كامل المسؤولية عن أي ضرر يحدث لها خلال مدة الإيجار ما لم يثبت خلاف ذلك رسمياً.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يلتزم المستأجر باستخدام المركبة وفق القوانين والتعليمات المرورية النافذة، ويتحمل وحده جميع المخالفات والغرامات والرسوم الناتجة عن استخدام المركبة أثناء مدة العقد.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يمنع منعاً باتاً تأجير المركبة من الباطن أو تسليمها أو تمكين أي شخص آخر من قيادتها أو استخدامها دون موافقة خطية مسبقة من المؤجر، وفي حال المخالفة يتحمل المستأجر جميع النتائج القانونية والمالية المترتبة.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يتحمل المستأجر المسؤولية المدنية والجزائية الكاملة عن أي حادث أو ضرر أو مطالبة تنشأ نتيجة سوء الاستخدام أو الإهمال أو مخالفة القوانين المرورية.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يلتزم المستأجر بإعادة المركبة في التاريخ والوقت المحددين بالعقد، وبنفس الحالة التي استلمها بها، ويحق للمؤجر احتساب أجور إضافية عن أي تأخير دون الحاجة إلى إنذار رسمي.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يحق للشركة سحب واسترداد المركبة فوراً ودون إشعار مسبق عند إخلال المستأجر بأي بند من بنود العقد، مع احتفاظ الشركة بحقه بالمطالبة بالتعويضات القانونية.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يتحمل المستأجر تكاليف إصلاح جميع الأضرار ، بما في ذلك الأضرار الناتجة عن الحوادث المتعمدة أو القيادة تحت تأثير الكحول أو المواد المحظورة أو القيادة المخالفة للقانون.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>لا يجوز للمستأجر إخراج المركبة خارج الحدود الجغرافية المحددة من قبل الشركة إلا بعد الحصول على موافقة تحريرية رسمية.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يلتزم المستأجر بإبلاغ الشركة والجهات المختصة فور وقوع أي حادث أو عطل أو حجز للمركبة، ولا يجوز إجراء أي تصليح أو تسوية دون موافقة الشركة.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يوافق المستأجر على أن جميع البيانات والمستندات المقدمة منه صحيحة وقانونية، ويتحمل المسؤولية الكاملة عند ثبوت خلاف ذلك.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يعتبر توقيع المستاجر الرقمي موافقة قانونية ملزمة لكافة شروط العقد.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>في حال امتناع المستأجر عن إعادة المركبة بعد انتهاء مدة الإيجار، يحق للشركة اتخاذ الإجراءات القانونية واسترداد المركبة مع المطالبة بالتعويض عن الأضرار والخسائر.</li>
                        <li className="editable pl-2" contentEditable suppressContentEditableWarning>يقرّ الطرفان بأن هذا العقد محرر بكامل إرادتهما ويمثل اتفاقاً نهائياً وملزماً قانونياً بينهما.</li>
                    </ol>
                </div>

                {!hideSignatures && (
                  <div className="flex justify-between mt-16 px-10">
                      <div className="text-center font-bold text-lg">
                          <div className="mb-12 editable" contentEditable suppressContentEditableWarning>توقيع المستأجر</div>
                          <div className="w-[150px] border-b-2 border-gray-800 mx-auto"></div>
                      </div>
                      <div className="text-center font-bold text-lg">
                          <div className="mb-12 editable" contentEditable suppressContentEditableWarning>توقيع مدير الشركة</div>
                          <div className="w-[150px] border-b-2 border-gray-800 mx-auto"></div>
                      </div>
                  </div>
                )}
            </div>
        </div>
        </div>
        
        {showCamera && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:hidden">
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-lg">التقاط صورة للزبون</h3>
                        <button onClick={stopCamera} className="text-red-500 hover:text-red-700 font-bold p-2 text-xl">✕</button>
                    </div>
                    <div className="relative bg-black rounded-lg overflow-hidden flex flex-col justify-center items-center h-[300px]">
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                    <div className="flex gap-4 justify-center mt-2">
                        <button onClick={captureImage} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition text-lg">
                            📸 التقاط الصورة
                        </button>
                        <button onClick={stopCamera} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-xl transition text-lg">
                            إلغاء
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}

