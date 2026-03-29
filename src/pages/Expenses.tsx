import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Expense } from '../types';
import { useAuth } from '../AuthContext';
import { Plus, Receipt, Calendar } from 'lucide-react';
import { format, parseISO, isToday, isThisWeek, isThisMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { formatCurrency } from '../utils/format';
import { ExportButtons } from '../components/ExportButtons';
import { DateRangeFilter } from '../components/DateRangeFilter';

export const Expenses: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'عام',
  });

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: new Date().toISOString(),
        recordedBy: user.uid,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ description: '', amount: '', category: 'عام' });
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('فشل في إضافة المصروف.');
    }
  };

  const filteredExpenses = expenses.filter(e => {
    let matchesTime = true;
    const expenseDate = parseISO(e.date);
    if (timeFilter === 'today') matchesTime = isToday(expenseDate);
    else if (timeFilter === 'week') matchesTime = isThisWeek(expenseDate);
    else if (timeFilter === 'month') matchesTime = isThisMonth(expenseDate);
    else if (timeFilter === 'custom' && startDate && endDate) {
      matchesTime = isWithinInterval(expenseDate, {
        start: startOfDay(parseISO(startDate)),
        end: endOfDay(parseISO(endDate))
      });
    }
    return matchesTime;
  });

  const exportData = filteredExpenses.map(expense => ({
    'التاريخ': format(parseISO(expense.date), 'yyyy/MM/dd HH:mm'),
    'الوصف': expense.description,
    'الفئة': expense.category,
    'المبلغ': expense.amount
  }));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">المصروفات</h1>
        <div className="flex items-center gap-3">
          <ExportButtons data={exportData} filename="تقرير_المصروفات" />
          {user?.role === 'admin' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-xl hover:bg-pink-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              تسجيل مصروف
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full print:hidden">
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none bg-white"
        >
          <option value="all">كل الأوقات</option>
          <option value="today">اليوم</option>
          <option value="week">هذا الأسبوع</option>
          <option value="month">هذا الشهر</option>
          <option value="custom">فترة مخصصة</option>
        </select>
        
        {timeFilter === 'custom' && (
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 print:bg-transparent">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">التاريخ</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">الوصف</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">الفئة</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-left print:text-black print:border-black">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 print:text-black">
                    <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50 print:hidden" />
                    <p>لم يتم تسجيل أي مصروفات بعد.</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                    <td className="p-4 text-gray-600 print:text-black print:border-b print:border-black">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 print:hidden" />
                        {format(parseISO(expense.date), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-900 print:text-black print:border-b print:border-black">{expense.description}</td>
                    <td className="p-4 print:border-b print:border-black">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 print:bg-transparent print:border print:border-gray-300 print:text-black">
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-red-600 text-left print:text-black print:border-b print:border-black">
                      -{formatCurrency(expense.amount)} ج.س
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">تسجيل مصروف</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف *</label>
                <input required type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" placeholder="مثال: أدوات مكتبية" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ *</label>
                <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الفئة *</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none">
                  <option value="عام">عام</option>
                  <option value="فواتير وخدمات">فواتير وخدمات</option>
                  <option value="إيجار">إيجار</option>
                  <option value="رواتب">رواتب</option>
                  <option value="صيانة">صيانة</option>
                  <option value="تسويق">تسويق</option>
                </select>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors">
                  إلغاء
                </button>
                <button type="submit" className="flex-1 py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium transition-colors shadow-sm">
                  حفظ المصروف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
