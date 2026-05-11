import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { useAuth } from '../AuthContext';
import { Sale, Expense, Purchase, PartnershipSettings, ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';
import { formatCurrency } from '../utils/format';
import { Users, DollarSign, PieChart as PieChartIcon, Save, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format, parseISO, isToday, isThisWeek, isThisMonth, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ExportButtons } from '../components/ExportButtons';
import { DateRangeFilter } from '../components/DateRangeFilter';

export const Partnership: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [mfgCycles, setMfgCycles] = useState<ManufacturingCycle[]>([]);
  const [mfgSales, setMfgSales] = useState<ManufacturingSale[]>([]);
  const [mfgExpenses, setMfgExpenses] = useState<ManufacturingExpense[]>([]);
  const [settings, setSettings] = useState<PartnershipSettings>({
    partner1Paid: 0,
    partner2Paid: 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [timeFilter, setTimeFilter] = useState('currentMonth');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const fetchData = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { start, end } = { start: startOfMonth(new Date()), end: endOfMonth(new Date()) };
      // Note: simplified logic for conversion, keeping the rest of the file's variables
      
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const [
        salesData,
        expensesData,
        purchasesData,
        cyclesData,
        mSalesData,
        mExpensesData,
        settingsData
      ] = await Promise.all([
        apiService.getCollection<Sale>('sales', { whereField: 'date', whereValue: startISO, whereOp: '>=', limit: 3000 }),
        apiService.getCollection<Expense>('expenses', { whereField: 'date', whereValue: startISO, whereOp: '>=', limit: 3000 }),
        apiService.getCollection<Purchase>('purchases', { whereField: 'date', whereValue: startISO, whereOp: '>=', limit: 3000 }),
        apiService.getCollection<ManufacturingCycle>('manufacturing_cycles', { whereField: 'startDate', whereValue: endISO, whereOp: '<=', limit: 1000 }),
        apiService.getCollection<ManufacturingSale>('manufacturing_sales', { whereField: 'date', whereValue: startISO, whereOp: '>=', limit: 2000 }),
        apiService.getCollection<ManufacturingExpense>('manufacturing_expenses', { whereField: 'date', whereValue: startISO, whereOp: '>=', limit: 2000 }),
        apiService.getDoc<PartnershipSettings>('settings', 'partnership').catch(() => null)
      ]);

      setSales(salesData);
      setExpenses(expensesData);
      setPurchases(purchasesData);
      setMfgCycles(cyclesData);
      setMfgSales(mSalesData);
      setMfgExpenses(mExpensesData);
      
      if (settingsData) {
        setSettings(settingsData);
      }

    } catch (error) {
      console.error('Error fetching partnership data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [timeFilter, startDate, endDate, isLoading]);

  useEffect(() => {
    fetchData();
  }, [timeFilter, startDate, endDate]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + purchases.reduce((sum, p) => sum + p.total, 0);
  const storeNetProfit = totalProfit - totalExpenses;

  // Manufacturing Calculations
  const totalMfgSales = mfgSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalMfgCosts = mfgCycles.reduce((sum, c) => sum + c.manufacturingCost, 0) + mfgExpenses.reduce((sum, e) => sum + e.amount, 0);
  const mfgNetProfit = totalMfgSales - totalMfgCosts;
  const zeinaMfgShare = mfgNetProfit * 0.5;

  const netProfit = storeNetProfit + zeinaMfgShare;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiService.updateDoc('settings', 'partnership', {
        partner1Paid: Number(settings.partner1Paid) || 0,
        partner2Paid: Number(settings.partner2Paid) || 0
      });
      alert('تم حفظ بيانات الشراكة بنجاح');
    } catch (error) {
      console.error('Error saving partnership settings:', error);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const totalCapital = settings.partner1Paid + settings.partner2Paid;
  const partner1ProfitShare = netProfit * 0.5;
  const partner2ProfitShare = netProfit * 0.5;

  const pieData = [
    { name: 'محمد وأهله (50%)', value: 50, color: '#4F46E5' },
    { name: 'عبدالجليل وأحمد بدرالدين (50%)', value: 50, color: '#10B981' }
  ];

  const capitalData = [
    { name: 'محمد وأهله', value: settings.partner1Paid, color: '#4F46E5' },
    { name: 'عبدالجليل وأحمد بدرالدين', value: settings.partner2Paid, color: '#10B981' }
  ];

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الشراكة</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-pink-600 bg-white border border-gray-200 rounded-xl transition-all disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-pink-700 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none bg-white"
        >
          <option value="currentMonth">هذا الشهر</option>
          <option value="today">اليوم</option>
          <option value="week">هذا الأسبوع</option>
          <option value="all">كل الأوقات</option>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* إدخال رأس المال */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">رأس المال المدفوع</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                محمد وأهله (30% موقع + 20% رأس مال)
              </label>
              <div className="relative">
                <input
                  type="number"
                  disabled={user?.role === 'observer'}
                  value={settings.partner1Paid || ''}
                  onChange={(e) => setSettings({ ...settings, partner1Paid: Number(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="المبلغ المدفوع"
                />
                <span className="absolute left-3 top-2 text-gray-500">ج.س</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                عبدالجليل وأحمد بدرالدين (50% رأس مال)
              </label>
              <div className="relative">
                <input
                  type="number"
                  disabled={user?.role === 'observer'}
                  value={settings.partner2Paid || ''}
                  onChange={(e) => setSettings({ ...settings, partner2Paid: Number(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="المبلغ المدفوع"
                />
                <span className="absolute left-3 top-2 text-gray-500">ج.س</span>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">إجمالي رأس المال:</span>
                <span className="text-2xl font-bold text-gray-900">{formatCurrency(totalCapital)} ج.س</span>
              </div>
            </div>
          </div>
        </div>

        {/* توزيع الأرباح */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">صافي الأرباح وتوزيعها</h2>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
              <span className="text-gray-600 font-medium">صافي الربح الكلي:</span>
              <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netProfit)} ج.س
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-pink-100 bg-pink-50 rounded-xl flex justify-between items-center">
              <div>
                <h4 className="font-bold text-pink-900">محمد وأهله</h4>
                <p className="text-sm text-pink-700">نصيب الشراكة: 50%</p>
              </div>
              <span className="text-xl font-bold text-pink-700">
                {formatCurrency(partner1ProfitShare)} ج.س
              </span>
            </div>

            <div className="p-4 border border-emerald-100 bg-emerald-50 rounded-xl flex justify-between items-center">
              <div>
                <h4 className="font-bold text-emerald-900">عبدالجليل وأحمد بدرالدين</h4>
                <p className="text-sm text-emerald-700">نصيب الشراكة: 50%</p>
              </div>
              <span className="text-xl font-bold text-emerald-700">
                {formatCurrency(partner2ProfitShare)} ج.س
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-gray-500" />
            نسبة الشراكة
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-gray-500" />
            توزيع رأس المال المدفوع
          </h3>
          <div className="h-64">
            {totalCapital > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={capitalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {capitalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${formatCurrency(value)} ج.س`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                لم يتم إدخال رأس مال بعد
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
