import { collection, doc, getDocs, getDoc as fbGetDoc, setDoc, deleteDoc, updateDoc as fbUpdateDoc, writeBatch, runTransaction, query, where, orderBy, limit, startAfter, DocumentData, getDocsFromCache, getDocFromCache } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Product, Sale, Expense, Customer, ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';

// In Firebase, we might want to continue using our Auth via Firebase Auth, 
// but since we custom-made login/register using custom email logic, 
// let's use Firebase auth here.
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 600000; // 10 minutes

function clearCache(colName?: string) {
  if (colName) {
    for (const key of cache.keys()) {
      if (key.startsWith(colName)) {
        cache.delete(key);
      }
    }
    // مسح الذاكرة المحلية (localStorage) المرتبطة بالمجموعة
    try {
      const lsKeys = Object.keys(localStorage);
      lsKeys.forEach(key => {
        if (key.startsWith(`cache_${colName}`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  } else {
    cache.clear();
    // مسح كل الذاكرة المحلية المخزنة للتطبيق
    try {
      const lsKeys = Object.keys(localStorage);
      lsKeys.forEach(key => {
        if (key.startsWith('cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
  }
}

export const apiService = {
  // --- AUTH ---
  async login(email: string, password: string): Promise<{ token: string, user: User }> {
    console.log('Attempting to login user via Firebase API:', email);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userDoc = await fbGetDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        throw new Error('بيانات المستخدم غير موجودة في قاعدة البيانات');
      }
      
      const userData = userDoc.data() as User;
      
      // We will save to localStorage the fact we logged in, but we also can rely on jwt
      // We create a fake JWT-like token string so other parts of the app that rely on it (like Layout) are happy
      const fakeToken = `ey.${btoa(unescape(encodeURIComponent(JSON.stringify(userData))))}.fake`;
      
      return { token: fakeToken, user: userData };
    } catch (e: any) {
      console.error('Login error:', e);
      throw new Error(e.message || 'Login failed');
    }
  },

  async loginWithGoogle(): Promise<{ token: string, user: User }> {
    try {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const firebaseUser = userCredential.user;
      
      let userDoc = await fbGetDoc(doc(db, 'users', firebaseUser.uid));
      
      if (!userDoc.exists()) {
        // If first user, make them admin
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
        const role = usersSnap.empty ? 'admin' : ('cashier' as any);
        
        const newUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown',
          email: firebaseUser.email || '',
          role: role,
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
        userDoc = await fbGetDoc(doc(db, 'users', firebaseUser.uid));
      }
      
      const userData = userDoc.data() as User;
      const fakeToken = `ey.${btoa(unescape(encodeURIComponent(JSON.stringify(userData))))}.fake`;
      
      return { token: fakeToken, user: userData };
    } catch (e: any) {
      console.error('Google login error:', e);
      throw new Error(e.message || 'Google login failed');
    }
  },

  async register(data: any): Promise<void> {
    console.log('Attempting to register user via Firebase:', data.email);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const newId = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', newId), {
        id: newId,
        name: data.name,
        email: data.email,
        role: data.role,
        createdAt: new Date().toISOString()
      });
    } catch (e: any) {
      console.error('Register error:', e);
      throw new Error('Registration failed');
    }
  },

  // --- DATA ---
  async getCollection<T>(colName: string, params: any = {}): Promise<T[]> {
    const cacheKey = `col_${colName}-${JSON.stringify(params)}`;
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const colRef = collection(db, colName);
      const constraints: any[] = [];
      
      if (params.whereField && params.whereValue) {
        constraints.push(where(params.whereField, params.whereOp || '==', params.whereValue));
      } else if (params.search) {
        constraints.push(where('name', '>=', params.search));
        constraints.push(where('name', '<=', params.search + '\uf8ff'));
        if (!params.orderBy || params.orderBy === 'name') {
          constraints.push(orderBy('name'));
        }
      }
      
      if (params.orderBy && (!params.search || params.orderBy !== 'name')) {
        constraints.push(orderBy(params.orderBy, params.orderDir || 'asc'));
      }
      if (params.limit) {
        constraints.push(limit(Number(params.limit)));
      }
      if (params.startAfterId) {
        const docRef = doc(db, colName, params.startAfterId);
        const docSnap = await fbGetDoc(docRef);
        if (docSnap.exists()) {
          constraints.push(startAfter(docSnap));
        }
      }
      
      const q = query(colRef, ...constraints);
      let snapshot;
      
      try {
        snapshot = await getDocs(q);
      } catch (e: any) {
        if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
          console.warn(`Quota exceeded for ${colName}, attempting to load from cache...`);
          snapshot = await getDocsFromCache(q);
        } else {
          throw e;
        }
      }
      
      const results = snapshot.docs.map(doc => {
         const data = doc.data();
         if (!data.id) data.id = doc.id;
         return data as unknown as T;
      });

      cache.set(cacheKey, { data: results, timestamp: Date.now() });
      return results;
    } catch (e: any) {
      console.error(`Fetch ${colName} failed`, e);
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        throw new Error('انتهى حد استخدام البيانات لليوم (Quota Exceeded). يرجى الانتظار حتى تحديث خطة Blaze أو استعادة الخدمة تلقائياً.');
      }
      throw new Error(`فشل تحميل البيانات من ${colName}`);
    }
  },

  async getDoc<T>(colName: string, id: string): Promise<T | null> {
    const cacheKey = `${colName}-${id}`;
    
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const docRef = doc(db, colName, id);
      let snapshot;
      
      try {
        snapshot = await fbGetDoc(docRef);
      } catch (e: any) {
        if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
          console.warn(`Quota exceeded for ${colName}/${id}, attempting to load from cache...`);
          snapshot = await getDocFromCache(docRef);
        } else {
          throw e;
        }
      }
      
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (!data.id) data.id = snapshot.id;
        const result = data as unknown as T;
        cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }
      return null;
    } catch (e: any) {
      console.error(`Fetch doc ${colName}/${id} failed`, e);
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        throw new Error('انتهى حد استخدام البيانات لليوم (Quota Exceeded). يرجى الانتظار حتى تحديث خطة Blaze أو استعادة الخدمة تلقائياً.');
      }
      throw new Error(`فشل تحميل الوثيقة ${id}`);
    }
  },

  async addDoc(colName: string, data: any): Promise<{ id: string }> {
    try {
      if (!data.id) data.id = Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, colName, data.id), data);
      clearCache(colName);
      return { id: data.id };
    } catch (e: any) {
      console.error(`Add to ${colName} failed`, e);
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        throw new Error('انتهى حد استخدام البيانات لليوم (Quota Exceeded).');
      }
      throw new Error(`فشلت إضافة البيانات إلى ${colName}`);
    }
  },

  async updateDoc(colName: string, id: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, colName, id);
      const updateData = { ...data };
      if (updateData.id) delete updateData.id;
      
      // We use setDoc with merge instead of updateDoc in case the doc doesn't exist yet
      await setDoc(docRef, updateData, { merge: true });
      clearCache(colName);
      localStorage.removeItem(`cache_${colName}-${id}`);
    } catch (e: any) {
      console.error(`Update ${colName}/${id} failed`, e);
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        throw new Error('انتهى حد استخدام البيانات لليوم (Quota Exceeded).');
      }
      throw new Error(`فشل تحديث الوثيقة ${id}`);
    }
  },

  async deleteDoc(colName: string, id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, colName, id));
      clearCache(colName);
      localStorage.removeItem(`cache_${colName}-${id}`);
    } catch (e: any) {
      console.error(`Delete ${colName}/${id} failed`, e);
      if (e.code === 'resource-exhausted' || e.message?.includes('quota')) {
        throw new Error('انتهى حد استخدام البيانات لليوم (Quota Exceeded).');
      }
      throw new Error(`فشل حذف الوثيقة ${id}`);
    }
  },

  async checkout(saleData: any, cart: any): Promise<{ id: string }> {
    try {
      if (!saleData.id) saleData.id = Math.random().toString(36).substring(2, 15);
      
      await runTransaction(db, async (transaction) => {
        // 1. Sale record
        const saleRef = doc(db, 'sales', saleData.id);
        transaction.set(saleRef, saleData);
        
        // 2. Update stock
        for (const item of cart) {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists()) {
            const currentStock = productDoc.data().stock || 0;
            transaction.update(productRef, { stock: currentStock - item.qty });
          }
        }
        
        // 3. Customer debt
        if (saleData.paymentMethod === 'debt' && saleData.customerId) {
          const customerRef = doc(db, 'customers', saleData.customerId);
          const customerDoc = await transaction.get(customerRef);
          if (customerDoc.exists()) {
            const currentDebt = customerDoc.data().debtBalance || 0;
            transaction.update(customerRef, { debtBalance: currentDebt + saleData.total });
          }
        }
      });
      
      clearCache('sales');
      clearCache('products');
      if (saleData.paymentMethod === 'debt' && saleData.customerId) clearCache('customers');

      return { id: saleData.id };
    } catch (e) {
      console.error('Checkout failed', e);
      throw new Error('Checkout failed');
    }
  },

  async recordPurchase(purchaseData: any, cart: any): Promise<{ id: string }> {
    try {
      if (!purchaseData.id) purchaseData.id = Math.random().toString(36).substring(2, 15);
      
      await runTransaction(db, async (transaction) => {
        // 1. Purchase record
        const purchaseRef = doc(db, 'purchases', purchaseData.id);
        transaction.set(purchaseRef, purchaseData);
        
        // 2. Update product stock and cost
        for (const item of cart) {
          const productRef = doc(db, 'products', item.productId);
          const productDoc = await transaction.get(productRef);
          if (productDoc.exists()) {
            const currentStock = productDoc.data().stock || 0;
            transaction.update(productRef, { 
              stock: currentStock + item.qty,
              cost: item.cost,
              updatedAt: new Date().toISOString()
            });
          }
        }
      });
      
      clearCache('purchases');
      clearCache('products');

      return { id: purchaseData.id };
    } catch (e) {
      console.error('Purchase record failed', e);
      throw new Error('Purchase record failed');
    }
  },

  // --- SYSTEM ---
  async getStatus(): Promise<{ status: string, db: string }> {
    try {
       // Just check if we can reach Firebase
       const colRef = collection(db, 'settings');
       const q = query(colRef, limit(1));
       await getDocs(q);
       return { status: 'ok', db: 'firebase' };
    } catch (e) {
       return { status: 'error', db: 'firebase' };
    }
  },

  async exportBackup(): Promise<any> {
    throw new Error('Backup export not implemented in client-side Firebase mode');
  },
};

