import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from './firebase';
import { CafeSettings, Employee, Expense, Ingredient, MenuItem, Note, Order, Role, UserSession } from '../types';
import {
  initialEmployees,
  initialExpenses,
  initialIngredients,
  initialMenuItems,
  initialNotes,
  initialOrders,
  initialSettings,
} from '../data/initialData';

const STORAGE_KEYS = {
  SETTINGS: 'kdh_settings_v1',
  MENU: 'kdh_menu_v1',
  INGREDIENTS: 'kdh_ingredients_v1',
  ORDERS: 'kdh_orders_v1',
  EXPENSES: 'kdh_expenses_v1',
  NOTES: 'kdh_notes_v1',
  EMPLOYEES: 'kdh_employees_v1',
  SESSION: 'kdh_session_v1',
  SYNCED: 'kdh_synced_v1',
};

// Event listener for in-app reactive updates
type StorageListener = () => void;
const listeners = new Set<StorageListener>();

export function subscribeToStore(listener: StorageListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error notifying store listener', e);
    }
  });
}

// LocalStorage helpers with fallback
function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (e) {
    console.error(`Error saving ${key} to localStorage`, e);
  }
}

// --- Session & Auth ---
export function getSavedSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading session from localStorage', e);
    return null;
  }
}

export function saveSession(session: UserSession): void {
  setItem(STORAGE_KEYS.SESSION, session);
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    notifyListeners();
  } catch (e) {
    console.error('Error clearing session', e);
  }
}

// --- Settings ---
export function getSettings(): CafeSettings {
  return getItem<CafeSettings>(STORAGE_KEYS.SETTINGS, initialSettings);
}

export function updateSettings(newSettings: Partial<CafeSettings>): CafeSettings {
  const current = getSettings();
  const updated = { ...current, ...newSettings };
  setItem(STORAGE_KEYS.SETTINGS, updated);

  // Sync to Firestore
  try {
    setDoc(doc(db, 'settings', 'main'), updated, { merge: true }).catch((err) => {
      console.warn('Firestore settings sync warn:', err);
    });
  } catch (err) {
    console.warn('Firestore settings error:', err);
  }

  return updated;
}

// --- Menu Items ---
export function getMenuItems(): MenuItem[] {
  return getItem<MenuItem[]>(STORAGE_KEYS.MENU, initialMenuItems);
}

export function saveMenuItems(items: MenuItem[]): void {
  setItem(STORAGE_KEYS.MENU, items);
}

export function addMenuItem(item: Omit<MenuItem, 'id'>): MenuItem {
  const items = getMenuItems();
  const newItem: MenuItem = {
    ...item,
    id: `menu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };
  saveMenuItems([newItem, ...items]);

  // Sync to Firestore
  try {
    setDoc(doc(db, 'menu', newItem.id), newItem).catch((err) => {
      console.warn('Firestore addMenuItem warn:', err);
    });
  } catch (err) {
    console.warn('Firestore addMenuItem error:', err);
  }

  return newItem;
}

export function updateMenuItem(id: string, updates: Partial<MenuItem>): void {
  const items = getMenuItems();
  const updated = items.map((item) => (item.id === id ? { ...item, ...updates } : item));
  saveMenuItems(updated);

  // Sync to Firestore
  try {
    setDoc(doc(db, 'menu', id), updates, { merge: true }).catch((err) => {
      console.warn('Firestore updateMenuItem warn:', err);
    });
  } catch (err) {
    console.warn('Firestore updateMenuItem error:', err);
  }
}

export function deleteMenuItem(id: string): void {
  const items = getMenuItems().filter((item) => item.id !== id);
  saveMenuItems(items);

  // Sync to Firestore
  try {
    deleteDoc(doc(db, 'menu', id)).catch((err) => {
      console.warn('Firestore deleteMenuItem warn:', err);
    });
  } catch (err) {
    console.warn('Firestore deleteMenuItem error:', err);
  }
}

// --- Ingredients & Stock ---
export function getIngredients(): Ingredient[] {
  return getItem<Ingredient[]>(STORAGE_KEYS.INGREDIENTS, initialIngredients);
}

export function saveIngredients(ingredients: Ingredient[]): void {
  setItem(STORAGE_KEYS.INGREDIENTS, ingredients);
}

export function addIngredient(data: Omit<Ingredient, 'id' | 'currentStock' | 'usedStock'>): Ingredient {
  const list = getIngredients();
  const newItem: Ingredient = {
    ...data,
    id: `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    usedStock: 0,
    currentStock: Number(data.initialStock) + Number(data.addedStock || 0),
  };
  saveIngredients([...list, newItem]);

  // Sync to Firestore
  try {
    setDoc(doc(db, 'ingredients', newItem.id), newItem).catch((err) => {
      console.warn('Firestore addIngredient warn:', err);
    });
  } catch (err) {
    console.warn('Firestore addIngredient error:', err);
  }

  return newItem;
}

export function updateIngredient(id: string, updates: Partial<Ingredient>): void {
  const list = getIngredients();
  const updated = list.map((item) => {
    if (item.id !== id) return item;
    const merged = { ...item, ...updates };
    merged.currentStock = Number(merged.initialStock) + Number(merged.addedStock || 0) - Number(merged.usedStock || 0);
    return merged;
  });
  saveIngredients(updated);

  // Sync to Firestore
  const target = updated.find((i) => i.id === id);
  if (target) {
    try {
      setDoc(doc(db, 'ingredients', id), target, { merge: true }).catch((err) => {
        console.warn('Firestore updateIngredient warn:', err);
      });
    } catch (err) {
      console.warn('Firestore updateIngredient error:', err);
    }
  }
}

export function restockIngredient(id: string, addedAmount: number, optionalCostPerUnit?: number): void {
  const list = getIngredients();
  const updated = list.map((item) => {
    if (item.id !== id) return item;
    const newAdded = Number(item.addedStock || 0) + Number(addedAmount);
    const newCurrent = Number(item.initialStock) + newAdded - Number(item.usedStock || 0);
    return {
      ...item,
      addedStock: newAdded,
      currentStock: newCurrent,
      costPerUnit: optionalCostPerUnit !== undefined ? optionalCostPerUnit : item.costPerUnit,
    };
  });
  saveIngredients(updated);

  const target = updated.find((i) => i.id === id);
  if (target) {
    try {
      setDoc(doc(db, 'ingredients', id), target, { merge: true }).catch((err) => {
        console.warn('Firestore restock warn:', err);
      });
    } catch (err) {
      console.warn('Firestore restock error:', err);
    }
  }
}

export function adjustStockOpname(id: string, actualRemainingStock: number): void {
  const list = getIngredients();
  const updated = list.map((item) => {
    if (item.id !== id) return item;
    const totalSupplied = Number(item.initialStock) + Number(item.addedStock || 0);
    const calculatedUsed = Math.max(0, totalSupplied - actualRemainingStock);
    return {
      ...item,
      usedStock: calculatedUsed,
      currentStock: actualRemainingStock,
    };
  });
  saveIngredients(updated);

  const target = updated.find((i) => i.id === id);
  if (target) {
    try {
      setDoc(doc(db, 'ingredients', id), target, { merge: true }).catch((err) => {
        console.warn('Firestore stock opname warn:', err);
      });
    } catch (err) {
      console.warn('Firestore stock opname error:', err);
    }
  }
}

export function deleteIngredient(id: string): void {
  const list = getIngredients().filter((item) => item.id !== id);
  saveIngredients(list);

  try {
    deleteDoc(doc(db, 'ingredients', id)).catch((err) => {
      console.warn('Firestore deleteIngredient warn:', err);
    });
  } catch (err) {
    console.warn('Firestore deleteIngredient error:', err);
  }
}

export function deductIngredientsForOrder(order: Order): void {
  const menuList = getMenuItems();
  const ingredientList = getIngredients();
  const ingMap = new Map<string, Ingredient>(ingredientList.map((i) => [i.id, { ...i }]));

  let hasChanges = false;

  order.items.forEach((orderItem) => {
    const menuItem = menuList.find((m) => m.id === orderItem.menuId);
    if (!menuItem || !menuItem.recipes || menuItem.recipes.length === 0) return;

    menuItem.recipes.forEach((req) => {
      const ing = ingMap.get(req.ingredientId);
      if (ing) {
        const consumed = Number(req.amount) * Number(orderItem.quantity);
        ing.usedStock = Number(ing.usedStock || 0) + consumed;
        ing.currentStock = Number(ing.initialStock) + Number(ing.addedStock || 0) - ing.usedStock;
        hasChanges = true;

        // Sync individual ingredient stock update to Firestore
        try {
          setDoc(doc(db, 'ingredients', ing.id), ing, { merge: true }).catch((err) => {
            console.warn('Firestore deductIngredient warn:', err);
          });
        } catch (err) {
          console.warn('Firestore deduct error:', err);
        }
      }
    });
  });

  if (hasChanges) {
    saveIngredients(Array.from(ingMap.values()));
  }
}

// --- Orders ---
export function getOrders(): Order[] {
  return getItem<Order[]>(STORAGE_KEYS.ORDERS, initialOrders);
}

export function saveOrders(orders: Order[]): void {
  setItem(STORAGE_KEYS.ORDERS, orders);
}

export function createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt'>): Order {
  const orders = getOrders();
  const dateStr = new Date().toISOString();
  const countToday = orders.length + 1;
  const orderNumber = `KDH-${String(countToday).padStart(4, '0')}`;

  const newOrder: Order = {
    ...orderData,
    id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    orderNumber,
    createdAt: dateStr,
  };

  const updatedOrders = [newOrder, ...orders];
  saveOrders(updatedOrders);

  // Automatically deduct ingredient stock
  deductIngredientsForOrder(newOrder);

  // Sync to Firestore Online
  try {
    setDoc(doc(db, 'orders', newOrder.id), newOrder).catch((err) => {
      console.warn('Firestore createOrder online warn:', err);
    });
  } catch (err) {
    console.warn('Firestore createOrder error:', err);
  }

  return newOrder;
}

export function cancelOrder(orderId: string): void {
  const orders = getOrders();
  const updated = orders.map((o) => (o.id === orderId ? { ...o, status: 'Dibatalkan' as const } : o));
  saveOrders(updated);

  try {
    updateDoc(doc(db, 'orders', orderId), { status: 'Dibatalkan' }).catch((err) => {
      console.warn('Firestore cancelOrder warn:', err);
    });
  } catch (err) {
    console.warn('Firestore cancelOrder error:', err);
  }
}

// --- Expenses ---
export function getExpenses(): Expense[] {
  return getItem<Expense[]>(STORAGE_KEYS.EXPENSES, initialExpenses);
}

export function saveExpenses(expenses: Expense[]): void {
  setItem(STORAGE_KEYS.EXPENSES, expenses);
}

export function addExpense(expense: Omit<Expense, 'id'>): Expense {
  const expenses = getExpenses();
  const newExp: Expense = {
    ...expense,
    id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };
  saveExpenses([newExp, ...expenses]);

  try {
    setDoc(doc(db, 'expenses', newExp.id), newExp).catch((err) => {
      console.warn('Firestore addExpense warn:', err);
    });
  } catch (err) {
    console.warn('Firestore addExpense error:', err);
  }

  return newExp;
}

export function deleteExpense(id: string): void {
  const expenses = getExpenses().filter((e) => e.id !== id);
  saveExpenses(expenses);

  try {
    deleteDoc(doc(db, 'expenses', id)).catch((err) => {
      console.warn('Firestore deleteExpense warn:', err);
    });
  } catch (err) {
    console.warn('Firestore deleteExpense error:', err);
  }
}

// --- Notes / Announcements ---
export function getNotes(): Note[] {
  return getItem<Note[]>(STORAGE_KEYS.NOTES, initialNotes);
}

export function saveNotes(notes: Note[]): void {
  setItem(STORAGE_KEYS.NOTES, notes);
}

export function addNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'readBy'>): Note {
  const notes = getNotes();
  const now = new Date().toISOString();
  const newNote: Note = {
    ...note,
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: now,
    updatedAt: now,
    readBy: [],
  };
  saveNotes([newNote, ...notes]);

  try {
    setDoc(doc(db, 'notes', newNote.id), newNote).catch((err) => {
      console.warn('Firestore addNote warn:', err);
    });
  } catch (err) {
    console.warn('Firestore addNote error:', err);
  }

  return newNote;
}

export function updateNote(id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'tag'>>): void {
  const notes = getNotes();
  const now = new Date().toISOString();
  const updated = notes.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: now } : n));
  saveNotes(updated);

  try {
    setDoc(doc(db, 'notes', id), { ...updates, updatedAt: now }, { merge: true }).catch((err) => {
      console.warn('Firestore updateNote warn:', err);
    });
  } catch (err) {
    console.warn('Firestore updateNote error:', err);
  }
}

export function markNoteAsRead(id: string, userName: string): void {
  const notes = getNotes();
  const target = notes.find((n) => n.id === id);
  if (!target || target.readBy.includes(userName)) return;

  const newReadBy = [...target.readBy, userName];
  const now = new Date().toISOString();
  const updated = notes.map((n) => (n.id === id ? { ...n, readBy: newReadBy, updatedAt: now } : n));
  saveNotes(updated);

  try {
    setDoc(doc(db, 'notes', id), { readBy: newReadBy, updatedAt: now }, { merge: true }).catch((err) => {
      console.warn('Firestore markNoteAsRead warn:', err);
    });
  } catch (err) {
    console.warn('Firestore markNoteAsRead error:', err);
  }
}

export function deleteNote(id: string): void {
  const notes = getNotes().filter((n) => n.id !== id);
  saveNotes(notes);

  try {
    deleteDoc(doc(db, 'notes', id)).catch((err) => {
      console.warn('Firestore deleteNote warn:', err);
    });
  } catch (err) {
    console.warn('Firestore deleteNote error:', err);
  }
}

// --- Employees / Staff Management ---
export function getEmployees(): Employee[] {
  return getItem<Employee[]>(STORAGE_KEYS.EMPLOYEES, initialEmployees);
}

export function saveEmployees(employees: Employee[]): void {
  setItem(STORAGE_KEYS.EMPLOYEES, employees);
}

export function addEmployee(emp: Omit<Employee, 'id' | 'joinedAt'>): Employee {
  const list = getEmployees();
  const newEmp: Employee = {
    ...emp,
    id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    joinedAt: new Date().toISOString().split('T')[0],
  };
  saveEmployees([...list, newEmp]);

  try {
    setDoc(doc(db, 'employees', newEmp.id), newEmp).catch((err) => {
      console.warn('Firestore addEmployee warn:', err);
    });
  } catch (err) {
    console.warn('Firestore addEmployee error:', err);
  }

  return newEmp;
}

export function updateEmployee(id: string, updates: Partial<Employee>): void {
  const list = getEmployees();
  const updated = list.map((e) => (e.id === id ? { ...e, ...updates } : e));
  saveEmployees(updated);

  try {
    setDoc(doc(db, 'employees', id), updates, { merge: true }).catch((err) => {
      console.warn('Firestore updateEmployee warn:', err);
    });
  } catch (err) {
    console.warn('Firestore updateEmployee error:', err);
  }
}

export function deleteEmployee(id: string): void {
  const list = getEmployees().filter((e) => e.id !== id);
  saveEmployees(list);

  try {
    deleteDoc(doc(db, 'employees', id)).catch((err) => {
      console.warn('Firestore deleteEmployee warn:', err);
    });
  } catch (err) {
    console.warn('Firestore deleteEmployee error:', err);
  }
}

// --- Backup & Restore ---
export function exportAllDataJSON(): string {
  const data = {
    settings: getSettings(),
    menu: getMenuItems(),
    ingredients: getIngredients(),
    orders: getOrders(),
    expenses: getExpenses(),
    notes: getNotes(),
    employees: getEmployees(),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAllDataJSON(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.settings) setItem(STORAGE_KEYS.SETTINGS, data.settings);
    if (data.menu) setItem(STORAGE_KEYS.MENU, data.menu);
    if (data.ingredients) setItem(STORAGE_KEYS.INGREDIENTS, data.ingredients);
    if (data.orders) setItem(STORAGE_KEYS.ORDERS, data.orders);
    if (data.expenses) setItem(STORAGE_KEYS.EXPENSES, data.expenses);
    if (data.notes) setItem(STORAGE_KEYS.NOTES, data.notes);
    if (data.employees) setItem(STORAGE_KEYS.EMPLOYEES, data.employees);
    notifyListeners();
    return true;
  } catch (e) {
    console.error('Failed to parse import data', e);
    return false;
  }
}

export function resetToDefaultData(): void {
  setItem(STORAGE_KEYS.SETTINGS, initialSettings);
  setItem(STORAGE_KEYS.MENU, initialMenuItems);
  setItem(STORAGE_KEYS.INGREDIENTS, initialIngredients);
  setItem(STORAGE_KEYS.ORDERS, initialOrders);
  setItem(STORAGE_KEYS.EXPENSES, initialExpenses);
  setItem(STORAGE_KEYS.NOTES, initialNotes);
  setItem(STORAGE_KEYS.EMPLOYEES, initialEmployees);
  notifyListeners();
}

// --- Firestore Cloud Real-time Synchronization ---
let activeUnsubscribers: (() => void)[] = [];

export function initFirestoreSync(role: Role = 'kasir'): () => void {
  // Clean up any previous subscriptions before re-attaching with the new role
  activeUnsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });
  activeUnsubscribers = [];

  // Test server connection in background
  testConnection().catch(() => {});

  const unsubscribers: (() => void)[] = [];
  const isOwnerLoggedIn = role === 'pemilik' && !!auth.currentUser;

  try {
    // 1. Sync Menu Items (Kasir & Pemilik can read)
    const menuUnsub = onSnapshot(
      collection(db, 'menu'),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((doc) => doc.data() as MenuItem);
          setItem(STORAGE_KEYS.MENU, items);
        } else if (isOwnerLoggedIn) {
          // If empty in cloud, seed initial menu items ONLY when logged in as Pemilik
          initialMenuItems.forEach((item) => {
            setDoc(doc(db, 'menu', item.id), item).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'menu');
      }
    );
    unsubscribers.push(menuUnsub);

    // 2. Sync Ingredients (Kasir & Pemilik can read)
    const ingUnsub = onSnapshot(
      collection(db, 'ingredients'),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((doc) => doc.data() as Ingredient);
          setItem(STORAGE_KEYS.INGREDIENTS, items);
        } else if (isOwnerLoggedIn) {
          initialIngredients.forEach((item) => {
            setDoc(doc(db, 'ingredients', item.id), item).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'ingredients');
      }
    );
    unsubscribers.push(ingUnsub);

    // 3. Sync Orders (Kasir & Pemilik can read & create)
    const ordersUnsub = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((doc) => doc.data() as Order);
          // Sort by createdAt descending
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setItem(STORAGE_KEYS.ORDERS, items);
        } else if (isOwnerLoggedIn) {
          initialOrders.forEach((item) => {
            setDoc(doc(db, 'orders', item.id), item).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );
    unsubscribers.push(ordersUnsub);

    // 4. Sync Expenses (STRICTLY and ONLY for Pemilik role who is authenticated with Firebase Auth)
    // Firestore security rules enforce: match /expenses/{expenseId} { allow read, write: if isOwner(); }
    if (isOwnerLoggedIn) {
      const expensesUnsub = onSnapshot(
        collection(db, 'expenses'),
        (snapshot) => {
          if (!snapshot.empty) {
            const items = snapshot.docs.map((doc) => doc.data() as Expense);
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setItem(STORAGE_KEYS.EXPENSES, items);
          } else {
            initialExpenses.forEach((item) => {
              setDoc(doc(db, 'expenses', item.id), item).catch(() => {});
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'expenses');
        }
      );
      unsubscribers.push(expensesUnsub);
    }

    // 5. Sync Notes (Kasir can read, Pemilik can manage)
    const notesUnsub = onSnapshot(
      collection(db, 'notes'),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((doc) => doc.data() as Note);
          items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          setItem(STORAGE_KEYS.NOTES, items);
        } else if (isOwnerLoggedIn) {
          initialNotes.forEach((item) => {
            setDoc(doc(db, 'notes', item.id), item).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'notes');
      }
    );
    unsubscribers.push(notesUnsub);

    // 6. Sync Employees (Kasir can read, Pemilik can manage)
    const empUnsub = onSnapshot(
      collection(db, 'employees'),
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((doc) => doc.data() as Employee);
          setItem(STORAGE_KEYS.EMPLOYEES, items);
        } else if (isOwnerLoggedIn) {
          initialEmployees.forEach((item) => {
            setDoc(doc(db, 'employees', item.id), item).catch(() => {});
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'employees');
      }
    );
    unsubscribers.push(empUnsub);

    // 7. Sync Settings (Store Profile)
    const settingsUnsub = onSnapshot(
      doc(db, 'settings', 'main'),
      (docSnap) => {
        if (docSnap.exists()) {
          setItem(STORAGE_KEYS.SETTINGS, docSnap.data() as CafeSettings);
        } else if (isOwnerLoggedIn) {
          setDoc(doc(db, 'settings', 'main'), initialSettings).catch(() => {});
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/main');
      }
    );
    unsubscribers.push(settingsUnsub);
    activeUnsubscribers = unsubscribers;
  } catch (err) {
    console.warn('Firestore subscription initialized with notice:', err);
  }

  return () => {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch {}
    });
    if (activeUnsubscribers === unsubscribers) {
      activeUnsubscribers = [];
    }
  };
}
