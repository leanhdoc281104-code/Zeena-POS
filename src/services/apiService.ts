import { User, Product, Sale, Expense, Customer, ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';

const API_BASE = '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const apiService = {
  // --- AUTH ---
  async login(email: string, password: string): Promise<{ token: string, user: User }> {
    console.log('Attempting to login user via API:', email);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown login error' }));
        console.error('Login API error:', res.status, errData);
        throw new Error(errData.error || 'Login failed');
      }
      return res.json();
    } catch (e) {
      console.error('Fetch error during login:', e);
      throw e;
    }
  },

  async register(data: any): Promise<void> {
    console.log('Attempting to register user via API:', data.email);
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('Registration response not OK:', res.status, errText);
      throw new Error('Registration failed');
    }
  },

  // --- DATA ---
  async getCollection<T>(collection: string, params: any = {}): Promise<T[]> {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/data/${collection}?${query}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(`Fetch ${collection} failed`);
    return res.json();
  },

  async getDoc<T>(collection: string, id: string): Promise<T> {
    const res = await fetch(`${API_BASE}/doc/${collection}/${id}`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(`Fetch doc ${id} failed`);
    return res.json();
  },

  async addDoc(collection: string, data: any): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/data/${collection}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Add to ${collection} failed`);
    return res.json();
  },

  async updateDoc(collection: string, id: string, data: any): Promise<void> {
    const res = await fetch(`${API_BASE}/data/${collection}/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Update ${id} failed`);
  },

  async deleteDoc(collection: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/data/${collection}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(`Delete ${id} failed`);
  },

  async checkout(saleData: any, cart: any): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/pos/checkout`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ saleData, cart })
    });
    if (!res.ok) throw new Error('Checkout failed');
    return res.json();
  },

  async recordPurchase(purchaseData: any, cart: any): Promise<{ id: string }> {
    const res = await fetch(`${API_BASE}/purchases/record`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ purchaseData, cart })
    });
    if (!res.ok) throw new Error('Purchase record failed');
    return res.json();
  },

  // --- SYSTEM ---
  async getStatus(): Promise<{ status: string, db: string }> {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) throw new Error('Status check failed');
    return res.json();
  },

  async exportBackup(): Promise<any> {
    const res = await fetch(`${API_BASE}/backup/export`, {
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Backup failed');
    return res.json();
  },
};
