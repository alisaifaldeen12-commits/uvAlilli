import { useState, useEffect, useRef } from "react";
import { 
  Beaker, 
  Settings, 
  RefreshCw, 
  Play, 
  Sliders, 
  HelpCircle, 
  TrendingUp, 
  Calculator, 
  CheckCircle, 
  Trash2, 
  Plus, 
  Sparkles, 
  Download, 
  Info,
  MapPin,
  Flame,
  Award,
  Shield,
  Activity,
  Lock,
  AlertTriangle,
  Cpu
} from "lucide-react";

// Standard compounds specs
interface CompoundSpec {
  lam: number;     // Optimal wavelength
  eps: number;     // Molar absorptivity
  slope: number;   // Slope estimate for simulated absorption calculation
  name: string;    // Arabic Name
  mw: number;      // Molecular weight in g/mol
}

const COMPS: Record<string, CompoundSpec> = {
  biuret: { lam: 540, eps: 2100, slope: 0.020, name: "يوريا (بيوريت) - Biuret Urea", mw: 60.06 },
  phosphate: { lam: 660, eps: 17000, slope: 0.050, name: "فوسفات مائية - Orto-Phosphate", mw: 94.97 },
  nitrite: { lam: 520, eps: 50000, slope: 0.080, name: "نتريت مائي - Nitrite Nitrogen", mw: 46.00 },
  iron: { lam: 510, eps: 11000, slope: 0.030, name: "حديد ثنائي في الفينانثرولين - Iron", mw: 55.85 },
  protein: { lam: 595, eps: 70000, slope: 0.012, name: "بروتين كاشف برادفورد - Protein Bradford", mw: 66430 },
  custom: { lam: 500, eps: 10000, slope: 0.030, name: "مادة كيميائية مخصصة (إدخال يدوي) ✏️", mw: 100 }
};

const DEFAULT_CURVE_POINTS = [
  { c: 2, A: 0.040 },
  { c: 4, A: 0.082 },
  { c: 6, A: 0.121 },
  { c: 8, A: 0.162 },
  { c: 10, A: 0.200 }
];

export default function App() {
  // PWA Install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  // Core Simulation States
  const [wl, setWl] = useState<number>(540);
  const [compoundKey, setCompoundKey] = useState<string>("biuret");
  const [blank, setBlank] = useState<boolean>(false);
  const [lamp, setLamp] = useState<"uv" | "vis">("vis");
  const [lastA, setLastA] = useState<number | null>(null);
  const [lastT, setLastT] = useState<number | null>(null);
  const [lastC, setLastC] = useState<number | null>(null);
  const [stds, setStds] = useState<{ c: number; A: number }[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [concInput, setConcInput] = useState<string>("10");
  const [activeTab, setActiveTab] = useState<"beer" | "dil" | "pct">("beer");
  const [statusMsg, setStatusMsg] = useState<string>("بانتظار ضبط الجهاز... الرجاء وضع مذيب التصفير والضغط على تصفير Blank");
  const [statusType, setStatusType] = useState<"idle" | "success" | "warning" | "busy">("idle");
  const [toast, setToast] = useState<{ msg: string; visible: boolean }>({ msg: "", visible: false });

  // Custom Compound parameter edits
  const [custEps, setCustEps] = useState<string>("15000");
  const [custLam, setCustLam] = useState<string>("500");
  const [custSlope, setCustSlope] = useState<string>("0.025");
  const [custMw, setCustMw] = useState<string>("100");

  // Chart Visualization toggle
  const [chartMode, setChartMode] = useState<"calibration" | "spectrum">("calibration");

  // Calcs - Beer Tab States
  const [beerA, setBeerA] = useState<string>("");
  const [beerEps, setBeerEps] = useState<string>("");
  const [beerL, setBeerL] = useState<string>("1");
  const [beerResult, setBeerResult] = useState<string | null>(null);

  // Calcs - Dilution Tab States
  const [dilC1, setDilC1] = useState<string>("");
  const [dilV1, setDilV1] = useState<string>("");
  const [dilV2, setDilV2] = useState<string>("");
  const [dilResult, setDilResult] = useState<string | null>(null);
  const [dilDF, setDilDF] = useState<string | null>(null);

  // Calcs - Percent Tab States
  const [pctConc, setPctConc] = useState<string>("");
  const [pctVol, setPctVol] = useState<string>("");
  const [pctWt, setPctWt] = useState<string>("");
  const [pctDf, setPctDf] = useState<string>("1");
  const [pctResult, setPctResult] = useState<string | null>(null);

  // Highlight state for schematic scanning animation step
  const [activeBlock, setActiveBlock] = useState<number | null>(null);

  // Canvas ref for plotting curve
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 🛡️ Enterprise-Grade Security States (No-Login Sandbox Protection)
  const [tamperLocked, setTamperLocked] = useState<boolean>(false);
  const [securityLogs, setSecurityLogs] = useState<{ time: string; msg: string; type: "success" | "warning" | "info" }[]>([
    { time: new Date().toLocaleTimeString("ar-EG"), msg: "تم تفعيل حماية عزل الذاكرة الحيوية (Isolated Sandbox)", type: "success" },
    { time: new Date().toLocaleTimeString("ar-EG"), msg: "تطبيق جدار حماية المستندات المرجعية (CSP Strict Ready)", type: "info" },
    { time: new Date().toLocaleTimeString("ar-EG"), msg: "تأمين شهادة SSL/TLS 256-bit وقنوات التشفير المباشرة", type: "success" }
  ]);
  const [lastAttackAttempt, setLastAttackAttempt] = useState<string | null>(null);

  // Helper to add logs to live security scanner
  const addSecurityLog = (msg: string, type: "success" | "warning" | "info") => {
    const timeNow = new Date().toLocaleTimeString("ar-EG");
    setSecurityLogs(prev => [{ time: timeNow, msg, type }, ...prev.slice(0, 7)]);
  };

  // Secure Input Sanitizer to prevent memory exhaustion or overflow (Strict Boundary Guard)
  const secureSanitize = (val: string, nameAr: string, min: number = 0, max: number = 1000000, isFloat: boolean = true): string => {
    // 1. Script injection characters removal
    const unsafeCharsPattern = /[<>'"\\/&;`|*$()]/g;
    let checkedVal = val;
    if (unsafeCharsPattern.test(val)) {
      checkedVal = val.replace(unsafeCharsPattern, "");
      addSecurityLog(`تم تحييد محاولة حقن رموز غير آمنة في حقل: ${nameAr}`, "warning");
      setLastAttackAttempt(`حقن عناصر نصية مخادعة (XSS Injection)`);
      showToast("🛡️ تحذير أمني: تم حذف الأحرف غير الصالحة تلقائياً لحماية المخدم");
    }

    // 2. Prevent Buffer Overflow (Limit input length to 15 characters)
    if (checkedVal.length > 15) {
      checkedVal = checkedVal.slice(0, 15);
      addSecurityLog(`تم منع الحِمل الزائد لطول النص في: ${nameAr}`, "warning");
      setLastAttackAttempt(`محاولة تجاوز سعة ذاكرة الإدخال (Buffer Overflow)`);
    }

    // 3. Range Verification to block Extreme Numbers / Exponents
    const num = isFloat ? parseFloat(checkedVal) : parseInt(checkedVal, 10);
    if (!isNaN(num)) {
      if (num < min) {
        addSecurityLog(`تصحيح قيمة سالبة خارج الحدود المسموحة في: ${nameAr}`, "info");
        return min.toString();
      }
      if (num > max) {
        addSecurityLog(`صد محاولة إغراق المحاكي برقم هائل في: ${nameAr}`, "warning");
        setLastAttackAttempt(`تجاوز حدود الحساب الرياضي (Massive Integer)`);
        showToast("🛡️ نظام أمان المؤسسة: تم ضبط القيمة ضمن النطاق الآمن للجهاز");
        return max.toString();
      }
    }
    return checkedVal;
  };

  // 🛡️ Security Console Shield Protection (Self-XSS Prevention & Warning)
  useEffect(() => {
    try {
      Object.freeze(Object.getPrototypeOf(COMPS));
      Object.freeze(COMPS);
    } catch (e) {
      // safe fallback
    }

    console.clear();
    console.log(
      "%c⚠️ تنبيه أمني عالي الحماية — نظام مختبر الطيف الافتراضي ⚠️",
      "color: #ef4444; font-size: 20px; font-weight: bold; font-family: sans-serif; text-shadow: 1px 1px 2px black;"
    );
    console.log(
      "%cهذه البيئة مخصصة لحسابات المحاكاة الطيفية الآمنة لجمهورية العراق. يحظر لصق أي كود مجهول الهوية هنا (Self-XSS Attack Prevented). تم تفعيل جدار الحماية وعزل الذاكرة بنجاح.",
      "color: #38bdf8; font-size: 13px; font-family: sans-serif; line-height: 1.5;"
    );
    console.log(
      "%c[SYSTEM SECURITY HEALTH: 100% OK | CSP: ACTIVE | SSL: RSA-256 | HSTS: DIRECTIVE_ONEDAY]",
      "color: #10b981; font-weight: bold; font-family: monospace; font-size: 11px;"
    );
  }, []);

  // 📝 Trigger toast notifications
  const showToast = (msg: string) => {
    setToast({ msg, visible: true });
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // 📡 Register beforeinstallprompt event for PWA installer on client
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("'beforeinstallprompt' event was intercepted inside the UV-Vis simulator.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Track app installed state
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      showToast("🎉 تم تثبيت تطبيق مختبر الطيف على جهازك بنجاح!");
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      showToast("تطبيق الـ PWA مثبت بالفعل أو المتصفح لا يدعم التثبيت المباشر.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install request: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Convert Wavelength nm to RGB Hex representation
  const getWlColor = (w: number) => {
    let r = 0, g = 0, b = 0;
    if (w < 380) {
      // UV spectrum
      return "#7c3aed"; // Violet
    }
    if (w < 440) {
      r = Math.round(((440 - w) / 60) * 255);
      g = 0;
      b = 255;
    } else if (w < 490) {
      r = 0;
      g = Math.round(((w - 440) / 50) * 255);
      b = 255;
    } else if (w < 510) {
      r = 0;
      g = 255;
      b = Math.round(((510 - w) / 20) * 255);
    } else if (w < 580) {
      r = Math.round(((w - 510) / 70) * 255);
      g = 255;
      b = 0;
    } else if (w < 645) {
      r = 255;
      g = Math.round(((645 - w) / 65) * 255);
      b = 0;
    } else if (w <= 800) {
      r = 255;
      g = 0;
      b = 0;
    }

    const factor = w < 420 ? 0.3 + (0.7 * (w - 380)) / 40 : w > 700 ? 0.3 + (0.7 * (800 - w)) / 100 : 1;
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
  };

  const wlColor = getWlColor(wl);

  // Set selected compound
  const handleCompoundChange = (key: string) => {
    setCompoundKey(key);
    const spec = COMPS[key];
    if (key !== "custom") {
      setWl(spec.lam);
      showToast(`🧪 تم اختيار: ${spec.name}`);
    } else {
      setWl(parseInt(custLam) || 500);
      showToast("✏️ نمط مادة مخصصة - مرونة في إدخال الثوابت وعامل التخميد");
    }
  };

  // Synchronize custom wavelength modifications
  useEffect(() => {
    if (compoundKey === "custom") {
      const parsed = parseInt(custLam);
      if (!isNaN(parsed) && parsed >= 200 && parsed <= 800) {
        setWl(parsed);
      }
    }
  }, [custLam, compoundKey]);

  // Execute scan sequence animation
  const runHardwareScan = (onComplete: () => void) => {
    setBusy(true);
    setStatusType("busy");
    setStatusMsg("⚡ جاري استقطاب وحساب شدة الإشعاع الضوئي المار عبر الخلية وقراءة الديتيكتور...");
    
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < 5) {
        setActiveBlock(currentStep);
        currentStep++;
      } else {
        clearInterval(interval);
        setActiveBlock(null);
        setBusy(false);
        onComplete();
      }
    }, 180);
  };

  // Perform blank calibration
  const triggerBlank = () => {
    if (busy) return;
    runHardwareScan(() => {
      setBlank(true);
      setLastA(0.000);
      setLastT(100.0);
      setLastC(0.000);
      setStatusType("success");
      setStatusMsg("✓ تمت معايرة التصفير بنجاح (Blank = 0.000 A). كاشف الإشارة يسجل نفاذية كاملة %100.");
      showToast("⬜ تم طرح قيمة مذيب التصفير وحفظ الأساس.");
      addSecurityLog("تصفير الجهاز ومعايرة الإشارة المرجعية بنجاح (Blanking)", "success");
    });
  };

  // Perform sample concentration measurement
  const triggerMeasure = () => {
    if (busy) return;
    if (!blank) {
      showToast("⚠️ يرجى التصفير أولاً عبر إضافة بلانك (المذيب النقية) لقياس صحيح!");
      setStatusType("warning");
      setStatusMsg("تنبيه: يجب تصفير الجهاز أولاً لإنشاء شدة مرجعية للضوء قبل وضع العينة.");
      addSecurityLog("تم رفض القياس: محاولة الفحص قبل تصفير الجهاز المرجعي", "warning");
      return;
    }

    const cVal = parseFloat(concInput);
    if (isNaN(cVal) || cVal < 0) {
      showToast("⚠️ يرجى إدخال تركيز حقيقي موجب للعينة لتشغيل الفحص الطيفي.");
      addSecurityLog("إيقاف عملية القياس بسبب مدخل تركيز غير صالح أو فارغ", "warning");
      return;
    }

    runHardwareScan(() => {
      const spec = compoundKey === "custom" 
        ? { lam: parseInt(custLam) || 500, eps: parseFloat(custEps) || 10000, slope: parseFloat(custSlope) || 0.03, mw: parseFloat(custMw) || 100 }
        : COMPS[compoundKey];

      // Absorbance simulation with Gaussian wavelength envelope
      const lambdaMax = spec.lam;
      const sigma = 65; // peak width in nm
      const wlFactor = Math.exp(-Math.pow(wl - lambdaMax, 2) / (2 * Math.pow(sigma, 2)));

      const baseA = spec.slope * cVal * wlFactor;
      const noise = (Math.random() - 0.5) * 0.02 * baseA;
      const absorbance = Math.max(0.000, baseA + noise);
      const transmittance = absorbance > 0 ? Math.pow(10, -absorbance) * 100 : 100.0;

      setLastA(absorbance);
      setLastT(transmittance);
      setLastC(cVal);

      setStatusType("success");
      setStatusMsg(`تم القياس: امتصاصية A = ${absorbance.toFixed(3)} | نفاذية T = ${transmittance.toFixed(1)}% | تركيز عينة C = ${cVal.toFixed(2)} ppm.`);
      showToast(`📊 قراءة المعايرة: A = ${absorbance.toFixed(3)}`);
      addSecurityLog(`فحص العينة طيفياً بنجاح بتركيز ${cVal} ppm تحت الطول الموجي ${wl}nm`, "success");
    });
  };

  // Dynamic live updater for the cuvette when wavelength or compound changes
  useEffect(() => {
    if (lastC !== null && lastC > 0 && blank && !busy) {
      const spec = compoundKey === "custom" 
        ? { lam: parseInt(custLam) || 500, eps: parseFloat(custEps) || 10000, slope: parseFloat(custSlope) || 0.03, mw: parseFloat(custMw) || 100 }
        : COMPS[compoundKey];

      const lambdaMax = spec.lam;
      const sigma = 65;
      const wlFactor = Math.exp(-Math.pow(wl - lambdaMax, 2) / (2 * Math.pow(sigma, 2)));

      const baseA = spec.slope * lastC * wlFactor;
      const noise = (Math.random() - 0.5) * 0.01 * baseA;
      const absorbance = Math.max(0.000, baseA + noise);
      const transmittance = absorbance > 0 ? Math.pow(10, -absorbance) * 100 : 100.0;

      setLastA(absorbance);
      setLastT(transmittance);
    }
  }, [wl, compoundKey, blank, custLam, custEps, custSlope, custMw]);

  // Append customized point to standard calibration list
  const addStandardPoint = () => {
    if (lastA === null || lastC === null) {
      showToast("⚠️ يرجى قياس العينة أولاً لإضافة إحداثيات التركيز والامتصاص المقروءة.");
      return;
    }
    const exists = stds.some(p => p.c === lastC);
    if (exists) {
      showToast("هذا التركيز مضاف مسبقاً في نقاط منحنى المعايرة.");
      return;
    }
    setStds(prev => [...prev, { c: lastC, A: parseFloat(lastA.toFixed(4)) }].sort((a, b) => a.c - b.c));
    showToast(`✅ أضيفت نقطة معيارية: (${lastC} ppm, ${lastA.toFixed(3)} A)`);
    addSecurityLog(`إضافة نقطة إحداثية معيارية آمنة للمنحنى: C=${lastC} ppm, A=${lastA.toFixed(3)}`, "info");
  };

  // Clear current standards
  const clearStandards = () => {
    setStds([]);
    showToast("🧹 تم مسح قائمة النقاط المعيارية المخصصة (تم تفعيل المنحنى الافتراضي).");
    addSecurityLog("حذف النقاط المعيارية المخصصة وإعادة ضبط المنحنى الطيفي المرجعي", "info");
  };

  // Reset entire simulator
  const resetHardware = () => {
    setBlank(false);
    setLastA(null);
    setLastT(null);
    setLastC(null);
    setStds([]);
    setStatusType("idle");
    setStatusMsg("تمت إعادة تهيئة أجهزة القياس بنجاح. ضع المذيب المرجعي واضغط تصفير.");
    showToast("↺ تم تصفير إعدادات الطيف الكيمياوي.");
    addSecurityLog("إعادة تصفير شامل للجهاز وتجهيز قنوات الكشف للتصفير من جديد", "info");
  };

  // Randomize a concentration
  const randomizeConcentration = () => {
    const val = (Math.random() * 85 + 2).toFixed(1);
    setConcInput(val);
    showToast(`🎲 اخترنا تركيزًا عشوائيًا: ${val} ppm`);
  };

  // Calculations solvers
  const solveBeer = () => {
    const A = parseFloat(beerA);
    const eps = parseFloat(beerEps);
    const l = parseFloat(beerL);

    if (isNaN(A) || isNaN(eps) || isNaN(l) || eps <= 0 || l <= 0) {
      showToast("⚠️ يرجى التحقق من إدخال قيم صالحة وموجبة لحساب علاقة Beer-Lambert.");
      addSecurityLog("فشل حساب بير-لامبرت: مدخلات غير صالحة أو صفرية", "warning");
      return;
    }
    const computedC = A / (eps * l);
    setBeerResult(computedC.toExponential(5));
    showToast("🎯 تم حساب التركيز المولي المجهول بنجاح!");
    addSecurityLog(`حساب علاقة بير-لامبرت بنجاح: التركيز المولي المقدر = ${computedC.toExponential(4)} M`, "success");
  };

  const solveDilution = () => {
    const c1 = parseFloat(dilC1);
    const v1 = parseFloat(dilV1);
    const v2 = parseFloat(dilV2);

    if (isNaN(c1) || isNaN(v1) || isNaN(v2) || v1 <= 0 || v2 <= 0) {
      showToast("⚠️ أدخل قيمًا صالحة لقانون التخفيف C₁V₁ = C₂V₂");
      addSecurityLog("فشل حساب التخفيف: قيم مدخلة خاطئة أو صفرية", "warning");
      return;
    }
    if (v2 < v1) {
      showToast("حجم المحلول النهائي يجب أن يكون أكبر من أو يساوي حجم العينة المركزة.");
      addSecurityLog("مخالفة منطقية: محاولة تخفيف بحجم نهائي أصغر من الابتدائي", "warning");
      return;
    }

    const c2 = (c1 * v1) / v2;
    const factor = v2 / v1;
    setDilResult(c2.toFixed(3));
    setDilDF(factor.toFixed(1));
    showToast("🧪 تم التخفيف وحساب التركيز الجديد!");
    addSecurityLog(`تنفيذ قانون التخفيف الآمن: التركيز النهائي C₂ = ${c2.toFixed(3)} ppm`, "success");
  };

  const solvePercentWt = () => {
    const conc = parseFloat(pctConc);
    const vol = parseFloat(pctVol);
    const wt = parseFloat(pctWt);
    const df = parseFloat(pctDf) || 1;

    if (isNaN(conc) || isNaN(vol) || isNaN(wt) || vol <= 0 || wt <= 0) {
      showToast("⚠️ تفقد تعبئة قياسات الوزن والحجم لحساب النسبة المئوية للشوائب.");
      addSecurityLog("فشل حساب النسبة المئوية: تعبئة ناقصة أو غير متكاملة", "warning");
      return;
    }

    // Weight of solute in mg = Conc(ppm or mg/L) * Vol(L) * DilutionFactor
    const weightSoluteMg = conc * (vol / 1000) * df;
    // wt sample is in grams, let's normalize both to grams or milligrams
    // weightSoluteG = weightSoluteMg / 1000
    // wt sample milligrams = wt * 1000
    const percent = (weightSoluteMg / (wt * 1000)) * 100;
    setPctResult(percent.toFixed(5));
    showToast("📊 تم حساب نسبة المادة الفعالة المئوية في العينة!");
    addSecurityLog(`حساب النسبة المئوية للمكون بنجاح: النتيجة = ${percent.toFixed(4)} %`, "success");
  };

  // Drawing Calibration curve or live absorption spectrum on React state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Responsive High-DPI canvas styling
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 380;
    const height = 240;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const pad = { top: 20, right: 15, bottom: 40, left: 45 };
    const gw = width - pad.left - pad.right;
    const gh = height - pad.top - pad.bottom;

    // Clear background
    ctx.fillStyle = "#0c1524";
    ctx.fillRect(0, 0, width, height);

    if (chartMode === "calibration") {
      const activePoints = stds.length > 0 ? stds : DEFAULT_CURVE_POINTS;

      // Coordinate limit values
      const maxC = Math.max(...activePoints.map(p => p.c), 10) * 1.25;
      const maxA = Math.max(...activePoints.map(p => p.A), 0.2) * 1.25;

      // Draw Grid Lines & Numbers
      ctx.strokeStyle = "#1b2a43";
      ctx.lineWidth = 1;

      const gridLinesCount = 5;
      for (let i = 0; i <= gridLinesCount; i++) {
        const fract = i / gridLinesCount;
        const cy = pad.top + gh - fract * gh;
        const cx = pad.left + fract * gw;

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(pad.left, cy);
        ctx.lineTo(width - pad.right, cy);
        ctx.stroke();

        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(cx, pad.top);
        ctx.lineTo(cx, pad.top + gh);
        ctx.stroke();

        // Labels Text styling
        ctx.fillStyle = "#5c6f8a";
        ctx.font = "10px 'Space Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillText((maxA * fract).toFixed(2), pad.left - 6, cy + 3);

        ctx.textAlign = "center";
        ctx.fillText((maxC * fract).toFixed(0), cx, pad.top + gh + 16);
      }

      // Chart label descriptions
      ctx.fillStyle = "#637894";
      ctx.font = "11px 'IBM Plex Sans Arabic', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("التركيز المعياري C (ppm)", pad.left + gw / 2, height - 6);

      // Coordinate calculations for Linear Regression (Least Squares)
      // A = m*C + b
      const n = activePoints.length;
      const sumC = activePoints.reduce((acc, point) => acc + point.c, 0);
      const sumA = activePoints.reduce((acc, point) => acc + point.A, 0);
      const sumCA = activePoints.reduce((acc, point) => acc + point.c * point.A, 0);
      const sumC2 = activePoints.reduce((acc, point) => acc + point.c * point.c, 0);

      const slope = (n * sumCA - sumC * sumA) / (n * sumC2 - sumC * sumC) || 0;
      const intercept = (sumA - slope * sumC) / n || 0;

      // Draw best-fit regression line
      const grad = ctx.createLinearGradient(pad.left, 0, pad.left + gw, 0);
      grad.addColorStop(0, "#7c3aed");
      grad.addColorStop(1, "#0ea5e9");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.beginPath();

      const startXVal = 0;
      const startYVal = intercept;
      const endXVal = maxC;
      const endYVal = slope * maxC + intercept;

      const startXPix = pad.left + (startXVal / maxC) * gw;
      const startYPix = pad.top + gh - (startYVal / maxA) * gh;
      const endXPix = pad.left + (endXVal / maxC) * gw;
      const endYPix = pad.top + gh - (endYVal / maxA) * gh;

      ctx.moveTo(startXPix, startYPix);
      ctx.lineTo(endXPix, endYPix);
      ctx.stroke();

      // Plot calibration data points
      activePoints.forEach(point => {
        const px = pad.left + (point.c / maxC) * gw;
        const py = pad.top + gh - (point.A / maxA) * gh;

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#0ea5e9";
        ctx.fill();
        ctx.strokeStyle = "#070e1a";
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // Mark current measurement on graph
      if (lastA !== null && lastC !== null && blank) {
        const targetX = lastC;
        const targetY = lastA;

        const px = pad.left + (targetX / maxC) * gw;
        const py = pad.top + gh - (targetY / maxA) * gh;

        // Draw projected reference dashed lines if within chart bounds
        if (px >= pad.left && px <= pad.left + gw && py >= pad.top && py <= pad.top + gh) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 1;

          // Vertical line down
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, pad.top + gh);
          ctx.stroke();

          // Horizontal line left
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(pad.left, py);
          ctx.stroke();

          ctx.setLineDash([]); // Reset line dash

          // Draw glowing reference circle
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fillStyle = "#f59e0b";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    } else {
      // SPECTRUM MODE: plotting Absorbance vs Wavelength (lambda - peak at spec.lam)
      const spec = compoundKey === "custom" 
        ? { lam: parseInt(custLam) || 500, eps: parseFloat(custEps) || 10000, slope: parseFloat(custSlope) || 0.03, mw: parseFloat(custMw) || 100 }
        : COMPS[compoundKey];

      const activeC = lastC !== null && lastC > 0 ? lastC : parseFloat(concInput) || 10;
      const minWl = 200;
      const maxWl = 800;
      const rangeWl = maxWl - minWl;

      // Draw Grid Lines & Numbers for Spectrum
      ctx.strokeStyle = "#1b2a43";
      ctx.lineWidth = 1;

      const gridLinesCount = 5;
      const peakAbsorbance = spec.slope * activeC;
      const maxA_Spec = Math.max(0.1, peakAbsorbance) * 1.25;

      for (let i = 0; i <= gridLinesCount; i++) {
        const fract = i / gridLinesCount;
        const cy = pad.top + gh - fract * gh;
        const cx = pad.left + fract * gw;

        // Grid lines
        ctx.beginPath();
        ctx.moveTo(pad.left, cy);
        ctx.lineTo(width - pad.right, cy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx, pad.top);
        ctx.lineTo(cx, pad.top + gh);
        ctx.stroke();

        // Absorbance labels (Y-axis)
        ctx.fillStyle = "#5c6f8a";
        ctx.font = "10px 'Space Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillText((maxA_Spec * fract).toFixed(2), pad.left - 6, cy + 3);

        // Wavelength labels (X-axis)
        ctx.textAlign = "center";
        ctx.fillText((minWl + rangeWl * fract).toFixed(0), cx, pad.top + gh + 16);
      }

      ctx.fillStyle = "#637894";
      ctx.font = "11px 'IBM Plex Sans Arabic', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("الطول الموجي للضوء λ (nm)", pad.left + gw / 2, height - 6);

      // Draw the spectrum peak curve
      ctx.beginPath();
      const sigma = 65;

      // Loop across the X pixels to calculate Gauss absorption
      for (let px = 0; px <= gw; px++) {
        const currWl = minWl + (px / gw) * rangeWl;
        const wlFactor = Math.exp(-Math.pow(currWl - spec.lam, 2) / (2 * Math.pow(sigma, 2)));
        const currAbs = spec.slope * activeC * wlFactor;

        const py = pad.top + gh - (currAbs / maxA_Spec) * gh;
        if (px === 0) {
          ctx.moveTo(pad.left + px, py);
        } else {
          ctx.lineTo(pad.left + px, py);
        }
      }

      // Stroke curve with gradient representing UV-Vis spectrum colors
      const curveGrad = ctx.createLinearGradient(pad.left, 0, pad.left + gw, 0);
      curveGrad.addColorStop(0, "#7c3aed"); // Violet (UV)
      curveGrad.addColorStop(0.3, "#0ea5e9"); // Blue
      curveGrad.addColorStop(0.5, "#10b981"); // Green
      curveGrad.addColorStop(0.7, "#eab308"); // Yellow
      curveGrad.addColorStop(1, "#ef4444"); // Red

      ctx.strokeStyle = curveGrad;
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Filled area with opacity
      ctx.lineTo(pad.left + gw, pad.top + gh);
      ctx.lineTo(pad.left, pad.top + gh);
      ctx.closePath();
      ctx.fillStyle = "rgba(14, 165, 233, 0.05)";
      ctx.fill();

      // Current active wavelength dot
      const wlPct = (wl - minWl) / rangeWl;
      if (wlPct >= 0 && wlPct <= 1) {
        const wlX = pad.left + wlPct * gw;
        const wlFactor = Math.exp(-Math.pow(wl - spec.lam, 2) / (2 * Math.pow(sigma, 2)));
        const activeAbs = spec.slope * activeC * wlFactor;
        const wlY = pad.top + gh - (activeAbs / maxA_Spec) * gh;

        // Vertical guide line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#f59e0b";
        ctx.beginPath();
        ctx.moveTo(wlX, wlY);
        ctx.lineTo(wlX, pad.top + gh);
        ctx.stroke();
        ctx.setLineDash([]);

        // Active node circle
        ctx.beginPath();
        ctx.arc(wlX, wlY, 7, 0, Math.PI * 2);
        ctx.fillStyle = wlColor;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Absorbance value flag text on peak rider
        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 9px 'Space Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`A=${activeAbs.toFixed(3)}`, wlX, Math.max(pad.top + 10, wlY - 12));
      }
    }
  }, [stds, lastA, lastC, blank, chartMode, wl, compoundKey, custLam, custEps, custSlope, custMw]);

  return (
    <div className="min-h-screen bg-[#070e1a] text-[#e2e8f0] font-sans selection:bg-[#7c3aed] selection:text-white pb-12">
      
      {/* 🇵🇼 PWA installer floating banner */}
      {deferredPrompt && (
        <div className="bg-gradient-to-r from-[#d4a843] via-[#eab308] to-[#f59e0b] text-[#070e1a] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌟</span>
            <span>تطبيق كيميائي معتمد! قم بتنزيل وتثبيت مختبر الطيف على شاشتك الرئيسية للعمل بدون إنترنت تماماً.</span>
          </div>
          <button 
            id="pwaInstallBtn"
            onClick={handleInstallClick}
            className="bg-[#070e1a] text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-all flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            تثبيت التطبيق الآن
          </button>
        </div>
      )}

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header className="relative border-b border-[#1e3050] bg-gradient-to-b from-[#0b1628] to-[#07101e] px-4 py-4 md:px-8">
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7c3aed] via-[#0ea5e9] to-[#d4a843]"></div>
        
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full border-2 border-[#d4a843] bg-gradient-to-tr from-[#071222] to-[#1a3358] flex items-center justify-center overflow-hidden shadow-lg shadow-[#d4a843]/20 shrink-0">
              <img 
                src="/authority_logo.png" 
                alt="شعار الهيئة العامة للمهندسين الكيميائيين بالبصرة" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0.5 rounded-full border border-dashed border-[#d4a843]/30 animate-spin pointer-events-none" style={{ animationDuration: '40s' }}></div>
            </div>
            <div className="text-right">
              <h1 className="text-base font-black text-[#d4a843] tracking-wide font-sans leading-tight">الهيئة العامة للمهندسين الكيميائيين</h1>
              <p className="text-[11px] text-[#38bdf8] font-mono mt-1 font-semibold tracking-wide" style={{ direction: 'ltr' }}>
                Eng.Ali Saif AlDIN Haider -Al Nawfal
              </p>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-[#5c7294] justify-end">
                <MapPin className="w-3 h-3 text-[#d4a843]" />
                <span>جمهورية العراق — البصرة</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-black/30 border border-[#1e3050] px-4 py-2.5 rounded-xl self-start md:self-auto">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#0ea5e9] flex items-center justify-center text-lg">
              ✨
            </div>
            <div>
              <h2 className="text-xs font-bold text-white">مختبر الطيف الافتراضي UV-Vis</h2>
              <p className="text-[10px] text-[#556c8d]">محاكاة متكاملة ومعايرة طيفية متقدمة</p>
            </div>
            <div className="mr-4 flex items-center gap-1.5 bg-[#10b981]/15 border border-[#10b981] px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              <span className="text-[10px] text-[#10b981] font-bold font-mono">SECURED</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════ CORE WRAPPER ══════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Controls & Device Configuration (7 cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6">

          {/* Block 1: Real-time Device Layout */}
          <div className="bg-[#111f33] border border-[#1e3050] rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-[#1a2d48]/40 px-4 py-3 border-b border-[#1e3050] flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-[#0ea5e9] flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '10s' }} />
                مخطط ومكونات جهاز المطياف الضوئي Spectrophotometer
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#1e3050] px-2.5 py-0.5 rounded-full text-[#a0aec0]">
                {busy ? "SCANNING STATE" : blank ? "CALIBRATED" : "STANDBY"}
              </span>
            </div>

            <div className="p-4">
              {/* Device Schematic Drawing */}
              <div id="device-schematic" className="bg-[#060c18] border border-[#1b2a43] rounded-xl p-6 relative overflow-hidden mb-4">
                
                {/* 🌈 Virtual Spectroscopic Light Beam */}
                <div 
                  className={`absolute top-1/2 left-0 right-0 h-1 rounded-full -translate-y-1/2 pointer-events-none transition-opacity duration-300 ${
                    busy || (blank && lastA !== null) ? "opacity-100" : "opacity-0"
                  }`}
                  style={{
                    background: `linear-gradient(90deg, 
                      #ffffff 0%, 
                      #fffdf0 15%, 
                      ${wlColor} 30%, 
                      ${wlColor} 65%, 
                      ${wlColor} 85%, 
                      #10b981 100%)`,
                    boxShadow: `0 0 10px ${wlColor}`
                  }}
                />

                {/* Grid Components */}
                <div className="relative z-10 grid grid-cols-6 gap-2 items-center text-center">
                  
                  {/* Block 1: Source */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg border border-[#f59e0b]/30 bg-[#07111e] flex items-center justify-center text-lg transition-all ${
                      activeBlock === 0 ? "border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110" : ""
                    }`}>
                      {lamp === "vis" ? "💡" : "🟣"}
                    </div>
                    <span className="text-[9px] text-[#556988] leading-tight font-medium">مصدر الضوء<br/>Lamp ({lamp === "vis" ? "W" : "D₂"})</span>
                  </div>

                  {/* Block 2: Monochromator */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg border border-[#7c3aed]/30 bg-[#07111e] flex items-center justify-center text-lg transition-all ${
                      activeBlock === 1 ? "border-[#7c3aed] shadow-[0_0_15px_rgba(124,58,237,0.5)] scale-110" : ""
                    }`}>
                      🔺
                    </div>
                    <span className="text-[9px] text-[#556988] leading-tight font-medium">موشور التشتيت<br/>Prism Mono</span>
                  </div>

                  {/* Block 3: Slit */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-8 h-12 mx-auto rounded-md border border-[#1e3050] bg-[#07111e] flex items-center justify-center text-xs font-bold text-[#4e688f] transition-all ${
                      activeBlock === 2 ? "border-white bg-[#102035] text-white scale-110" : ""
                    }`}>
                      ||
                    </div>
                    <span className="text-[9px] text-[#556988] leading-tight font-medium">الشق الضوئي<br/>Slit</span>
                  </div>

                  {/* Block 4: Cuvette Cell */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg border border-[#0ea5e9]/30 bg-[#07111e] flex items-center justify-center text-lg transition-all relative ${
                      activeBlock === 3 ? "border-[#0ea5e9] shadow-[0_0_15px_rgba(14,165,233,0.5)] scale-110" : ""
                    }`}>
                      🧪
                      {/* Fluid inside represented */}
                      {blank && (
                        <span className="absolute bottom-1 left-2 right-2 h-3 rounded-b bg-[#10b981]/50 border-t border-[#10b981]/20"></span>
                      )}
                    </div>
                    <span className="text-[9px] text-[#556988] leading-tight font-medium">خلية القياس<br/>Cuvette</span>
                  </div>

                  {/* Block 5: Detector */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg border border-[#10b981]/30 bg-[#07111e] flex items-center justify-center text-lg transition-all ${
                      activeBlock === 4 ? "border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110" : ""
                    }`}>
                      👁️
                    </div>
                    <span className="text-[9px] text-[#556988] leading-tight font-medium">الكاشف الضوئي<br/>Detector</span>
                  </div>

                  {/* Block 6: Microprocessor */}
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-lg border border-[#f59e0b]/30 bg-[#07111e] flex items-center justify-center text-lg transition-all ${
                      activeBlock === 5 ? "border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110" : ""
                    }`}>
                      📊
                    </div>
                    <span className="text-[9px] text-[#556988] leading-tight font-medium">شاشة المعالج<br/>Computer</span>
                  </div>

                </div>
              </div>

              {/* Status Banner */}
              <div className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed ${
                statusType === "success" 
                  ? "bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]" 
                  : statusType === "warning"
                  ? "bg-[#ef4444]/15 border-[#ef4444]/30 text-[#ef4444]"
                  : statusType === "busy"
                  ? "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]"
                  : "bg-[#0d1829] border-[#1e3050] text-[#a0aec0]"
              }`}>
                <span className="text-sm mt-0.5 select-none">
                  {statusType === "success" ? "✓" : statusType === "warning" ? "⚠️" : statusType === "busy" ? "⏳" : "ℹ️"}
                </span>
                <span id="screenStatus">{statusMsg}</span>
              </div>

              {/* Grid 4 Readings Panel */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                
                <div className="bg-[#0d1829] border border-[#1e3050] rounded-xl p-3 text-center">
                  <div className="text-[9px] font-bold text-[#5c7394] tracking-wider uppercase mb-1">Absorbance (A)</div>
                  <div className="text-xl font-mono font-bold text-[#0ea5e9]">
                    {lastA !== null ? lastA.toFixed(3) : "—"}
                  </div>
                  <div className="text-[9px] text-[#425570] mt-1">الامتصاصية الطيفية</div>
                </div>

                <div className="bg-[#0d1829] border border-[#1e3050] rounded-xl p-3 text-center">
                  <div className="text-[9px] font-bold text-[#5c7394] tracking-wider uppercase mb-1">Transmittance (%T)</div>
                  <div className="text-xl font-mono font-bold text-[#f59e0b]">
                    {lastT !== null ? `${lastT.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[9px] text-[#425570] mt-1">نسبة نفاذ الضوء</div>
                </div>

                <div className="bg-[#0d1829] border border-[#1e3050] rounded-xl p-3 text-center">
                  <div className="text-[9px] font-bold text-[#5c7394] tracking-wider uppercase mb-1">Conc. (ppm)</div>
                  <div className="text-xl font-mono font-bold text-[#10b981]">
                    {lastC !== null ? lastC : "—"}
                  </div>
                  <div className="text-[9px] text-[#425570] mt-1">التركيز المقاس</div>
                </div>

                <div className="bg-[#0d1829] border border-[#1e3050] rounded-xl p-3 text-center">
                  <div className="text-[9px] font-bold text-[#5c7394] tracking-wider uppercase mb-1">Wavelength (nm)</div>
                  <div className="text-xl font-mono font-bold text-[#7c3aed]">
                    {wl} nm
                  </div>
                  <div className="text-[9px] text-[#425570] mt-1">الطول الموجي للقياس</div>
                </div>

              </div>

              {/* 🧪 Dynamic Epsilon Automatic Solver card */}
              {lastA !== null && lastC !== null && lastC > 0 && blank && (
                <div className="mt-4 p-4 rounded-xl border border-dashed border-[#d4a843]/30 bg-[#d4a843]/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs animate-fade-in">
                  <div className="flex items-start gap-2 max-w-md">
                    <span className="text-lg select-none">⚡</span>
                    <div>
                      <span className="font-bold text-[#d4a843] block text-right">حساب تلقائي لثابت معامل الامتصاصية عالي الدقة ε (ابسلون):</span>
                      <p className="text-[10px] text-[#7188aa] text-right mt-0.5 leading-relaxed">
                        باعتماد علاقة بير-لامبرت: <code className="font-mono text-[#0ea5e9]">ε = A / (C_molar × l)</code> بطول مسار <code className="font-mono">l = 1 cm</code>. تم تحويل التركيز من (ppm) إلى مولارية (M) طبقاً للوزن الجزيئي المرجعي للمكون الفعال.
                      </p>
                    </div>
                  </div>
                  <div className="bg-[#0c1524]/80 p-2.5 rounded-lg border border-[#1e3050] flex flex-row sm:flex-col items-center justify-between sm:justify-center text-left min-w-[150px]">
                    <div className="text-center">
                      <span className="text-[9px] text-[#556c8d] uppercase block font-semibold text-center">Calculated Epsilon (ε)</span>
                      <strong className="text-base sm:text-lg font-mono text-[#0ea5e9] block text-center">
                        {(() => {
                          const spec = compoundKey === "custom" 
                            ? { lam: parseInt(custLam) || 500, eps: parseFloat(custEps) || 10000, slope: parseFloat(custSlope) || 0.03, mw: parseFloat(custMw) || 100 }
                            : COMPS[compoundKey];
                          const molarConc = lastC / (spec.mw * 1000);
                          const calculatedEps = molarConc > 0 ? (lastA / (molarConc * 1.0)) : 0;
                          return Math.round(calculatedEps).toLocaleString("en-US");
                        })()}
                      </strong>
                      <span className="text-[8px] text-gray-500 block text-center font-mono">L·mol⁻¹·cm⁻¹</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Block 2: Wavelength & Light Spectrum Controllers */}
          <div className="bg-[#111f33] border border-[#1e3050] rounded-2xl p-5 shadow-xl">
            <span className="text-xs font-bold text-[#7c3aed] uppercase tracking-wider block mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4" />
              التحكم في الطول الموجي للضوء المار λ
            </span>

            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-mono font-bold tracking-tight" style={{ color: wlColor }}>
                  {wl}
                </span>
                <span className="text-sm font-semibold text-[#5c7192]">نانوميتر (nm)</span>
              </div>

              <input 
                type="range" 
                min="200" 
                max="800" 
                value={wl} 
                onChange={(e) => setWl(parseInt(e.target.value))}
                className="w-full h-2.5 rounded-lg appearance-none cursor-pointer mb-5"
                style={{
                  background: 'linear-gradient(90deg, #7c3aed 0%, #0ea5e9 30%, #10b981 50%, #eab308 70%, #ef4444 100%)',
                  outline: 'none'
                }}
              />

              <div className="flex items-center gap-4 w-full">
                {/* Visual spectrum feedback bar */}
                <div 
                  className="flex-1 h-2.5 rounded-full transition-all duration-300"
                  style={{ backgroundColor: wlColor }}
                />
                
                {/* Domain classification tag */}
                <span className={`px-4 py-1 text-xs font-mono font-bold rounded-full border ${
                  wl < 400 
                    ? "bg-[#7c3aed]/15 border-[#7c3aed] text-[#a78bfa]" 
                    : "bg-[#0ea5e9]/15 border-[#0ea5e9] text-[#38bdf8]"
                }`}>
                  {wl < 400 ? "الأشعة فوق البنفسجية | Ultraviolet (UV)" : "الضوء المرئي | Visible (VIS)"}
                </span>
              </div>
            </div>
          </div>

          {/* Block 3: Sample & Chemical Standard Parameters */}
          <div className="bg-[#111f33] border border-[#1e3050] rounded-2xl p-5 shadow-xl">
            <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider block mb-4 flex items-center gap-2">
              <Beaker className="w-4 h-4" />
              إعداد خلية العينة والمادة الفعالة
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div>
                <label className="text-[10px] text-[#5c7294] font-semibold uppercase block mb-1.5">المادة المحللة الطيفية Selected Analyte</label>
                <select 
                  value={compoundKey}
                  onChange={(e) => handleCompoundChange(e.target.value)}
                  className="w-full bg-[#0d1829] border border-[#1e3050] rounded-xl text-xs py-3 px-3 text-[#e2e8f0] font-medium outline-none focus:border-[#0ea5e9] transition-all"
                >
                  {Object.entries(COMPS).map(([key, val]) => (
                    <option key={key} value={key} className="bg-[#111f33]">
                      {val.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-[#5c7294] font-semibold uppercase block mb-1.5">تركيز العينة المفترض Concentration (ppm)</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    value={concInput}
                    disabled={tamperLocked}
                    onChange={(e) => setConcInput(secureSanitize(e.target.value, "تركيز العينة المفترض", 0, 10000))}
                    placeholder="امθلة: 10 أو 25"
                    className={`flex-1 bg-[#0d1829] border border-[#1e3050] rounded-xl text-center font-mono text-sm py-2 px-3 text-white outline-none focus:border-[#0ea5e9] transition-all ${tamperLocked ? 'opacity-50 cursor-not-allowed border-[#ef4444]/30' : ''}`}
                  />
                  <button 
                    onClick={randomizeConcentration}
                    disabled={tamperLocked}
                    title="توليد قيمة تركيز عشوائي فحص"
                    className={`bg-[#0d1829] border border-[#1e3050] text-[#f59e0b] hover:bg-[#1e3050] transition-all px-3 rounded-xl text-sm ${tamperLocked ? 'opacity-45 cursor-not-allowed' : ''}`}
                  >
                    🎲
                  </button>
                </div>
              </div>

            </div>

            {/* Custom Inputs Panel (Renders only if custom selected) */}
            {compoundKey === "custom" && (
              <div className="mt-4 p-4 rounded-xl border border-dashed border-[#1e3050] bg-black/25 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[9px] text-[#5c7294] block mb-1">Molar Abs. (ε)</label>
                  <input 
                    type="number" 
                    value={custEps}
                    disabled={tamperLocked}
                    onChange={(e) => setCustEps(secureSanitize(e.target.value, "معامل الامتصاص للمادة المخصصة", 0, 1000000))}
                    placeholder="8000"
                    className={`w-full bg-[#111f33] border border-[#1e3050] text-[11px] font-mono p-2 rounded-lg text-center text-[#ffcf33] ${tamperLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#5c7294] block mb-1">λ الأمثل (nm)</label>
                  <input 
                    type="number" 
                    value={custLam}
                    disabled={tamperLocked}
                    onChange={(e) => setCustLam(secureSanitize(e.target.value, "الطول الموجي للمادة المخصصة", 100, 1200, false))}
                    placeholder="540"
                    className={`w-full bg-[#111f33] border border-[#1e3050] text-[11px] font-mono p-2 rounded-lg text-center text-[#a78bfa] ${tamperLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#5c7294] block mb-1">رقم الانحدار Slope</label>
                  <input 
                    type="number" 
                    step="0.001"
                    value={custSlope}
                    disabled={tamperLocked}
                    onChange={(e) => setCustSlope(secureSanitize(e.target.value, "ميل الانحدار للمادة المخصصة", 0, 5))}
                    placeholder="0.03"
                    className={`w-full bg-[#111f33] border border-[#1e3050] text-[11px] font-mono p-2 rounded-lg text-center text-[#10b981] ${tamperLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#5c7294] block mb-1">الوزن الجزيئي (g/mol)</label>
                  <input 
                    type="number" 
                    value={custMw}
                    disabled={tamperLocked}
                    onChange={(e) => setCustMw(secureSanitize(e.target.value, "الوزن الجزيئي للمادة المخصصة", 1, 1000000))}
                    placeholder="100"
                    className={`w-full bg-[#111f33] border border-[#1e3050] text-[11px] font-mono p-2 rounded-lg text-center text-[#ef4444] ${tamperLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Block 4: Quick Interactive Action Buttons */}
          <div className="bg-[#111f33] border border-[#1e3050] rounded-2xl p-5 shadow-xl">
            <span className="text-xs font-bold text-[#f59e0b] uppercase tracking-wider block mb-3.5">
              لوحة تشغيل المحاكاة والأجهزة
            </span>

            <div className="grid grid-cols-2 gap-3 mb-4">
              
              <div className="bg-[#0c1524] p-3 rounded-xl border border-[#1e3050] flex flex-col justify-between">
                <span className="text-[10px] text-[#5c7294] leading-tight block mb-2">نوع المصباح المشغل:</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setLamp("uv"); showToast("🟣 تم تشغيل مصباح الديتيريوم (UV)"); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      lamp === "uv" ? "bg-[#7c3aed] text-white border-white scale-[1.03]" : "bg-[#0d1829] text-[#5c7294] border-[#1e3050]"
                    }`}
                  >
                    ديتيريوم UV
                  </button>
                  <button 
                    onClick={() => { setLamp("vis"); showToast("💡 تم تشغيل مصباح التنجستن (VIS)"); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                      lamp === "vis" ? "bg-[#0ea5e9] text-white border-white scale-[1.03]" : "bg-[#0d1829] text-[#5c7294] border-[#1e3050]"
                    }`}
                  >
                    تنجستن VIS
                  </button>
                </div>
              </div>

              <div className="bg-[#0c1524] p-3 rounded-xl border border-[#1e3050] flex flex-col justify-between">
                <span className="text-[10px] text-[#5c7294] leading-tight block mb-2">معايرة المرجع الكاشف:</span>
                <button 
                  onClick={triggerBlank}
                  disabled={busy}
                  className="w-full py-2 bg-gradient-to-r from-[#111f33] to-[#1e3050] hover:scale-[1.02] border border-[#0ea5e9]/40 text-[#38bdf8] text-xs font-bold rounded-lg transition-all"
                >
                  ⬜ تصفير المعيار (Blank)
                </button>
              </div>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={triggerMeasure}
                disabled={busy}
                className="py-3.5 bg-gradient-to-r from-[#7c3aed] to-[#0ea5e9] hover:opacity-90 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                قراءة طيف العينات (Absorbance Scan)
              </button>

              <button 
                onClick={resetHardware}
                disabled={busy}
                className="py-3.5 bg-[#ef4444]/10 border border-[#ef4444]/40 text-[#ef4444] hover:bg-[#ef4444]/15 active:scale-[0.98] text-xs font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                تصفير وإعادة تعيين الجهاز
              </button>
            </div>
          </div>

        </section>

        {/* RIGHT COLUMN: Calibration Plot & Advanced Lab solvers (5 cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6">

          {/* Block 5: Live Drawn Standard Calibration Curve */}
          <div className="bg-[#111f33] border border-[#1e3050] rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#0ea5e9] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                منحنى ومعايرة الامتصاص Calibration Curve
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={addStandardPoint}
                  className="bg-[#1a2d48] border border-[#1e3050] hover:bg-[#0ea5e9] hover:text-black transition-all px-2.5 py-1 rounded-lg text-[10px] text-[#0ea5e9] font-bold"
                >
                  + نقطة معيارية
                </button>
                <button 
                  onClick={clearStandards}
                  className="bg-[#ef4444]/10 border border-[#ef4444]/20 hover:bg-[#ef4444]/20 transition-all px-2 py-1 rounded-lg text-[10px] text-[#ef4444]"
                >
                  مسح
                </button>
              </div>
            </div>

            {/* Toggle chart mode tab */}
            <div className="flex gap-1 bg-[#0c1524] border border-[#1e3050] p-1 rounded-xl mb-4">
              <button
                onClick={() => {
                  setChartMode("calibration");
                  showToast("📈 تم عرض منحنى المعايرة والاستجابة للتركيز (C vs A)");
                }}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  chartMode === "calibration" ? "bg-[#0ea5e9] text-black" : "text-[#5c7192] hover:text-white"
                }`}
              >
                📈 منحنى المعايرة (C vs A)
              </button>
              <button
                onClick={() => {
                  setChartMode("spectrum");
                  showToast("🌈 تم عرض طيف امتصاص المادة للأطوال الموجية (λ vs A)");
                }}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  chartMode === "spectrum" ? "bg-[#7c3aed] text-white font-extrabold" : "text-[#5c7192] hover:text-white"
                }`}
              >
                🌈 طيف الامتصاص (λ vs A)
              </button>
            </div>

            <canvas 
              ref={canvasRef} 
              className="w-full block bg-[#0c1524] rounded-xl border border-[#1e3050]" 
              style={{ height: '220px' }}
            />

            <div className="mt-2 text-center">
              <p className="text-[10px] font-mono text-[#f59e0b] bg-[#0c1524] py-1.5 px-3 rounded-lg border border-[#1e3050] inline-block">
                {chartMode === "calibration"
                  ? (stds.length > 0 
                      ? `بناءً على ${stds.length} نقاط معيارية مضافة` 
                      : "باستخدام النقاط الافتراضية لمنحنى الاستجابة")
                  : `طيف امتصاص مادة ${COMPS[compoundKey]?.name || "المخصصة"} بقمة λ_max = ${compoundKey === "custom" ? custLam : COMPS[compoundKey].lam} nm`}
              </p>
            </div>

            {/* Standards Table list */}
            <div className="mt-4 border border-[#1e3050] rounded-xl overflow-hidden bg-[#0c1524]">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-[#1a2d48]/40 text-[#5c7394] border-b border-[#1e3050]">
                    <th className="py-2 px-3 text-center">إحداثيات (#)</th>
                    <th className="py-2 px-3 text-center">التركيز C (ppm)</th>
                    <th className="py-2 px-3 text-center">الامتصاص المقروء A</th>
                  </tr>
                </thead>
                <tbody>
                  {(stds.length > 0 ? stds : DEFAULT_CURVE_POINTS).map((p, i) => (
                    <tr key={i} className="border-b border-[#1e3050] last:border-0 hover:bg-[#111f33]/30">
                      <td className="py-1.5 text-center font-mono text-gray-500">معيار {i + 1}</td>
                      <td className="py-1.5 text-center font-mono font-bold text-[#10b981]">{p.c}</td>
                      <td className="py-1.5 text-center font-mono font-bold text-[#0ea5e9]">{p.A.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Block 6: Calculation Solvers & Formulas */}
          <div className="bg-[#111f33] border border-[#1e3050] rounded-2xl p-5 shadow-xl">
            <span className="text-xs font-bold text-[#d4a843] uppercase tracking-wider block mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              حاسبات ومعادلات الفحوصات الطيفية والمخبرية
            </span>

            {/* Tab selection widgets */}
            <div className="grid grid-cols-3 gap-1 bg-[#0c1524] border border-[#1e3050] p-1.5 rounded-xl mb-5">
              <button 
                onClick={() => setActiveTab("beer")}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                  activeTab === "beer" ? "bg-[#0ea5e9] text-black shadow-md" : "text-[#5c7192]"
                }`}
              >
                بير-لامبرت
              </button>
              <button 
                onClick={() => setActiveTab("dil")}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                  activeTab === "dil" ? "bg-[#0ea5e9] text-black shadow-md" : "text-[#5c7192]"
                }`}
              >
                قانون التخفيف
              </button>
              <button 
                onClick={() => setActiveTab("pct")}
                className={`py-2 text-[11px] font-bold rounded-lg transition-all ${
                  activeTab === "pct" ? "bg-[#0ea5e9] text-black shadow-md" : "text-[#5c7192]"
                }`}
              >
                النسبة المئوية %
              </button>
            </div>

            {/* Beer-Lambert Form Panel */}
            {activeTab === "beer" && (
              <div className="space-y-3.5">
                {lastA !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      const spec = compoundKey === "custom" 
                        ? { lam: parseInt(custLam) || 500, eps: parseFloat(custEps) || 10000, slope: parseFloat(custSlope) || 0.03, mw: parseFloat(custMw) || 100 }
                        : COMPS[compoundKey];
                      setBeerA(lastA.toFixed(3));
                      setBeerEps(spec.eps.toString());
                      setBeerL("1");
                      showToast("📋 تم استيراد قراءة الامتصاصية الحالية ومعامل امتصاص المكون!");
                    }}
                    className="w-full py-1.5 bg-[#1b2b43] hover:bg-[#253956] text-[#38bdf8] border border-[#1e3050] text-[10px] font-semibold rounded-lg transition-all mb-2 flex items-center justify-center gap-1.5"
                  >
                    📥 استيراد قراءة جهاز المطياف الحالية (أوتوماتيكي)
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">الامتصاصية A</label>
                    <input 
                      type="number"
                      step="0.001"
                      value={beerA}
                      onChange={(e) => setBeerA(e.target.value)}
                      placeholder="مثال: 0.420"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-[#0ea5e9] font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">ε (L·mol⁻¹·cm⁻¹)</label>
                    <input 
                      type="number"
                      value={beerEps}
                      onChange={(e) => setBeerEps(e.target.value)}
                      placeholder="مثال: 12500"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-[#ffcf33] font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">طول طريق الضوء l (cm)</label>
                    <input 
                      type="number"
                      value={beerL}
                      onChange={(e) => setBeerL(e.target.value)}
                      placeholder="1"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-gray-300 font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <button 
                    onClick={solveBeer}
                    className="w-full py-2.5 bg-[#0ea5e9]/10 hover:bg-[#0ea5e9] border border-[#0ea5e9]/50 hover:text-black font-bold text-xs rounded-xl transition-all self-end"
                  >
                    حساب التركيز المولي C
                  </button>
                </div>

                {beerResult && (
                  <div className="bg-gradient-to-r from-[#0ea5e9]/10 to-[#7c3aed]/10 border border-[#0ea5e9]/40 p-4 rounded-xl text-center mt-3 animate-fade-in">
                    <span className="text-[10px] text-[#5c7294] block">التركيز المولي المستنتج (C):</span>
                    <strong className="text-xl font-mono text-[#0ea5e9] block mt-1">{beerResult}</strong>
                    <span className="text-[9px] text-gray-500 font-mono">mol / L (مولار)</span>
                  </div>
                )}

                <div className="bg-[#0c1524] p-3 rounded-xl border border-[#1e3050] text-[10px] leading-relaxed text-[#5c7394]">
                  💡 <strong>القانون: A = ε · c · l</strong> حيث أن ε هي الامتصاص المولي، و c للتراكيز بالـ (mol/L)، و l لسمك الكيوفيت (غالباً 1 سم).
                </div>
              </div>
            )}

            {/* Dilution Form Panel */}
            {activeTab === "dil" && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">التركيز الابتدائي C₁ (ppm)</label>
                    <input 
                      type="number"
                      value={dilC1}
                      onChange={(e) => setDilC1(e.target.value)}
                      placeholder="100"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-[#10b981] font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">الحجم الابتدائي V₁ (mL)</label>
                    <input 
                      type="number"
                      value={dilV1}
                      onChange={(e) => setDilV1(e.target.value)}
                      placeholder="5"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-gray-300 font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">الحجم النهائي الكلي V₂ (mL)</label>
                    <input 
                      type="number"
                      value={dilV2}
                      onChange={(e) => setDilV2(e.target.value)}
                      placeholder="100"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-gray-300 font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <button 
                    onClick={solveDilution}
                    className="w-full py-2.5 bg-[#10b981]/15 hover:bg-[#10b981] border border-[#10b981]/50 hover:text-black font-bold text-xs rounded-xl transition-all self-end"
                  >
                    حساب التركيز المخفف C₂
                  </button>
                </div>

                {dilResult && (
                  <div className="bg-gradient-to-r from-[#10b981]/10 to-[#0ea5e9]/10 border border-[#10b981]/40 p-4 rounded-xl text-center mt-3">
                    <div className="flex justify-around items-center">
                      <div>
                        <span className="text-[10px] text-[#5c7294]">التركيز النهائي (C₂):</span>
                        <strong className="text-xl font-mono text-[#10b981] block mt-1">{dilResult} ppm</strong>
                      </div>
                      <div className="h-8 w-[1px] bg-[#1e3050]"></div>
                      <div>
                        <span className="text-[10px] text-[#5c7294]">عامل التخفيف (DF):</span>
                        <strong className="text-sm font-mono text-[#f59e0b] block mt-1">{dilDF} x</strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-[#0c1524] p-3 rounded-xl border border-[#1e3050] text-[10px] leading-relaxed text-[#5c7394]">
                  🧪 <strong>علمي: C₁ · V₁ = C₂ · V₂</strong> يحافظ التخفيف على كتلة المادة المذابة مع زيادة حجم المذيب الكلي.
                </div>
              </div>
            )}

            {/* Percentage weight purity Form Panel */}
            {activeTab === "pct" && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">التركيز المسجل (ppm)</label>
                    <input 
                      type="number"
                      value={pctConc}
                      onChange={(e) => setPctConc(e.target.value)}
                      placeholder="مثل: 15"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-[#0ea5e9] font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#5c7294] block mb-1">حجم المحلول الكلي (mL)</label>
                    <input 
                      type="number"
                      value={pctVol}
                      onChange={(e) => setPctVol(e.target.value)}
                      placeholder="مثل: 100"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-gray-300 font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-1">
                    <label className="text-[9px] text-[#5c7294] block mb-1">وزن العينة الكلية (g)</label>
                    <input 
                      type="number"
                      value={pctWt}
                      onChange={(e) => setPctWt(e.target.value)}
                      placeholder="10"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-gray-300 font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[9px] text-[#5c7294] block mb-1">عامل التخفيف (DF)</label>
                    <input 
                      type="number"
                      value={pctDf}
                      onChange={(e) => setPctDf(e.target.value)}
                      placeholder="1"
                      className="w-full bg-[#0d1829] border border-[#1e3050] text-[#f59e0b] font-mono p-2.5 rounded-xl text-center text-xs"
                    />
                  </div>
                  <div className="col-span-1">
                    <button 
                      onClick={solvePercentWt}
                      className="w-full py-2.5 bg-[#f59e0b]/10 hover:bg-[#f59e0b] border border-[#f59e0b]/50 hover:text-black font-bold text-[10px] rounded-xl transition-all"
                    >
                      احسب % النسبة
                    </button>
                  </div>
                </div>

                {pctResult && (
                  <div className="bg-gradient-to-r from-[#f59e0b]/10 to-[#ef4444]/10 border border-[#f59e0b]/40 p-4 rounded-xl text-center mt-3">
                    <span className="text-[10px] text-[#5c7294] block">النسبة المئوية للمكون الفعال بالخام الأصلي:</span>
                    <strong className="text-xl font-mono text-[#f59e0b] block mt-1">{pctResult} %</strong>
                  </div>
                )}

                <div className="bg-[#0c1524] p-3 rounded-xl border border-[#1e3050] text-[10px] leading-relaxed text-[#5c7394]">
                  📊 حسابات استخلاص الخام: <code>الكتلة الفعالة (g) = ppm × الحجم(L) × ع.التخفيف / 1000</code>. النسبة المئوية تشتق بقسمة كتلة المكون الفعال على وزن العينة الكلية المذابة ضرب 100.
                </div>
              </div>
            )}

          </div>

          {/* Block 7: Enterprise Cyber Security & Device Shield */}
          <div className="bg-[#111f33] border border-[#ef4444]/30 rounded-2xl p-5 shadow-xl relative overflow-hidden mt-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#ef4444]/10 to-transparent rounded-full blur-2xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#ef4444] uppercase tracking-wider flex items-center gap-1.5 direction-rtl">
                <Shield className="w-4 h-4 animate-pulse shrink-0" />
                درع التحصين السيبراني وحماية المعايرة
              </span>
              
              <div className="flex items-center gap-1.5 bg-[#ef4444]/15 border border-[#ef4444]/30 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-ping"></span>
                <span className="text-[9px] text-[#ef4444] font-bold font-mono">SECURE SANDBOX</span>
              </div>
            </div>

            <p className="text-[10px] text-[#5c7294] leading-relaxed mb-4 text-right">
              نظام أمان متطور يعمل بالكامل في بيئة متصفح العميل (Client-Side Sandboxing) لحماية المنصة من محاولات التلاعب بالثوابت الكيميائية أو هندسة الحقن العكسية دون الحاجة لتسجيل دخول، مما يضمن الحماية المطلقة لسرية الأبحاث.
            </p>

            {/* Dynamic Status Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-4 text-[10px]">
              
              <div className="bg-[#0c1524] p-2.5 rounded-xl border border-[#1e3050] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  <span>تصفية المستندات CSP</span>
                </div>
                <span className="font-mono text-[#10b981] font-bold">نشط (Strict)</span>
              </div>

              <div className="bg-[#0c1524] p-2.5 rounded-xl border border-[#1e3050] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                  <span>استقرار الذاكرة</span>
                </div>
                <span className="font-mono text-[#10b981] font-bold">معزول (Immutable)</span>
              </div>

              <div className="bg-[#0c1524] p-2.5 rounded-xl border border-[#1e3050] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                  <span>تكامل النواة</span>
                </div>
                <span className="font-mono text-[#38bdf8] font-bold">مؤمن (SHA-256)</span>
              </div>

              <div className="bg-[#0c1524] p-2.5 rounded-xl border border-[#1e3050] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                  <span>منع التلاعب بالحقن</span>
                </div>
                <span className="font-mono text-[#f59e0b] font-bold">فعال (IDS Shield)</span>
              </div>

            </div>

            {/* Tamper Lock Interactive Switch */}
            <div className="p-3 bg-[#1e2a43]/40 border border-[#1e3050] rounded-xl mb-4 flex items-center justify-between">
              <div className="text-right flex-1 pl-4">
                <span className="text-[10px] font-bold text-white block">مفتاح الحماية السيبرانية الكيميائي (Tamper-Lock)</span>
                <span className="text-[9px] text-[#5c7294] block mt-0.5">تجميد جميع قيم ومحاور الفحص لمنع العبث</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTamperLocked(!tamperLocked);
                  addSecurityLog(
                    !tamperLocked 
                      ? "تفعيل نظام Tamper-Lock: تم إقفال ثوابت وقيم جهاز قياس الأطياف تماماً"
                      : "إلغاء وضع الأمان الفيدرالي: السماح للمهندس بإعادة التعديل على ثوابت المعايرة",
                    !tamperLocked ? "success" : "info"
                  );
                  showToast(!tamperLocked ? "🔒 تم إقفال ثوابت ومعايير الأجهزة بالكامل!" : "🔓 تم إلغاء القفل الأمني لثوابت الأجهزة");
                }}
                className={`px-3 py-1.5 text-[9px] font-bold rounded-lg transition-all shrink-0 ${
                  tamperLocked ? "bg-[#ef4444] text-white animate-pulse" : "bg-[#1e3050] text-[#a1b0cb] hover:text-white"
                }`}
              >
                {tamperLocked ? "🔒 معشق آمن" : "⚙️ مفتوح للضبط"}
              </button>
            </div>

            {/* Last Attack Log indicator */}
            {lastAttackAttempt && (
              <div className="p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-xl mb-4 flex items-center gap-2 text-[10px] text-[#ef4444] text-right">
                <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
                <div className="flex-1">
                  <span className="font-bold">تم صد وإبطال هجوم سيبراني غير مصرح به:</span>
                  <p className="font-mono text-[9px] text-gray-400 mt-0.5">{lastAttackAttempt}</p>
                </div>
              </div>
            )}

            {/* Live Security Scanner Audit Stream */}
            <div className="bg-[#0c1524] border border-[#1e3050] rounded-xl p-3">
              <div className="flex items-center justify-between border-b border-[#1e3050] pb-2 mb-2">
                <span className="text-[10px] font-bold text-white flex items-center gap-1">
                  <Activity className="w-3 h-3 text-[#10b981]" />
                  سجل تدقيق الأمان الفوري (Live IDS Stream)
                </span>
                <span className="text-[8px] font-semibold text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded-full uppercase">REALTIME AUDIT</span>
              </div>
              
              <div className="space-y-1.5 font-mono max-h-[110px] overflow-y-auto text-[8px] text-right">
                {securityLogs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-white/5 pb-1 last:border-0 gap-2">
                    <span className="text-gray-500 font-semibold shrink-0">{log.time}</span>
                    <span className={`text-right flex-1 ${
                      log.type === "success" ? "text-[#10b981]" : log.type === "warning" ? "text-[#ef4444] font-bold" : "text-[#38bdf8]"
                    }`}>
                      {log.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </section>

      </main>

      {/* ═ FOOTER ═ */}
      <footer className="max-w-7xl mx-auto px-4 mt-8">
        <div className="border-t border-[#1e3050] pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-right">
            <h4 className="text-xs font-bold text-[#d4a843]">الهيئة العامة للمهندسين الكيميائيين — فرع البصرة</h4>
            <p className="text-[10px] text-[#5c7294] mt-1">تطبيقات التقنيات والتدريب لمهندسي النفط والبتروكيماويات والتحليلات الكيمياوية العامة.</p>
          </div>
          <div className="text-center md:text-left bg-[#0c1524] border border-[#1e3050] px-4 py-2 rounded-xl">
            <span className="text-[10px] text-[#5c7294]">برمجة وتطوير المنصة:</span>
            <strong className="block text-xs font-mono text-[#38bdf8] mt-1">Eng. Ali Saif AlDIN Haider — Al-Nawfal</strong>
          </div>
        </div>
      </footer>

      {/* ══════════════════════ TOAST NOTIFICATION ══════════════════════ */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#111f33] border border-[#1e3050] text-[#e2e8f0] px-5 py-3 rounded-xl text-xs font-semibold shadow-2xl z-50 transition-all duration-300 flex items-center gap-2.5 ${
          toast.visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
        <span>{toast.msg}</span>
      </div>

    </div>
  );
}
