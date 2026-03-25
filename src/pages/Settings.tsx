import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { StoreSettings } from '../types';
import { Save, Store, MapPin, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: '',
    storeAddress: '',
    storeLogo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

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
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docRef = doc(db, 'settings', 'store');
      await setDoc(docRef, settings);
      alert('تم حفظ الإعدادات بنجاح');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file, 500);
        setSettings({ ...settings, storeLogo: compressedImage });
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('فشل في معالجة الصورة.');
      }
    }
  };

  const handleClearData = async () => {
    if (user?.role !== 'admin') return;
    
    const confirm1 = window.confirm('تحذير خطير: هل أنت متأكد من رغبتك في مسح جميع البيانات؟ (المنتجات، المبيعات، العملاء، التصنيع، الخ)');
    if (!confirm1) return;
    
    const confirm2 = window.prompt('لتأكيد المسح، اكتب كلمة "تأكيد" في المربع أدناه:');
    if (confirm2 !== 'تأكيد') {
      alert('تم إلغاء عملية المسح.');
      return;
    }

    setClearing(true);
    try {
      const collectionsToClear = [
        'products',
        'sales',
        'purchases',
        'expenses',
        'customers',
        'manufacturing_cycles',
        'manufacturing_sales',
        'manufacturing_expenses'
      ];

      for (const colName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, colName));
        const deletePromises = querySnapshot.docs.map(document => deleteDoc(doc(db, colName, document.id)));
        await Promise.all(deletePromises);
      }

      // Reset partnership settings
      await setDoc(doc(db, 'settings', 'partnership'), {
        partner1Paid: 0,
        partner2Paid: 0
      });

      alert('تم مسح جميع البيانات بنجاح. النظام الآن جديد بالكامل.');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('حدث خطأ أثناء مسح البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-2xl font-bold text-gray-800">إعدادات المتجر</h2>
          <p className="text-gray-500 mt-1">تكوين معلومات المتجر التي تظهر في الفواتير</p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-gray-400" />
                اسم المتجر
              </div>
            </label>
            <input
              type="text"
              required
              disabled={user?.role === 'observer'}
              value={settings.storeName}
              onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="أدخل اسم المتجر"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                عنوان المتجر
              </div>
            </label>
            <input
              type="text"
              disabled={user?.role === 'observer'}
              value={settings.storeAddress || ''}
              onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="أدخل عنوان المتجر (اختياري)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-400" />
                شعار المتجر (يظهر في الفاتورة)
              </div>
            </label>
            <div className="flex items-center gap-6">
              {settings.storeLogo ? (
                <div className="relative w-24 h-24 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  <img src={settings.storeLogo} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                  <button
                    type="button"
                    disabled={user?.role === 'observer'}
                    onClick={() => setSettings({ ...settings, storeLogo: '' })}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  disabled={user?.role === 'observer'}
                  onChange={handleLogoUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-2">يفضل استخدام صورة بخلفية شفافة (PNG) بحجم أقل من 500 كيلوبايت.</p>
              </div>
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="pt-4 border-t border-gray-100">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    حفظ الإعدادات
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>

      {user?.role === 'admin' && (
        <div className="mt-8 bg-red-50 rounded-2xl shadow-sm border border-red-100 overflow-hidden">
          <div className="p-6 border-b border-red-100 bg-red-100/50">
            <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              منطقة الخطر (مسح البيانات)
            </h2>
            <p className="text-red-600 mt-1">هذا الإجراء سيقوم بمسح كافة البيانات في النظام (المنتجات، المبيعات، العملاء، الخ) وإعادته كأنه جديد. لا يمكن التراجع عن هذا الإجراء.</p>
          </div>
          <div className="p-6">
            <button
              onClick={handleClearData}
              disabled={clearing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70"
            >
              {clearing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  مسح جميع البيانات والبدء من جديد
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
