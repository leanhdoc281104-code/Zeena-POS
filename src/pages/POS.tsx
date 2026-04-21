import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Product, SaleItem, Customer, StoreSettings } from '../types';
import { Search, ScanLine, ShoppingCart, Plus, Minus, Trash2, CreditCard, Banknote, UserRound, Package, Printer, Bluetooth, Download, X } from 'lucide-react';
import { Toast } from '../components/Toast';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { formatCurrency } from '../utils/format';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { printReceiptBluetooth } from '../utils/bluetooth';

export const POS: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'debt' | 'bankak'>('cash');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [lastSale, setLastSale] = useState<{ id: string, cart: SaleItem[], total: number, discount?: number, paymentMethod: string, customerName?: string } | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [checkoutError, setCheckoutError] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'store');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStoreSettings(docSnap.data() as StoreSettings);
        }
      } catch (error) {
        console.error('Error fetching store settings:', error);
      }
    };
    fetchSettings();

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => {
      unsubProducts();
      unsubCustomers();
    };
  }, []);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isScanning) {
      html5QrCode = new Html5Qrcode('reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
        ]
      });
      
      const config = { 
        fps: 20, 
        qrbox: { width: 350, height: 150 },
        useBarCodeDetectorIfSupported: true,
        aspectRatio: 1.0
      };
      
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

          handleScan(decodedText);
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

  const handleScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
    } else {
      setToast({ message: 'المنتج غير موجود!', type: 'error' });
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          setToast({ message: 'الكمية غير كافية في المخزون!', type: 'error' });
          return prev;
        }
        return prev.map(item => item.productId === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      if (product.stock <= 0) {
        setToast({ message: 'نفدت الكمية!', type: 'error' });
        return prev;
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, cost: product.cost, qty: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const newQty = item.qty + delta;
        if (newQty > (product?.stock || 0)) {
          setToast({ message: 'الكمية غير كافية في المخزون!', type: 'error' });
          return item;
        }
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0));
  };

  const [discount, setDiscount] = useState<number>(0);

  const updateCartItem = (productId: string, field: 'name' | 'price', value: string | number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const totalCost = cart.reduce((sum, item) => sum + item.cost * item.qty, 0);
  const profit = total - totalCost;

  const handleCheckout = async () => {
    setCheckoutError('');
    if (cart.length === 0) return;
    if (paymentMethod === 'debt' && !selectedCustomer) {
      setCheckoutError('الرجاء اختيار عميل للدفع الآجل.');
      return;
    }

    setIsCheckingOut(true);
    try {
      const saleData: any = {
        items: cart,
        total,
        profit,
        discount,
        paymentMethod,
        date: new Date().toISOString(),
        cashierId: user?.uid,
        customerId: selectedCustomer || null,
        createdAt: serverTimestamp()
      };

      if (paymentMethod === 'bankak' && receiptUrl) {
        saleData.receiptUrl = receiptUrl;
      }

      // Create sale record
      const saleRef = await addDoc(collection(db, 'sales'), saleData);

      // Update product stock
      for (const item of cart) {
        const productRef = doc(db, 'products', item.productId);
        await updateDoc(productRef, {
          stock: increment(-item.qty),
          updatedAt: new Date().toISOString()
        });
      }

      // Update customer debt if applicable
      if (paymentMethod === 'debt' && selectedCustomer) {
        const customerRef = doc(db, 'customers', selectedCustomer);
        await updateDoc(customerRef, {
          debtBalance: increment(total),
          updatedAt: new Date().toISOString()
        });
      }

      const customerName = selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : undefined;
      
      setLastSale({
        id: saleRef.id,
        cart: [...cart],
        total,
        discount,
        paymentMethod,
        customerName
      });

      // Reset
      setCart([]);
      setDiscount(0);
      setCheckoutModalOpen(false);
      setSelectedCustomer('');
      setPaymentMethod('cash');
      setReceiptUrl('');
      setShowReceiptModal(true);
    } catch (error) {
      console.error('Checkout failed:', error);
      setCheckoutError('فشلت عملية الدفع. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const savePdfReceipt = (saleData: any) => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text(storeSettings?.storeName || 'Receipt', 105, 20, { align: 'center' });
      
      let currentY = 30;
      if (storeSettings?.storeAddress) {
        doc.setFontSize(10);
        doc.text(storeSettings.storeAddress, 105, currentY, { align: 'center' });
        currentY += 10;
      }

      doc.setFontSize(12);
      doc.text(`Receipt No: ${saleData.id.slice(0, 8)}`, 20, currentY);
      doc.text(`Date: ${new Date().toLocaleString('en-US')}`, 20, currentY + 10);
      doc.text(`Cashier: ${user?.name}`, 20, currentY + 20);

      const tableData = saleData.cart.map((item: any) => [
        item.name,
        item.qty.toString(),
        `${formatCurrency(item.price)}`,
        `${formatCurrency((item.price * item.qty))}`
      ]);

      (doc as any).autoTable({
        startY: currentY + 30,
        head: [['Item', 'Qty', 'Price', 'Total']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });

      const finalY = (doc as any).lastAutoTable.finalY || 60;
      doc.setFontSize(14);
      if (saleData.discount) {
        doc.text(`Subtotal: ${formatCurrency((saleData.total + saleData.discount))}`, 140, finalY + 10);
        doc.text(`Discount: ${formatCurrency(saleData.discount)}`, 140, finalY + 20);
        doc.text(`Total: ${formatCurrency(saleData.total)}`, 140, finalY + 30);
      } else {
        doc.text(`Total: ${formatCurrency(saleData.total)}`, 140, finalY + 10);
      }
      const paymentMethodAr = saleData.paymentMethod === 'cash' ? 'Cash' : saleData.paymentMethod === 'card' ? 'Card' : saleData.paymentMethod === 'bankak' ? 'Bankak' : 'Debt';
      doc.text(`Payment: ${paymentMethodAr}`, 20, finalY + (saleData.discount ? 30 : 10));

      doc.save(`receipt_${saleData.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
      setToast({ message: 'فشل في إنشاء ملف PDF.', type: 'error' });
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-preview');
    if (printContent) {
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContent.innerHTML;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); // Reload to restore React event listeners
    }
  };

  const handlePrintBluetooth = async (saleData: any) => {
    let text = '';
    text += `${storeSettings?.storeName || 'نظام زينة'}\n`;
    if (storeSettings?.storeAddress) {
      text += `${storeSettings.storeAddress}\n`;
    }
    text += '--------------------------------\n';
    text += `رقم الإيصال: ${saleData.id.slice(0, 8)}\n`;
    text += `التاريخ: ${new Date().toLocaleString('ar-EG')}\n`;
    text += `الكاشير: ${user?.name}\n`;
    if (saleData.customerName) {
      text += `العميل: ${saleData.customerName}\n`;
    }
    text += '--------------------------------\n';
    text += 'الصنف        الكمية    السعر\n';
    text += '--------------------------------\n';
    saleData.cart.forEach((item: any) => {
      const name = item.name.length > 12 ? item.name.substring(0, 12) : item.name.padEnd(12, ' ');
      const qty = item.qty.toString().padEnd(4, ' ');
      const price = `ج.س${formatCurrency((item.price * item.qty))}`;
      text += `${name} ${qty} ${price}\n`;
    });
    text += '--------------------------------\n';
    if (saleData.discount) {
      text += `المجموع الفرعي: ج.س${formatCurrency((saleData.total + saleData.discount))}\n`;
      text += `الخصم: ج.س${formatCurrency(saleData.discount)}\n`;
    }
    text += `الإجمالي: ج.س${formatCurrency(saleData.total)}\n`;
    const paymentMethodAr = saleData.paymentMethod === 'cash' ? 'نقدي' : saleData.paymentMethod === 'card' ? 'بطاقة' : saleData.paymentMethod === 'bankak' ? 'بنكك' : 'آجل';
    text += `طريقة الدفع: ${paymentMethodAr}\n`;
    text += '--------------------------------\n';
    text += 'شكرا لتسوقكم معنا!\n';

    try {
      await printReceiptBluetooth(text);
    } catch (err) {
      setToast({ message: 'فشل الاتصال بالطابعة. تأكد من تفعيل البلوتوث وإقران الطابعة.', type: 'error' });
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode.includes(searchQuery)
  );

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 pb-24 lg:pb-0 relative" dir="rtl">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #receipt-preview, #receipt-preview * {
              visibility: visible;
            }
            #receipt-preview {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
              padding: 10mm;
              background: white;
              border: none;
              font-size: 14px;
              color: black;
            }
          }
        `}
      </style>

      {/* Products Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ابحث عن المنتجات أو امسح الباركود..."
              className="w-full pr-10 pl-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-4 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors ${
              isScanning ? 'bg-red-100 text-red-700' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
            }`}
          >
            <ScanLine className="w-5 h-5" />
            {isScanning ? 'إيقاف المسح' : 'مسح'}
          </button>
        </div>

        {isScanning && (
          <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200 relative overflow-hidden flex justify-center">
            <div className="relative w-full max-w-sm">
              <div id="reader" className="w-full rounded-lg overflow-hidden"></div>
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center">
                 <div className="w-[300px] h-[150px] relative border-2 border-pink-500 rounded-lg overflow-hidden">
                   <div className="absolute left-0 w-full h-1 bg-pink-500 shadow-[0_0_10px_#ec4899] animate-scan"></div>
                 </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pl-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="flex flex-col text-right bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-full aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <h3 className="font-medium text-gray-900 line-clamp-2 mb-1">{product.name}</h3>
                <div className="mt-auto flex items-center justify-between w-full">
                  <span className="font-bold text-pink-600">{formatCurrency(product.price)} ج.س</span>
                  <span className="text-xs text-gray-500">{product.stock} متبقي</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Cart Toggle Button */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
        <button
          onClick={() => setIsCartOpen(true)}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white p-4 rounded-xl font-bold flex items-center justify-between shadow-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            <span>عرض السلة ({cart.reduce((sum, item) => sum + item.qty, 0)})</span>
          </div>
          <span>{formatCurrency(total)} ج.س</span>
        </button>
      </div>

      {/* Cart Section */}
      <div 
        className={`
          fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 lg:static lg:z-auto lg:bg-transparent lg:transition-none
          ${isCartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto'}
        `}
        onClick={() => setIsCartOpen(false)}
      >
        <div 
          className={`
            absolute bottom-0 left-0 right-0 top-16 bg-white rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300
            lg:static lg:w-96 lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-200 lg:h-full lg:translate-y-0
            ${isCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 lg:p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-pink-600" />
              الطلب الحالي
            </h2>
            <div className="flex items-center gap-3">
              <span className="bg-pink-100 text-pink-700 py-1 px-3 rounded-full text-sm font-medium">
                {cart.reduce((sum, item) => sum + item.qty, 0)} عناصر
              </span>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="lg:hidden p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-50" />
              <p>السلة فارغة</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.productId} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                <div className="flex-1 min-w-0 ml-4 space-y-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateCartItem(item.productId, 'name', e.target.value)}
                    className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-pink-500 focus:outline-none font-medium text-gray-900 truncate"
                  />
                  <div className="flex items-center text-sm text-gray-500">
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateCartItem(item.productId, 'price', parseFloat(e.target.value) || 0)}
                      className="w-20 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-pink-500 focus:outline-none"
                    />
                    <span>ج.س</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQty(item.productId, -1)} className="p-1 hover:bg-white rounded-md shadow-sm">
                    <Minus className="w-4 h-4 text-gray-600" />
                  </button>
                  <span className="w-6 text-center font-medium">{item.qty}</span>
                  <button onClick={() => updateQty(item.productId, 1)} className="p-1 hover:bg-white rounded-md shadow-sm">
                    <Plus className="w-4 h-4 text-gray-600" />
                  </button>
                  <button onClick={() => updateQty(item.productId, -item.qty)} className="p-1 hover:bg-red-100 rounded-md mr-2 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

          <div className="p-4 lg:p-6 border-t border-gray-200 bg-gray-50 rounded-b-none lg:rounded-b-2xl pb-8 lg:pb-6">
            <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">المجموع الفرعي</span>
              <span className="font-medium text-gray-900">{formatCurrency(subtotal)} ج.س</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">الخصم</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 text-left px-2 py-1 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
                  placeholder="0"
                />
                <span className="text-gray-500">ج.س</span>
              </div>
            </div>
            <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="text-gray-900 font-bold text-lg">الإجمالي</span>
              <span className="text-3xl font-bold text-pink-600">{formatCurrency(total)} ج.س</span>
            </div>
          </div>
            <button
              onClick={() => {
                setIsCartOpen(false);
                setCheckoutModalOpen(true);
              }}
              disabled={cart.length === 0 || user?.role === 'observer'}
              className="w-full py-4 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors shadow-sm"
            >
              {user?.role === 'observer' ? 'للمشاهدة فقط' : 'الدفع'}
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">إتمام الدفع</h2>
            
            {checkoutError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
                {checkoutError}
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-600">المبلغ الإجمالي</span>
                <span className="text-2xl font-bold text-pink-600">{formatCurrency(total)} ج.س</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                    paymentMethod === 'cash' ? 'border-pink-600 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-pink-200'
                  }`}
                >
                  <Banknote className="w-6 h-6" />
                  <span className="font-medium">نقدي</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`p-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                    paymentMethod === 'card' ? 'border-pink-600 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-pink-200'
                  }`}
                >
                  <CreditCard className="w-6 h-6" />
                  <span className="font-medium">بطاقة</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('bankak')}
                  className={`p-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                    paymentMethod === 'bankak' ? 'border-pink-600 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-pink-200'
                  }`}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  <span className="font-medium">بنكك</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('debt')}
                  className={`p-4 rounded-xl flex flex-col items-center gap-2 border-2 transition-all ${
                    paymentMethod === 'debt' ? 'border-pink-600 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-pink-200'
                  }`}
                >
                  <UserRound className="w-6 h-6" />
                  <span className="font-medium">آجل/دين</span>
                </button>
              </div>

              {paymentMethod === 'bankak' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">صورة الإشعار (اختياري)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const { compressImage } = await import('../utils/imageUtils');
                          const compressed = await compressImage(file, 500);
                          setReceiptUrl(compressed);
                        } catch (error) {
                          console.error('Error compressing image:', error);
                          setToast({ message: 'فشل في معالجة الصورة.', type: 'error' });
                        }
                      }
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 transition-all"
                  />
                  {receiptUrl && (
                    <div className="mt-2">
                      <img src={receiptUrl} alt="Receipt Preview" className="h-20 rounded-xl border border-gray-200" />
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'debt' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">اختر العميل</label>
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-pink-500 outline-none"
                  >
                    <option value="">-- اختر العميل --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (الرصيد: {formatCurrency(c.debtBalance)} ج.س)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCheckoutModalOpen(false)}
                disabled={isCheckingOut}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-xl font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="flex-1 py-3 px-4 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors shadow-sm flex justify-center items-center"
              >
                {isCheckingOut ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'تأكيد الدفع'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && lastSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">تمت العملية بنجاح</h2>
            
            {/* Receipt Preview */}
            <div id="receipt-preview" className="flex-1 overflow-y-auto bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 font-mono text-sm text-gray-800" dir="rtl">
              <div className="text-center mb-4 border-b border-gray-300 pb-4">
                <img src="/logo.png" alt="Store Logo" className="mx-auto h-16 mb-2 object-contain" />
                {storeSettings?.storeAddress && (
                  <p className="text-sm text-gray-600 mt-1">{storeSettings.storeAddress}</p>
                )}
                <p className="mt-2 text-gray-500">إيصال الدفع</p>
              </div>
              <div className="mb-4 space-y-1 border-b border-gray-300 pb-4">
                <p>رقم الإيصال: {lastSale.id.slice(0, 8)}</p>
                <p>التاريخ: {new Date().toLocaleString('ar-EG')}</p>
                <p>الكاشير: {user?.name}</p>
                {lastSale.customerName && <p>العميل: {lastSale.customerName}</p>}
              </div>
              <table className="w-full mb-4">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-right py-1">الصنف</th>
                    <th className="text-center py-1">الكمية</th>
                    <th className="text-left py-1">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {lastSale.cart.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-1">{item.name}</td>
                      <td className="text-center py-1">{item.qty}</td>
                      <td className="text-left py-1">{formatCurrency((item.price * item.qty))} ج.س</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-300 pt-4 space-y-1">
                {lastSale.discount ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>المجموع الفرعي:</span>
                      <span>{formatCurrency((lastSale.total + lastSale.discount))} ج.س</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>الخصم:</span>
                      <span>{formatCurrency(lastSale.discount)} ج.س</span>
                    </div>
                  </>
                ) : null}
                <div className="flex justify-between font-bold text-lg">
                  <span>الإجمالي:</span>
                  <span>{formatCurrency(lastSale.total)} ج.س</span>
                </div>
                <div className="flex justify-between">
                  <span>طريقة الدفع:</span>
                  <span>{lastSale.paymentMethod === 'cash' ? 'نقدي' : lastSale.paymentMethod === 'card' ? 'بطاقة' : lastSale.paymentMethod === 'bankak' ? 'بنكك' : 'آجل'}</span>
                </div>
              </div>
              <div className="text-center mt-6 text-gray-500">
                <p>شكراً لتسوقكم معنا!</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handlePrint}
                className="w-full py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                طباعة (عبر النظام / طابعة عادية)
              </button>
              <button
                onClick={() => handlePrintBluetooth(lastSale)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Bluetooth className="w-5 h-5" />
                طباعة (بلوتوث مباشر)
              </button>
              <button
                onClick={() => savePdfReceipt(lastSale)}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                حفظ كملف PDF
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
