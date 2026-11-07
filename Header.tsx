import React, { useState } from 'react';
import { Coffee, ShieldCheck, UserCheck, Settings as SettingsIcon, LogOut, Bell, Cloud } from 'lucide-react';
import { CafeSettings, Note, UserSession } from '../types';

interface HeaderProps {
  session: UserSession;
  settings: CafeSettings;
  notes: Note[];
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  settings,
  notes,
  onOpenLogin,
  onOpenSettings,
  onSelectTab,
  onLogout,
}) => {
  const isOwner = session.role === 'pemilik';

  // Count unread notes for cashier
  const unreadNotesCount = !isOwner
    ? notes.filter((n) => !n.readBy.includes(session.name)).length
    : 0;

  return (
    <header className="sticky top-0 z-30 bg-[#382215] text-[#FAF6F0] border-b border-[#4d3221] shadow-md px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onSelectTab('pos')}>
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
            <Coffee className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 leading-tight">
              {settings.name}
            </h1>
            <p className="text-[10px] text-amber-200/80 font-medium leading-none">
              {settings.tagline}
            </p>
          </div>
        </div>

        {/* Right side controls: Role Badge, Notes, Settings */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status */}
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-[10px] text-emerald-300 font-semibold"
            title="Tersambung ke Firebase Cloud Firestore (Online)"
          >
            <Cloud className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Online</span>
          </div>

          {/* Notes notification badge */}
          <button
            type="button"
            onClick={() => onSelectTab('notes')}
            className="relative p-2 rounded-lg bg-[#4a2e1d] hover:bg-[#5b3924] text-amber-200 transition-colors"
            title="Catatan Tim"
          >
            <Bell className="w-4 h-4" />
            {unreadNotesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                {unreadNotesCount}
              </span>
            )}
          </button>

          {/* Current Role Button */}
          <button
            type="button"
            onClick={onOpenLogin}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isOwner
                ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 hover:bg-emerald-500/30'
            }`}
            title="Klik untuk ganti peran"
          >
            {isOwner ? (
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="capitalize">{session.role}</span>
          </button>

          {/* Settings button (Only active for owner, or opens login for cashier) */}
          <button
            type="button"
            onClick={isOwner ? onOpenSettings : onOpenLogin}
            className="p-2 rounded-lg bg-[#4a2e1d] hover:bg-[#5b3924] text-amber-100 transition-colors"
            title={isOwner ? 'Pengaturan Kafe & Data' : 'Masuk sebagai Pemilik'}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Keluar dari akun ${session.name}?`)) {
                onLogout();
              }
            }}
            className="p-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 hover:text-white transition-all"
            title="Keluar / Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
