import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { ShoppingCart, LayoutDashboard, Package, Receipt, Users, LogOut, Menu, X, Settings as SettingsIcon, FileText, Truck, Handshake, UserCog, Factory, Key } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { StoreSettings } from '../types';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Layout: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pmError, setPmError] = useState('');
  const [pmLoading, setPmLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const storedSettings = await import('../services/apiService').then(m => m.apiService.getDoc<StoreSettings>('settings', 'store'));
        if (storedSettings) {
          setSettings(storedSettings);
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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    setPmLoading(true);
    setPmError('');
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) throw new Error('المستخدم غير مسجل الدخول');

      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      alert('تم تغيير كلمة المرور بنجاح');
      setIsPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPmError('فشل تغيير كلمة المرور. تأكد من صحة كلمة المرور الحالية.');
      console.error(err);
    } finally {
      setPmLoading(false);
    }
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
          <img src={settings?.storeLogo || "/logo.png"} alt="نظام زينة" className="h-10 object-contain" />
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
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-700 rounded-xl hover:bg-gray-100 transition-colors mb-2"
            >
              <Key className="w-5 h-5 ml-3" />
              تغيير كلمة المرور
            </button>
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
          <img src={settings?.storeLogo || "/logo.png"} alt="نظام زينة" className="h-8 object-contain" />
          <button onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="w-6 h-6 text-gray-500" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-[100] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">تغيير كلمة المرور</h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {pmError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{pmError}</div>}
              <div>
                <label className="block text-sm text-gray-700 mb-1">كلمة المرور الحالية</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">كلمة المرور الجديدة</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={pmLoading}
                className="w-full bg-pink-600 text-white rounded-lg py-2 font-medium hover:bg-pink-700 disabled:opacity-50"
              >
                {pmLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
