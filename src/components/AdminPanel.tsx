import React, { useState, useEffect } from "react";
import jsQR from "jsqr";
import { AppState, AdminMetrics } from "../types";
import { 
  Upload, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Settings,
  Eye,
  EyeOff,
  RotateCcw,
  Clock,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminPanelProps {
  state: AppState;
  adminPin: string;
  onUpdateState: (updates: Partial<AppState> & { adminPin?: string }) => Promise<boolean>;
  onResetTimer: (target?: "user" | "batal") => Promise<boolean>;
  onToggleTimer: (target?: "user" | "batal") => Promise<boolean>;
  onToggleExpire: (target?: "user" | "batal") => Promise<boolean>;
  onLogout: () => void;
}

export default function AdminPanel({
  state,
  adminPin,
  onUpdateState,
  onResetTimer,
  onToggleTimer,
  onToggleExpire,
  onLogout
}: AdminPanelProps) {
  // Local state
  const [qrImageUrl, setQrImageUrl] = useState(state.qrImageUrl);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [virtualAccount, setVirtualAccount] = useState(state.virtualAccount || "70014080808");
  
  // Custom premium visual feedback states
  const [lastUpdatedSection, setLastUpdatedSection] = useState<"qris" | "batal" | "timer-user" | "timer-batal" | null>(null);
  const [showSparkles, setShowSparkles] = useState(false);
  
  // Advanced options toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Real-time visitor state
  const [activeUsersCount, setActiveUsersCount] = useState(0);

  // Poll metrics for user count in header
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/admin/metrics", {
          headers: { "x-admin-pin": adminPin }
        });
        if (res.ok) {
          const data = await res.json();
          setActiveUsersCount(data.activeUsersCount);
        }
      } catch (err) {
        console.error("Failed to fetch metrics", err);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [adminPin]);

  // Sync state changes
  useEffect(() => {
    setQrImageUrl(state.qrImageUrl);
  }, [state.qrImageUrl]);

  useEffect(() => {
    if (state.virtualAccount) {
      setVirtualAccount(state.virtualAccount);
    }
  }, [state.virtualAccount]);

  // Helper to auto-detect and crop QR code in browser
  const autoCropQR = (base64Str: string): Promise<{ base64: string; cropped: boolean }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ base64: base64Str, cropped: false });
            return;
          }

          // Set canvas dimensions to match image
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Get image data for jsQR
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            const xs = [
              code.location.topLeftCorner.x,
              code.location.topRightCorner.x,
              code.location.bottomLeftCorner.x,
              code.location.bottomRightCorner.x
            ];
            const ys = [
              code.location.topLeftCorner.y,
              code.location.topRightCorner.y,
              code.location.bottomLeftCorner.y,
              code.location.bottomRightCorner.y
            ];

            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const qrWidth = maxX - minX;
            const qrHeight = maxY - minY;

            // Add dynamic padding (approx 15% of QR code width) to show border frame nicely
            const paddingX = qrWidth * 0.15;
            const paddingY = qrHeight * 0.15;

            let cropX = Math.max(0, minX - paddingX);
            let cropY = Math.max(0, minY - paddingY);
            let cropW = Math.min(img.width - cropX, qrWidth + paddingX * 2);
            let cropH = Math.min(img.height - cropY, qrHeight + paddingY * 2);

            // Create a new canvas to draw the cropped image
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext("2d");

            if (cropCtx) {
              cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              const croppedBase64 = cropCanvas.toDataURL("image/jpeg", 0.95);
              resolve({ base64: croppedBase64, cropped: true });
              return;
            }
          }
          resolve({ base64: base64Str, cropped: false });
        } catch (err) {
          console.error("Error auto-cropping QR:", err);
          resolve({ base64: base64Str, cropped: false });
        }
      };
      img.onerror = () => {
        resolve({ base64: base64Str, cropped: false });
      };
    });
  };

  // Handle uploading local photo with auto-cropping
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setSaveStatus(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalBase64 = reader.result as string;
      try {
        // Automatically crop QR Code if detected
        const cropResult = await autoCropQR(originalBase64);

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-pin": adminPin
          },
          body: JSON.stringify({
            image: cropResult.base64,
            filename: file.name
          })
        });

        const data = await res.json();
        if (data.success && data.url) {
          setQrImageUrl(data.url);
          if (cropResult.cropped) {
            setSaveStatus({ 
              type: "success", 
              msg: "✨ Barcode QRIS berhasil dideteksi & dipotong otomatis dengan rapi! Klik tombol 'Terapkan Barcode' di bawah." 
            });
          } else {
            setSaveStatus({ 
              type: "success", 
              msg: "Foto terbaca! (Sistem tidak mendeteksi barcode otomatis, mengunggah foto asli). Klik tombol 'Terapkan Barcode' di bawah." 
            });
          }
        } else {
          setUploadError(data.error || "Gagal mengunggah foto.");
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        setUploadError("Gagal mengunggah gambar. Pastikan format valid.");
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setUploadError("Gagal membaca file gambar.");
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  // Trigger full success effect
  const triggerSuccessVisuals = (section: "qris" | "batal" | "timer-user" | "timer-batal") => {
    setLastUpdatedSection(section);
    setShowSparkles(true);
    setTimeout(() => {
      setLastUpdatedSection(null);
      setShowSparkles(false);
    }, 4000);
  };

  // Submit and apply QRIS Image to live clients
  const handleApplyImage = async () => {
    setSaveStatus(null);
    
    const success = await onUpdateState({
      qrImageUrl,
      useCustomText: false
    });

    if (success) {
      setSaveStatus({ type: "success", msg: "Barcode QRIS berhasil diterapkan & Timer QRIS otomatis berjalan!" });
      triggerSuccessVisuals("qris");
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({ type: "error", msg: "Gagal menerapkan barcode baru." });
    }
  };

  const handleApplyVirtualAccount = async () => {
    setSaveStatus(null);
    if (!virtualAccount.trim()) {
      setSaveStatus({ type: "error", msg: "Nomor Virtual Akun tidak boleh kosong." });
      return;
    }
    const success = await onUpdateState({
      virtualAccount: virtualAccount.trim()
    });

    if (success) {
      setSaveStatus({ type: "success", msg: "Nomor Virtual Akun berhasil diperbarui & Timer Batal otomatis berjalan!" });
      triggerSuccessVisuals("batal");
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({ type: "error", msg: "Gagal memperbarui Nomor Virtual Akun." });
    }
  };

  // Wrapper for toggling timers
  const handleToggleTimerWrapper = async (target: "user" | "batal") => {
    setSaveStatus(null);
    const success = await onToggleTimer(target);
    if (success) {
      const isRunningNow = target === "user" ? !state.isTimerRunning : !state.batalIsTimerRunning;
      setSaveStatus({
        type: "success",
        msg: `Timer ${target === "user" ? "QRIS" : "Batal"} berhasil ${isRunningNow ? "DILANJUTKAN (PLAY)" : "DIHENTIKAN SEMENTARA (PAUSED)"}!`
      });
      triggerSuccessVisuals(target === "user" ? "timer-user" : "timer-batal");
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({ type: "error", msg: "Gagal mengubah status timer." });
    }
  };

  // Wrapper for resetting timers
  const handleResetTimerWrapper = async (target: "user" | "batal") => {
    setSaveStatus(null);
    const success = await onResetTimer(target);
    if (success) {
      const timeVal = target === "user" ? state.initialTime : state.batalInitialTime;
      setSaveStatus({
        type: "success",
        msg: `Timer ${target === "user" ? "QRIS" : "Batal"} berhasil di-reset ke ${timeVal} detik!`
      });
      triggerSuccessVisuals(target === "user" ? "timer-user" : "timer-batal");
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({ type: "error", msg: "Gagal me-reset timer." });
    }
  };

  // Wrapper for toggle expire status
  const handleToggleExpireWrapper = async (target: "user" | "batal") => {
    setSaveStatus(null);
    const success = await onToggleExpire(target);
    if (success) {
      const isExpiredNow = target === "user" ? !state.isExpired : !state.batalIsExpired;
      setSaveStatus({
        type: "success",
        msg: `Halaman ${target === "user" ? "QRIS" : "Batal"} berhasil ${isExpiredNow ? "DIPAKSA HABIS (EXPIRED)" : "DIAKTIFKAN KEMBALI (ONLINE)"}!`
      });
      triggerSuccessVisuals(target === "user" ? "timer-user" : "timer-batal");
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({ type: "error", msg: "Gagal mengubah status kadaluarsa." });
    }
  };

  const formatSeconds = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div id="admin-panel-clean" className="h-screen w-full flex flex-col bg-[#F4F7FA] text-slate-800 font-sans antialiased overflow-hidden selection:bg-blue-100">
      
      {/* HEADER BAR (Mandiri Biru Bersih) */}
      <header className="bg-[#003D79] border-b-[4px] border-[#FFB700] px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0 z-40">
        <div className="flex items-center gap-2">
          <img
            src={state.logoUrl}
            alt="Logo"
            className="h-7 w-auto object-contain"
            style={{ filter: "drop-shadow(0 0 5px rgba(255, 255, 255, 0.4))" }}
          />
          <div className="border-l border-white/20 pl-2">
            <h1 className="font-extrabold text-xs tracking-tight text-white uppercase leading-none">
              PENGONTROL QRIS
            </h1>
            <p className="text-[9px] text-slate-300 mt-0.5 font-bold">
              User aktif: <span className="text-[#FFB700]">{activeUsersCount} orang</span>
            </p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="flex items-center gap-1 bg-blue-900/50 hover:bg-rose-600 hover:border-rose-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all duration-200 border border-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Keluar
        </button>
      </header>

      {/* MAIN CONTAINER: FIXED ONE SCREEN FOR MOBILE AND DESKTOP */}
      <main className="flex-1 flex flex-col justify-between p-4 max-w-sm mx-auto w-full overflow-y-auto">
        
        <div className="space-y-4">
          
          {/* INSTRUCTIONS */}
          <div className="text-center bg-blue-50/50 border border-blue-100 rounded-2xl py-2 px-3 text-[11px] text-[#003D79] font-medium leading-relaxed shadow-sm">
            Ambil tangkapan layar (screenshot) QRIS baru Anda, lalu upload di bawah ini untuk mengganti barcode secara instan.
          </div>

          {/* MAIN UPLOAD BOX */}
          <div className={`bg-white border p-4 rounded-2xl shadow-md flex flex-col items-center justify-center gap-3 transition-all duration-500 relative overflow-hidden ${
            lastUpdatedSection === "qris" 
              ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500 bg-emerald-50/5" 
              : "border-slate-200"
          }`}>
            
            <div className="w-full relative border-2 border-dashed border-blue-200 hover:border-[#003D79] rounded-2xl p-6 bg-slate-50/80 transition-all text-center flex flex-col items-center justify-center gap-2 cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                disabled={isUploading}
              />
              <div className="p-3.5 bg-blue-50 rounded-full text-[#003D79] border border-blue-100 group-hover:scale-105 transition-transform duration-300">
                <Upload className="h-6 w-6 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-700">
                  {isUploading ? "Membaca Foto..." : "Upload Foto Barcode"}
                </p>
                <p className="text-[10px] text-slate-400">
                  Ambil dari galeri HP atau tangkap kamera langsung
                </p>
              </div>
            </div>

            {uploadError && (
              <p className="text-rose-600 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {uploadError}
              </p>
            )}

            {/* BARCODE PREVIEW AREA */}
            <div className="w-full text-center space-y-1.5">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Preview Gambar Terpilih:</p>
              <div className="relative bg-white aspect-square w-28 mx-auto flex items-center justify-center rounded-xl shadow-inner border border-slate-200/80 p-1.5 overflow-hidden">
                <img 
                  src={qrImageUrl} 
                  alt="QRIS Terkini" 
                  className="w-full h-full object-contain rounded-lg"
                  onError={(e) => {
                    console.log("No custom image preview available yet.");
                  }}
                />
              </div>
            </div>

            {/* SAVE AND APPLY ACTION BUTTON */}
            <button
              onClick={handleApplyImage}
              disabled={isUploading}
              className="w-full bg-[#003D79] hover:bg-[#002B54] text-white font-extrabold text-xs tracking-wider uppercase py-3.5 px-6 rounded-xl shadow-md transition-all duration-200 border border-[#002B54] flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" /> Terapkan Barcode Baru
            </button>
          </div>

          {/* CONTROL VIRTUAL ACCOUNT INSTANTLY */}
          <div className={`bg-white border p-4 rounded-2xl shadow-md flex flex-col gap-3 transition-all duration-500 relative overflow-hidden ${
            lastUpdatedSection === "batal" 
              ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500 bg-emerald-50/5" 
              : "border-slate-200"
          }`}>
            <div>
              <label className="text-[10px] font-extrabold text-[#003D79] uppercase tracking-wider block mb-1">
                Ubah Nomor Virtual Akun (Instan)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={virtualAccount}
                  onChange={(e) => setVirtualAccount(e.target.value)}
                  placeholder="Contoh: 70014080808"
                  className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-[#003D79] tracking-wider focus:outline-none focus:border-[#003D79]"
                />
                <button
                  type="button"
                  onClick={handleApplyVirtualAccount}
                  className="bg-[#FEB600] hover:bg-[#E5A300] text-[#003D79] font-extrabold text-xs px-4 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 shrink-0 shadow-sm"
                >
                  Ubah
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-1">
                Berubah seketika di halaman pengguna /batal
              </p>
            </div>
          </div>

          {/* QUICK LINKS SECTION */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 shadow-sm">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest text-center">
              Akses Halaman Pengguna:
            </span>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 bg-white hover:bg-slate-50 text-[#003D79] rounded-lg border border-slate-200 transition-all shadow-sm"
              >
                Halaman QRIS (/)
              </a>
              <a
                href="/batal"
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 bg-white hover:bg-slate-50 text-amber-700 rounded-lg border border-slate-200 transition-all shadow-sm animate-pulse"
              >
                Halaman Batal (/batal)
              </a>
            </div>
          </div>

          {/* TIMER 1: HALAMAN UTAMA (QRIS) */}
          <div className={`bg-white border p-4 rounded-2xl shadow-md flex flex-col gap-3 transition-all duration-500 relative overflow-hidden ${
            lastUpdatedSection === "timer-user" 
              ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500 bg-emerald-50/5" 
              : "border-slate-200"
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-[#003D79]" />
                <span className="text-xs font-bold text-[#003D79] uppercase">Timer Halaman QRIS (/)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                state.isExpired ? "bg-rose-100 text-rose-700" : state.isTimerRunning ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>
                {state.isExpired ? "EXPIRED" : state.isTimerRunning ? "AKTIF" : "PAUSED"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Sisa Waktu:</span>
              <strong className="font-mono text-[#003D79] text-base">{formatSeconds(state.timeLeft)}</strong>
            </div>

            {/* Input to set QRIS initial time */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 shrink-0">Atur Waktu:</span>
              <input
                type="number"
                value={state.initialTime}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    await onUpdateState({ initialTime: val });
                  }
                }}
                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400">detik</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleToggleTimerWrapper("user")}
                disabled={state.isExpired}
                className={`py-2 px-2.5 rounded-lg font-extrabold text-xs transition-all border ${
                  state.isTimerRunning 
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200" 
                    : "bg-[#003D79] hover:bg-[#002B54] text-white border-[#003D79]"
                } disabled:opacity-50`}
              >
                {state.isTimerRunning ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => handleResetTimerWrapper("user")}
                className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-extrabold rounded-lg text-xs transition-all"
              >
                Reset ({state.initialTime}s)
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => handleToggleExpireWrapper("user")}
              className={`w-full py-2 px-3 rounded-lg font-extrabold text-xs transition-all border ${
                state.isExpired
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
              }`}
            >
              {state.isExpired ? "Aktifkan Kembali" : "Paksa Habis (Expired)"}
            </button>
          </div>

          {/* TIMER 2: HALAMAN BATAL */}
          <div className={`bg-white border p-4 rounded-2xl shadow-md flex flex-col gap-3 transition-all duration-500 relative overflow-hidden ${
            lastUpdatedSection === "timer-batal" 
              ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500 bg-emerald-50/5" 
              : "border-slate-200"
          }`}>
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4.5 w-4.5 text-amber-700" />
                <span className="text-xs font-bold text-amber-700 uppercase">Timer Halaman Batal (/batal)</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                state.batalIsExpired ? "bg-rose-100 text-rose-700" : state.batalIsTimerRunning ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>
                {state.batalIsExpired ? "EXPIRED" : state.batalIsTimerRunning ? "AKTIF" : "PAUSED"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-500">Sisa Waktu:</span>
              <strong className="font-mono text-amber-700 text-base">{formatSeconds(state.batalTimeLeft !== undefined ? state.batalTimeLeft : 300)}</strong>
            </div>

            {/* Input to set Batal initial time */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 shrink-0">Atur Waktu:</span>
              <input
                type="number"
                value={state.batalInitialTime !== undefined ? state.batalInitialTime : 300}
                onChange={async (e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    await onUpdateState({ batalInitialTime: val });
                  }
                }}
                className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-slate-700 focus:outline-none"
              />
              <span className="text-slate-400">detik</span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleToggleTimerWrapper("batal")}
                disabled={state.batalIsExpired}
                className={`py-2 px-2.5 rounded-lg font-extrabold text-xs transition-all border ${
                  state.batalIsTimerRunning 
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200" 
                    : "bg-amber-700 hover:bg-amber-800 text-white border-amber-700"
                } disabled:opacity-50`}
              >
                {state.batalIsTimerRunning ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => handleResetTimerWrapper("batal")}
                className="py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-extrabold rounded-lg text-xs transition-all"
              >
                Reset ({state.batalInitialTime !== undefined ? state.batalInitialTime : 300}s)
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleToggleExpireWrapper("batal")}
              className={`w-full py-2 px-3 rounded-lg font-extrabold text-xs transition-all border ${
                state.batalIsExpired
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200"
              }`}
            >
              {state.batalIsExpired ? "Aktifkan Kembali" : "Paksa Habis (Expired)"}
            </button>
          </div>

          {/* STATUS NOTIFICATION TOAST (Professional floating banner with drawing animations & auto-draining progress bar) */}
          <AnimatePresence>
            {saveStatus && (
              <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.9, x: "-50%" }}
                animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
                exit={{ opacity: 0, y: -20, scale: 0.9, x: "-50%" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`fixed top-6 left-1/2 z-50 max-w-sm w-[90%] bg-white/95 backdrop-blur-md rounded-2xl border shadow-2xl p-4 overflow-hidden ${
                  saveStatus.type === "success" 
                    ? "border-emerald-200/90 shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)]" 
                    : "border-rose-200/90 shadow-[0_20px_40px_-15px_rgba(244,63,94,0.3)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full flex-shrink-0 ${
                    saveStatus.type === "success" ? "bg-emerald-100" : "bg-rose-100"
                  }`}>
                    {saveStatus.type === "success" ? (
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <motion.path
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                    )}
                  </div>
                  
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center gap-1.5 justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        saveStatus.type === "success" ? "text-emerald-800" : "text-rose-800"
                      }`}>
                        {saveStatus.type === "success" ? (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                            PENGATURAN DISINKRONKAN
                          </>
                        ) : (
                          "PROSES GAGAL"
                        )}
                      </span>
                      <span className={`flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-widest ${
                        saveStatus.type === "success" 
                          ? "bg-emerald-100 text-emerald-700 animate-pulse" 
                          : "bg-rose-100 text-rose-700"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          saveStatus.type === "success" ? "bg-emerald-500" : "bg-rose-500"
                        }`}></span> Live
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-slate-700 leading-snug">
                      {saveStatus.msg}
                    </p>
                  </div>
                </div>

                {/* Draining Progress Bar */}
                <motion.div
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 4, ease: "linear" }}
                  className={`absolute bottom-0 left-0 h-1 ${
                    saveStatus.type === "success" 
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                      : "bg-rose-500"
                  }`}
                />
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* BANK MANDIRI LEGAL FOOTER */}
        <footer className="text-center text-[10px] text-slate-400 font-medium py-4">
          PT Bank Mandiri (Persero) Tbk.
        </footer>

      </main>
    </div>
  );
}
