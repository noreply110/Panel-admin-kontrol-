import React, { useState } from "react";
import { KeyRound, ShieldAlert, ArrowLeft } from "lucide-react";

interface PINScreenProps {
  onVerify: (pin: string) => Promise<boolean>;
  onCancel: () => void;
}

export default function PINScreen({ onVerify, onCancel }: PINScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError("");
    try {
      const isValid = await onVerify(pin);
      if (!isValid) {
        setError("PIN Admin salah! Silakan coba lagi.");
        setPin("");
      }
    } catch (err) {
      setError("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (num: string) => {
    setError("");
    if (pin.length < 8) {
      setPin(prev => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
  };

  return (
    <div id="pin-screen-container" className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 selection:bg-blue-800">
      <div id="pin-card" className="bg-slate-800 border border-slate-700 max-w-sm w-full rounded-[24px] p-6 text-center shadow-2xl relative animate-fade-in">
        
        {/* Back Button */}
        <button
          onClick={onCancel}
          className="absolute left-5 top-5 text-slate-400 hover:text-white p-2 rounded-lg bg-slate-750 transition-colors"
          title="Kembali ke QRIS"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="mx-auto w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 mt-2 border border-amber-500/20 text-amber-500">
          <KeyRound className="h-6 w-6 animate-pulse" />
        </div>

        <h2 className="text-white font-extrabold text-xl tracking-tight">PIN Akses Pengontrol</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6">Masukkan PIN Admin untuk mengontrol barcode dan timer.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dot Password Display */}
          <div className="flex justify-center gap-3 my-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-150 ${
                  i < pin.length
                    ? "bg-amber-400 border-amber-400 scale-110 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                    : "border-slate-600 bg-slate-800"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs py-2 px-3 rounded-lg flex items-center gap-2 justify-center animate-shake">
              <ShieldAlert className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Secure Digital Keypad */}
          <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                disabled={loading}
                className="h-14 bg-slate-700/50 hover:bg-slate-700 active:scale-95 text-white font-bold text-lg rounded-xl transition-all shadow-sm border border-slate-600/30"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              disabled={loading}
              className="h-14 text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center transition-colors"
            >
              HAPUS
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              disabled={loading}
              className="h-14 bg-slate-700/50 hover:bg-slate-700 active:scale-95 text-white font-bold text-lg rounded-xl transition-all shadow-sm border border-slate-600/30"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              disabled={loading}
              className="h-14 text-slate-400 hover:text-slate-200 font-medium text-xs rounded-xl flex items-center justify-center transition-colors"
            >
              BATAL
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className={`w-full mt-6 py-3 px-6 rounded-full font-bold text-sm tracking-wider uppercase transition-all duration-200 shadow-lg border ${
              loading || pin.length < 4
                ? "bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed"
                : "bg-amber-400 hover:bg-amber-500 text-slate-900 border-amber-300"
            }`}
          >
            {loading ? "Memverifikasi..." : "Masuk Panel"}
          </button>
        </form>

        <p className="text-[10px] text-slate-500 mt-5">
          PIN default adalah <span className="font-bold text-slate-400">123456</span>. PIN dapat diubah dari dalam panel setelah masuk.
        </p>
      </div>
    </div>
  );
}
