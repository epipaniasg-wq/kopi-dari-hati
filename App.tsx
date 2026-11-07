import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { CafeSettings, Employee, Expense, Ingredient, MenuItem, Note, Order, Role, UserSession } from './types';
import {
  clearSession,
  getEmployees,
  getExpenses,
  getIngredients,
  getMenuItems,
  getNotes,
  getOrders,
  getSavedSession,
  getSettings,
  initFirestoreSync,
  saveSession,
  subscribeToStore,
} from './services/storage';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PosView } from './components/pos/PosView';
import { MenuManagement } from './components/menu/MenuManagement';
import { InventoryManagement } from './components/inventory/InventoryManagement';
import { FinancialReports } from './components/reports/FinancialReports';
import { NotesBoard } from './components/notes/NotesBoard';
import { LoginModal } from './components/LoginModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { LoginPage } from './components/auth/LoginPage';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(getSavedSession);
  const [settings, setSettings] = useState<CafeSettings>(getSettings);
  const [employees, setEmployees] = useState<Employee[]>(getEmployees);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(getMenuItems);
  const [ingredients, setIngredients] = useState<Ingredient[]>(getIngredients);
  const [orders, setOrders] = useState<Order[]>(getOrders);
  const [expenses, setExpenses] = useState<Expense[]>(getExpenses);
  const [notes, setNotes] = useState<Note[]>(getNotes);

  const [activeTab, setActiveTab] = useState<string>('pos');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [loginTargetRole, setLoginTargetRole] = useState<Role>('pemilik');

  const refreshAllData = useCallback(() => {
    setSettings(getSettings());
    setEmployees(getEmployees());
    setMenuItems(getMenuItems());
    setIngredients(getIngredients());
    setOrders(getOrders());
    setExpenses(getExpenses());
    setNotes(getNotes());
  }, []);

  useEffect(() => {
    let cancelSync: (() => void) | undefined;

    const startSync = () => {
      if (cancelSync) {
        cancelSync();
        cancelSync = undefined;
      }
      const activeRole = session?.role || 'kasir';
      cancelSync = initFirestoreSync(activeRole);
    };

    // Initialize sync with current session role (defaults to kasir if no session)
    startSync();

    // Re-evaluate when Firebase auth state changes
    const authUnsub = onAuthStateChanged(auth, () => {
      startSync();
    });

    const unsubscribe = subscribeToStore(() => {
      refreshAllData();
      const current = getSavedSession();
      setSession((prev) => {
        if (!prev && !current) return null;
        if (!prev || !current) return current;
        if (
          prev.role === current.role &&
          prev.name === current.name &&
          prev.employeeId === current.employeeId
        ) {
          return prev;
        }
        return current;
      });
    });

    return () => {
      if (cancelSync) cancelSync();
      authUnsub();
      unsubscribe();
    };
  }, [refreshAllData, session?.role]);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    saveSession(newSession);
    setActiveTab('pos');
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  const handleRequireOwnerAuth = () => {
    setLoginTargetRole('pemilik');
    setIsLoginModalOpen(true);
  };

  // If cashier tries to stay on owner tabs when switching roles, redirect to pos
  useEffect(() => {
    if (session && session.role === 'kasir' && ['menu', 'inventory', 'reports'].includes(activeTab)) {
      setActiveTab('pos');
    }
  }, [session, activeTab]);

  // If not logged in, display the dedicated Login Page first
  if (!session) {
    return (
      <LoginPage
        settings={settings}
        employees={employees}
        onLogin={handleLoginSuccess}
      />
    );
  }

  const unreadNotesCount = session.role === 'kasir'
    ? notes.filter((n) => !n.readBy.includes(session.name)).length
    : 0;

  return (
    <div className="min-h-screen bg-[#180e08] text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Top Mobile Header with Role badge and Logout */}
      <Header
        session={session}
        settings={settings}
        notes={notes}
        onOpenLogin={() => {
          setLoginTargetRole(session.role === 'pemilik' ? 'kasir' : 'pemilik');
          setIsLoginModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onSelectTab={(tab) => setActiveTab(tab)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto">
        {activeTab === 'pos' && (
          <PosView
            menuItems={menuItems}
            session={session}
            settings={settings}
            onRefreshData={refreshAllData}
          />
        )}

        {activeTab === 'menu' && session.role === 'pemilik' && (
          <MenuManagement
            menuItems={menuItems}
            ingredients={ingredients}
            onRefreshData={refreshAllData}
          />
        )}

        {activeTab === 'inventory' && session.role === 'pemilik' && (
          <InventoryManagement
            ingredients={ingredients}
            onRefreshData={refreshAllData}
          />
        )}

        {activeTab === 'reports' && session.role === 'pemilik' && (
          <FinancialReports
            orders={orders}
            expenses={expenses}
            ingredients={ingredients}
            settings={settings}
            session={session}
            onRefreshData={refreshAllData}
          />
        )}

        {activeTab === 'notes' && (
          <NotesBoard
            notes={notes}
            session={session}
            onRefreshData={refreshAllData}
          />
        )}
      </main>

      {/* Bottom Navigation for Mobile HP */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        role={session.role}
        onRequireOwnerAuth={handleRequireOwnerAuth}
        unreadNotesCount={unreadNotesCount}
      />

      {/* Authentication / Quick Role Switch Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentSession={session}
        settings={settings}
        onLoginSuccess={handleLoginSuccess}
        targetRolePrompt={loginTargetRole}
      />

      {/* Settings Modal (Owner Only) with Employee Management */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onRefreshData={refreshAllData}
      />
    </div>
  );
}
