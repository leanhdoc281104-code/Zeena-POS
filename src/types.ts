export type Role = 'admin' | 'cashier' | 'observer';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: 'piece' | 'weight';
  category: string;
  expiryDate?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  profit: number;
  discount?: number;
  paymentMethod: 'cash' | 'card' | 'debt' | 'bankak';
  receiptUrl?: string;
  date: string;
  cashierId: string;
  customerId?: string;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  qty: number;
  cost: number;
}

export interface Purchase {
  id: string;
  items: PurchaseItem[];
  total: number;
  supplierName: string;
  date: string;
  recordedBy: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  recordedBy: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  debtBalance: number;
  createdAt: string;
}

export interface StoreSettings {
  storeName: string;
  storeAddress?: string;
  storeLogo?: string;
}

export interface PartnershipSettings {
  partner1Paid: number; // محمد وأهله
  partner2Paid: number; // عبدالجليل وأحمد بدرالدين
}

export interface ManufacturingCycle {
  id: string;
  productName: string;
  fundingAmount: number;
  manufacturingCost: number;
  cartonsProduced: number;
  cartonPrice: number;
  status: 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface ManufacturingSale {
  id: string;
  cycleId: string;
  customerName: string;
  customerPhone: string;
  cartonsSold: number;
  totalAmount: number;
  date: string;
  recordedBy: string;
}

export interface ManufacturingExpense {
  id: string;
  cycleId: string;
  description: string;
  amount: number;
  date: string;
  recordedBy: string;
}
