import React, { useRef, useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { toast } from "react-hot-toast";
import { compressImage as globalCompressImage } from "../lib/imageUtils";
import {
  CheckCircle,
  Image,
  Loader2,
  ShieldCheck,
  FileCheck,
  ScanFace,
  UserCheck,
  MapPin,
  Mail,
  Phone,
  Car,
  CarFront,
  X,
  Star,
  Search,
} from "lucide-react";
import {
  api,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  db,
  doc,
  getDoc,
  limit,
  orderBy
} from "../lib/api";

export const defaultTermsNoDriver = [
  "يقرّ المستأجر بأنه استلم المركبة بحالة فنية جيدة وصالحة للاستعمال، بعد فحصها ومعاينتها، ويتحمل كامل المسؤولية عن أي ضرر يحدث لها خلال مدة الإيجار ما لم يثبت خلاف ذلك رسمياً.",
  "يلتزم المستأجر باستخدام المركبة وفق القوانين والتعليمات المرورية النافذة، ويتحمل وحده جميع المخالفات والغرامات والرسوم الناتجة عن استخدام المركبة أثناء مدة العقد.",
  "يمنع منعاً باتاً تأجير المركبة من الباطن أو تسليمها أو تمكين أي شخص آخر من قيادتها أو استخدامها دون موافقة خطية مسبقة من المؤجر، وفي حال المخالفة يتحمل المستأجر جميع النتائج القانونية والمالية المترتبة.",
  "يتحمل المستأجر المسؤولية المدنية والجزائية الكاملة عن أي حادث أو ضرر أو مطالبة تنشأ نتيجة سوء الاستخدام أو الإهمال أو مخالفة القوانين المرورية.",
  "يلتزم المستأجر بإعادة المركبة في التاريخ والوقت المحددين بالعقد، وبنفس الحالة التي استلمها بها، ويحق للمؤجر احتساب أجور إضافية عن أي تأخير دون الحاجة إلى إنذار رسمي.",
  "يحق للشركة سحب واسترداد المركبة فوراً ودون إشعار مسبق عند إخلال المستأجر بأي بند من بنود العقد، مع احتفاظ الشركة بحقه بالمطالبة بالتعويضات القانونية.",
  "يتحمل المستأجر تكاليف إصلاح جميع الأضرار ، بما في ذلك الأضرار الناتجة عن الحوادث المتعمدة أو القيادة تحت تأثير الكحول أو المواد المحظورة أو القيادة المخالفة للقانون.",
  "لا يجوز للمستأجر إخراج المركبة خارج الحدود الجغرافية المحددة من قبل الشركة إلا بعد الحصول على موافقة تحريرية رسمية.",
  "يلتزم المستأجر بإبلاغ الشركة والجهات المختصة فور وقوع أي حادث أو عطل أو حجز للمركبة، ولا يجوز إجراء أي تصليح أو تسوية دون موافقة الشركة.",
  "يوافق المستأجر على أن جميع البيانات والمستندات المقدمة منه صحيحة وقانونية، ويتحمل المسؤولية الكاملة عند ثبوت خلاف ذلك.",
  "يعتبر توقيع المستاجر موافقة قانونية ملزمة لكافة شروط العقد.",
  "في حال امتناع المستأجر عن إعادة المركبة بعد انتهاء مدة الإيجار، يحق للشركة اتخاذ الإجراءات القانونية واسترداد المركبة مع المطالبة بالتعويض عن الأضرار والخسائر.",
  "يقرّ الطرفان بأن هذا العقد محرر بكامل إرادتهما ويمثل اتفاقاً نهائياً وملزماً قانونياً بينهما.",
];

export const defaultTermsWithDriver = [
  "يقرّ المستأجر بالالتزام بمسار الرحلة والوقت المتفق عليه، وأي تغيير قد يترتب عليه تكاليف إضافية تحددها إدارة الشركة.",
  "الشركة مسؤولة عن توفير سائقين مؤهلين ومركبات صالحة للعمل، وتبدأ المدة المحتسبة من وقت انطلاق المركبة.",
  "يلتزم المستأجر والركاب بتعليمات السلامة، ويُمنع منعاً باتاً نقل المواد الممنوعة قانونياً أو الخطرة داخل المركبات.",
  "المستأجر مسؤول بشكل كامل عن أي أضرار تلحق بالمركبات من الداخل نتيجة سوء الاستخدام أو الإهمال من قبل الركاب.",
  "الشركة والسائق غير مسؤولين عن أي مفقودات شخصية تُترك داخل المركبات بعد انتهاء الرحلة ومغادرة الركاب.",
  "في حال حدوث عطل طارئ، تلتزم الشركة بتوفير مركبة بديلة في أقرب وقت ممكن لضمان إتمام الرحلة بأمان.",
  "يلتزم المستأجر بدفع المبلغ المتفق عليه كاملاً، ويعتبر توقيعه موافقة نهائية على المسار وتكلفة الرحلة والشروط.",
  "يمنع منعاً باتاً استخدام السيارات في الدكات العشائرية أو ترهيب الناس، وبخلاف ذلك سيتم سحب السيارات فوراً وإلغاء الحجز وفرض غرامة مالية على المستأجر.",
  "في حال استعمال السيارات لأي عمل مشبوه، يتم فوراً إلغاء الحجز وإبلاغ الجهات الأمنية عن المستأجر.",
  "يقرّ الطرفان بأن هذا العقد محرر بكامل إرادتهما ويمثل اتفاقاً نهائياً وملزماً قانونياً بينهما.",
];

const formatCurrency = (val: string | undefined | null) => {
  if (!val) return "0";
  const num = parseFloat(val.toString().replace(/,/g, ""));
  if (isNaN(num)) return val;
  return num.toLocaleString("en-US");
};

export const ContractView: React.FC<{
  company?: any;
  staff?: any;
  isWithDriver?: boolean;
  contractInitialData?: any;
  readOnly?: boolean;
  onSaveSuccess?: () => void;
}> = ({
  company,
  staff,
  isWithDriver = false,
  contractInitialData,
  readOnly = false,
  onSaveSuccess,
}) => {
  const contractRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentCompany, setCurrentCompany] = useState(company);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setCurrentCompany((prev: any) => ({ ...prev, ...company }));
    }
  }, [
    company?.name,
    company?.phoneNumber,
    company?.address,
    company?.logoUrl,
    company?.establishmentImageUrl,
    company?.contractTerms,
    company?.driverContractTerms,
    company?.qrCodeFields,
  ]);

  useEffect(() => {
    if (staff?.companyId) {
      const q = doc(db, "companies", staff.companyId);
      const unsubscribe = onSnapshot(q, (docSnap) => {
        if (docSnap.exists()) {
          const newCompany = { id: docSnap.id, ...docSnap.data() };
          setCurrentCompany(newCompany);
        }
      });
      return () => unsubscribe();
    }
  }, [staff?.companyId]);

  const refreshCompanyData = async () => {
    if (!staff?.companyId) return;
    try {
      const docRef = doc(db, "companies", staff.companyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const newCompany = { id: docSnap.id, ...docSnap.data() };
        setCurrentCompany(newCompany);
        if (newCompany.logoUrl) {
          setLogoImg(newCompany.logoUrl);
        } else {
          setLogoImg(null);
        }
        toast.success("تم تحديث بيانات الشركة من الإعدادات!");
      } else {
        toast.error("لم يتم العثور على بيانات الشركة");
      }
    } catch (error) {
      console.error("Error refreshing company:", error);
      toast.error("حدث خطأ أثناء جلب بيانات الشركة");
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (currentCompany && !readOnly && !contractInitialData) {
      setContractData((prev) => ({
        ...prev,
        companyName: prev.companyName === "اسم الشركة" ? (currentCompany.name || prev.companyName) : prev.companyName,
        companyPhone: (prev.companyPhone === "07726683571" || !prev.companyPhone) ? (currentCompany.phoneNumber || prev.companyPhone) : prev.companyPhone,
        companyAddress: (prev.companyAddress === "بغداد - الزعفرانية" || !prev.companyAddress) ? (currentCompany.address || prev.companyAddress) : prev.companyAddress,
      }));
    }
  }, [currentCompany, readOnly, contractInitialData]);

  useEffect(() => {
    if (contractInitialData) {
      // Sync images when viewing existing contract
      if (contractInitialData.carImageUrl)
        setCarImg(contractInitialData.carImageUrl);
      if (contractInitialData.customerImageUrl)
        setCustomerImg(contractInitialData.customerImageUrl);
    }
  }, [contractInitialData]);

  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [customerImg, setCustomerImg] = useState<string>(
    () => localStorage.getItem(`contractCustomerImg${isWithDriver ? "_driver" : ""}`) || "",
  );
  const [carImg, setCarImg] = useState<string>(
    () => localStorage.getItem(`contractCarImg${isWithDriver ? "_driver" : ""}`) || "",
  );
  const [logoImg, setLogoImg] = useState<string | null>(
    () => localStorage.getItem("contractLogoImg") || "",
  );
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  const [inventory, setInventory] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [carSearchTerm, setCarSearchTerm] = useState("");

  useEffect(() => {
    if (staff) {
      const companyId = staff.companyId || "";
      const userId = staff.id || "";
      const q = userId
        ? query(collection(db, "customers"), where("companyId", "==", companyId), orderBy("createdAt", "desc"), limit(100))
        : query(collection(db, "customers"), orderBy("createdAt", "desc"), limit(100));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setCustomersList(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      });
      return () => unsubscribe();
    }
  }, [staff]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customersList;
    const term = customerSearchTerm.toLowerCase();
    return customersList.filter(c => 
      (c.name || c.fullName || "").toLowerCase().includes(term) ||
      (c.phoneNumber || c.phone || "").includes(term) ||
      (c.documentNumber || "").includes(term)
    );
  }, [customersList, customerSearchTerm]);

  const filteredInventory = useMemo(() => {
    let list = inventory;
    // Filter by availability: only show cars that are available or have no status set
    list = list.filter(car => {
      const status = (car.status || "").toLowerCase();
      return status === "available" || status === "";
    });

    if (!carSearchTerm) return list;
    const term = carSearchTerm.toLowerCase();
    return list.filter(car => 
      (car.name || "").toLowerCase().includes(term) ||
      (car.plateNumber || "").toLowerCase().includes(term) ||
      (car.chassisNumber || car.chassis || "").toLowerCase().includes(term) ||
      (car.color || "").toLowerCase().includes(term) ||
      (car.year || "").toString().includes(term)
    );
  }, [inventory, carSearchTerm]);

  useEffect(() => {
    if (staff && staff.companyId) {
      const q = query(
        collection(db, "inventory"),
        where("companyId", "==", staff.companyId),
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setInventory(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      });
      return () => unsubscribe();
    }
  }, [staff]);

  useEffect(() => {
    if (currentCompany) {
      setLogoImg(currentCompany.logoUrl || null);
    }
  }, [currentCompany]);

  const [textAlign, setTextAlign] = useState<"right" | "center" | "left">(
    "right",
  );
  const [swapHeader, setSwapHeader] = useState<boolean>(true);

  // Print / PDF Settings
  const [pdfFileName, setPdfFileName] = useState("عقد_تأجير");
  const [pdfMargin, setPdfMargin] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [hideQrCode, setHideQrCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [hideSignatures, setHideSignatures] = useState(false);
  const [hideRegistrationNumber, setHideRegistrationNumber] = useState(false);
  const [screenZoom, setScreenZoom] = useState(readOnly ? 1.0 : 0.65);

  useEffect(() => {
    return () => {
      if (!readOnly) {
        localStorage.removeItem(`contractData${isWithDriver ? "_driver" : ""}`);
        localStorage.removeItem(`contractCustomerImg${isWithDriver ? "_driver" : ""}`);
        localStorage.removeItem(`contractCarImg${isWithDriver ? "_driver" : ""}`);
      }
    };
  }, [readOnly, isWithDriver]);

  const [contractData, setContractData] = useState(() => {
    if (contractInitialData) return contractInitialData;

    const savedData = localStorage.getItem(`contractData${isWithDriver ? "_driver" : ""}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.renterName === "عمر طلال") parsed.renterName = "";
        if (parsed.renterPhone === "0776683571") parsed.renterPhone = "";
        if (parsed.renterAddress === "ديالى") parsed.renterAddress = "";
        if (parsed.documentType === "بطاقة وطنية") parsed.documentType = "";
        if (parsed.documentNumber === "A1278655") parsed.documentNumber = "";
        if (parsed.carModel === "سنة الصنع") parsed.carModel = "";
        if (parsed.plateNumber === "رقم اللوحة") parsed.plateNumber = "";
        if (parsed.carColor === "لون السيارة") parsed.carColor = "";
        if (parsed.manufactureYear === "سنة الصنع") parsed.manufactureYear = "";
        if (parsed.dailyKmLimit === "150") parsed.dailyKmLimit = "";
        if (parsed.extraKmPenaltyRate === "50000")
          parsed.extraKmPenaltyRate = "";
        if (parsed.rentalDays === "1" || parsed.rentalDays === "0")
          parsed.rentalDays = "";
        if (parsed.rentalCost === "100" || parsed.rentalCost === "0")
          parsed.rentalCost = "";
        if (parsed.dailyAmount === "100" || parsed.dailyAmount === "0")
          parsed.dailyAmount = "";
        if (parsed.rentalKmCount === "0") parsed.rentalKmCount = "";
        return parsed;
      } catch (e) {
        console.error("Failed to parse", e);
      }
    }
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const randomCode = Math.floor(10000 + Math.random() * 90000).toString();

    return {
      companyName: "اسم الشركة",
      companyPhone: "07726683571",
      companyAddress: "بغداد - الزعفرانية",
      contractCode: randomCode,
      renterName: "",
      driverName: "",
      driverPhone: "",
      renterPhone: "",
      renterAddress: "",
      witnessName: "",
      witnessName2: "",
      documentType: "",
      documentNumber: "",
      idCardDate: "",
      idCardExpiry: "",
      renterDateOfBirth: "",
      drivingLicenseNumber: "",
      drivingLicenseDate: "",
      drivingLicenseExpiry: "",
      carModel: "",
      carName: "",
      carOwnerName: "",
      carImageUrl: "",
      registrationNumber: "",
      carCount: "",
      carTypes: "",
      chassisNumber: "",
      plateNumber: "",
      carColor: "",
      manufactureYear: "",
      rentalCost: "",
      paidAmount: "",
      remainingAmount: "",
      dailyKmLimit: "",
      extraKmPenaltyRate: "",
      departureDate: new Date().toISOString().split("T")[0],
      departureTime: currentTime,
      returnDate: "",
      returnTime: currentTime,
      rentalDays: "",
      dailyAmount: "",
      notes: "",
      rentalKmCount: "",
    };
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const idFileInputRef = useRef<HTMLInputElement>(null);

  const handleIdImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
      const base64 = await globalCompressImage(file, 1200, 1200, 0.8);
      const response = await fetch("/api/extract-id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          base64ImageBytes: base64,
          mimeType: "image/jpeg",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Server returned ${response.status}`,
        );
      }
      const data = await response.json();

      setContractData((prev) => ({
        ...prev,
        renterName: data.fullName || prev.renterName,
        documentNumber: data.idNumber || prev.documentNumber,
        renterAddress: data.address || prev.renterAddress,
        renterDateOfBirth: data.birthDate || prev.renterDateOfBirth,
        idCardExpiry: data.expiryDate || prev.idCardExpiry,
        idCardDate: data.issueDate || prev.idCardDate,
      }));

      toast.success("تم استخراج البيانات بنجاح!");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ في استخراج البيانات من الصورة.");
    } finally {
      setIsExtracting(false);
      if (idFileInputRef.current) idFileInputRef.current.value = "";
    }
  };

  const handleAmountChange = (field: string, value: string) => {
    const raw = value.replace(/[^0-9.]/g, "");
    if (!raw) {
      setContractData((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    const parts = raw.split(".");
    let integerPart = parts[0];
    if (integerPart) {
      integerPart = parseInt(integerPart, 10).toLocaleString("en-US");
    }
    const formatted =
      parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
    setContractData((prev) => ({ ...prev, [field]: formatted }));
  };

  useEffect(() => {
    const { carImageUrl, customerImageUrl, ...rest } = contractData;
    localStorage.setItem(`contractData${isWithDriver ? "_driver" : ""}`, JSON.stringify(rest));
  }, [contractData, isWithDriver]);

  useEffect(() => {
    localStorage.setItem(`contractCustomerImg${isWithDriver ? "_driver" : ""}`, customerImg);
  }, [customerImg, isWithDriver]);

  useEffect(() => {
    if (logoImg !== null) {
      localStorage.setItem("contractLogoImg", logoImg);
    } else {
      localStorage.removeItem("contractLogoImg");
    }
  }, [logoImg]);

  useEffect(() => {
    localStorage.setItem(`contractCarImg${isWithDriver ? "_driver" : ""}`, carImg);
  }, [carImg, isWithDriver]);

  useEffect(() => {
    // Generate QR Code based on configured fields
    const fields = currentCompany?.qrCodeFields || [
      { id: "companyName", label: "اسم الشركة", enabled: true },
      { id: "contractCode", label: "رقم العقد", enabled: true },
      { id: "renterName", label: "اسم المستأجر", enabled: false },
      { id: "renterPhone", label: "هاتف المستأجر", enabled: false },
      { id: "plateNumber", label: "رقم اللوحة", enabled: false },
      { id: "returnDate", label: "تاريخ انتهاء المدة", enabled: true },
      {
        id: "customText",
        label: "نص مخصص",
        enabled: true,
        value: "هذا العقد مصدق حتى انتهاء المدة",
      },
      {
        id: "establishmentImage",
        label: "صورة تأسيس الشركة (رابط)",
        enabled: false,
      },
    ];

    const verifId = contractInitialData?.id || savedDocId || contractData.id;
    
    // Combine text so that phone scanners will treat it as text and allow searching the web.
    // Avoid using window.location.origin as it points to the AI Studio system preview URL.
    const qrText = `حالة العقد: مصدق\nالشركة: ${currentCompany?.name || "غير محدد"}\nرقم العقد: ${contractData.contractCode || "غير محدد"}`.trim();

    QRCode.toDataURL(
      qrText,
      { width: 400, margin: 2, errorCorrectionLevel: "M" },
      (error, url) => {
        if (!error && url) {
          setQrCodeUrl(url);
        } else {
          console.error(error);
        }
      },
    );
  }, [
    currentCompany?.name,
    currentCompany?.qrCodeFields,
    currentCompany?.establishmentImageUrl,
    contractData.id,
    contractData.contractCode,
    contractInitialData,
    savedDocId,
    isWithDriver,
  ]);

  useEffect(() => {
    const days = parseInt(contractData.rentalDays || "0");
    const daily = parseFloat(
      contractData.dailyAmount?.toString().replace(/,/g, "") || "0",
    );
    if (!isNaN(days) && !isNaN(daily) && (days > 0 || daily > 0)) {
      const totalNum = days * daily;
      const total = totalNum === 0 ? "" : totalNum.toLocaleString("en-US");
      if (contractData.rentalCost !== total) {
        setContractData((prev) => ({ ...prev, rentalCost: total }));
      }
    }
  }, [contractData.rentalDays, contractData.dailyAmount]);

  useEffect(() => {
    const cost = parseFloat(
      contractData.rentalCost?.toString().replace(/,/g, "") || "0",
    );
    const paid = parseFloat(
      contractData.paidAmount?.toString().replace(/,/g, "") || "0",
    );
    if (!isNaN(cost) && !isNaN(paid)) {
      const remNum = cost - paid;
      const rem =
        remNum === 0 && !contractData.paidAmount
          ? ""
          : remNum.toLocaleString("en-US");
      if (contractData.remainingAmount !== rem) {
        setContractData((prev) => ({ ...prev, remainingAmount: rem }));
      }
    }
  }, [contractData.rentalCost, contractData.paidAmount]);

  useEffect(() => {
    if (contractData.departureDate && contractData.returnDate) {
      const d1 = new Date(contractData.departureDate);
      const d2 = new Date(contractData.returnDate);
      const diff = Math.ceil(
        (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (!isNaN(diff) && diff >= 0) {
        const val = diff === 0 ? "" : diff.toString();
        if (contractData.rentalDays !== val) {
          setContractData((prev) => ({ ...prev, rentalDays: val }));
        }
      }
    }
  }, [contractData.departureDate, contractData.returnDate]);

  const compressImage = async (
    file: File,
    callback: (base64: string) => void,
  ) => {
    try {
      const base64 = await globalCompressImage(file, 800, 800, 0.6);
      callback(base64);
    } catch (error) {
      console.error("Image compression failed", error);
    }
  };

  const loadCustomer = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      compressImage(file, (base64) => {
        setCustomerImg(base64);
      });
    }
  };

  const loadCarImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      compressImage(file, (base64) => {
        setCarImg(base64);
        setContractData((prev) => ({ ...prev, carImageUrl: base64 }));
      });
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
      tracks.forEach((track) => track.stop());
    }
    setShowCamera(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.6);
        setCustomerImg(dataUrl);
        stopCamera();
      }
    }
  };


  const createCopyForPrinting = (element: HTMLElement, titleSuffix: string) => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.id = "";
    copy.classList.remove("print:hidden", "shadow-2xl");
    copy.classList.add("print-contract-copy");
    copy.style.zoom = "1";
    copy.style.transform = "none";
    copy.style.width = "210mm";

    // Convert inputs/textareas/selects to static elements for better printing
    const originalInputs = element.querySelectorAll("input, select, textarea");
    const copyInputs = copy.querySelectorAll("input, select, textarea");

    originalInputs.forEach((original, idx) => {
      const c = copyInputs[idx] as HTMLElement;
      if (c && c.parentNode) {
        if (original.tagName === "INPUT" && (original as HTMLInputElement).type === "file") {
          return; // Skip file inputs
        }

        const staticEl = document.createElement("div");
        staticEl.className = c.className;
        staticEl.style.cssText = c.style.cssText;
        staticEl.style.display = "flex";
        staticEl.style.alignItems = c.tagName === "TEXTAREA" ? "flex-start" : "center";
        staticEl.style.whiteSpace = c.tagName === "TEXTAREA" ? "pre-wrap" : "nowrap";
        staticEl.style.overflow = "hidden";

        const clientHeight = (original as HTMLElement).clientHeight;
        if (clientHeight) {
          staticEl.style.minHeight = `${clientHeight}px`;
        }

        let val = "";
        if (original.tagName === "SELECT") {
          const sel = original as HTMLSelectElement;
          val = sel.options[sel.selectedIndex]?.text || "";
        } else if (
          original.tagName === "INPUT" &&
          ((original as HTMLInputElement).type === "checkbox" ||
            (original as HTMLInputElement).type === "radio")
        ) {
          val = (original as HTMLInputElement).checked ? "☑" : "☐";
          staticEl.style.display = "inline-flex";
        } else {
          val = (original as HTMLInputElement | HTMLTextAreaElement).value;
        }

        if (!val && original.hasAttribute("placeholder")) {
          staticEl.textContent = original.getAttribute("placeholder") || "";
          staticEl.style.color = "#9ca3af"; // gray-400 fallback
        } else {
          staticEl.textContent = val;
        }

        c.parentNode.replaceChild(staticEl, c);
      }
    });

    const titleElements = copy.querySelectorAll(".contract-title");
    titleElements.forEach((t) => (t.textContent += titleSuffix));

    // Ensure watermark is fully visible
    const watermark = copy.querySelector(".print-watermark") as HTMLElement;
    if (watermark) {
      watermark.classList.remove("opacity-0");
      watermark.style.opacity = "1";
    }

    const originalCanvases = element.querySelectorAll("canvas");
    const copyCanvases = copy.querySelectorAll("canvas");
    originalCanvases.forEach((canvas, idx) => {
      if (copyCanvases[idx]) {
        const ctx = copyCanvases[idx].getContext("2d");
        ctx?.drawImage(canvas, 0, 0);
      }
    });

    // Ensure styles are preserved
    copy.style.margin = "0 auto";
    copy.style.boxShadow = "none";
    
    return copy;
  };

  const printPage = async () => {
    console.log("Print button clicked");
    if (isPrinting) return;

    const element = contractRef.current;
    if (!element) {
      return;
    }

    // Create a temporary print container
    const printContainer = document.createElement("div");
    printContainer.id = "print-duplicates-container";
    
    // Add copies
    const copy1 = createCopyForPrinting(element, " (نسخة الشركة)");
    const copy2 = createCopyForPrinting(element, " (نسخة المستأجر)");
    
    printContainer.appendChild(copy1);
    printContainer.appendChild(copy2);

    setIsPrinting(true);

    try {
      
      // Add style to hide everything else and show this container during print
      const style = document.createElement("style");
      style.id = "temp-print-style";
      style.textContent = `
        #print-duplicates-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          z-index: -1 !important;
          visibility: hidden !important;
        }
        @media print {
          /* 1. إلغاء تأثير تكبير شاشة اللابتوب (Scaling) وإجبار المتصفح على حجم الورق القانوني */
          html, body {
            width: 210mm !important; /* أبعاد ورقة A4 الرسمية بالطول */
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 2. تحديد هوامش الصفحة الورقية كلياً بشكل ثابت لا يتأثر بنوع الجهاز */
          @page {
            size: A4 portrait !important; /* فرض الطباعة بالطول ورق رسمي A4 */
            margin: 20mm 15mm 20mm 15mm !important; /* هوامش ثابتة: أعلى، يمين، أسفل، يسار */
          }

          /* 3. توحيد حجم خطوط نصوص العقد بالسنتيمتر والنقاط الثابتة بدل البكسل */
          .contract-body, p, td, span {
            font-size: 14pt !important; /* حجم الخط القياسي للمعاملات القانونية */
            line-height: 1.6 !important; /* قفل المسافة بين الأسطر لمنع تداخل الكلام باللابتوب */
          }

          /* 4. إجبار عناوين البنود على أحجام ثابتة */
          h1, h2, h3 {
            font-size: 18pt !important;
            font-weight: bold !important;
            margin-bottom: 10mm !important;
          }

          /* 5. منع ترحيل التواقيع أو الأسطر الأخيرة لصفحة جديدة فارغة */
          .contract-signatures, .signature-area {
            page-break-inside: avoid !important; /* يمنع كسر منطقة التواقيع إلى نصفين بين الصفحات */
            margin-top: 15mm !important;
          }

          /* إخفاء شريط النظام والأزرار وأي شيء ليس له علاقة بنص العقد القانوني */
          .btn, button, .navbar, .sidebar, .no-print, .print-hidden, #root, #initial-loader {
            display: none !important;
          }

          #print-duplicates-container {
            visibility: visible !important;
            z-index: 9999 !important;
            width: 210mm !important;
          }

          .print-contract-copy {
            page-break-after: always !important;
            break-after: page !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            margin: 0 auto !important;
            width: 210mm !important;
          }

          .print-contract-copy:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(printContainer);

      if (!readOnly) {
        // Save data in background while we prepare the print
        saveContractToSystem(false).catch(e => console.error("Auto-save failed during print prep:", e));
      }

      const cleanup = () => {
        if (document.head.contains(style)) document.head.removeChild(style);
        if (document.body.contains(printContainer)) document.body.removeChild(printContainer);
        window.removeEventListener("afterprint", cleanup);
        setIsPrinting(false);
      };

      window.addEventListener("afterprint", cleanup);

      // Give more time for images and canvases to be ready in the cloned DOM
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      window.print();
      
      // Cleanup will happen via afterprint event
      if (onSaveSuccess) onSaveSuccess();
    } catch (error) {
      console.error("Printing failed:", error);
      setIsPrinting(false);
    }
  };

  const sendViaWhatsApp = async () => {
    if (!readOnly) {
      const docId = await saveContractToSystem(false);
      if (!docId) return;
    }
    if (!contractData.renterPhone) {
      toast.error("يرجى إدخال رقم هاتف المستأجر لتتمكن من إرسال الواتساب");
      return;
    }
    const txt = isWithDriver
      ? `مرحباً بك ${contractData.renterName}،\nتم إصدار عقد رحلة خاص بك بنجاح من شركة ${contractData.companyName || "تأجير السيارات"}.\nرقم العقد: ${contractData.contractCode}\nعدد السيارات: ${contractData.carCount || "غير محدد"}\nأنواع السيارات: ${contractData.carTypes || "غير محدد"}\n\nنتمنى لكم رحلة سعيدة!`
      : `مرحباً بك ${contractData.renterName}،\nتم إصدار عقد تأجير سيارة خاص بك بنجاح من شركة ${contractData.companyName || "تأجير السيارات"}.\nرقم العقد: ${contractData.contractCode}\nالسيارة: ${contractData.carModel} - ${contractData.plateNumber}\n\nنتمنى لك رحلة سعيدة!`;

    let phoneStr = String(contractData.renterPhone || "").replace(/\D/g, "");
    if (phoneStr.startsWith("0")) {
      phoneStr = "964" + phoneStr.substring(1);
    } else if (!phoneStr.startsWith("964")) {
      phoneStr = "964" + phoneStr;
    }

    const url = `whatsapp://send?phone=${phoneStr}&text=${encodeURIComponent(txt)}`;

    window.location.href = url;
    if (onSaveSuccess) onSaveSuccess();
  };

  const downloadPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    
    try {
      if (!readOnly) {
        const docId = await saveContractToSystem(false);
        if (!docId) {
          setIsGeneratingPdf(false);
          return;
        }
      }

      const element = contractRef.current;
      if (element) {
        localStorage.setItem("contractPrinted", "true");

        // Wait for React to render the DOM without zoom and for QR code to refresh
        await new Promise((resolve) => setTimeout(resolve, 150));

        try {
          const printContainer = document.createElement("div");

          const copy1 = createCopyForPrinting(element, " (نسخة الشركة)");
          const copy2 = createCopyForPrinting(element, " (نسخة المستأجر)");

          printContainer.appendChild(copy1);
          printContainer.appendChild(copy2);

          // Append to DOM so html-to-image can compute styles
          printContainer.style.position = "absolute";
          printContainer.style.left = "-9999px";
          printContainer.style.top = "0";
          printContainer.style.width = "210mm";
          document.body.appendChild(printContainer);

          // wait for browser to paint
          await new Promise((resolve) => setTimeout(resolve, 50));

          try {
            const toPngOpts = { cacheBust: false, pixelRatio: 1.5, skipFonts: false };
            const imgData1 = await toPng(copy1, toPngOpts);
            const imgData2 = await toPng(copy2, toPngOpts);

            const pdf = new jsPDF({
              unit: "mm",
              format: "a4",
              orientation: "portrait",
            });

            const pdfWidth = 210;
            const pdfHeight = 297;
            
            const addImageToPdf = (imgData: string, isNewPage = false) => {
               if (isNewPage) pdf.addPage();
               const imgProps = pdf.getImageProperties(imgData);
               
               const effectiveWidth = pdfWidth - (pdfMargin * 2);
               const effectiveHeight = pdfHeight - (pdfMargin * 2);
               
               // Scale image to fit width perfectly
               const ratio = effectiveWidth / imgProps.width;
               const imgWidth = effectiveWidth;
               const imgHeight = imgProps.height * ratio;
               
               // Split across multiple pages if needed
               let heightLeft = imgHeight;
               let position = pdfMargin;
               let currentPage = 1;

               pdf.addImage(imgData, 'PNG', pdfMargin, position, imgWidth, imgHeight);
               heightLeft -= effectiveHeight;

               while (heightLeft > 1) {
                 position = heightLeft - imgHeight + pdfMargin;
                 pdf.addPage();
                 pdf.addImage(imgData, 'PNG', pdfMargin, position, imgWidth, imgHeight);
                 heightLeft -= effectiveHeight;
                 currentPage++;
               }
            };

            addImageToPdf(imgData1, false);
            addImageToPdf(imgData2, true);

            pdf.save(`${pdfFileName}_${contractData.contractCode}.pdf`);
            
            if (onSaveSuccess) onSaveSuccess();
          } catch (error) {
            console.error("PDF generation error:", error);
            toast.error("حدث خطأ أثناء تحميل ملف PDF");
          } finally {
            if (printContainer && printContainer.parentNode) {
              document.body.removeChild(printContainer);
            }
          }
        } catch (error) {
          console.error("PDF setup error:", error);
          toast.error("حدث خطأ أثناء إعداد ملف PDF");
        }
      }
    } catch (error) {
      console.error("Download PDF failed:", error);
      toast.error("حدث خطأ أثناء التحضير لتحميل الملف");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const saveContractToSystem = async (triggerSuccess = false) => {
    if (savedDocId) {
      if (triggerSuccess && onSaveSuccess) onSaveSuccess();
      return savedDocId;
    }
    if (!staff?.companyId && !currentCompany?.id) {
      toast.error(
        "لم يتم التعرف على بيانات الشركة. يرجى التأكد من تسجيل الدخول أو تحديث الصفحة.",
      );
      return null;
    }

    setIsSavingSystem(true);
    try {
      let finalCarId = selectedCarId;
      if (
        !finalCarId &&
        (contractData.chassisNumber ||
          contractData.plateNumber ||
          contractData.carName)
      ) {
        const foundCar = inventory.find((c) => {
          const matchChassis =
            contractData.chassisNumber &&
            ((c.chassisNumber &&
              String(c.chassisNumber).trim() ===
                String(contractData.chassisNumber).trim()) ||
              (c.chassis &&
                String(c.chassis).trim() ===
                  String(contractData.chassisNumber).trim()));
          const matchPlate =
            contractData.plateNumber &&
            c.plateNumber &&
            String(c.plateNumber).trim() ===
              String(contractData.plateNumber).trim();
          const matchName =
            contractData.carName &&
            c.name &&
            String(c.name).trim() === String(contractData.carName).trim();
          return matchChassis || matchPlate || matchName;
        });
        if (foundCar) finalCarId = foundCar.id;
      }

      const payloadData = {
        ...contractData,
        rentalDays:
          parseInt(String(contractData.rentalDays).replace(/\D/g, "")) || 0,
        dailyAmount:
          parseFloat(String(contractData.dailyAmount).replace(/,/g, "")) || 0,
        rentalCost:
          parseFloat(String(contractData.rentalCost).replace(/,/g, "")) || 0,
        paidAmount:
          parseFloat(String(contractData.paidAmount).replace(/,/g, "")) || 0,
        remainingAmount:
          parseFloat(String(contractData.remainingAmount).replace(/,/g, "")) ||
          0,
        chassisNumber: contractData.chassisNumber,
        fullName: contractData.renterName,
        driverName: contractData.driverName,
        driverPhone: contractData.driverPhone,
        phoneNumber: contractData.renterPhone,
        carType: contractData.carModel,
        rentalStartDate: contractData.departureDate,
        rentalStartTime: contractData.departureTime,
        rentalEndDate: contractData.returnDate,
        rentalEndTime: contractData.returnTime,
        carId: finalCarId || "",
        companyId: currentCompany?.id || staff?.companyId || "",
        companyName: currentCompany?.name || "اسم الشركة",
        userId: staff?.id || "",
        bookingStatus: "active",
        isWithDriver: isWithDriver,
        createdAt: serverTimestamp(),
      };

      if (!payloadData.returnDate) delete payloadData.returnDate;
      if (!payloadData.departureDate) delete payloadData.departureDate;
      if (!payloadData.rentalEndDate) delete payloadData.rentalEndDate;
      if (!payloadData.rentalStartDate) delete payloadData.rentalStartDate;

      let docIdToReturn = savedDocId;
      if (contractInitialData?.id) {
        // Update existing contract document
        const updatedPayload = { ...payloadData };
        delete updatedPayload.createdAt; // Prevent overriding createdAt
        if (!updatedPayload.contractCode) delete updatedPayload.contractCode;

        await updateDoc(
          doc(db, "contracts", contractInitialData.id),
          updatedPayload,
        );
        docIdToReturn = contractInitialData.id;
        setSavedDocId(docIdToReturn);
      } else {
        // Create new contract document
        const docRef = await addDoc(collection(db, "contracts"), payloadData);
        docIdToReturn = docRef.id;
        setSavedDocId(docIdToReturn);
      }

      // Automate updating the selected car status in the database fleet to 'rented'
      if (finalCarId) {
        try {
          await api.put("inventory", finalCarId, { status: "rented" });
        } catch (carErr) {
          console.error(
            "Failed to automatically set car status to rented:",
            carErr,
          );
        }
      }

      // Automate saving the renter as a customer in the system automatically if not exists
      if (contractData.renterName && contractData.renterPhone) {
        try {
          const phoneLower = String(contractData.renterPhone || "").trim();
          const exists = customersList.some(
            (c) =>
              (c.phoneNumber && c.phoneNumber.trim() === phoneLower) ||
              (c.phone && c.phone.trim() === phoneLower),
          );
          if (!exists) {
            await addDoc(collection(db, "customers"), {
              name: contractData.renterName,
              phoneNumber: contractData.renterPhone,
              address: contractData.renterAddress || "",
              documentType: contractData.documentType || "",
              documentNumber: contractData.documentNumber || "",
              renterDateOfBirth: contractData.renterDateOfBirth || "",
              idCardDate: contractData.idCardDate || "",
              idCardExpiry: contractData.idCardExpiry || "",
              drivingLicenseNumber: contractData.drivingLicenseNumber || "",
              drivingLicenseDate: contractData.drivingLicenseDate || "",
              drivingLicenseExpiry: contractData.drivingLicenseExpiry || "",
              imageUrl: customerImg || "",
              userId: staff?.id || "",
              companyId: staff?.companyId || "",
              createdAt: new Date().toISOString(),
            });
            console.log("Customer saved dynamically on contract insertion!");
          }
        } catch (custErr) {
          console.error(
            "Failed to automatically save customer on contract creation:",
            custErr,
          );
        }
      }

      toast.success(
        "تم حفظ العقد وتحديث حالة السيارة وحفظ ملف المستأجر تلقائياً! 🚗👤🚀",
      );
      localStorage.setItem("contractPrinted", "true");

      if (triggerSuccess && onSaveSuccess) {
        onSaveSuccess();
      }

      return docIdToReturn;
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء حفظ العقد في النظام.");
      return null;
    } finally {
      setIsSavingSystem(false);
    }
  };

  const termsBase = isWithDriver
    ? defaultTermsWithDriver
    : defaultTermsNoDriver;
  const customTermsConfigSource = isWithDriver
    ? currentCompany?.driverContractTerms
    : currentCompany?.contractTerms;
  const customTermsConfig = Array.isArray(customTermsConfigSource)
    ? customTermsConfigSource
    : [];

  const finalTermsList = termsBase.map((defaultTerm, idx) => {
    const customTerm = customTermsConfig[idx];
    return customTerm && customTerm.trim() !== "" ? customTerm : defaultTerm;
  });

  customTermsConfig.forEach((customTerm: string, idx: number) => {
    if (idx >= termsBase.length && customTerm && customTerm.trim() !== "") {
      finalTermsList.push(customTerm);
    }
  });

  const midpointTerms = Math.ceil(finalTermsList.length / 2);
  const rightColTerms = finalTermsList.slice(0, midpointTerms); // Columns in layout reversed
  const leftColTerms = finalTermsList.slice(midpointTerms);

  return (
    <div
      className="p-6 bg-neutral-100 min-h-screen print:p-0 print:bg-white"
      dir="rtl"
    >

      
      {/* Form Container */}
      {!readOnly && (
        <div className="bg-white p-6 rounded-3xl shadow-lg mb-8 print:hidden">
          <h2 className="text-2xl font-black text-center mb-6">بيانات العقد</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-8">
            {/* Group 2: Renter */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="border-b pb-3 space-y-2 text-right">
                <div className="flex justify-between items-center gap-2">
                  <h3 className="font-bold text-gray-700 whitespace-nowrap">
                    بيانات المستأجر والعميل
                  </h3>
                </div>
                {customersList.length > 0 && (
                  <div className="flex flex-col items-end gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500 font-bold block">
                        اتمتة العملاء:
                      </span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="بحث..."
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          className="text-[13px] leading-[13px] p-1 pr-6 border border-teal-200 rounded bg-white w-[102px] outline-none focus:border-teal-400"
                        />
                        <Search size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-teal-400" />
                      </div>
                    </div>
                    <select
                      value=""
                      className="text-xs p-1.5 border border-teal-300 rounded bg-teal-50/50 hover:bg-teal-50 font-bold outline-none text-teal-900 transition cursor-pointer w-full max-w-[250px]"
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        const customer = customersList.find((c) => c.id === id);
                        if (customer) {
                          setContractData((prev) => ({
                            ...prev,
                            renterName:
                              customer.name ||
                              customer.fullName ||
                              prev.renterName,
                            renterPhone:
                              customer.phoneNumber ||
                              customer.phone ||
                              prev.renterPhone,
                            renterAddress:
                              customer.address || prev.renterAddress,
                            documentType:
                              customer.documentType || prev.documentType,
                            documentNumber:
                              customer.documentNumber || prev.documentNumber,
                            renterDateOfBirth:
                              customer.renterDateOfBirth ||
                              prev.renterDateOfBirth,
                            idCardDate: customer.idCardDate || prev.idCardDate,
                            idCardExpiry:
                              customer.idCardExpiry || prev.idCardExpiry,
                            drivingLicenseNumber:
                              customer.drivingLicenseNumber ||
                              prev.drivingLicenseNumber,
                            drivingLicenseDate:
                              customer.drivingLicenseDate ||
                              prev.drivingLicenseDate,
                            drivingLicenseExpiry:
                              customer.drivingLicenseExpiry ||
                              prev.drivingLicenseExpiry,
                            customerImageUrl:
                              customer.imageUrl || prev.customerImageUrl,
                          }));
                          if (customer.imageUrl)
                            setCustomerImg(customer.imageUrl);
                        }
                      }}
                    >
                      <option value="">
                        👤 {customerSearchTerm ? `نتائج البحث (${filteredCustomers.length})` : "اختر من العملاء لتعبئة العقد فوراً"}
                      </option>
                      {filteredCustomers.map((cust, index) => (
                        <option key={cust.id || index} value={cust.id}>
                          {cust.name || cust.fullName} -{" "}
                          {cust.phoneNumber || cust.phone || "بدون هاتف"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <input
                value={contractData.renterName || ""}
                onChange={(e) =>
                  setContractData({
                    ...contractData,
                    renterName: e.target.value,
                  })
                }
                placeholder="اسم المستأجر"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <div
                className="flex w-full items-center border-b-2 border-gray-200 focus-within:border-blue-500 transition px-1 bg-transparent"
                dir="ltr"
              >
                <span className="text-sm text-gray-500 font-bold ml-2.5 mt-0.5">
                  +964
                </span>
                <input
                  dir="ltr"
                  value={contractData.renterPhone || ""}
                  onChange={(e) =>
                    setContractData({
                      ...contractData,
                      renterPhone: (e.target.value || "").replace(/\D/g, ""),
                    })
                  }
                  placeholder="7xxxxxxxxx"
                  className="flex-1 py-2 text-sm bg-transparent focus:outline-none rounded-none text-left"
                />
              </div>
              {isWithDriver && (
                <>
                  <input
                    value={contractData.driverName || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        driverName: e.target.value,
                      })
                    }
                    placeholder="اسم السائق"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <div
                    className="flex w-full items-center border-b-2 border-gray-200 focus-within:border-blue-500 transition px-1 bg-transparent"
                    dir="ltr"
                  >
                    <span className="text-sm text-gray-500 font-bold ml-2.5 mt-0.5">
                      +964
                    </span>
                    <input
                      dir="ltr"
                      value={contractData.driverPhone || ""}
                      onChange={(e) =>
                        setContractData({
                          ...contractData,
                          driverPhone: (e.target.value || "").replace(
                            /\D/g,
                            "",
                          ),
                        })
                      }
                      placeholder="رقم السائق 7xxxxxxxxx"
                      className="flex-1 py-2 text-sm bg-transparent focus:outline-none rounded-none text-left"
                    />
                  </div>
                </>
              )}
              <input
                value={contractData.renterAddress || ""}
                onChange={(e) =>
                  setContractData({
                    ...contractData,
                    renterAddress: e.target.value,
                  })
                }
                placeholder="عنوان المستأجر (الزقاق / المحلة / الدار)"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <div className="grid grid-cols-1 gap-2">
                <input
                  value={contractData.witnessName || ""}
                  onChange={(e) =>
                    setContractData({
                      ...contractData,
                      witnessName: e.target.value,
                    })
                  }
                  placeholder="اسم الشاهد الأول"
                  className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                />
                <input
                  value={contractData.witnessName2 || ""}
                  onChange={(e) =>
                    setContractData({
                      ...contractData,
                      witnessName2: e.target.value,
                    })
                  }
                  placeholder="اسم الشاهد الثاني"
                  className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                />
              </div>
              <div className="grid grid-cols-1 gap-2">
                <input
                  value={contractData.documentType || ""}
                  onChange={(e) =>
                    setContractData({
                      ...contractData,
                      documentType: e.target.value,
                    })
                  }
                  placeholder="نوع المستمسك"
                  className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                />
                <input
                  value={contractData.documentNumber || ""}
                  onChange={(e) =>
                    setContractData({
                      ...contractData,
                      documentNumber: e.target.value,
                    })
                  }
                  placeholder="رقم المستمسك"
                  className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                />
              </div>
              {!isWithDriver && (
                <>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-500 font-bold mb-1 px-1">
                        تاريخ الإصدار
                      </span>
                      <input
                        type="date"
                        value={contractData.idCardDate || ""}
                        onChange={(e) =>
                          setContractData({
                            ...contractData,
                            idCardDate: e.target.value,
                          })
                        }
                        className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-500 font-bold mb-1 px-1">
                        تاريخ الانتهاء
                      </span>
                      <input
                        type="date"
                        value={contractData.idCardExpiry || ""}
                        onChange={(e) =>
                          setContractData({
                            ...contractData,
                            idCardExpiry: e.target.value,
                          })
                        }
                        className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col mt-2">
                    <span className="text-[11px] text-gray-500 font-bold mb-1 px-1">
                      تاريخ ميلاد المستأجر
                    </span>
                    <input
                      type="date"
                      value={contractData.renterDateOfBirth || ""}
                      onChange={(e) =>
                        setContractData({
                          ...contractData,
                          renterDateOfBirth: e.target.value,
                        })
                      }
                      className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                    />
                  </div>
                  <input
                    value={contractData.drivingLicenseNumber || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        drivingLicenseNumber: e.target.value,
                      })
                    }
                    placeholder="رقم إجازة السوق"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-500 font-bold mb-1 px-1">
                        إصدار الإجازة
                      </span>
                      <input
                        type="date"
                        value={contractData.drivingLicenseDate || ""}
                        onChange={(e) =>
                          setContractData({
                            ...contractData,
                            drivingLicenseDate: e.target.value,
                          })
                        }
                        className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-gray-500 font-bold mb-1 px-1">
                        انتهاء الإجازة
                      </span>
                      <input
                        type="date"
                        value={contractData.drivingLicenseExpiry || ""}
                        onChange={(e) =>
                          setContractData({
                            ...contractData,
                            drivingLicenseExpiry: e.target.value,
                          })
                        }
                        className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Group 4: Rental & Payment */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-2 border-b pb-2">
                معلومات الإيجار والدفع
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-sm text-gray-500 font-medium px-1">
                    تاريخ الخروج
                  </div>
                  <input
                    type="date"
                    value={contractData.departureDate || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        departureDate: e.target.value,
                      })
                    }
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium px-1">
                    وقت الخروج
                  </div>
                  <input
                    type="time"
                    value={contractData.departureTime || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        departureTime: e.target.value,
                      })
                    }
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-sm text-gray-500 font-medium px-1">
                    تاريخ العودة
                  </div>
                  <input
                    type="date"
                    value={contractData.returnDate || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        returnDate: e.target.value,
                      })
                    }
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-500 font-medium px-1">
                    وقت العودة
                  </div>
                  <input
                    type="time"
                    value={contractData.returnTime || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        returnTime: e.target.value,
                      })
                    }
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                </div>
              </div>
              <input
                value={contractData.rentalDays || ""}
                onChange={(e) =>
                  setContractData({
                    ...contractData,
                    rentalDays: e.target.value,
                  })
                }
                placeholder="عدد أيام التأجير"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <input
                value={contractData.dailyAmount || ""}
                onChange={(e) =>
                  handleAmountChange("dailyAmount", e.target.value)
                }
                placeholder="المبلغ اليومي"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <input
                value={contractData.rentalCost || ""}
                onChange={(e) =>
                  handleAmountChange("rentalCost", e.target.value)
                }
                placeholder="المبلغ الكلي"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <input
                value={contractData.paidAmount || ""}
                onChange={(e) =>
                  handleAmountChange("paidAmount", e.target.value)
                }
                placeholder="الواصل"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <input
                value={contractData.remainingAmount || ""}
                onChange={(e) =>
                  handleAmountChange("remainingAmount", e.target.value)
                }
                placeholder="الباقي"
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              <input
                value={contractData.rentalKmCount || ""}
                onChange={(e) =>
                  setContractData({
                    ...contractData,
                    rentalKmCount: e.target.value,
                  })
                }
                placeholder={isWithDriver ? "تفاصيل الرحلة" : "عدد الكيلوات"}
                className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
              />
              {!isWithDriver && (
                <textarea
                  value={contractData.notes || ""}
                  onChange={(e) =>
                    setContractData({ ...contractData, notes: e.target.value })
                  }
                  placeholder="ملاحظات"
                  maxLength={200}
                  className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                />
              )}
            </div>

            {/* Group 3: Vehicle & Limitations */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-gray-700">بيانات المركبة</h3>
                {inventory.length > 0 && (
                  <div className="flex flex-col items-end gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500 font-bold block">
                        اتمتة السيارات:
                      </span>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="بحث..."
                          value={carSearchTerm}
                          onChange={(e) => setCarSearchTerm(e.target.value)}
                          className="text-[13px] leading-[13px] p-1 pr-6 border border-amber-200 rounded bg-white w-[102px] outline-none focus:border-amber-400"
                        />
                        <Search size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-400" />
                      </div>
                    </div>
                    <select
                      value=""
                      className="text-xs p-1.5 border border-amber-300 rounded bg-amber-50/50 hover:bg-amber-50 font-bold outline-none text-amber-900 transition cursor-pointer w-full max-w-[250px]"
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) {
                          setSelectedCarId("");
                          setCarImg("");
                          setContractData((prev) => ({
                            ...prev,
                            carImageUrl: "",
                          }));
                          return;
                        }
                        setSelectedCarId(id);
                        const car = inventory.find((c) => c.id === id);
                        if (car) {
                          setContractData((prev) => ({
                            ...prev,
                            carName: car.name || prev.carName,
                            carOwnerName:
                              car.ownerName || car.owner || prev.carOwnerName,
                            carImageUrl: car.imageUrl || prev.carImageUrl,
                            carModel: car.year || prev.carModel,
                            plateNumber: car.plateNumber || prev.plateNumber,
                            registrationNumber:
                              car.registrationNumber || prev.registrationNumber,
                            chassisNumber:
                              car.chassisNumber ||
                              car.chassis ||
                              car.chassis_number ||
                              prev.chassisNumber,
                            carColor: car.color || prev.carColor,
                            manufactureYear: car.year || prev.manufactureYear,
                            dailyAmount: car.dailyPrice
                              ? String(car.dailyPrice)
                              : prev.dailyAmount,
                          }));
                          setCarImg(car.imageUrl || "");
                        }
                      }}
                    >
                      <option value="">
                        🚗 {carSearchTerm ? `نتائج البحث (${filteredInventory.length})` : "اختر من الأسطول لتعبئة البيانات فوراً"}
                      </option>
                      {filteredInventory.map((car, index) => (
                        <option key={car.id || index} value={car.id}>
                          {car.name} - {car.plateNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {!isWithDriver ? (
                <>
                  <input
                    value={contractData.carOwnerName || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        carOwnerName: e.target.value,
                      })
                    }
                    placeholder="مالك المركبة"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.carName || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        carName: e.target.value,
                      })
                    }
                    placeholder="اسم السيارة"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.carModel || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        carModel: e.target.value,
                      })
                    }
                    placeholder="سنة الصنع"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.chassisNumber || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        chassisNumber: e.target.value,
                      })
                    }
                    placeholder="رقم الشاصي"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.plateNumber || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        plateNumber: e.target.value,
                      })
                    }
                    placeholder="رقم اللوحة"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.registrationNumber || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        registrationNumber: e.target.value,
                      })
                    }
                    placeholder="رقم السنوية"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.carColor || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        carColor: e.target.value,
                      })
                    }
                    placeholder="لون السيارة"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                </>
              ) : (
                <>
                  <input
                    value={contractData.carCount || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        carCount: e.target.value,
                      })
                    }
                    placeholder="عدد السيارات"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                  <input
                    value={contractData.carTypes || ""}
                    onChange={(e) =>
                      setContractData({
                        ...contractData,
                        carTypes: e.target.value,
                      })
                    }
                    placeholder="أنواع السيارات"
                    className="w-full p-2 text-sm border-b-2 border-gray-200 bg-transparent focus:border-blue-500 focus:outline-none rounded-none transition px-1"
                  />
                </>
              )}
              <label className="flex items-center justify-center p-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-100">
                <span className="text-sm font-medium text-gray-500">
                  📷 إضافة صورة السيارة
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={loadCarImage}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100 bg-white p-6 rounded-3xl shadow-lg mb-8 print:hidden">
        <h3 className="font-bold text-gray-700 mb-4 text-center">
          خيارات التصدير والطباعة
        </h3>
          <div className="flex flex-wrap justify-center gap-6 mb-6 bg-gray-50 p-4 rounded-xl">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">اسم ملف الـ PDF:</label>
              <input
                value={pdfFileName}
                onChange={(e) => setPdfFileName(e.target.value)}
                className="p-2 border rounded-lg text-sm w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">هامش الـ PDF (ملم):</label>
              <input
                type="number"
                value={pdfMargin}
                onChange={(e) => setPdfMargin(Number(e.target.value))}
                className="p-2 border rounded-lg text-sm w-20"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideQrCode}
                onChange={(e) => setHideQrCode(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">إخفاء الـ QR Code</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideSignatures}
                onChange={(e) => setHideSignatures(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">إخفاء التواقيع</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideRegistrationNumber}
                onChange={(e) => setHideRegistrationNumber(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">إخفاء رقم السنوية</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={sendViaWhatsApp}
              className="py-3 px-6 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:bg-green-600 transition"
            >
              💬 إرسال عبر واتساب
            </button>
            <button
              onClick={printPage}
              disabled={isPrinting}
              className={`py-3 px-6 bg-blue-600 text-white font-bold rounded-xl shadow-lg transition ${isPrinting ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"}`}
            >
              {isPrinting ? "⏳ جاري التحضير..." : "🖨 طباعة العقد"}
            </button>
            <button
              onClick={downloadPDF}
              disabled={isGeneratingPdf}
              className={`py-3 px-6 bg-gray-800 text-white font-bold rounded-xl shadow-lg transition ${isGeneratingPdf ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-900"}`}
            >
              {isGeneratingPdf ? "⏳ جاري المعالجة..." : "📄 تحميل كـ PDF"}
            </button>

          </div>
        </div>

      {/* A4 Preview Wrapper with Desktop-Fitting Controls */}
      {!readOnly && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 print:hidden mb-6 max-w-4xl mx-auto shadow-sm">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-right">
              <p className="text-blue-600 font-bold text-sm flex items-center gap-1.5">
                <span>💡</span>
                <span>
                  يمكنك النقر على أي نص داخل العقد وتعديله مباشرة قبل الطباعة
                </span>
              </p>
              <p className="text-gray-500 text-xs mt-1">
                تعديل الحجم بالأسفل يساعدك على ملاءمة العقد لشاشتك دون الحاجة
                للنزول للأسفل ولا يؤثر على جودة الطباعة أو الـ PDF.
              </p>
            </div>

            {/* Advanced Zoom / Fit controls */}
            <div className="flex flex-wrap items-center gap-3 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
              <span className="text-xs font-bold text-gray-600">
                حجم المعاينة:
              </span>
              <button
                onClick={() =>
                  setScreenZoom((prev) =>
                    Math.max(0.35, Number((prev - 0.05).toFixed(2))),
                  )
                }
                className="w-7 h-7 flex items-center justify-center bg-white border rounded-lg hover:bg-gray-50 font-bold text-sm shadow-sm transition active:scale-95"
              >
                -
              </button>
              <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md min-w-[42px] text-center">
                {Math.round(screenZoom * 100)}%
              </span>
              <button
                onClick={() =>
                  setScreenZoom((prev) =>
                    Math.min(1.2, Number((prev + 0.05).toFixed(2))),
                  )
                }
                className="w-7 h-7 flex items-center justify-center bg-white border rounded-lg hover:bg-gray-50 font-bold text-sm shadow-sm transition active:scale-95"
              >
                +
              </button>

              <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>

              <button
                onClick={() => setScreenZoom(0.55)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${screenZoom === 0.55 ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50 border"}`}
              >
                شاشة صغيرة 💻
              </button>
              <button
                onClick={() => setScreenZoom(0.65)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${screenZoom === 0.65 ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50 border"}`}
              >
                ملاءمة الشاشة 🖥️
              </button>
              <button
                onClick={() => setScreenZoom(1.0)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${screenZoom === 1.0 ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50 border"}`}
              >
                كامل 📄
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto flex justify-center pb-8 print:block print:overflow-visible print:pb-0 print:w-auto">
        <div
          ref={contractRef}
          className={`page w-[210mm] min-h-[297mm] print:min-h-[297mm] bg-white relative shrink-0 shadow-2xl print:shadow-none flex flex-col`}
          id="contract"
          style={{ zoom: isGeneratingPdf ? 1 : screenZoom, width: "797.667px", marginRight: "43px" }}
        >
          {/* Center Watermark (Full Page) */}
          <div className="print-watermark absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none z-0">
            <div className="relative flex items-center justify-center w-[400px] h-[400px]">
              {/* Decorative Official Seal Rings */}
              <div className="absolute inset-0 border-[6px] border-[#cdb26a] rounded-full opacity-[0.10]"></div>
              <div className="absolute inset-[16px] border-[2px] border-[#0c1424] border-dashed rounded-full opacity-[0.05]"></div>
              <div className="absolute inset-[32px] border-[4px] border-[#cdb26a] rounded-full opacity-[0.05]"></div>
              {logoImg ? (
                <img src={logoImg} alt="Watermark" className="w-[320px] h-[320px] object-cover rounded-full opacity-[0.15]" />
              ) : (
                <CarFront size={320} strokeWidth={0.5} className="text-[#0c1424] opacity-[0.15]" />
              )}
            </div>
          </div>

          {/* Header */}
          <div
            className={`bg-[#0c1424] text-white flex justify-between items-start px-12 pb-6 rounded-b-[40px] border-b-[8px] border-[#cdb26a] relative ${swapHeader ? "flex-row-reverse" : "flex-row"}`}
            style={{ height: "151.183px", width: "761.644px", marginLeft: "0px", marginRight: "16px", marginTop: "9px", paddingTop: "44px" }}
          >
            {/* Left: Logo & Company Name */}
            <div
              className={`flex items-center gap-3 z-10 w-1/4 ${swapHeader ? "flex-row-reverse" : ""}`}
              style={{ marginLeft: "-34px" }}
            >
              {logoImg ? (
                <div className="bg-white/5 p-1 rounded-lg shrink-0 relative group">
                  <img
                    src={logoImg}
                    alt="Logo"
                    className="w-[130px] h-[130px] object-contain print:color-adjust-exact"
                    style={{
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                      marginTop: "-42px",
                    }}
                  />
                  {!isGeneratingPdf && !readOnly && (
                    <button
                      type="button"
                      onClick={() => setLogoImg("")}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition print:hidden"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={`border-2 border-[#cdb26a] rounded-xl p-2 w-[70px] h-[70px] flex flex-col items-center justify-center relative shrink-0 cursor-pointer ${isGeneratingPdf ? "hidden" : "print:hidden"}`}
                >
                  <label className="cursor-pointer text-center flex flex-col items-center">
                    <div className="flex gap-1 mb-1 text-[#cdb26a]">
                      <Star size={8} fill="currentColor" />
                      <Star size={12} fill="currentColor" />
                      <Star size={8} fill="currentColor" />
                    </div>
                    <Car size={24} className="text-[#cdb26a]" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setLogoImg(ev.target?.result as string);
                            localStorage.setItem(
                              "contractLogoImg",
                              ev.target?.result as string,
                            );
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
              <div
                className={`flex flex-col ${swapHeader ? "text-right" : "text-right"}`}
                style={{ textAlign: "right", lineHeight: "24px", width: "145.64px", height: "78.4911px", marginRight: "1px", marginLeft: "1px", marginTop: "-50px" }}
              >
                {/* Company info moved to center */}
              </div>
            </div>

            {/* Center: Title */}
            <div className="flex flex-col items-center justify-start z-10 flex-1 pt-1">
              <h2
                className="text-[25px] mb-1 editable text-white -mt-[41px] -mr-[36px] text-center not-italic no-underline font-bold leading-[37.5px] font-serif"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                style={{ fontSize: "33px", textAlign: "center", fontWeight: "bold", fontStyle: "normal", fontFamily: '"Times New Roman"', width: "197.33px", height: "40.5px", lineHeight: "45.5px", marginLeft: "-9px" }}
              >
                عقد ايجار سيارة
              </h2>
              <div className="flex flex-col items-center -mt-2 -mr-[36px]">
                <h1
                  className="font-bold text-lg text-[#cdb26a] editable whitespace-nowrap"
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  style={{ fontSize: "17px", lineHeight: "1.2", height: "34.3793px", marginTop: "17px" }}
                >
                  {currentCompany?.name || "اسم الشركة"}
                </h1>
              </div>
              <span className="text-white text-lg font-bold mt-1 -mr-[36px]" style={{ fontFamily: '"Times New Roman"', marginLeft: "-9px" }}>
                {!isWithDriver ? "(عقد بدون سائق)" : "(عقد مع سائق)"}
              </span>
            </div>

            {/* Right: QR Code and Contract Verification */}
            <div className={`${hideQrCode ? "hidden" : "flex"} flex-col items-center text-white p-3 rounded-xl z-10 shrink-0 w-[140px]`} style={{ marginRight: "-46px", height: "168.518px", marginTop: "-66px" }}>
              <span className="text-[10px] font-bold mb-1.5">
                تحقق من العقد
              </span>
              <div className="shrink-0 mb-1.5">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="QR"
                    className="w-[90px] h-[90px] object-contain print:color-adjust-exact rounded bg-white"
                    style={{
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  />
                ) : (
                  <div className="w-[90px] h-[90px] flex items-center justify-center bg-white rounded">
                    <ScanFace size={24} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div
                className="text-[11px] text-[#d3d3d3] px-2 py-0.5 rounded font-bold whitespace-nowrap editable"
                contentEditable={!readOnly}
                suppressContentEditableWarning
              >
                {contractData.contractCode || "CR-2025-00001"}
              </div>
            </div>
          </div>

          {/* Contract Body (Grid Panels) */}
          <div
            className={`mt-[17px] px-12 text-${textAlign} grid grid-cols-2 gap-x-6 gap-y-6 text-[10px]`}
            style={{ width: "794.678px", height: "461.226px", marginTop: "4px" }}
          >
            {/* Renter Data (Top Left in RTL, meaning second child. We need it first visually in RTL so we do Right then Left) */}

            {/* Panel 1: Contract Data */}
            <div className="border border-black rounded-2xl pt-6 pb-4 px-4 relative flex flex-col mt-0 -mb-[3px] h-full" style={{ marginRight: "-30px", height: "194.317px", marginBottom: "-6px", textAlign: "right", fontSize: "7px", lineHeight: "9px", marginTop: "-2px", width: "374.995px" }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-10 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap shadow-sm z-10" style={{ paddingTop: "9px", marginTop: "13px", marginLeft: "114px", width: "141px", height: "20px" }}>
                بيانات العقد
              </div>
              <div className="flex-1 space-y-3.5 flex flex-col justify-center px-2 text-black text-[11px] -mr-[13px]">

                <div className="flex items-center">
                  <span className="text-black font-bold w-[80px] shrink-0">
                    رقم العقد :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                  >
                    {contractData.contractCode || "CR-2025-00001"}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[80px] shrink-0">
                    تاريخ العقد :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                  >
                    {contractData.departureDate}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[80px] shrink-0">
                    وقت الخروج :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                  >
                    {contractData.departureTime}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[80px] shrink-0">
                    وقت العودة :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                  >
                    {contractData.returnTime}
                  </span>
                </div>

                <div className="flex items-center">
                  <span className="text-black font-bold w-[80px] shrink-0">
                    مدة التأجير :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center text-[9px] editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                  >
                    من {contractData.departureDate} إلى{" "}
                    {contractData.returnDate}
                  </span>
                </div>
                {!isWithDriver && (
                  <div className="flex items-center mb-1">
                    <span className="text-black font-bold w-[80px] shrink-0">
                      عدد الكيلوات :
                    </span>
                    <span
                      className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                    >
                      {contractData.rentalKmCount}
                    </span>
                  </div>
                )}
                {isWithDriver && (
                  <div className="flex items-start mb-1">
                    <span className="text-black font-bold w-[80px] shrink-0 mt-[2px]">
                      تفاصيل الرحلة :
                    </span>
                    <div
                      className="border-b border-gray-200 border-dashed flex-1 editable min-h-[1.5rem] break-words whitespace-pre-wrap outline-none -ml-1"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      style={{
                        minHeight: "22.9873px",
                        lineHeight: "2",
                        width: "261.182px",
                        paddingTop: "-7px",
                        paddingLeft: "-2px",
                        marginTop: "4px",
                        paddingBottom: "-6px",
                        fontWeight: "bold",
                        fontSize: "11px",
                        marginLeft: "-22px",
                        marginRight: "-6px",
                        marginBottom: "-12px",
                        wordBreak: "break-word"
                      }}
                    >
                      {contractData.rentalKmCount}
                    </div>
                  </div>
                )}
                {!isWithDriver && (
                  <div className="flex items-start">
                    <span className="text-black font-bold w-[80px] shrink-0 mt-[13px]">
                      الملاحظات :
                    </span>
                    <div
                      className="border-b border-gray-200 border-dashed flex-1 editable min-h-[1.5rem] break-words break-all whitespace-pre-wrap outline-none -ml-1"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                      style={{
                        paddingTop: "-9px",
                        marginTop: "3px",
                        paddingLeft: "-3px",
                        height: "23.985px",
                        width: "260.55px",
                        marginLeft: "-4px",
                        paddingBottom: "-1px",
                        textAlign: "justify",
                        fontFamily: "Times New Roman",
                        fontWeight: "bold"
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.currentTarget.innerText.length >= 200 &&
                          e.key !== "Backspace" &&
                          e.key !== "Delete" &&
                          e.key !== "ArrowLeft" &&
                          e.key !== "ArrowRight" &&
                          e.key !== "ArrowUp" &&
                          e.key !== "ArrowDown" &&
                          !e.ctrlKey &&
                          !e.metaKey
                        ) {
                          e.preventDefault();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData.getData("text/plain");
                        const remaining = 200 - e.currentTarget.innerText.length;
                        if (remaining > 0) {
                          document.execCommand("insertText", false, text.substring(0, remaining));
                        }
                      }}
                    >
                      {contractData.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel 2: Renter Data */}
            <div className="border border-black rounded-2xl pt-6 pb-4 px-4 relative flex flex-col -ml-[35px] h-full" style={{ width: "372.327px", height: "194.317px", marginBottom: "-8px", marginTop: "-2px", marginRight: "-6px" }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-10 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "142px", height: "20px", textAlign: "right", fontSize: "12px", marginTop: "13px", paddingTop: "3px", marginLeft: "114px" }}>
                بيانات المستأجر
              </div>
              <div className="flex flex-row-reverse gap-3 flex-1 px-2">
                <div className="w-[90px] shrink-0 flex flex-col items-center justify-start gap-1" style={{ marginTop: "13px" }}>
                  {customerImg ? (
                    <img
                      src={customerImg}
                      className="w-[90px] h-[100px] object-cover border border-gray-200 rounded-md print:color-adjust-exact"
                      style={{
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                        marginTop: "-18px",
                        marginLeft: "-29px",
                      }}
                    />
                  ) : (
                    <div className="w-[90px] h-[100px] bg-gray-50 rounded-md flex items-center justify-center text-gray-300 border border-dashed border-gray-300">
                      <UserCheck size={40} className="opacity-20" />
                    </div>
                  )}
                  <div
                    className={`flex flex-col gap-1 mt-1 ${isGeneratingPdf ? "hidden" : "print:hidden"} w-full`}
                  >
                    <label className="text-[9px] bg-gray-200 hover:bg-gray-300 py-1 px-1 rounded cursor-pointer text-center block w-full whitespace-nowrap">
                      رفع صورة
                      <input
                        type="file"
                        accept="image/*"
                        onChange={loadCustomer}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={startCamera}
                      className="text-[9px] bg-blue-100 hover:bg-blue-200 text-blue-700 py-1 px-1 rounded transition block w-full whitespace-nowrap"
                    >
                      الكاميرا
                    </button>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5 -mr-[18px] text-black font-bold font-['Vazirmatn'] text-[11px] border-black" style={{ fontSize: "11px", lineHeight: "9px", marginTop: "2px", marginLeft: "-14px" }}>
                  <div className="flex items-center">
                    <span className="text-black font-bold w-[70px] shrink-0">
                      اسم المستأجر :
                    </span>
                    <span
                      className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                    >
                      {contractData.renterName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1">
                      <span className="text-black font-bold w-[80px] shrink-0">
                        نوع المستمسك :
                      </span>
                      <span
                        className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        style={{ marginLeft: "-19px" }}
                      >
                        {contractData.documentType}
                      </span>
                    </div>
                    <div className="flex items-center flex-1">
                      <span className="text-black font-bold w-[70px] shrink-0" style={{ marginLeft: "-56px", marginRight: "25px" }}>
                        الرقم :
                      </span>
                      <span
                        className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        style={{ marginLeft: "-25px", marginTop: "3px" }}
                      >
                        {contractData.documentNumber}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1">
                      <span className="text-black font-bold w-[70px] shrink-0">
                        تاريخ الإصدار :
                      </span>
                      <span
                        className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        style={{ width: "36.5048px", height: "3.5143999999999984px", marginLeft: "-22px", marginRight: "-10px", marginTop: "-5px", paddingTop: "-6px", textAlign: "center", fontSize: "11px" }}
                      >
                        {contractData.idCardDate}
                      </span>
                    </div>
                    <div className="flex items-center flex-1" style={{ marginLeft: "-7px", marginRight: "-4px", marginBottom: "-2px", width: "120.659px", height: "8.5288px" }}>
                      <span className="text-black font-bold shrink-0 text-right" style={{ marginLeft: "-22px", marginRight: "15px", width: "67px", marginBottom: "1px" }}>
                        الانتهاء :
                      </span>
                      <span
                        className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center ml-[-8px]"
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                      >
                        {contractData.idCardExpiry}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-black font-bold w-[70px] shrink-0">
                      تاريخ الميلاد :
                    </span>
                    <span
                      className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                    >
                      {contractData.renterDateOfBirth}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-black font-bold w-[70px] shrink-0">
                      رقم الجوال :
                    </span>
                    <span
                      className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                    >
                      {contractData.renterPhone}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-black font-bold shrink-0" style={{ width: "82.9808px", height: "10.9952px", marginTop: "-1px", marginLeft: "-13px", marginRight: "-2px" }}>
                      العنوان :
                    </span>
                    <span
                      className="font-bold border-b border-gray-200 border-dashed flex-1 editable w-[165px] h-[18px] ml-[-20px] mr-[-29px] mt-[1px] text-center"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                    >
                      {contractData.renterAddress}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-black font-bold w-[70px] shrink-0">
                      رقم الرخصة :
                    </span>
                    <span
                      className="font-bold border-b border-gray-200 border-dashed flex-1 editable text-center"
                      contentEditable={!readOnly}
                      suppressContentEditableWarning
                    >
                      {contractData.drivingLicenseNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center flex-1">
                      <span className="text-black font-bold w-[70px] shrink-0" style={{ marginTop: "-5px" }}>
                        تاريخ الإصدار :
                      </span>
                      <span
                        className="font-bold border-b border-gray-200 border-dashed flex-1 editable -ml-[33px] -mr-[3px] pt-[3px] text-center"
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        style={{ marginTop: "-1px" }}
                      >
                        {contractData.drivingLicenseDate}
                      </span>
                    </div>
                    <div className="flex items-center flex-1 mr-[23px] -ml-[1px]">
                      <span className="text-black font-bold shrink-0 ml-[17px] text-right w-[40px]">
                        الانتهاء :
                      </span>
                      <span
                        className="font-bold border-b border-gray-200 border-dashed flex-1 editable -ml-[16px]"
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                      >
                        {contractData.drivingLicenseExpiry}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 3: Financial Details */}
            <div className="border border-black rounded-2xl pt-[19px] pl-4 pr-[15px] relative flex flex-col" style={{ height: "194.981px", marginTop: "-83px", width: "375.938px", marginRight: "-31px", marginLeft: "-5px", paddingBottom: "0px" }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-10 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "142px", height: "20px", marginTop: "12px", paddingTop: "1px", textAlign: "right", paddingBottom: "3px", paddingLeft: "40px", paddingRight: "32px", marginLeft: "115px" }}>
                تفاصيل المالية
              </div>
              <div className="flex-1 space-y-3.5 flex flex-col justify-center px-4 -mr-[19px]" style={{ lineHeight: "9px" }}>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    قيمة الإيجار اليومية :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "13px" }}
                  >
                    {formatCurrency(contractData.dailyAmount)} دينار عراقي
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    إجمالي قيمة الإيجار :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "12px" }}
                  >
                    {formatCurrency(contractData.rentalCost)} دينار عراقي
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    التأمين المسترد :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "13px" }}
                  >
                    {" "}
                    دينار عراقي
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    إجمالي العقد :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "13px" }}
                  >
                    {formatCurrency(contractData.rentalCost)} دينار عراقي
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    المبلغ المدفوع :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "13px" }}
                  >
                    {formatCurrency(contractData.paidAmount)} دينار عراقي
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    المتبقي :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "13px" }}
                  >
                    {formatCurrency(contractData.remainingAmount)} دينار عراقي
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-black font-bold w-[120px] shrink-0 text-[11px] text-right">
                    الضريبة (إن وجدت) :
                  </span>
                  <span
                    className="font-bold border-b border-gray-200 border-dashed flex-1 text-center editable"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ fontSize: "13px" }}
                  >
                    {" "}
                    دينار عراقي
                  </span>
                </div>
              </div>
            </div>

            {/* Panel 4: Car Data */}
            <div className="border border-black rounded-2xl pt-6 pb-[16px] px-4 relative flex flex-col mb-[5px] text-black" style={{ height: "192.947px", width: "372.981px", fontSize: "10px", marginTop: "-82px", marginLeft: "-34px", marginRight: "-4px" }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-10 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "142px", height: "20px", paddingTop: "3px", paddingBottom: "5px", fontSize: "14px", lineHeight: "16.5px", fontFamily: "Vazirmatn", paddingRight: "37px", marginTop: "12px", marginLeft: "113px" }}>
                بيانات السيارة
              </div>
              <div className="flex flex-row-reverse gap-3 flex-1 h-full items-center px-2">
                <div className="w-[100px] shrink-0 flex flex-col items-center justify-center">
                  {contractData.carImageUrl ? (
                    <img src={contractData.carImageUrl} alt="Car" className="w-[90px] h-[90px] object-cover rounded-md print:color-adjust-exact shadow-sm border border-gray-200" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
                  ) : (
                    <div className="w-[90px] h-[90px] flex items-center justify-center bg-slate-50 rounded-md border border-dashed border-slate-200">
                      <svg width="80" height="40" viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-40">
                        {/* Porsche Silhouette - Low Profile aerodynamic shape */}
                        <path d="M5 38C5 38 8 35 15 34C22 33 80 33 100 36C110 38 115 42 115 45V48C115 52 112 54 105 54H15C8 54 5 52 5 48V38Z" fill="#1E293B" />
                        
                        {/* The iconic 911 roof curve */}
                        <path d="M35 34C35 34 45 10 75 10C95 10 105 32 108 36" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
                        
                        {/* Window/Cabin highlight */}
                        <path d="M52 14C52 14 65 12 80 14C90 16 98 28 100 34H48L52 14Z" fill="#94A3B8" fillOpacity="0.3" />
                        
                        {/* Low-profile wheels */}
                        <circle cx="25" cy="48" r="7" fill="#0F172A" stroke="white" strokeWidth="1.5" />
                        <circle cx="92" cy="48" r="7" fill="#0F172A" stroke="white" strokeWidth="1.5" />
                        
                        {/* Headlight (Porsche oval style) */}
                        <ellipse cx="108" cy="38" rx="4" ry="3" fill="#FDE68A" fillOpacity="0.8" transform="rotate(-10, 108, 38)" />
                        
                        {/* Tail detail */}
                        <path d="M5 40H12" stroke="white" strokeWidth="1" strokeOpacity="0.3" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3 -mr-[18px] -ml-[7px] text-black font-bold font-['Vazirmatn'] text-[11px] leading-[15px] border-black" style={{ lineHeight: "9px" }}>
                  {!isWithDriver ? (
                    <>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0">
                          مالك السيارة :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.carOwnerName}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0 -mb-[12px] -mt-[7px]">
                          نوع السيارة :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.carName}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0">
                          الموديل :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.carModel}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0">
                          رقم اللوحة :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.plateNumber}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0">
                          رقم السنوية :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.registrationNumber}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0">
                          رقم الشاصي :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.chassisNumber}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[70px] shrink-0" style={{ height: "4.99px", marginTop: "0px" }}>
                          لون السيارة :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.carColor}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[80px] shrink-0">
                          عدد السيارات :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.carCount}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-black font-bold w-[80px] shrink-0 -mb-[12px] -mt-[7px]">
                          أنواع السيارات :
                        </span>
                        <span
                          className="font-bold border-b border-gray-200 border-dashed flex-1 editable min-h-[30px]"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.carTypes}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="ml-[13px] mr-4 border border-black rounded-2xl pt-6 pb-4 px-4 relative shadow-sm flex flex-col justify-center" style={{ height: "310.938px", marginTop: "-56px", width: "760.683px" }}>
            <div
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-white px-4 text-[#0c1424] font-black text-[14px] z-10 editable whitespace-nowrap"
              contentEditable={!readOnly}
              suppressContentEditableWarning
            >
              شروط وأحكام العقد
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-normal italic" style={{ fontSize: "16px", fontWeight: "normal" }}>
              {finalTermsList.map((term, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]" style={{ fontSize: "12px", lineHeight: "12px", fontWeight: "bold", fontStyle: "normal", fontFamily: "'Times New Roman'", ...(i === 1 ? { marginTop: "11px" } : {}), ...(i === 12 ? { height: "44.5px", marginTop: "-22px" } : {}) }}>
                  <span
                    className="bg-[#cdb26a] text-white font-bold px-1.5 py-0.5 rounded text-[10px] leading-none shrink-0 print:color-adjust-exact"
                    style={{
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="text-gray-800 text-justify font-bold editable no-underline"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                    style={{ 
                      lineHeight: i === 0 ? "10.5px" : i === 1 ? "12.5px" : "12.5px", 
                      fontStyle: "normal", 
                      fontFamily: "'Times New Roman'",
                      fontSize: i === 0 ? "12px" : i === 1 ? "12px" : undefined,
                      borderColor: (i === 0 || i === 1) ? "#000000" : undefined,
                      marginTop: i === 0 ? "9px" : i === 1 ? "-3px" : undefined
                    }}
                  >
                    {term}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Security Ribbon */}
          <div
            className="mt-2 ml-[11px] mr-4 bg-[#112556] text-white rounded-full py-1.5 px-4 flex items-center justify-start gap-2 shadow-sm text-[9px] h-[25.9615px] print:color-adjust-exact text-right"
            style={{
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
              marginTop: "-27px",
              paddingTop: "6px",
              marginLeft: "280px"
            }}
          >
            <ShieldCheck size={14} className="text-[#cdb26a]" />
            <span className="font-bold">
              تم إصدار هذا العقد إلكترونياً وحفظه في نظام الشركة ولا يمكن تعديله
              أو حذفه بعد الإصدار حماية لحقوق الطرفين.
            </span>
          </div>

          {/* Signatures */}
          {!hideSignatures && (
            <div className="mt-4 flex flex-col gap-6">
              <div className="flex justify-between px-20 relative -ml-[3px] mr-0" style={{ marginLeft: "-3px", marginTop: "1px", width: "800.641px", height: "121.967px" }}>
                {/* Right Signature (Renter) & Fingerprint in RTL */}
                <div className="flex gap-4 items-start border border-black rounded-2xl p-4 relative bg-white shadow-sm -ml-1 -mr-[63px] pt-[17px] pr-[15px] w-[281px]" style={{ marginTop: "-13px", height: "130.948px" }}>
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-6 py-1 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "141px", height: "20px", marginTop: "13px", marginLeft: "66px" }}>
                    توقيع المستأجر
                  </div>
                  <div className="text-center flex-1 mt-2">
                    <div className="space-y-4 mt-[7px] -mr-[11px] -ml-[17px]" style={{ width: "190.918px", marginTop: "2px" }}>
                      <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[11px]">
                        <span className="font-bold w-[40px] text-right">
                          الاسم :
                        </span>
                        <span
                          className="flex-1 editable -ml-[5px] -mt-[1px]"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                          style={{ fontWeight: "bold" }}
                        >
                          {/* {contractData.renterName} */}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[11px]">
                        <span className="font-bold w-[40px] text-right">
                          التوقيع :
                        </span>
                        <span className="flex-1"></span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[11px]">
                        <span className="font-bold w-[40px] text-right">
                          التاريخ :
                        </span>
                        <span
                          className="flex-1 editable font-bold"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                        >
                          {contractData.departureDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fingerprint */}
                  <div className="text-center w-[70px] flex flex-col items-center mt-2">
                    <div className="w-[60px] h-[60px] border border-gray-300 rounded-xl flex items-center justify-center opacity-50 bg-gray-50">
                      <span className="text-[10px] text-gray-400">البصمة</span>
                    </div>
                  </div>
                </div>

                {/* Left Signature (Company) in RTL */}
                <div className="flex gap-4 items-start border border-black rounded-2xl p-4 relative bg-white shadow-sm mr-[2px]" style={{ width: "289px", height: "130.99px", marginTop: "-13px", marginLeft: "-60px" }}>
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-6 py-1 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "141px", height: "20px", marginTop: "12px", marginLeft: "71px" }}>
                    توقيع الشركة
                  </div>
                  <div className="text-center flex-1 mt-2 -ml-[2px] -mr-[14px]">
                    <div className="space-y-4 relative">
                      <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[11px]">
                        <span className="font-bold w-[40px] text-right">
                          الاسم :
                        </span>
                        <span
                          className="flex-1 editable font-bold"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                          style={{ fontSize: "12px", textAlign: "right", fontFamily: "Vazirmatn" }}
                        >
                          {currentCompany?.name}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[11px]">
                        <span className="font-bold w-[40px] text-right">
                          التوقيع :
                        </span>
                        <span className="flex-1"></span>
                      </div>
                      <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[11px]">
                        <span className="font-bold w-[40px] text-right">
                          الختم :
                        </span>
                        <span className="flex-1"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Witnesses */}
              <div className="flex justify-between px-20 relative items-start" style={{ width: "832.986px", height: "74.9808px", marginTop: "-18px" }}>
                <div className="flex gap-4 items-start border border-black rounded-2xl p-4 relative bg-white shadow-sm -mr-[63px]" style={{ marginLeft: "3px", marginTop: "-7px", height: "42.9338px", marginRight: "-64px", width: "283.948px", paddingTop: "4px", paddingBottom: "14px", paddingRight: "30px" }}>
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-6 py-1 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "141px", height: "20px", marginLeft: "64px", marginTop: "12px" }}>
                    الشاهد الأول
                  </div>
                  <div className="text-center flex-1 mt-3">
                    <div className="flex gap-6" style={{ width: "231.971px", height: "18.1806px", marginTop: "-1px", marginLeft: "1px", paddingTop: "0px", paddingLeft: "0px", paddingRight: "0px" }}>
                      <div className="flex items-end border-b border-dashed border-gray-400 pb-1 text-[11px] flex-1" style={{ width: "116.269px", marginLeft: "20px", height: "18.728px", marginRight: "-12px", textAlign: "right" }}>
                        <span className="font-bold w-[36px] -mr-[14px] text-right shrink-0" style={{ height: "8.5px", width: "38.9776px" }}>
                          الاسم :
                        </span>
                        <span
                          className="flex-1 editable text-center -ml-[8px] text-[11px] font-bold"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                          style={{ textAlign: "right", marginTop: "0px", height: "8.49039px" }}
                        >
                          {contractData.witnessName}
                        </span>
                      </div>
                      <div className="flex items-end border-b border-dashed border-gray-400 pb-1 text-[11px] flex-1" style={{ height: "24.1806px", margin_right: "-15px", width: "101.769px", marginLeft: "-15px" }}>
                        <span className="font-bold w-[45px] text-right shrink-0" style={{ height: "9.4679px", marginLeft: "-4px", marginRight: "-14px" }}>
                          التوقيع :
                        </span>
                        <span className="flex-1"></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 items-start border border-black rounded-2xl p-4 relative bg-white shadow-sm" style={{ width: "287px", marginLeft: "-29px", paddingBottom: "16px", paddingTop: "0px", height: "42.9742px", marginTop: "-6px" }}>
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#112556] text-white px-6 py-1 rounded-full text-[12px] font-bold whitespace-nowrap shadow-sm z-10" style={{ width: "141px", height: "20px", marginTop: "12px", marginLeft: "73px" }}>
                    الشاهد الثاني
                  </div>
                  <div className="text-center flex-1 mt-3">
                    <div className="flex gap-6" style={{ width: "246.576px", marginTop: "-3px" }}>
                      <div className="flex items-end border-b border-dashed border-gray-400 pb-1 text-[11px] flex-1 mr-[25px] -ml-[15px] mt-[1px] h-[22px] w-[110px]" style={{ marginTop: "3px", width: "115.788px", height: "24.9818px" }}>
                        <span className="font-bold w-[42px] h-[15px] -mr-[36px] text-right shrink-0" style={{ height: "9.984px" }}>
                          الاسم :
                        </span>
                        <span
                          className="flex-1 editable text-center text-[11px] font-bold"
                          contentEditable={!readOnly}
                          suppressContentEditableWarning
                          style={{ textAlign: "right", marginTop: "0px", height: "12.5064px" }}
                        >
                          {contractData.witnessName2}
                        </span>
                      </div>
                      <div className="flex items-end border-b border-dashed border-gray-400 pb-1 text-[11px] flex-1" style={{ marginLeft: "-18px" }}>
                        <span className="font-bold w-[45px] text-right shrink-0">
                          التوقيع :
                        </span>
                        <span className="flex-1"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Area */}
          <div className="mt-auto w-full flex flex-col relative bottom-0 left-0 right-0 z-10 print:color-adjust-exact">
            {/* Main Dark Footer */}
            <div
              className={`bg-[#0c1424] text-white flex justify-between items-center px-12 py-5 rounded-t-[40px] border-t-[5px] border-[#cdb26a] ${swapHeader ? "flex-row-reverse" : "flex-row"}`}
              style={{ marginTop: "-40px", height: "60.5107px", width: "774.654px", paddingTop: "10px", marginLeft: "0px", marginRight: "10px", paddingBottom: "18px" }}
            >
              <div
                className={`flex items-center gap-2 ${swapHeader ? "flex-row-reverse text-left" : "text-right"}`}
                dir="ltr"
              >
                <Phone size={16} className="text-white" />{" "}
                <span
                  className="font-sans tracking-wider whitespace-nowrap text-[12px] font-bold editable"
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                >
                  +
                  {String(
                    currentCompany?.phoneNumber || "966 50 123 4567",
                  ).replace(/^0+/, "")}
                </span>
              </div>
              <div
                className={`flex items-center gap-2 ${swapHeader ? "flex-row-reverse text-left" : "text-right"}`}
              >
                <Mail size={16} className="text-white" />{" "}
                <span
                  className="font-sans tracking-wider whitespace-nowrap text-[11px] editable font-bold"
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                >
                  {currentCompany?.email || "info@company.com"}
                </span>
              </div>
              <div
                className={`flex items-center gap-2 ${swapHeader ? "flex-row-reverse text-left" : "text-right"}`}
              >
                <MapPin size={16} className="text-white" />{" "}
                <span
                  className="whitespace-nowrap text-[11px] editable font-bold"
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                >
                  {currentCompany?.address ||
                    "الرياض - المملكة العربية السعودية"}
                </span>
              </div>
              <div
                className={`flex items-center gap-3 ${swapHeader ? "flex-row-reverse text-left" : "text-right"}`}
                style={{ order: -1 }}
              >
                <div className="text-[12px] font-bold leading-tight" style={{ marginTop: "11px" }}>
                  <span
                    className="editable whitespace-nowrap text-[#cdb26a]"
                    contentEditable={!readOnly}
                    suppressContentEditableWarning
                  >
                    {currentCompany?.name || "اسم الشركة"}
                  </span>
                </div>
                <Car size={26} className="text-[#cdb26a]" />
              </div>
            </div>


          </div>
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg">التقاط صورة للزبون</h3>
              <button
                onClick={stopCamera}
                className="text-red-500 hover:text-red-700 font-bold p-2 text-xl"
              >
                ✕
              </button>
            </div>
            <div className="relative bg-black rounded-lg overflow-hidden flex flex-col justify-center items-center h-[300px]">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              ></video>
              <canvas ref={canvasRef} className="hidden"></canvas>
            </div>
            <div className="flex gap-4 justify-center mt-2">
              <button
                onClick={captureImage}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition text-lg"
              >
                📸 التقاط الصورة
              </button>
              <button
                onClick={stopCamera}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-xl transition text-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
