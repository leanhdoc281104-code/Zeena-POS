import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ShoppingCart, LayoutDashboard, Package, Receipt, Users, LogOut, Menu, X, Settings as SettingsIcon, FileText, Truck, Handshake, UserCog, Factory } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StoreSettings } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'store');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as StoreSettings);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'نقطة البيع', path: '/', icon: ShoppingCart, roles: ['admin', 'cashier', 'observer'] },
    { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'observer'] },
    { name: 'المبيعات', path: '/sales', icon: FileText, roles: ['admin', 'cashier', 'observer'] },
    { name: 'المشتريات', path: '/purchases', icon: Truck, roles: ['admin', 'observer'] },
    { name: 'المخزون', path: '/inventory', icon: Package, roles: ['admin', 'observer'] },
    { name: 'المصروفات', path: '/expenses', icon: Receipt, roles: ['admin', 'observer'] },
    { name: 'العملاء', path: '/customers', icon: Users, roles: ['admin', 'observer'] },
    { name: 'التصنيع', path: '/manufacturing', icon: Factory, roles: ['admin', 'observer'] },
    { name: 'الشراكة', path: '/partnership', icon: Handshake, roles: ['admin', 'observer'] },
    { name: 'الأدوار', path: '/roles', icon: UserCog, roles: ['admin', 'observer'] },
    { name: 'الإعدادات', path: '/settings', icon: SettingsIcon, roles: ['admin', 'observer'] },
  ];

  const filteredNavItems = navItems.filter(item => user?.role && item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-gray-50" dir="rtl">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 print:hidden",
        isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <img src="/logo.png" alt="نظام زينة" className="h-10 object-contain" />
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors",
                  isActive 
                    ? "bg-pink-50 text-pink-700" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="w-5 h-5 ml-3" />
                {item.name}
              </NavLink>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center mb-4 px-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{user?.role === 'admin' ? 'مدير' : 'كاشير'}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 ml-3" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print-content">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 print:hidden">
          <img src="/logo.png" alt="نظام زينة" className="h-8 object-contain" />
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-gray-500" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
