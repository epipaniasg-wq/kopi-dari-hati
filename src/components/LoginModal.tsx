import React, { useState } from 'react';
import { X, ShieldCheck, UserCheck, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { CafeSettings, Role, UserSession } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: UserSession;
  settings: CafeSettings;
  onLoginSuccess: (session: UserSession) => void;
  targetRolePrompt?: Role;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentSession,
  settings,
  onLoginSuccess,
  targetRolePrompt,
}) => {
  const [selectedRole, setSelectedRole] = useState<Role>(targetRolePrompt || 'pemilik');
  const [pin, setPin] = useState('');
  const [cashierName, setCashierName] = useState(
    currentSession.role === 'kasir' ? currentSession.name : 'Kasir Sinta'
  );
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setPin('');
    setErrorMsg('');
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (selectedRole === 'pemilik') {
      const correctPin = settings.ownerPin || '1234';
      if (pin === correctPin) {
        onLoginSuccess({
          role: 'pemilik',
          name: 'Pemilik (Owner)',
          loginTime: new Date().toISOString(),
        });
        onClose();
      } else {
        setErrorMsg('PIN Pemilik salah! (PIN Default: 1234)');
      }
    } else {
      // Kasir login
      const correctPin = settings.cashierPin || '0000';
      if (pin && pin !== correctPin) {
        setErrorMsg('PIN Kasir salah! (PIN Default: 0000)');
        return;
      }
      onLoginSuccess({
        role: 'kasir',
        name: cashierName.trim() || 'Kasir',
        loginTime: new Date().toISOString(),
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#23150d] text-stone-100 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-stone-800 shadow-2xl p-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Ganti Peran / Masuk
            </h2>
            <p className="text-xs text-stone-400">Pilih akses sesuai tugas Anda di kafe</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-stone-800/80 hover:bg-stone-700 text-stone-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 gap-2 my-4 bg-stone-900/90 p-1.5 rounded-xl border border-stone-800">
          <button
            type="button"
            onClick={() => handleRoleSelect('kasir')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              selectedRole === 'kasir'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Kasir (POS)</span>
          </button>

          <button
            type="button"
            onClick={() => handleRoleSelect('pemilik')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              selectedRole === 'pemilik'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Pemilik (Admin)</span>
          </button>
        </div>

        {/* Form Details */}
        <div className="space-y-4">
          {selectedRole === 'kasir' ? (
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">
                Nama Petugas Kasir:
              </label>
              <input
                type="text"
                value={cashierName}
                onChange={(e) => setCashierName(e.target.value)}
                placeholder="Contoh: Sinta / Budi"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-white text-sm focus:outline-hidden focus:border-amber-400"
              />
              <p className="text-[11px] text-stone-400 mt-1">
                Nama ini akan dicantumkan di struk pesanan & konfirmasi baca catatan.
              </p>
            </div>
          ) : (
            <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 text-xs text-amber-200/90">
              <span className="font-semibold text-amber-400 block mb-0.5">Akses Pemilik (Owner)</span>
              Membuka seluruh laporan keuangan, stok bahan, harga menu, dan catatan rahasia kafe.
            </div>
          )}

          {/* PIN Input Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-stone-300">
                Masukkan PIN {selectedRole === 'pemilik' ? 'Pemilik (Default: 1234)' : 'Kasir (Default: 0000)'}:
              </label>
              {pin.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="text-[11px] text-stone-400 hover:text-amber-300"
                >
                  Hapus
                </button>
              )}
            </div>

            {/* PIN Dots Display */}
            <div className="flex justify-center items-center gap-3 py-2 bg-stone-900/80 rounded-xl border border-stone-800">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    pin.length > idx
                      ? 'bg-amber-400 border-amber-400 scale-110'
                      : 'border-stone-600 bg-transparent'
                  }`}
                />
              ))}
            </div>

            {errorMsg && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/30 p-2 rounded-lg border border-rose-900/50">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Touch-Friendly Numeric Keypad for Mobile */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((btn) => {
              const isAction = btn === 'C' || btn === '⌫';
              return (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (btn === 'C') setPin('');
                    else if (btn === '⌫') handleBackspace();
                    else handlePinInput(btn);
                  }}
                  className={`py-3 rounded-xl text-base font-bold transition-all active:scale-95 flex items-center justify-center ${
                    isAction
                      ? 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                      : 'bg-stone-900 text-white hover:bg-stone-800 border border-stone-800'
                  }`}
                >
                  {btn}
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-stone-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 mt-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Masuk Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
