import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';
import { Plus, Edit, Trash2, X, Factory, DollarSign, Package, FileText, Receipt, CheckCircle, Clock, LayoutDashboard, Handshake } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const Manufacturing: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cycles' | 'sales' | 'expenses'>('dashboard');
  
  const [cycles, setCycles] = useState<ManufacturingCycle[]>([]);
  const [sales, setSales] = useState<ManufacturingSale[]>([]);
  const [expenses, setExpenses] = useState<ManufacturingExpense[]>([]);
  
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  const [cycleFormData, setCycleFormData] = useState({
    productName: '',
    fundingAmount: 0,
    manufacturingCost: 0,
    cartonsProduced: 0,
    cartonPrice: 0,
    status: 'active' as 'active' | 'completed'
  });

  const [saleFormData, setSaleFormData] = useState({
    cycleId: '',
    customerName: '',
    customerPhone: '',
    cartonsSold: 0,
  });

  const [expenseFormData, setExpenseFormData] = useState({
    cycleId: '',
    description: '',
    amount: 0,
  });

  useEffect(() => {
    if (!user) return;

    const cyclesUnsubscribe = onSnapshot(
      query(collection(db, 'manufacturing_cycles'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setCycles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingCycle)));
      }
    );

    const salesUnsubscribe = onSnapshot(
      query(collection(db, 'manufacturing_sales'), orderBy('date', 'desc')),
      (snapshot) => {
        setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingSale)));
      }
    );

    const expensesUnsubscribe = onSnapshot(
      query(collection(db, 'manufacturing_expenses'), orderBy('date', 'desc')),
      (snapshot) => {
        setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingExpense)));
      }
    );

    return () => {
      cyclesUnsubscribe();
      salesUnsubscribe();
      expensesUnsubscribe();
    };
  }, [user]);

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role === 'observer') return;

    try {
      await addDoc(collection(db, 'manufacturing_cycles'), {
        ...cycleFormData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsCycleModalOpen(false);
      setCycleFormData({
        productName: '',
        fundingAmount: 0,
        manufacturingCost: 0,
        cartonsProduced: 0,
        cartonPrice: 0,
        status: 'active'
      });
    } catch (error) {
      console.error('Error creating cycle:', error);
      alert('حدث خطأ أثناء إضافة الدورة');
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role === 'observer') return;

    const cycle = cycles.find(c => c.id === saleFormData.cycleId);
    if (!cycle) return;

    const totalAmount = saleFormData.cartonsSold * cycle.cartonPrice;

    try {
      await addDoc(collection(db, 'manufacturing_sales'), {
        ...saleFormData,
        totalAmount,
        date: new Date().toISOString(),
        recordedBy: user.uid
      });
      setIsSaleModalOpen(false);
      setSaleFormData({
        cycleId: '',
        customerName: '',
        customerPhone: '',
        cartonsSold: 0,
      });
    } catch (error) {
      console.error('Error creating sale:', error);
      alert('حدث خطأ أثناء إضافة المبيعة');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role === 'observer') return;

    try {
      await addDoc(collection(db, 'manufacturing_expenses'), {
        ...expenseFormData,
        date: new Date().toISOString(),
        recordedBy: user.uid
      });
      setIsExpenseModalOpen(false);
      setExpenseFormData({
        cycleId: '',
        description: '',
        amount: 0,
      });
    } catch (error) {
      console.error('Error creating expense:', error);
      alert('حدث خطأ أثناء إضافة المنصرف');
    }
  };

  const handleCompleteCycle = async (id: string) => {
    if (!user || user.role === 'observer') return;
    if (window.confirm('هل أنت متأكد من إكمال هذه الدورة؟')) {
      try {
        await updateDoc(doc(db, 'manufacturing_cycles', id), {
          status: 'completed',
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error updating cycle:', error);
      }
    }
  };

  const handleDeleteCycle = async (id: string) => {
    if (!user || user.role !== 'admin') return;
    if (window.confirm('هل أنت متأكد من حذف هذه الدورة؟ سيتم حذف جميع المبيعات والمنصرفات المرتبطة بها.')) {
      try {
        await deleteDoc(doc(db, 'manufacturing_cycles', id));
        // Note: Ideally, you should also delete related sales and expenses via a Cloud Function or batch delete here.
      } catch (error) {
        console.error('Error deleting cycle:', error);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SD', {
      style: 'currency',
      currency: 'SDG',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Dashboard Calculations
  const totalFunding = cycles.reduce((sum, c) => sum + c.fundingAmount, 0);
  const totalManufacturingCosts = cycles.reduce((sum, c) => sum + c.manufacturingCost, 0);
  const totalAdditionalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCosts = totalManufacturingCosts + totalAdditionalExpenses;
  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const netProfit = totalSales - totalCosts;
  const zeinaShare = netProfit * 0.5;
  const bakriShare = netProfit * 0.5;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">التصنيع</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 space-x-reverse border-b border-gray-200">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-4 px-4 text-sm font-medium ${activeTab === 'dashboard' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <LayoutDashboard className="w-5 h-5 inline-block ml-2" />
          لوحة التحكم
        </button>
        <button
          onClick={() => setActiveTab('cycles')}
          className={`pb-4 px-4 text-sm font-medium ${activeTab === 'cycles' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Factory className="w-5 h-5 inline-block ml-2" />
          دورات الإنتاج
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-4 px-4 text-sm font-medium ${activeTab === 'sales' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileText className="w-5 h-5 inline-block ml-2" />
          المبيعات
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-4 px-4 text-sm font-medium ${activeTab === 'expenses' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Receipt className="w-5 h-5 inline-block ml-2" />
          المنصرفات
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalSales)}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">إجمالي التكاليف والمنصرفات</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalCosts)}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <Receipt className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">نصيب متجر زينة (50%)</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(zeinaShare)}</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <Handshake className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">نصيب مصنع بكري (50%)</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(bakriShare)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Factory className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">أرباح دورات الإنتاج</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">الدورة</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">المبيعات</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">التكاليف</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">صافي الربح</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cycles.map((cycle) => {
                    const cycleSales = sales.filter(s => s.cycleId === cycle.id).reduce((sum, s) => sum + s.totalAmount, 0);
                    const cycleExpenses = expenses.filter(e => e.cycleId === cycle.id).reduce((sum, e) => sum + e.amount, 0);
                    const cycleCosts = cycle.manufacturingCost + cycleExpenses;
                    const cycleProfit = cycleSales - cycleCosts;

                    return (
                      <tr key={cycle.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{cycle.productName}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(cycleSales)}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(cycleCosts)}</td>
                        <td className={`px-6 py-4 text-sm font-bold ${cycleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(cycleProfit)}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {cycle.status === 'active' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              نشط
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              مكتمل
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cycles Tab */}
      {activeTab === 'cycles' && (
        <div className="space-y-6">
          {user?.role !== 'observer' && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsCycleModalOpen(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5 ml-2" />
                إضافة دورة إنتاج
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cycles.map((cycle) => (
              <div key={cycle.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{cycle.productName}</h3>
                    <p className="text-sm text-gray-500">{format(new Date(cycle.createdAt), 'dd MMMM yyyy', { locale: ar })}</p>
                  </div>
                  {cycle.status === 'active' ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      مكتمل
                    </span>
                  )}
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">مبلغ التمويل:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(cycle.fundingAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">تكلفة التصنيع:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(cycle.manufacturingCost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">الإنتاجية:</span>
                    <span className="font-medium text-gray-900">{cycle.cartonsProduced} كرتونة</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">سعر البيع للكرتونة:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(cycle.cartonPrice)}</span>
                  </div>
                </div>

                {user?.role !== 'observer' && (
                  <div className="flex justify-end space-x-2 space-x-reverse pt-4 border-t border-gray-100">
                    {cycle.status === 'active' && (
                      <button
                        onClick={() => handleCompleteCycle(cycle.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="إكمال الدورة"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteCycle(cycle.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="حذف الدورة"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {user?.role !== 'observer' && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsSaleModalOpen(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5 ml-2" />
                إضافة مبيعة
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">التاريخ</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">دورة الإنتاج</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">العميل</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">الكمية (كرتونة)</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sales.map((sale) => {
                    const cycle = cycles.find(c => c.id === sale.cycleId);
                    return (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {format(new Date(sale.date), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {cycle?.productName || 'غير معروف'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div>{sale.customerName}</div>
                          <div className="text-xs text-gray-500">{sale.customerPhone}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{sale.cartonsSold}</td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {user?.role !== 'observer' && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsExpenseModalOpen(true)}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-5 h-5 ml-2" />
                إضافة منصرف
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">التاريخ</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">دورة الإنتاج</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">البيان</th>
                    <th className="px-6 py-3 text-sm font-semibold text-gray-900">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((expense) => {
                    const cycle = cycles.find(c => c.id === expense.cycleId);
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {format(new Date(expense.date), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {cycle?.productName || 'غير معروف'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{expense.description}</td>
                        <td className="px-6 py-4 text-sm font-bold text-red-600">
                          {formatCurrency(expense.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {/* Cycle Modal */}
      {isCycleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">إضافة دورة إنتاج</h2>
              <button onClick={() => setIsCycleModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateCycle} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  value={cycleFormData.productName}
                  onChange={(e) => setCycleFormData({ ...cycleFormData, productName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ التمويل</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={cycleFormData.fundingAmount}
                  onChange={(e) => setCycleFormData({ ...cycleFormData, fundingAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تكلفة التصنيع</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={cycleFormData.manufacturingCost}
                  onChange={(e) => setCycleFormData({ ...cycleFormData, manufacturingCost: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الإنتاجية (كرتونة)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={cycleFormData.cartonsProduced}
                    onChange={(e) => setCycleFormData({ ...cycleFormData, cartonsProduced: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">سعر البيع (للكرتونة)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={cycleFormData.cartonPrice}
                    onChange={(e) => setCycleFormData({ ...cycleFormData, cartonPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  حفظ الدورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Modal */}
      {isSaleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">إضافة مبيعة تصنيع</h2>
              <button onClick={() => setIsSaleModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateSale} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">دورة الإنتاج</label>
                <select
                  required
                  value={saleFormData.cycleId}
                  onChange={(e) => setSaleFormData({ ...saleFormData, cycleId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">اختر الدورة...</option>
                  {cycles.filter(c => c.status === 'active').map(cycle => (
                    <option key={cycle.id} value={cycle.id}>{cycle.productName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
                <input
                  type="text"
                  required
                  value={saleFormData.customerName}
                  onChange={(e) => setSaleFormData({ ...saleFormData, customerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم هاتف العميل</label>
                <input
                  type="text"
                  required
                  value={saleFormData.customerPhone}
                  onChange={(e) => setSaleFormData({ ...saleFormData, customerPhone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الكمية (كرتونة)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={saleFormData.cartonsSold}
                  onChange={(e) => setSaleFormData({ ...saleFormData, cartonsSold: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  حفظ المبيعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">إضافة منصرف تصنيع</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">دورة الإنتاج</label>
                <select
                  required
                  value={expenseFormData.cycleId}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, cycleId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">اختر الدورة...</option>
                  {cycles.filter(c => c.status === 'active').map(cycle => (
                    <option key={cycle.id} value={cycle.id}>{cycle.productName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البيان</label>
                <input
                  type="text"
                  required
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={expenseFormData.amount}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  حفظ المنصرف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
