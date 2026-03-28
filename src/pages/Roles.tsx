import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { User } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, Trash2, Mail, Shield, User as UserIcon, Key } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const Roles: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier' as 'admin' | 'cashier' | 'observer'
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as User));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Initialize secondary app to create user without logging out the current admin
      const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, "SecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        formData.email, 
        formData.password
      );
      const newUid = userCredential.user.uid;

      // Save user data to Firestore using the primary app (which has admin privileges)
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        createdAt: new Date().toISOString()
      });

      // Sign out and clean up secondary app
      await signOut(secondaryAuth);

      // Send email via mailto
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
      setFormData({ name: '', email: '', password: '', role: 'cashier' });
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/operation-not-allowed') {
        alert('عذراً، ميزة تسجيل الدخول بالبريد الإلكتروني غير مفعلة.\n\nيرجى الذهاب إلى لوحة تحكم Firebase -> Authentication -> Sign-in method وتفعيل Email/Password.');
      } else {
        alert(error.message || 'حدث خطأ أثناء إنشاء الحساب');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحساب؟ (سيتم حذفه من قاعدة البيانات فقط)')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الأدوار والحسابات</h1>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">الاسم</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">البريد الإلكتروني</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">الدور</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">تاريخ الإنشاء</th>
                {currentUser?.role === 'admin' && (
                  <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-center">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.uid} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="p-4 border-b border-gray-100 text-gray-600">{user.email}</td>
                  <td className="p-4 border-b border-gray-100">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'observer' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role === 'admin' ? 'مدير' : user.role === 'observer' ? 'مراقب' : 'كاشير'}
                    </span>
                  </td>
                  <td className="p-4 border-b border-gray-100 text-gray-600">
                    {user.createdAt ? format(parseISO(user.createdAt), 'yyyy/MM/dd') : '-'}
                  </td>
                  {currentUser?.role === 'admin' && (
                    <td className="p-4 border-b border-gray-100 text-center">
                      <button
                        onClick={() => handleDelete(user.uid)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
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

      {/* Add User Modal */}
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
