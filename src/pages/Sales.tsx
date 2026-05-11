import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { Sale } from '../types';
import { Search, Trash2, Eye, Plus, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { format, parseISO, isToday, isThisWeek, isThisMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { formatCurrency } from '../utils/format';
import { ExportButtons } from '../components/ExportButtons';
import { DateRangeFilter } from '../components/DateRangeFilter';

const PAGE_SIZE = 50;

export const Sales: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const fetchSales = useCallback(async (isNextPage = false) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const currentOffset = isNextPage ? offset : 0;
      const data = await apiService.getCollection<Sale>('sales', {
        orderBy: 'date',
        orderDir: 'desc',
        limit: PAGE_SIZE,
        offset: currentOffset
      });

      if (isNextPage) {
        setSales(prev => [...prev, ...data]);
        setOffset(currentOffset + PAGE_SIZE);
      } else {
        setSales(data);
        setOffset(PAGE_SIZE);
      }

      setHasMore(data.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [offset, isLoading]);

  useEffect(() => {
    fetchSales();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setOffset(0);
    fetchSales(false);
  };

  const handleDelete = async (id: string) => {
    if (user?.role !== 'admin') return;
    if (window.confirm('هل أنت متأكد أنك تريد حذف هذه العملية؟')) {
      try {
        await apiService.deleteDoc('sales', id);
        setSales(prev => prev.filter(s => s.id !== id));
      } catch (error) {
        console.error('Error deleting sale:', error);
        alert('فشل في حذف العملية.');
      }
    }
  };

  const filteredSales = sales.filter(s => {
    const matchesSearch = s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.customerId && s.customerId.toLowerCase().includes(searchQuery.toLowerCase()));
      
    let matchesTime = true;
    const saleDate = parseISO(s.date);
    if (timeFilter === 'today') matchesTime = isToday(saleDate);
    else if (timeFilter === 'week') matchesTime = isThisWeek(saleDate);
    else if (timeFilter === 'month') matchesTime = isThisMonth(saleDate);
    else if (timeFilter === 'custom' && startDate && endDate) {
      matchesTime = isWithinInterval(saleDate, {
        start: startOfDay(parseISO(startDate)),
        end: endOfDay(parseISO(endDate))
      });
    }

    let matchesProduct = true;
    if (productFilter) {
      matchesProduct = s.items.some(item => item.name.toLowerCase().includes(productFilter.toLowerCase()));
    }

    return matchesSearch && matchesTime && matchesProduct;
  });

  const exportData = filteredSales.map(sale => ({
    'رقم الإيصال': sale.id,
    'التاريخ': format(parseISO(sale.date), 'yyyy/MM/dd HH:mm'),
    'الإجمالي': sale.total,
    'طريقة الدفع': sale.paymentMethod === 'cash' ? 'نقدي' : 
      sale.paymentMethod === 'bankak' ? 'بنكك' : 
      sale.paymentMethod === 'fawry' ? 'فوري' : 'أووكاش',
    'المنتجات': sale.items.map(item => `${item.name} (${item.qty})`).join('، ')
  }));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">تتبع المبيعات</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-pink-600 bg-white border border-gray-200 rounded-xl transition-all disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <ExportButtons data={exportData} filename="تقرير_المبيعات" />
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
        
        <input
          type="text"
          placeholder="تصفية بالمنتج..."
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
        />

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="البحث برقم الإيصال..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 print:bg-transparent">
              <tr>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">رقم الإيصال</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">التاريخ</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">الإجمالي</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 print:text-black print:border-black">طريقة الدفع</th>
                <th className="p-4 font-medium text-gray-600 border-b border-gray-200 text-center print:hidden">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                  <td className="p-4 border-b border-gray-100 font-mono text-sm print:border-black print:text-black">{sale.id.slice(0, 8)}</td>
                  <td className="p-4 border-b border-gray-100 print:border-black print:text-black">{format(parseISO(sale.date), 'yyyy/MM/dd HH:mm')}</td>
                  <td className="p-4 border-b border-gray-100 font-bold text-pink-600 print:border-black print:text-black">
                    {formatCurrency(sale.total)} ج.س
                  </td>
                  <td className="p-4 border-b border-gray-100 print:border-black print:text-black">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                      sale.paymentMethod === 'bankak' ? 'bg-purple-100 text-purple-700' :
                      sale.paymentMethod === 'fawry' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {sale.paymentMethod === 'cash' ? 'نقدي' : 
                       sale.paymentMethod === 'bankak' ? 'بنكك' : 
                       sale.paymentMethod === 'fawry' ? 'فوري' : 'أووكاش'}
                    </span>
                  </td>
                  <td className="p-4 border-b border-gray-100 text-center print:hidden">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="p-2 text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(sale.id)}
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
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    لا توجد مبيعات مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4 print:hidden">
          <button
            onClick={() => fetchSales(true)}
            disabled={isLoading}
            className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50 shadow-sm"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            عرض المزيد من المبيعات
          </button>
        </div>
      )}

      {/* Sale Details Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">تفاصيل المبيعات</h2>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-xl">
              <div>
                <p className="text-sm text-gray-500">رقم الإيصال</p>
                <p className="font-mono font-medium">{selectedSale.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">التاريخ</p>
                <p className="font-medium">{format(parseISO(selectedSale.date), 'yyyy/MM/dd HH:mm')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">طريقة الدفع</p>
                <p className="font-medium">
                  {selectedSale.paymentMethod === 'cash' ? 'نقدي' : 
                   selectedSale.paymentMethod === 'bankak' ? 'بنكك' : 
                   selectedSale.paymentMethod === 'fawry' ? 'فوري' : 'أووكاش'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">الإجمالي</p>
                <p className="font-bold text-pink-600">{formatCurrency(selectedSale.total)} ج.س</p>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-4">المنتجات</h3>
            <table className="w-full text-right border-collapse mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200">المنتج</th>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200 text-center">الكمية</th>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200">السعر</th>
                  <th className="p-3 font-medium text-gray-600 border-b border-gray-200">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {selectedSale.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="p-3">{item.name}</td>
                    <td className="p-3 text-center">{item.qty}</td>
                    <td className="p-3">{formatCurrency(item.price)} ج.س</td>
                    <td className="p-3 font-medium">{formatCurrency((item.price * item.qty))} ج.س</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedSale.receiptUrl && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-2">صورة الإشعار</h3>
                <img src={selectedSale.receiptUrl} alt="Receipt" className="max-w-full h-auto rounded-xl border border-gray-200" />
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedSale(null)}
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
