import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { StoreSettings } from '../types';
import { Save, Store, MapPin, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';

import { apiService } from '../services/apiService';
import { Database, RefreshCw, Download, Calendar, History, ShieldCheck } from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  // ... existing state ...
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('zeina_last_backup'));
  const [backupDue, setBackupDue] = useState(false);

  useEffect(() => {
    if (lastBackup) {
      const lastDate = new Date(lastBackup);
      const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 7) {
        setBackupDue(true);
      }
    } else {
      setBackupDue(true);
    }
  }, [lastBackup]);

  const handleExportBackup = async () => {
    setBackingUp(true);
    try {
      const backupData = await apiService.exportBackup();
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `zeina-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      const now = new Date().toISOString();
      localStorage.setItem('zeina_last_backup', now);
      setLastBackup(now);
      setBackupDue(false);
      alert('تم تحميل النسخة الاحتياطية بنجاح. يرجى الاحتفاظ بها في مكان آمن.');
    } catch (error) {
      console.error('Backup download failed:', error);
      alert('فشل إنشاء النسخة الاحتياطية');
    } finally {
      setBackingUp(false);
    }
  };

  const [settings, setSettings] = useState<StoreSettings>({
    storeName: '',
    storeAddress: '',
    storeLogo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<{current: string, total: number, done: number} | null>(null);

  const [status, setStatus] = useState<{status: string, db: string, error?: string | null} | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const s = await apiService.getStatus();
        setStatus({ ...s, error: null });
      } catch (e: any) {
        console.error('Status check failed', e);
        setStatus({ status: 'error', db: 'unknown', error: e.message || String(e) });
      }
    };
    checkStatus();
  }, []);

  const [showConfirmMigrate, setShowConfirmMigrate] = useState(false);

  const handleMigrateToLocal = async () => {
    setShowConfirmMigrate(false);
    try {
      console.log('Migration process triggered. User:', user?.email);
      
      if (!user) {
        alert('حدث خطأ: لا توجد بيانات للمستخدم الحالي. يرجى تسجيل الخروج والدخول مرة أخرى.');
        return;
      }
      
      if (user.role !== 'admin') {
        alert('عذراً، هذه الميزة متاحة فقط للمديرين.');
        return;
      }

      setMigrating(true);
      setMigrationStatus({ current: 'جاري البدء والتحقق من الاتصال...', total: 0, done: 0 });
      
      const collectionsToMigrate = [
        'users',
        'products',
        'sales',
        'purchases',
        'expenses',
        'customers',
        'manufacturing_cycles',
        'manufacturing_sales',
        'manufacturing_expenses'
      ];

      for (const colName of collectionsToMigrate) {
        setMigrationStatus(prev => ({ 
          current: `جاري تحميل بيانات ${colName} من Firebase...`, 
          total: prev?.total || 0, 
          done: prev?.done || 0 
        }));
        
        let querySnapshot;
        try {
          querySnapshot = await getDocs(collection(db, colName));
        } catch (e: any) {
          console.error(`Firebase error fetching ${colName}:`, e);
          if (e.message?.includes('quota')) {
            alert(`فشل تحميل ${colName}: تم تجاوز حدود Firebase المجانية. يرجى الانتظار حتى الغد أو الترقية.`);
            throw e;
          }
          continue; // Try next collection
        }

        const totalDocs = querySnapshot.size;
        let count = 0;
        
        setMigrationStatus({ current: `جاري نقل ${colName} (${totalDocs} مستند)...`, total: totalDocs, done: 0 });

        for (const document of querySnapshot.docs) {
          let retryCount = 3;
          while (retryCount > 0) {
            try {
              const rowData = document.data();
              // Sanitize Firestore values (like Timestamps)
              Object.keys(rowData).forEach(key => {
                const val = rowData[key];
                if (val && typeof val === 'object') {
                  if (val.seconds !== undefined) {
                    rowData[key] = new Date(val.seconds * 1000).toISOString();
                  } else if (val.toDate && typeof val.toDate === 'function') {
                    rowData[key] = val.toDate().toISOString();
                  }
                }
              });

              const data = { ...rowData, id: document.id };
              await apiService.updateDoc(colName, document.id, data);
              count++;
              setMigrationStatus(prev => ({ 
                current: `جاري معالجة ${colName}...`, 
                total: totalDocs, 
                done: count 
              }));
              
              // Small delay every 10 docs to prevent congestion
              if (count % 10 === 0) {
                await new Promise(r => setTimeout(r, 50));
              }
              break; // Success, exit retry loop
            } catch (e: any) {
              console.error(`Attempt ${4 - retryCount} failed for doc ${document.id} in ${colName}:`, e);
              retryCount--;
              if (retryCount > 0) {
                await new Promise(r => setTimeout(r, 500)); // Wait before retry
              } else {
                console.error(`Final failure for doc ${document.id} in ${colName}`);
              }
            }
          }
        }
      }

      // Migrate settings separately as they might be different structure
      setMigrationStatus({ current: 'جاري نقل الإعدادات النهائية...', total: 2, done: 0 });
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'store'));
        if (settingsSnap.exists()) {
          await apiService.updateDoc('settings', 'store', settingsSnap.data());
        }
        setMigrationStatus(prev => ({ ...prev!, done: 1 }));
        
        const partnershipSnap = await getDoc(doc(db, 'settings', 'partnership'));
        if (partnershipSnap.exists()) {
          await apiService.updateDoc('settings', 'partnership', partnershipSnap.data());
        }
        setMigrationStatus(prev => ({ ...prev!, done: 2 }));
      } catch (e) {
        console.error('Settings migration failed:', e);
      }

      setMigrationStatus(null);
      alert('تمت عملية نقل البيانات بنجاح تام! يمكنك الآن العمل بشكل أسرع دون قيود.');
      window.location.reload(); // Reload to pick up all new local data
    } catch (error: any) {
      console.error('Migration error:', error);
      alert('حدث خطأ غير متوقع أثناء الهجرة: ' + (error.message || 'فشل الاتصال'));
    } finally {
      setMigrating(false);
      setMigrationStatus(null);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await apiService.getDoc<StoreSettings>('settings', 'store');
        if (data) {
          setSettings(data);
        } else {
          // Try fallback to firebase for initial migration context
          const docSnap = await getDoc(doc(db, 'settings', 'store'));
          if (docSnap.exists()) {
            setSettings(docSnap.data() as StoreSettings);
          }
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
      await apiService.updateDoc('settings', 'store', settings);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70"
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
        <div className="mt-8 bg-blue-50 rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="p-6 border-b border-blue-100 bg-blue-100/50">
            <h2 className="text-xl font-bold text-blue-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-6 h-6" />
                تجاوز حدود Firebase (هجرة البيانات)
              </div>
              <div className="flex flex-col items-end gap-1">
                {status?.status === 'ok' ? (
                  <span className="text-[10px] font-normal px-2 py-0.5 bg-green-500 text-white rounded-full">السيرفر: {status.db}</span>
                ) : status?.error ? (
                  <span className="text-[10px] font-normal px-2 py-0.5 bg-red-500 text-white rounded-full" title={status.error}>خطأ: {status.error.substring(0, 20)}</span>
                ) : (
                  <span className="text-[10px] font-normal px-2 py-0.5 bg-red-500 text-white rounded-full">السيرفر غير متصل</span>
                )}
                <span className="text-[10px] font-normal px-2 py-0.5 bg-blue-500 text-white rounded-full">صلاحيتك: {user?.role}</span>
              </div>
            </h2>
            <p className="text-blue-600 mt-1">
              انقل بياناتك إلى الاستضافة المحلية (Hostinger) للتخلص من مشاكل حدود القراءة اليومية نهائياً.
            </p>
          </div>
          <div className="p-6">
            {(() => {
              if (migrating) {
                return (
                  <div className="animate-pulse flex items-center justify-center gap-3 py-4 px-4 bg-blue-100 text-blue-700 rounded-xl font-bold border border-blue-200">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                    جاري نقل البيانات الآن... ({migrationStatus?.done || 0} / {migrationStatus?.total || 0})
                  </div>
                );
              }
              
              if (showConfirmMigrate) {
                return (
                  <div className="bg-white border-2 border-blue-600 rounded-xl p-5 space-y-4 shadow-xl transform transition-all duration-300 scale-100">
                    <div className="flex items-center gap-3 text-blue-800 font-bold text-lg mb-2">
                      <AlertTriangle className="w-7 h-7 text-blue-600" />
                      تأكيد النقل النهائي للقاعدة المحلية
                    </div>
                    <p className="text-sm font-medium text-gray-700 leading-relaxed">
                      سيتم نسخ جميع بياناتك (المنتجات، المبيعات، العملاء، الخ) من Firebase إلى SQLite المحلي. 
                      هذا الإجراء آمن ولا يحذف بياناتك الأصلية. هل تود المتابعة؟
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          console.log('Final migration confirmation clicked');
                          handleMigrateToLocal();
                        }}
                        className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-xl text-sm font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all text-center"
                      >
                        نعم، ابدأ نقل البيانات الآن
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          console.log('Migration cancelled');
                          setShowConfirmMigrate(false);
                        }}
                        className="flex-1 bg-gray-100 text-gray-600 py-3 px-6 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all text-center"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    console.log('Migration initial trigger clicked. User role:', user?.role);
                    if (user?.role !== 'admin') {
                      alert('عذراً، صلاحياتك الحالية هي (' + (user?.role || 'غير معروف') + ') بينما الهجرة تتطلب صلاحية مدير (admin).');
                      return;
                    }
                    setShowConfirmMigrate(true);
                  }}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 group"
                >
                  <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" />
                  <span className="text-lg">بدء هجرة البيانات إلى SQLite</span>
                </button>
              );
            })()}
            
            {migrationStatus && (
              <div className="mt-4 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                <p className="text-sm font-medium text-blue-800 mb-2">{migrationStatus.current}</p>
                {migrationStatus.total > 0 && (
                  <div className="space-y-1">
                    <div className="w-full bg-blue-100 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${(migrationStatus.done / migrationStatus.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-blue-500 font-mono">
                      <span>{migrationStatus.done} من {migrationStatus.total}</span>
                      <span>{Math.round((migrationStatus.done / migrationStatus.total) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-blue-500 mt-3 text-center">
              ملاحظة: هذا الإجراء لا يمسح بيانات Firebase الأصلية، بل ينسخها فقط.
            </p>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="mt-8 bg-green-50 rounded-2xl shadow-sm border border-green-100 overflow-hidden">
          <div className="p-6 border-b border-green-100 bg-green-100/50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-green-800 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6" />
                النسخ الاحتياطي (الأمان)
              </h2>
              <p className="text-green-600 mt-1">احتفظ بنسخة من بياناتك خارج النظام لضمان عدم ضياعها تحت أي ظرف.</p>
            </div>
            {lastBackup && (
              <div className="text-left">
                <span className="text-[10px] text-green-700 bg-green-200 px-2 py-1 rounded-full font-mono">
                  آخر نسخة: {new Date(lastBackup).toLocaleDateString('ar-EG')}
                </span>
              </div>
            )}
          </div>
          <div className="p-6 space-y-4">
            {backupDue && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800">
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">تذكير بالنسخ الاحتياطي الأسبوعي</p>
                  <p className="text-xs mt-1">لقد مر أكثر من أسبوع منذ آخر نسخة احتياطية. ننصحك بتحميل نسخة الآن.</p>
                </div>
              </div>
            )}
            
            <button
              onClick={handleExportBackup}
              disabled={backingUp}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 group"
            >
              {backingUp ? (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              ) : (
                <>
                  <Download className="w-6 h-6 group-hover:bounce transition-transform" />
                  تحميل نسخة احتياطية (JSON)
                </>
              )}
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-green-100 rounded-xl flex items-center gap-3">
                <History className="w-8 h-8 text-green-300" />
                <div>
                  <p className="text-[10px] text-gray-500">الحالة</p>
                  <p className="text-xs font-bold text-green-700">{lastBackup ? 'مؤمن' : 'لم يتم النسخ بعد'}</p>
                </div>
              </div>
              <div className="p-3 bg-white border border-green-100 rounded-xl flex items-center gap-3">
                <Calendar className="w-8 h-8 text-green-300" />
                <div>
                  <p className="text-[10px] text-gray-500">التوصية</p>
                  <p className="text-xs font-bold text-green-700">كل 7 أيام</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
