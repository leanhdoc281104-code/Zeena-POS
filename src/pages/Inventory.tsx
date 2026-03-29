import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Product } from '../types';
import { useAuth } from '../AuthContext';
import { formatCurrency } from '../utils/format';
import { Plus, Search, Edit, Trash2, Package, ScanLine, Image as ImageIcon } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { format, parseISO } from 'date-fns';
import { compressImage } from '../utils/imageUtils';
import { Toast } from '../components/Toast';
import { ExportButtons } from '../components/ExportButtons';

export const Inventory: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: '',
    cost: '',
    stock: '',
    minStock: '',
    unit: 'piece',
    category: '',
    expiryDate: '',
    imageUrl: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isScanning) {
      html5QrCode = new Html5Qrcode('inventory-barcode-reader');
      
      const config = { fps: 10, qrbox: { width: 300, height: 150 } };
      
      html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          // Play beep sound
          try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.value = 800; // Beep frequency
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 0.01);
            gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
          } catch (e) {
            console.error("Audio play failed", e);
          }

          setFormData(prev => ({ ...prev, barcode: decodedText }));
          setIsScanning(false);
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      ).catch((err) => {
        console.error("Error starting scanner", err);
        const errorMsg = err?.toString() || '';
        if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission dismissed')) {
          setToast({ message: 'الرجاء السماح بالوصول إلى الكاميرا لاستخدام الماسح الضوئي.', type: 'error' });
        } else {
          setToast({ message: 'فشل تشغيل الكاميرا', type: 'error' });
        }
        setIsScanning(false);
      });
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode?.clear();
        }).catch(console.error);
      }
    };
  }, [isScanning]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedImage = await compressImage(file, 500);
        setFormData(prev => ({ ...prev, imageUrl: compressedImage }));
      } catch (error) {
        console.error('Error compressing image:', error);
        alert('فشل في معالجة الصورة.');
      }
    }
  };

  const handleOpenModal = (product?: Product) => {
    setIsScanning(false);
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        barcode: product.barcode,
        price: product.price.toString(),
        cost: product.cost.toString(),
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
        unit: product.unit,
        category: product.category || '',
        expiryDate: product.expiryDate ? product.expiryDate.split('T')[0] : '',
        imageUrl: product.imageUrl || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '', barcode: '', price: '', cost: '', stock: '', minStock: '', unit: 'piece', category: '', expiryDate: '', imageUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin') return;

    const productData = {
      name: formData.name,
      barcode: formData.barcode,
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost),
      stock: parseInt(formData.stock, 10),
      minStock: parseInt(formData.minStock, 10),
      unit: formData.unit,
      category: formData.category,
      expiryDate: formData.expiryDate ? new Date(formData.expiryDate).toISOString() : null,
      imageUrl: formData.imageUrl,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
      setToast({ message: 'فشل في حفظ المنتج.', type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('هل أنت متأكد أنك تريد حذف هذا المنتج؟')) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (error) {
        console.error('Error deleting product:', error);
        setToast({ message: 'فشل في حذف المنتج.', type: 'error' });
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode.includes(searchQuery)
  );

  const exportData = filteredProducts.map(p => ({
    'المنتج': p.name,
    'الباركود': p.barcode,
    'الفئة': p.category,
    'سعر البيع': p.price,
    'التكلفة': p.cost,
    'المخزون الحالي': p.stock,
    'الحد الأدنى': p.minStock,
    'الوحدة': p.unit,
    'تاريخ الانتهاء': p.expiryDate ? format(parseISO(p.expiryDate), 'yyyy/MM/dd') : 'لا يوجد'
  }));

  return (
    <div className="space-y-6" dir="rtl">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">إدارة المخزون</h1>
        <div className="flex items-center gap-3">
          <ExportButtons data={exportData} filename="تقرير_المخزون" />
          {user?.role === 'admin' && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              إضافة منتج
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-12rem)] print:h-auto print:border-none print:shadow-none">
        <div className="p-4 border-b border-gray-200 print:hidden">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث بالاسم أو الباركود..."
              className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto print:overflow-visible">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10 print:static print:bg-transparent">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">المنتج</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">الباركود</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">السعر / التكلفة</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">المخزون</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">تاريخ الانتهاء</th>
                {user?.role === 'admin' && (
                  <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-left print:hidden">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                  <td className="p-4 print:border-b print:border-black">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0 print:hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 print:text-black">{product.name}</p>
                        <p className="text-sm text-gray-500 print:text-black">{product.category}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 font-mono text-sm print:text-black print:border-b print:border-black">{product.barcode}</td>
                  <td className="p-4 print:border-b print:border-black">
                    <p className="font-medium text-gray-900 print:text-black">{formatCurrency(product.price)} ج.س</p>
                    {user?.role === 'admin' && (
                      <p className="text-sm text-gray-500 print:text-black">التكلفة: {formatCurrency(product.cost)} ج.س</p>
                    )}
                  </td>
                  <td className="p-4 print:border-b print:border-black">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${product.stock <= product.minStock ? 'text-red-600' : 'text-gray-900'} print:text-black`}>
                        {product.stock}
                      </span>
                      <span className="text-sm text-gray-500 print:text-black">{product.unit === 'piece' ? 'قطعة' : 'وزن'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 print:text-black print:border-b print:border-black">
                    {product.expiryDate ? format(parseISO(product.expiryDate), 'MMM dd, yyyy') : '-'}
                  </td>
                  {user?.role === 'admin' && (
                    <td className="p-4 text-left print:hidden">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleOpenModal(product)} className="p-2 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors">
                          <Edit className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{editingProduct ? 'تعديل المنتج' : 'إضافة منتج'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الباركود</label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} className="flex-1 p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                    <button type="button" onClick={() => setIsScanning(!isScanning)} className={`px-3 py-2 rounded-xl border transition-colors ${isScanning ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                      <ScanLine className="w-5 h-5" />
                    </button>
                  </div>
                  {isScanning && (
                    <div className="mt-2 p-4 bg-white rounded-xl shadow-sm border border-gray-200 relative overflow-hidden flex justify-center">
                      <div className="relative w-full max-w-sm">
                        <div id="inventory-barcode-reader" className="w-full rounded-lg overflow-hidden"></div>
                        <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center">
                           <div className="w-[300px] h-[150px] relative border-2 border-pink-500 rounded-lg overflow-hidden">
                             <div className="absolute left-0 w-full h-1 bg-pink-500 shadow-[0_0_10px_#ec4899] animate-scan"></div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع *</label>
                  <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر التكلفة *</label>
                  <input required type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المخزون الحالي *</label>
                  <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تنبيه الحد الأدنى للمخزون *</label>
                  <input required type="number" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة *</label>
                  <select value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none">
                    <option value="piece">قطعة</option>
                    <option value="weight">وزن (كجم/جم)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                  <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
                  <input type="date" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">صورة المنتج</label>
                  <label className="flex items-center gap-4 cursor-pointer group">
                    {formData.imageUrl ? (
                      <div className="relative w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                        <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setFormData({ ...formData, imageUrl: '' });
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-400 shrink-0 group-hover:bg-gray-100 group-hover:border-pink-400 transition-all">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageUpload}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 transition-all cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 mt-2">اضغط على الصورة لفتح الكاميرا مباشرة، أو اختر ملفاً.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
                  إلغاء
                </button>
                <button type="submit" className="flex-1 py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium transition-colors shadow-sm">
                  حفظ المنتج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
