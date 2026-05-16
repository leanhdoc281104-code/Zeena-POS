import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, Trash2, Mail, Shield, User as UserIcon, Key, RefreshCw, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { apiService } from '../services/apiService';

export const Roles: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'Zeena123',
    role: 'cashier' as 'admin' | 'cashier' | 'observer'
  });

  const fetchUsers = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await apiService.getCollection<User>('users');
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isLoading]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await apiService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });

      const subject = encodeURIComponent('تم إنشاء حسابك في نظام زينة');
      const body = encodeURIComponent(
        `مرحباً ${formData.name}،\n\n` +
        `تم إنشاء حسابك بنجاح في نظام زينة.\n\n` +
        `بيانات الدخول:\n` +
        `البريد الإلكتروني: ${formData.email}\n` +
        `كلمة المرور: ${formData.password}\n` +
        `الدور: ${formData.role === 'admin' ? 'مدير' : 'كاشير'}\n\n` +
        `رابط النظام: ${window.location.origin}\n\n` +
        `يرجى تغيير كلمة المرور بعد تسجيل الدخول الأول.`
      );
      window.open(`mailto:${formData.email}?subject=${subject}&body=${body}`);

      alert('تم إنشاء الحساب بنجاح');
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: 'Zeena123', role: 'cashier' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.message || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
      try {
        await apiService.deleteDoc('users', id);
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };


  return (
    <div className="space-y-6 print:space-y-4" dir="rtl">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الأدوار والحسابات</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-pink-600 bg-white border border-gray-200 rounded-xl transition-all disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
          >
            طباعة
          </button>
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-pink-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              إضافة حساب جديد
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 print:bg-transparent">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">الاسم</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">البريد الإلكتروني</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">الدور</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">تاريخ الإنشاء</th>
                {currentUser?.role === 'admin' && (
                  <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-center print:hidden">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                  <td className="p-4 border-b border-gray-100 print:border-black">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold print:hidden">
                        {user.name?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-gray-900 print:text-black">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-4 border-b border-gray-100 text-gray-600 print:text-black print:border-black">{user.email}</td>
                  <td className="p-4 border-b border-gray-100 print:border-black">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium print:text-black print:bg-transparent print:border print:border-black ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'observer' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'admin' ? 'مدير' : user.role === 'observer' ? 'مراقب' : 'كاشير'}
                    </span>
                  </td>
                  <td className="p-4 border-b border-gray-100 text-gray-600 print:text-black print:border-black">
                    {user.createdAt ? format(parseISO(user.createdAt), 'yyyy/MM/dd') : '-'}
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="p-4 border-b border-gray-100 text-center print:hidden">
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    لا توجد حسابات مسجلة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">إضافة حساب جديد</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الحساب</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                    placeholder="الاسم الكامل"
                  />
                  <UserIcon className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                    placeholder="example@domain.com"
                  />
                  <Mail className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                    placeholder="كلمة مرور قوية (6 أحرف على الأقل)"
                  />
                  <Key className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور (الصلاحية)</label>
                <div className="relative">
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'cashier' | 'observer' })}
                    className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none appearance-none"
                  >
                    <option value="cashier">كاشير (مبيعات فقط)</option>
                    <option value="admin">مدير (صلاحيات كاملة)</option>
                    <option value="observer">مراقب (عرض فقط)</option>
                  </select>
                  <Shield className="w-5 h-5 text-gray-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-pink-600 text-white py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
