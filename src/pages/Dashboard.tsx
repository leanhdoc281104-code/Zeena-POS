import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Expense, Product, Purchase, ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle, Filter, Calendar } from 'lucide-react';
import { format, subDays, isAfter, parseISO, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import { formatCurrency } from '../utils/format';

import { ExportButtons } from '../components/ExportButtons';

export const Dashboard: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mfgCycles, setMfgCycles] = useState<ManufacturingCycle[]>([]);
  const [mfgSales, setMfgSales] = useState<ManufacturingSale[]>([]);
  const [mfgExpenses, setMfgExpenses] = useState<ManufacturingExpense[]>([]);

  const [dateFilter, setDateFilter] = useState<'currentMonth' | 'prevMonth' | 'currentQuarter' | 'currentHalf' | 'currentYear' | 'custom'>('currentMonth');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sourceFilter, setSourceFilter] = useState<'all' | 'store' | 'mfg'>('all');

  useEffect(() => {
    const unsubSales = onSnapshot(query(collection(db, 'sales'), orderBy('date', 'desc')), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    });
    const unsubExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });
    const unsubPurchases = onSnapshot(query(collection(db, 'purchases'), orderBy('date', 'desc')), (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
    });
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubMfgCycles = onSnapshot(collection(db, 'manufacturing_cycles'), (snapshot) => {
      setMfgCycles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingCycle)));
    });
    const unsubMfgSales = onSnapshot(collection(db, 'manufacturing_sales'), (snapshot) => {
      setMfgSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingSale)));
    });
    const unsubMfgExpenses = onSnapshot(collection(db, 'manufacturing_expenses'), (snapshot) => {
      setMfgExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManufacturingExpense)));
    });

    return () => {
      unsubSales();
      unsubExpenses();
      unsubPurchases();
      unsubProducts();
      unsubMfgCycles();
      unsubMfgSales();
      unsubMfgExpenses();
    };
  }, []);

  const getActiveDateRange = () => {
    const today = new Date();
    switch (dateFilter) {
      case 'currentMonth':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'prevMonth': {
        const prev = subMonths(today, 1);
        return { start: startOfMonth(prev), end: endOfMonth(prev) };
      }
      case 'currentQuarter':
        return { start: startOfQuarter(today), end: endOfQuarter(today) };
      case 'currentHalf': {
        const month = today.getMonth();
        const start = new Date(today.getFullYear(), month < 6 ? 0 : 6, 1);
        const end = new Date(today.getFullYear(), month < 6 ? 5 : 11, month < 6 ? 30 : 31);
        return { start, end };
      }
      case 'currentYear':
        return { start: startOfYear(today), end: endOfYear(today) };
      case 'custom':
        return { start: startOfDay(parseISO(customStartDate)), end: endOfDay(parseISO(customEndDate)) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  };

  const { start, end } = getActiveDateRange();

  const isDateInRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = parseISO(dateStr);
    return d >= start && d <= end;
  };

  const filteredSales = sales.filter(s => isDateInRange(s.date));
  const filteredExpenses = expenses.filter(e => isDateInRange(e.date));
  const filteredPurchases = purchases.filter(p => isDateInRange(p.date));
  const filteredMfgSales = mfgSales.filter(s => isDateInRange(s.date));
  const filteredMfgCycles = mfgCycles.filter(c => isDateInRange(c.startDate));
  const filteredMfgExpenses = mfgExpenses.filter(e => isDateInRange(e.date));

  let displaySales = filteredSales;
  let displayExpenses = filteredExpenses;
  let displayPurchases = filteredPurchases;
  let displayMfgSales = filteredMfgSales;
  let displayMfgCycles = filteredMfgCycles;
  let displayMfgExpenses = filteredMfgExpenses;

  if (sourceFilter === 'store') {
    displayMfgSales = [];
    displayMfgCycles = [];
    displayMfgExpenses = [];
  } else if (sourceFilter === 'mfg') {
    displaySales = [];
    displayExpenses = [];
    displayPurchases = [];
  }

  const totalStoreRevenue = displaySales.reduce((sum, s) => sum + s.total, 0);
  const totalStoreProfit = displaySales.reduce((sum, s) => sum + s.profit, 0);
  const totalStoreExpenses = displayExpenses.reduce((sum, e) => sum + e.amount, 0) + displayPurchases.reduce((sum, p) => sum + p.total, 0);
  const storeNetProfit = totalStoreProfit - totalStoreExpenses;

  const totalMfgRevenue = displayMfgSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalMfgCosts = displayMfgCycles.reduce((sum, c) => sum + c.manufacturingCost, 0) + displayMfgExpenses.reduce((sum, e) => sum + e.amount, 0);
  const mfgNetProfit = totalMfgRevenue - totalMfgCosts;
  const zeinaMfgShare = mfgNetProfit * 0.5;

  const totalRevenue = totalStoreRevenue + totalMfgRevenue;
  const combinedNetProfit = storeNetProfit + zeinaMfgShare;
  const totalExpenses = totalStoreExpenses + totalMfgCosts;

  const daysDiff = differenceInDays(end, start);
  const useMonths = daysDiff > 60;

  const intervals = useMonths 
    ? eachMonthOfInterval({ start, end })
    : eachDayOfInterval({ start, end });

  const chartData = intervals.map(date => {
    const dateStr = format(date, useMonths ? 'yyyy-MM' : 'yyyy-MM-dd');
    
    const periodSales = displaySales.filter(s => s.date.startsWith(dateStr));
    const periodExpenses = displayExpenses.filter(e => e.date.startsWith(dateStr));
    const periodPurchases = displayPurchases.filter(p => p.date.startsWith(dateStr));
    const periodMfgSales = displayMfgSales.filter(s => s.date.startsWith(dateStr));
    const periodMfgCycles = displayMfgCycles.filter(c => c.startDate.startsWith(dateStr));
    const periodMfgExpenses = displayMfgExpenses.filter(e => e.date.startsWith(dateStr));

    const rev = periodSales.reduce((sum, s) => sum + s.total, 0) + periodMfgSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const storeProf = periodSales.reduce((sum, s) => sum + s.profit, 0);
    const storeExp = periodExpenses.reduce((sum, e) => sum + e.amount, 0) + periodPurchases.reduce((sum, p) => sum + p.total, 0);
    const mfgProf = periodMfgSales.reduce((sum, s) => sum + s.totalAmount, 0) - (periodMfgCycles.reduce((sum, c) => sum + c.manufacturingCost, 0) + periodMfgExpenses.reduce((sum, e) => sum + e.amount, 0));
    
    const netProf = (storeProf - storeExp) + (mfgProf * 0.5);
    const exp = storeExp + periodMfgCycles.reduce((sum, c) => sum + c.manufacturingCost, 0) + periodMfgExpenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      date: format(date, useMonths ? 'MMM yyyy' : 'MMM dd'),
      revenue: rev,
      netProfit: netProf,
      expenses: exp
    };
  });

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const expiringProducts = products.filter(p => p.expiryDate && isAfter(new Date(), subDays(parseISO(p.expiryDate), 30)));

  return (
    <div className="space-y-6 print:space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">نظرة عامة على لوحة التحكم</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sourceFilter === 'all' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              الكل
            </button>
            <button
              onClick={() => setSourceFilter('store')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sourceFilter === 'store' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              المتجر فقط
            </button>
            <button
              onClick={() => setSourceFilter('mfg')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${sourceFilter === 'mfg' ? 'bg-pink-100 text-pink-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              التصنيع فقط
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer"
            >
              <option value="currentMonth">الشهر الحالي</option>
              <option value="prevMonth">الشهر السابق</option>
              <option value="currentQuarter">الربع الحالي</option>
              <option value="currentHalf">النصف الحالي</option>
              <option value="currentYear">السنة الحالية</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 shadow-sm">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-sm border-none focus:ring-0 p-0 text-gray-700"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-sm border-none focus:ring-0 p-0 text-gray-700"
              />
            </div>
          )}
          <ExportButtons 
            data={chartData.map(d => ({
              'التاريخ': d.date,
              'الإيرادات': d.revenue,
              'المصروفات': d.expenses,
              'صافي الربح': d.netProfit
            }))} 
            filename="تقرير_لوحة_التحكم" 
          />
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">تقرير لوحة التحكم</h1>
        <p className="text-gray-600">
          الفترة: {format(start, 'yyyy/MM/dd')} - {format(end, 'yyyy/MM/dd')}
        </p>
        <p className="text-gray-600">
          المصدر: {sourceFilter === 'all' ? 'الكل' : sourceFilter === 'store' ? 'المتجر فقط' : 'التصنيع فقط'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium print:text-black">إجمالي الإيرادات</h3>
            <div className="p-2 bg-green-100 rounded-lg print:hidden">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 print:text-black">{formatCurrency(totalRevenue)} ج.س</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium print:text-black">صافي الربح الكلي</h3>
            <div className="p-2 bg-pink-100 rounded-lg print:hidden">
              <TrendingUp className="w-6 h-6 text-pink-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 print:text-black">{formatCurrency(combinedNetProfit)} ج.س</p>
          {(sourceFilter === 'all' || sourceFilter === 'mfg') && (
            <p className="text-sm text-gray-500 mt-2 print:text-black">نصيب زينة من التصنيع: {formatCurrency(zeinaMfgShare)}</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium print:text-black">إجمالي المصروفات</h3>
            <div className="p-2 bg-red-100 rounded-lg print:hidden">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 print:text-black">{formatCurrency(totalExpenses)} ج.س</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium print:text-black">إجمالي المنتجات</h3>
            <div className="p-2 bg-blue-100 rounded-lg print:hidden">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 print:text-black">{products.length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none print:break-inside-avoid">
          <h3 className="text-lg font-bold text-gray-900 mb-6 print:text-black">الإيرادات والأرباح</h3>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `${formatCurrency(value)} ج.س`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${formatCurrency(value)} ج.س`, '']}
                />
                <Line type="monotone" dataKey="revenue" name="الإيرادات" stroke="#4F46E5" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="netProfit" name="صافي الربح" stroke="#10B981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none print:break-inside-avoid">
          <h3 className="text-lg font-bold text-gray-900 mb-6 print:text-black">المصروفات</h3>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} tickFormatter={(value) => `${formatCurrency(value)} ج.س`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${formatCurrency(value)} ج.س`, 'المصروفات']}
                  cursor={{ fill: '#F3F4F6' }}
                />
                <Bar dataKey="expenses" name="المصروفات" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-500 print:hidden" />
            <h3 className="text-lg font-bold text-gray-900 print:text-black">تنبيهات نقص المخزون</h3>
          </div>
          <div className="space-y-4">
            {lowStockProducts.length === 0 ? (
              <p className="text-gray-500 print:text-black">جميع المنتجات متوفرة بكميات كافية.</p>
            ) : (
              lowStockProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100 print:bg-transparent print:border-black">
                  <div>
                    <h4 className="font-medium text-gray-900 print:text-black">{p.name}</h4>
                    <p className="text-sm text-amber-700 print:text-black">الحد الأدنى: {p.minStock} {p.unit === 'piece' ? 'قطعة' : 'وزن'}</p>
                  </div>
                  <span className="text-lg font-bold text-amber-600 print:text-black">{p.stock} متبقي</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 print:border-black print:shadow-none print:break-inside-avoid">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-red-500 print:hidden" />
            <h3 className="text-lg font-bold text-gray-900 print:text-black">قريباً تنتهي صلاحيته</h3>
          </div>
          <div className="space-y-4">
            {expiringProducts.length === 0 ? (
              <p className="text-gray-500 print:text-black">لا توجد منتجات تنتهي صلاحيتها خلال 30 يوماً.</p>
            ) : (
              expiringProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100 print:bg-transparent print:border-black">
                  <div>
                    <h4 className="font-medium text-gray-900 print:text-black">{p.name}</h4>
                    <p className="text-sm text-red-700 print:text-black">المخزون: {p.stock} {p.unit === 'piece' ? 'قطعة' : 'وزن'}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600 print:text-black">
                    {p.expiryDate ? format(parseISO(p.expiryDate), 'MMM dd, yyyy') : 'غير متوفر'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
