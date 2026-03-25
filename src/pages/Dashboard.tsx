import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Sale, Expense, Product, Purchase, ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { formatCurrency } from '../utils/format';

export const Dashboard: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [mfgCycles, setMfgCycles] = useState<ManufacturingCycle[]>([]);
  const [mfgSales, setMfgSales] = useState<ManufacturingSale[]>([]);
  const [mfgExpenses, setMfgExpenses] = useState<ManufacturingExpense[]>([]);

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

  // Calculate Stats
  const today = new Date();
  const last30Days = Array.from({ length: 30 }).map((_, i) => format(subDays(today, 29 - i), 'yyyy-MM-dd'));

  const salesByDay = last30Days.map(date => {
    const daySales = sales.filter(s => s.date.startsWith(date));
    const dayExpenses = expenses.filter(e => e.date.startsWith(date));
    const dayPurchases = purchases.filter(p => p.date.startsWith(date));
    
    const revenue = daySales.reduce((sum, s) => sum + s.total, 0);
    const profit = daySales.reduce((sum, s) => sum + s.profit, 0);
    const expenseTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0) + dayPurchases.reduce((sum, p) => sum + p.total, 0);
    
    return {
      date: format(parseISO(date), 'MMM dd'),
      revenue,
      netProfit: profit - expenseTotal,
      expenses: expenseTotal
    };
  });

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.profit, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0) + purchases.reduce((sum, p) => sum + p.total, 0);
  const storeNetProfit = totalProfit - totalExpenses;

  // Manufacturing Calculations
  const totalMfgSales = mfgSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalMfgCosts = mfgCycles.reduce((sum, c) => sum + c.manufacturingCost, 0) + mfgExpenses.reduce((sum, e) => sum + e.amount, 0);
  const mfgNetProfit = totalMfgSales - totalMfgCosts;
  const zeinaMfgShare = mfgNetProfit * 0.5;

  const combinedNetProfit = storeNetProfit + zeinaMfgShare;

  const lowStockProducts = products.filter(p => p.stock <= p.minStock);
  const expiringProducts = products.filter(p => p.expiryDate && isAfter(new Date(), subDays(parseISO(p.expiryDate), 30)));

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900">نظرة عامة على لوحة التحكم</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">إجمالي الإيرادات</h3>
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalRevenue)} ج.س</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">صافي الربح الكلي (شامل التصنيع)</h3>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(combinedNetProfit)} ج.س</p>
          <p className="text-sm text-gray-500 mt-2">نصيب زينة من التصنيع: {formatCurrency(zeinaMfgShare)}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">إجمالي المصروفات</h3>
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalExpenses)} ج.س</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 font-medium">إجمالي المنتجات</h3>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{products.length}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">الإيرادات والأرباح (آخر 30 يوماً)</h3>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDay}>
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

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">المصروفات (آخر 30 يوماً)</h3>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDay}>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h3 className="text-lg font-bold text-gray-900">تنبيهات نقص المخزون</h3>
          </div>
          <div className="space-y-4">
            {lowStockProducts.length === 0 ? (
              <p className="text-gray-500">جميع المنتجات متوفرة بكميات كافية.</p>
            ) : (
              lowStockProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div>
                    <h4 className="font-medium text-gray-900">{p.name}</h4>
                    <p className="text-sm text-amber-700">الحد الأدنى: {p.minStock} {p.unit === 'piece' ? 'قطعة' : 'وزن'}</p>
                  </div>
                  <span className="text-lg font-bold text-amber-600">{p.stock} متبقي</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h3 className="text-lg font-bold text-gray-900">قريباً تنتهي صلاحيته</h3>
          </div>
          <div className="space-y-4">
            {expiringProducts.length === 0 ? (
              <p className="text-gray-500">لا توجد منتجات تنتهي صلاحيتها خلال 30 يوماً.</p>
            ) : (
              expiringProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                  <div>
                    <h4 className="font-medium text-gray-900">{p.name}</h4>
                    <p className="text-sm text-red-700">المخزون: {p.stock} {p.unit === 'piece' ? 'قطعة' : 'وزن'}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">
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
