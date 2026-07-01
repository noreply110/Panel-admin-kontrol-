import React, { useEffect, useRef, useState } from "react";
import { AppState } from "../types";
import { Volume2, VolumeX, Smartphone, RefreshCw, AlertTriangle, Download, X } from "lucide-react";

interface UserViewProps {
  state: AppState;
  onNavigateToAdmin: () => void;
}

export default function UserView({ state, onNavigateToAdmin }: UserViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Format timer seconds into MM:SS
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Attempt to play audio
  const handleToggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.log("Audio play blocked by browser, user interaction required:", err);
          setAlertMessage("Silakan ketuk layar untuk memutar suara panduan.");
        });
    }
  };

  // Handle Livin app deep linking
  const handleOpenLivin = () => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
      window.location.href = "intent://#Intent;package=id.bmri.livin;scheme=https;end";
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      window.location.href = "livin://";
    } else {
      setAlertMessage("Silakan buka aplikasi Livin' Mandiri langsung dari HP Anda.");
    }
  };

  // Download QRIS Image function
  const handleDownloadQR = async () => {
    try {
      const res = await fetch(qrSource);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "qris-pembatalan-mandiri.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback for CORS limits
      const link = document.createElement("a");
      link.href = qrSource;
      link.target = "_blank";
      link.download = "qris-pembatalan-mandiri.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Generate QR code URL
  const qrSource = state.useCustomText
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(state.qrCustomText)}`
    : state.qrImageUrl;

  return (
    <div id="user-view-container" className="flex flex-col min-h-screen bg-[#f6f8fb] font-sans antialiased text-slate-800 selection:bg-amber-100">
      {/* Audio Element */}
      {state.audioUrl && (
        <audio
          id="instruksiAudio"
          ref={audioRef}
          src={state.audioUrl}
          loop
          preload="auto"
          className="hidden"
        />
      )}

      {/* HEADER dengan logo Mandiri */}
      <header id="mandiri-header" className="bg-[#003D79] px-5 py-3.5 flex items-center justify-between shadow-md border-b-[4px] border-[#FFB700] sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img
            id="logoMandiri"
            src={state.logoUrl}
            alt="Logo Mandiri"
            className="h-9 w-auto object-contain transition-transform duration-500 hover:scale-105"
            style={{
              filter: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.45)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))",
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          {/* Audio controller toggle widget */}
          {!state.isExpired && (
            <button
              id="btn-toggle-audio"
              onClick={handleToggleAudio}
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

      {/* KONTEN UTAMA */}
      <main id="main-content" className="flex-1 flex items-center justify-center p-4 md:p-6">
        <div id="payment-card" className="relative bg-white border-2 border-slate-300 rounded-[24px] p-6 max-w-[380px] w-full text-center shadow-2xl transition-all duration-300 overflow-hidden">
          
          {/* EXPIRED OVERLAY */}
          {state.isExpired && (
            <div
              id="expired-overlay"
              className="absolute inset-0 bg-white/98 z-30 flex flex-col items-center justify-center p-6 animate-fade-in"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-4 border border-rose-100 shadow-sm">
                <span className="text-5xl text-rose-600 animate-bounce">❌</span>
              </div>
              <h2 className="text-rose-600 font-extrabold text-2xl tracking-tight mb-2">WAKTU HABIS</h2>
              <p className="text-sm text-slate-500 max-w-[260px] leading-relaxed">
                Batas waktu proses pembatalan ini telah berakhir. Silakan hubungi admin atau minta kode baru.
              </p>
              <button
                id="btn-recheck"
                onClick={() => window.location.reload()}
                className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold text-sm transition-all duration-200 shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Muat Ulang Halaman
              </button>
            </div>
          )}

          {/* Title */}
          <h1 id="payment-title" className="text-[#003D79] font-extrabold text-base md:text-lg tracking-wider uppercase border-b-2 border-slate-100 pb-3 mb-5">
            QRIS Pembatalan Transaksi
          </h1>

          {/* SISA WAKTU CHIP */}
          <div id="chip-container" className="flex justify-center mb-5">
            <div className="bg-gradient-to-r from-[#004e92] to-[#003D79] rounded-full px-4 py-1.5 flex items-center gap-2.5 shadow-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span id="chip-label" className="text-[9px] font-bold text-blue-200 tracking-widest uppercase">
                {state.statusMessage}
              </span>
              <span id="timerDisplay" className="font-mono font-extrabold text-[#FFB700] text-base leading-none">
                {formatTime(state.timeLeft)}
              </span>
            </div>
          </div>

          {/* QRIS FRAME (MELAYANG DAN DINAMIS) */}
          <div id="qris-frame" className="relative bg-white aspect-square w-full max-w-[280px] mx-auto flex items-center justify-center rounded-2xl mb-3 shadow-xl border border-slate-100 p-2 overflow-hidden hover:scale-[1.02] transition-transform duration-300">
            {/* LASER SCANNING LINE */}
            <div
              id="scanner-line"
              className="absolute left-[5%] right-[5%] h-[3px] bg-gradient-to-r from-transparent via-[#FFB700] to-transparent shadow-[0_0_15px_rgba(255,183,0,0.85)] z-10 animate-scan pointer-events-none"
              style={{
                animation: "scanLine 2s infinite ease-in-out"
              }}
            />
            
            <img
              id="qrImage"
              src={qrSource}
              alt="QRIS Code"
              className="w-[90%] h-auto object-contain bg-white rounded-lg transition-all duration-300"
            />
          </div>

          {/* DOWNLOAD BUTTON */}
          <div className="mb-5">
            <button
              id="btn-download-qris"
              onClick={handleDownloadQR}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#003D79] to-[#005CA9] hover:from-[#002B54] hover:to-[#003D79] text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 border border-blue-900"
            >
              <Download className="h-4.5 w-4.5" />
              UNDUH GAMBAR QRIS
            </button>
          </div>

          {/* SCREENSHOT ALERT BADGE */}
          <div id="screenshot-badge" className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold px-4 py-2 rounded-xl mb-6 inline-flex items-center gap-2 animate-pulse shadow-sm">
            <span>📸</span>
            <span>Silakan Screenshot QRIS Ini</span>
          </div>

          {/* INSTRUCTIONS CONTAINER */}
          <div id="instructions" className="text-left max-w-[290px] mx-auto mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <span className="text-xs font-extrabold text-[#003D79] tracking-wide block mb-3 uppercase">
              Langkah Pembatalan:
            </span>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
                <span className="bg-[#003D79] text-white w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  1
                </span>
                <span><b>Screenshot</b> atau simpan gambar QRIS di atas</span>
              </div>
              <div className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
                <span className="bg-[#003D79] text-white w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  2
                </span>
                <span>Buka aplikasi <b>Livin' Mandiri</b> di HP Anda</span>
              </div>
              <div className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
                <span className="bg-[#003D79] text-white w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  3
                </span>
                <span>Masuk ke menu <b>QRIS</b> &gt; Ketuk ikon <b>Upload dari Galeri</b></span>
              </div>
              <div className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
                <span className="bg-[#003D79] text-white w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  4
                </span>
                <span>Klik <b>Lanjutkan</b> &amp; masukkan <b>PIN</b> Livin' Anda</span>
              </div>
              <div className="flex items-start gap-2.5 text-[11px] text-slate-600 leading-relaxed">
                <span className="bg-[#003D79] text-white w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  5
                </span>
                <span>Pilih opsi <b>(2) Batalkan Transaksi</b> di menu konfirmasi</span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <button
            id="btn-livin"
            onClick={handleOpenLivin}
            className="w-full bg-gradient-to-b from-[#FFB700] to-[#E5A300] hover:from-[#FFC01E] hover:to-[#FFB700] active:scale-[0.98] text-[#003D79] font-extrabold text-xs md:text-sm tracking-wider uppercase py-3.5 px-6 rounded-full shadow-[0_5px_15px_rgba(255,183,0,0.35)] transition-all duration-200 border border-amber-300"
          >
            Buka Aplikasi Livin'
          </button>
          
          <p id="disclaimer-text" className="text-[9px] text-slate-400 mt-3 italic leading-snug">
            *Tombol ini bekerja jika Anda membuka halaman dari HP yang terpasang aplikasi Livin' Mandiri.
          </p>
        </div>
      </main>

      {/* FOOTER */}
      <footer id="mandiri-footer" className="bg-[#003D79] text-slate-300 text-center py-4 px-5 border-t-[4px] border-[#FFB700] text-[11px] font-medium leading-relaxed mt-auto">
        <p className="font-semibold text-white">PT Bank Mandiri (Persero) Tbk.</p>
        <p className="mt-0.5">
          Terdaftar dan diawasi oleh <span className="text-[#FFB700] font-bold">Otoritas Jasa Keuangan (OJK)</span>.
        </p>
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

      {/* CSS keyframe animation injected directly */}
      <style>{`
        @keyframes scanLine {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
