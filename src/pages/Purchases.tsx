import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp, query, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Product, Purchase, PurchaseItem } from '../types';
import { Plus, Search, Trash2, Package, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../utils/format';

export const Purchases: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const [supplierName, setSupplierName] = useState('');
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });

    const q = query(collection(db, 'purchases'), orderBy('date', 'desc'));
    const unsubPurchases = onSnapshot(q, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
    });

    return () => {
      unsubProducts();
      unsubPurchases();
    };
  }, []);

  const handleAddToCart = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const quantity = parseInt(qty, 10);
    const itemCost = parseFloat(cost);

    if (quantity <= 0 || itemCost < 0) return;

    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, qty: item.qty + quantity, cost: itemCost }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        qty: quantity,
        cost: itemCost
      }]);
    }

    setSelectedProduct('');
    setQty('1');
    setCost('');
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cart.length === 0 || !supplierName) return;

    const total = cart.reduce((sum, item) => sum + (item.cost * item.qty), 0);

    try {
      // Create purchase record
      await addDoc(collection(db, 'purchases'), {
        items: cart,
        total,
        supplierName,
        date: new Date().toISOString(),
        recordedBy: user.uid,
        createdAt: serverTimestamp()
      });

      // Update product stock and cost
      for (const item of cart) {
        const productRef = doc(db, 'products', item.productId);
        await updateDoc(productRef, {
          stock: increment(item.qty),
          cost: item.cost, // Update the cost to the latest purchase cost
          updatedAt: new Date().toISOString()
        });
      }

      setIsModalOpen(false);
      setCart([]);
      setSupplierName('');
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('فشل في حفظ المشتريات.');
    }
  };

  const handleDelete = async (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('هل أنت متأكد أنك تريد حذف هذه العملية؟')) {
      try {
        await deleteDoc(doc(db, 'purchases', id));
      } catch (error) {
        console.error('Error deleting purchase:', error);
        alert('فشل في حذف العملية.');
      }
    }
  };

  const filteredPurchases = purchases.filter(p => 
    p.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.id.includes(searchQuery)
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">المشتريات</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              placeholder="البحث باسم المورد أو رقم العملية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              فاتورة مشتريات
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">التاريخ</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">المورد</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">الإجمالي</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 border-b border-gray-100">{format(parseISO(purchase.date), 'yyyy/MM/dd HH:mm')}</td>
                  <td className="p-4 border-b border-gray-100 font-medium">{purchase.supplierName}</td>
                  <td className="p-4 border-b border-gray-100 font-bold text-indigo-600">
                    {formatCurrency(purchase.total)} ج.س
                  </td>
                  <td className="p-4 border-b border-gray-100 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setSelectedPurchase(purchase)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    لا توجد مشتريات مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">فاتورة مشتريات جديدة</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">اسم المورد</label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="أدخل اسم المورد..."
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                <h3 className="font-bold text-gray-900">إضافة منتج</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">المنتج</label>
                    <select
                      value={selectedProduct}
                      onChange={(e) => {
                        setSelectedProduct(e.target.value);
                        const p = products.find(prod => prod.id === e.target.value);
                        if (p) setCost(p.cost.toString());
                      }}
                      className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="">-- اختر المنتج --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">الكمية</label>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">التكلفة (للوحدة)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!selectedProduct || !qty || !cost}
                  className="w-full py-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  إضافة للفاتورة
                </button>
              </div>

              {cart.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">المنتجات المضافة</h3>
                  <table className="w-full text-right border-collapse mb-4">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 border-b">المنتج</th>
                        <th className="p-2 border-b text-center">الكمية</th>
                        <th className="p-2 border-b">التكلفة</th>
                        <th className="p-2 border-b">المجموع</th>
                        <th className="p-2 border-b"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-100">
                          <td className="p-2">{item.name}</td>
                          <td className="p-2 text-center">{item.qty}</td>
                          <td className="p-2">{formatCurrency(item.cost)}</td>
                          <td className="p-2">{formatCurrency((item.cost * item.qty))}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.productId)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-xl font-bold text-indigo-600 text-left">
                    الإجمالي: {formatCurrency(cart.reduce((sum, item) => sum + (item.cost * item.qty), 0))} ج.س
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={cart.length === 0 || !supplierName}
                  className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  حفظ الفاتورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Details Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">تفاصيل المشتريات</h2>
              <button
                onClick={() => setSelectedPurchase(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-sm text-gray-500">رقم الإيصال</p>
                <p className="font-mono font-medium">{selectedPurchase.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">التاريخ</p>
                <p className="font-medium">{format(parseISO(selectedPurchase.date), 'yyyy/MM/dd HH:mm')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">المورد</p>
                <p className="font-medium">{selectedPurchase.supplierName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">الإجمالي</p>
                <p className="font-bold text-indigo-600">{formatCurrency(selectedPurchase.total)} ج.س</p>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-4">المنتجات</h3>
            <table className="w-full text-right border-collapse mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200">المنتج</th>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200 text-center">الكمية</th>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200">التكلفة</th>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {selectedPurchase.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 text-center">{item.qty}</td>
                    <td className="p-3">{formatCurrency(item.cost)} ج.س</td>
                    <td className="p-3 font-medium">{formatCurrency((item.cost * item.qty))} ج.س</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPurchase(null)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
