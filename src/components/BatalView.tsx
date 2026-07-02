import React, { useEffect, useState, useRef } from "react";
import { AppState } from "../types";
import { ArrowLeft, RefreshCw, Volume2, VolumeX, Copy, Check, X } from "lucide-react";

interface BatalViewProps {
  state: AppState;
}

export default function BatalView({ state }: BatalViewProps) {
  const [suaraSudahDiputar, setSuaraSudahDiputar] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const audioPlayingRef = useRef(false);

  // Copy Virtual Account function
  const handleCopyVA = () => {
    const vaText = state.virtualAccount || "70014080808";
    navigator.clipboard.writeText(vaText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Gagal menyalin text:", err);
    });
  };

  // Trigger speech synthesis voice guidance on user interaction
  const mainkanSuaraBank = () => {
    if (state.batalIsExpired) return;
    if ("speechSynthesis" in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        audioPlayingRef.current = false;
        setIsPlaying(false);
      } else {
        audioPlayingRef.current = true;
        setIsPlaying(true);
        setSuaraSudahDiputar(true);
        
        // Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        const pesan = `Selamat datang di Livin Mandiri. Ikuti langkah pembatalan transaksi. Buka aplikasi Livin Mandiri, pilih menu Bayar, cari penyedia jasa Transferpay 7 0 0 1 4, masukkan kode pembatalan yang tertera, klik total pembatalan, masukkan pin Livin, lalu pilih batalkan transaksi. Pembatalan berhasil.`;
        const ucapan = new SpeechSynthesisUtterance(pesan);
        ucapan.lang = "id-ID";
        ucapan.rate = 0.85;
        ucapan.pitch = 1.0;
        
        ucapan.onend = () => {
          audioPlayingRef.current = false;
          setIsPlaying(false);
        };
        ucapan.onerror = () => {
          audioPlayingRef.current = false;
          setIsPlaying(false);
        };

        window.speechSynthesis.speak(ucapan);
      }
    }
  };

  // Auto cancel speech when expired
  useEffect(() => {
    if (state.batalIsExpired) {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
      }
    }
  }, [state.batalIsExpired]);

  // Cancel speech synthesis when unmounted
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle deep link to Livin Mandiri app
  const handleBukaLivinApp = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering voice guidance twice
    if (state.batalIsExpired) return;
    
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.location.href = "intent://#Intent;package=id.bmri.livin;scheme=https;end";
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      window.location.href = "livin://";
    } else {
      setAlertMessage("Silakan buka aplikasi Livin' Mandiri secara manual di HP Anda.");
    }
  };

  // Format timer countdown
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      id="batal-view-root"
      className="min-h-screen flex flex-col bg-[#F0F4F8] font-sans text-slate-800 antialiased select-none"
    >
      {/* HEADER DENGAN LOGO MANDIRI BERGERAK */}
      <header className="bg-[#003D79] px-6 py-4 flex items-center justify-between border-b-[3px] border-[#FEB600] shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img
            src={state.logoUrl || "https://mediate.co.id/wp-content/uploads/2020/12/Bank_Mandiri_logo.png"}
            alt="Logo Mandiri"
            className="h-9 w-auto object-contain animate-logo-bounce"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))" }}
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Audio controller toggle widget */}
          {!state.batalIsExpired && (
            <button
              id="btn-toggle-audio"
              onClick={mainkanSuaraBank}
              className={`p-2 rounded-full transition-all duration-300 ${
                isPlaying
                  ? "bg-amber-400 text-[#003D79] shadow-md animate-pulse"
                  : "bg-blue-900/60 text-slate-300 hover:text-white"
              }`}
              title={isPlaying ? "Matikan Suara Panduan" : "Putar Suara Panduan"}
            >
              {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
          )}
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-grow flex items-center justify-center px-4 py-6">
        <div className="max-w-[440px] w-full bg-white rounded-[28px] shadow-[0_20px_35px_-12px_rgba(0,61,121,0.12),_0_0_0_1px_rgba(0,61,121,0.02)] overflow-hidden relative">
          
          {/* CARD HEADER */}
          <div className="pt-6 px-6">
            <h1 className="text-base md:text-lg font-extrabold text-[#003D79] uppercase tracking-wide border-l-4 border-[#FEB600] pl-3 mb-5">
              Pembatalan Transaksi
            </h1>
          </div>

          {/* TIMER CHIP */}
          <div className="flex justify-center mb-5">
            <div className="bg-gradient-to-br from-[#EA7200] to-[#C95C00] rounded-full px-5 py-2 flex items-center gap-2.5 shadow-[0_4px_12px_rgba(234,114,0,0.25)]">
              <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
                Sisa Waktu
              </span>
              <span className="font-mono font-extrabold text-white text-lg bg-black/20 px-2 py-0.5 rounded-full">
                {formatTime(state.batalTimeLeft !== undefined ? state.batalTimeLeft : 300)}
              </span>
            </div>
          </div>

          {/* STATUS CARD */}
          <div className="mx-6 bg-[#F9FBFE] border border-[#E9EDF2] rounded-[20px] p-4 mb-6 flex items-center gap-4 shadow-[0_6px_12px_-6px_rgba(0,61,121,0.15)] hover:shadow-[0_10px_18px_-8px_rgba(0,61,121,0.2)] transition-shadow duration-300">
            <div className="w-11 h-11 relative flex-shrink-0">
              <div className="w-full h-full rounded-full border-2 border-[#E0E7F0]"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FEB600] rounded-full shadow-[0_0_8px_#FEB600] animate-pulse"></div>
              <div className="absolute top-0 left-0 w-full h-full animate-spin">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#003D79] rounded-full"></div>
              </div>
            </div>
            <div>
              <div className="text-xs font-extrabold text-[#003D79] uppercase tracking-wider mb-0.5">
                Pembatalan sedang berlangsung
              </div>
              <div className="text-[11px] text-[#6C7A8E] animate-pulse">
                Menunggu konfirmasi server ...
              </div>
            </div>
          </div>

          {/* BARCODE BOX WITH VIRTUAL ACCOUNT NUMBER */}
          <div className="mx-6 bg-gradient-to-br from-white to-[#F4F9FF] border border-[#E2E8F0] rounded-[20px] p-6 mb-6 text-center shadow-[0_12px_24px_-8px_rgba(0,61,121,0.25)] hover:shadow-[0_16px_28px_-8px_rgba(0,61,121,0.35)] transition-shadow duration-300 relative overflow-hidden">
            {state.batalIsExpired && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 flex flex-col justify-center items-center text-center p-4 animate-fade-in">
                <div className="text-3xl mb-1.5 animate-bounce">⏰</div>
                <div className="text-[#D32F2F] font-extrabold text-sm mb-1 uppercase tracking-wide">Kode Kadaluarsa</div>
                <div className="text-[10px] text-slate-500 max-w-[220px] leading-relaxed mb-2 font-semibold">
                  Silakan lakukan permintaan baru atau hubungi admin layanan pelanggan.
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.reload();
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-[10px] transition-all shadow-sm"
                >
                  <RefreshCw className="h-3 w-3 animate-spin-slow" />
                  Muat Ulang
                </button>
              </div>
            )}

            <span className="text-xs font-extrabold text-[#003D79] tracking-wider uppercase bg-[#EFF3F8] px-4 py-1 rounded-full mb-4 inline-block">
              KODE PEMBATALAN TRANSAKSI
            </span>
            
            {/* VIRTUAL ACCOUNT NUMBER TEXT (INSTANTLY CONTROLLABLE & FLEXIBLE ON MOBILE) */}
            {(() => {
              const vaText = state.virtualAccount || "70014080808";
              const len = vaText.length;
              let fontSizeClass = "text-2xl sm:text-3xl";
              let trackingClass = "tracking-wider sm:tracking-widest";

              if (len > 24) {
                fontSizeClass = "text-xs sm:text-sm";
                trackingClass = "tracking-normal";
              } else if (len > 18) {
                fontSizeClass = "text-sm sm:text-base";
                trackingClass = "tracking-normal";
              } else if (len > 14) {
                fontSizeClass = "text-base sm:text-lg";
                trackingClass = "tracking-normal";
              } else if (len > 11) {
                fontSizeClass = "text-lg sm:text-xl";
                trackingClass = "tracking-wide";
              }

              return (
                <div className={`${fontSizeClass} ${trackingClass} break-all whitespace-normal max-w-full overflow-hidden font-black text-[#003D79] my-4 font-mono select-all bg-slate-50 border border-dashed border-blue-200 py-3 px-3 rounded-xl shadow-inner transition-all duration-300`}>
                  {vaText}
                </div>
              );
            })()}

            <div className="mt-4">
              <button
                id="btn-salin-va"
                onClick={handleCopyVA}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-md transition-all duration-300 active:scale-95 border ${
                  copied
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    : "bg-gradient-to-r from-[#003D79] to-[#005CA9] hover:from-[#002B54] hover:to-[#003D79] text-white border-blue-900"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    BERHASIL DISALIN!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    SALIN KODE PEMBATALAN
                  </>
                )}
              </button>
            </div>
          </div>

          {/* STEPS LIST */}
          <div className="px-6 mb-7 text-left">
            <div className="text-xs font-extrabold text-[#003D79] uppercase tracking-wider border-b-2 border-[#FEB600] pb-1 mb-4 inline-block">
              Langkah Pembatalan
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  1
                </span>
                <span>Buka aplikasi <strong className="text-[#003D79]">Livin' Mandiri</strong></span>
              </li>
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  2
                </span>
                <span>Pilih menu <strong className="text-[#003D79]">Bayar</strong> &rarr; Cari Penyedia Jasa</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  3
                </span>
                <span>Pilih <strong className="text-[#003D79]">Transferpay (70014)</strong> lalu lanjutkan</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  4
                </span>
                <span>Masukkan <strong className="text-[#003D79]">kode pembatalan ({state.virtualAccount || "70014080808"})</strong> di atas, klik Lanjutkan</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  5
                </span>
                <span>Klik <strong className="text-[#003D79]">Total Pembatalan</strong></span>
              </li>
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  6
                </span>
                <span>Masukkan <strong className="text-[#003D79]">PIN Livin'</strong> Anda</span>
              </li>
              <li className="flex items-start gap-3 text-xs text-[#1F2A44] leading-relaxed">
                <span className="bg-[#67B2E8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-0.5 shadow-sm">
                  7
                </span>
                <span>Pilih <strong className="text-[#003D79]">Batalkan Transaksi</strong> (bukan Lanjut Bayar)</span>
              </li>
            </ul>
          </div>

          {/* ACTION BUTTON */}
          <div className="px-6 mb-6">
            <button
              onClick={handleBukaLivinApp}
              disabled={state.batalIsExpired}
              className={`w-full py-4 rounded-full font-extrabold text-sm uppercase tracking-wider text-[#003D79] transition-all shadow-[0_8px_18px_rgba(254,182,0,0.25)] border border-[#E5A300] active:scale-97 ${
                state.batalIsExpired 
                  ? "bg-slate-300 text-slate-500 border-slate-300 cursor-not-allowed shadow-none" 
                  : "bg-gradient-to-r from-[#FEB600] to-[#F59E0B] hover:opacity-95"
              }`}
            >
              {state.batalIsExpired ? "Kode Kadaluarsa" : "Buka Livin' Mandiri"}
            </button>
          </div>

          {/* LEGAL INFO & DISCLAIMER */}
          <div className="text-[10px] text-center text-slate-400 px-6 pb-5 border-t border-[#ECF1F6] mt-2 pt-4">
            *Pastikan koneksi internet stabil. Pembatalan hanya melalui Livin' Mandiri.
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-[#003D79] text-white text-center py-4 px-5 border-t-[3px] border-[#FEB600] text-xs font-medium">
        <p>PT Bank Mandiri (Persero) Tbk. | Terdaftar & diawasi OJK</p>
      </footer>

      {/* CUSTOM ALERT MODAL */}
      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[24px] border-2 border-[#003D79] max-w-sm w-full p-6 text-center shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setAlertMessage(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-[#003D79] font-black text-sm tracking-wide uppercase mb-2">Informasi Penting</h3>
            <p className="text-slate-600 text-xs font-semibold leading-relaxed mb-6">
              {alertMessage}
            </p>
            <button
              onClick={() => setAlertMessage(null)}
              className="w-full py-2.5 bg-[#003D79] hover:bg-[#002B54] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98]"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Custom Keyframe Animations */}
      <style>{`
        @keyframes logoBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.02); }
        }
        .animate-logo-bounce {
          animation: logoBounce 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
