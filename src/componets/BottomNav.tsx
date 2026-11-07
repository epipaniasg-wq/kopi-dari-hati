import React from 'react';
import { ShoppingBag, UtensilsCrossed, Package, BarChart3, FileText, Lock } from 'lucide-react';
import { Role } from '../types';

interface BottomNavProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  role: Role;
  onRequireOwnerAuth: () => void;
  unreadNotesCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  role,
  onRequireOwnerAuth,
  unreadNotesCount,
}) => {
  const isOwner = role === 'pemilik';

  const navItems = [
    {
      id: 'pos',
      label: 'Kasir',
      icon: ShoppingBag,
      requiresOwner: false,
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: UtensilsCrossed,
      requiresOwner: true,
    },
    {
      id: 'inventory',
      label: 'Stok Bahan',
      icon: Package,
      requiresOwner: true,
    },
    {
      id: 'reports',
      label: 'Laporan',
      icon: BarChart3,
      requiresOwner: true,
    },
    {
      id: 'notes',
      label: 'Catatan',
      icon: FileText,
      requiresOwner: false,
      badge: unreadNotesCount > 0 ? unreadNotesCount : undefined,
    },
  ];

  const handleTabClick = (item: (typeof navItems)[0]) => {
    if (item.requiresOwner && !isOwner) {
      onRequireOwnerAuth();
    } else {
      onSelectTab(item.id);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-[#2d1b11] border-t border-[#442b1c] text-[#d6c7b8] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.25)]">
      <div className="max-w-md mx-auto grid grid-cols-5 px-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isLocked = item.requiresOwner && !isOwner;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTabClick(item)}
              className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
                isActive
                  ? 'text-amber-400 font-bold'
                  : 'text-stone-400 hover:text-stone-200 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {isLocked && (
                  <span className="absolute -top-1 -right-1 bg-stone-700/90 text-amber-300 p-0.5 rounded-full shadow">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 py-0.2 rounded-full min-w-4 text-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight line-clamp-1">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
