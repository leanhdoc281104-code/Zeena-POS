import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, Users, Search, DollarSign } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from '../utils/format';

export const Customers: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    debtBalance: '0'
  });

  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'customers'), {
        name: formData.name,
        phone: formData.phone,
        debtBalance: parseFloat(formData.debtBalance) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', debtBalance: '0' });
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('فشل في إضافة العميل.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) return;

    try {
      const customerRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        debtBalance: increment(-amount),
        updatedAt: new Date().toISOString()
      });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('فشل في تسجيل الدفعة.');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">العملاء والديون</h1>
        {user?.role === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            إضافة عميل
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="البحث بالاسم أو رقم الهاتف..."
              className="w-full pr-10 pl-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">العميل</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">رقم الهاتف</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200">تاريخ الانضمام</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-left">رصيد الدين</th>
                {user?.role === 'admin' && (
                  <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-left">الإجراءات</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لم يتم العثور على عملاء.</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{customer.phone}</td>
                    <td className="p-4 text-gray-600">
                      {customer.createdAt ? format(parseISO(customer.createdAt), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="p-4 text-left">
                      <span className={`font-bold ${customer.debtBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(customer.debtBalance)} ج.س
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td className="p-4 text-left">
                        {customer.debtBalance > 0 && (
                          <button
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setIsPaymentModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors"
                          >
                            <DollarSign className="w-4 h-4" />
                            استلام دفعة
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">إضافة عميل</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف *</label>
                <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رصيد الدين الافتتاحي</label>
                <input type="number" step="0.01" value={formData.debtBalance} onChange={e => setFormData({...formData, debtBalance: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
                  إلغاء
                </button>
                <button type="submit" className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm">
                  حفظ العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">استلام دفعة</h2>
            <p className="text-gray-500 mb-6">تسجيل دفعة من {selectedCustomer.name}</p>
            
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="p-4 bg-red-50 rounded-xl mb-4">
                <span className="text-red-700 text-sm font-medium">رصيد الدين الحالي</span>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(selectedCustomer.debtBalance)} ج.س</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مبلغ الدفعة *</label>
                <input required type="number" step="0.01" max={selectedCustomer.debtBalance} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" />
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
                  إلغاء
                </button>
                <button type="submit" className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-sm">
                  تأكيد الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
