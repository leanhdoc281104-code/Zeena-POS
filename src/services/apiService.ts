import { collection, doc, getDocs, getDoc as fbGetDoc, setDoc, deleteDoc, updateDoc as fbUpdateDoc, writeBatch, runTransaction, query, where, orderBy, limit, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Product, Sale, Expense, Customer, ManufacturingCycle, ManufacturingSale, ManufacturingExpense } from '../types';

// In Firebase, we might want to continue using our Auth via Firebase Auth, 
// but since we custom-made login/register using custom email logic, 
// let's use Firebase auth here.
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword } from 'firebase/auth';

const auth = getAuth();

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
      
      // For legacy compat with how AuthContext gets token
      const token = await firebaseUser.getIdToken();
      // We will save to localStorage the fact we logged in, but we also can rely on jwt
      // We create a fake JWT-like token string so other parts of the app that rely on it (like Layout) are happy
      const fakeToken = `ey.${btoa(unescape(encodeURIComponent(JSON.stringify(userData))))}.fake`;
      
      return { token: fakeToken, user: userData };
    } catch (e: any) {
      console.error('Login error:', e);
      throw new Error(e.message || 'Login failed');
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
    try {
      const colRef = collection(db, colName);
      const constraints: any[] = [];
      
      if (params.whereField && params.whereValue) {
        constraints.push(where(params.whereField, params.whereOp || '==', params.whereValue));
      }
      if (params.orderBy) {
        constraints.push(orderBy(params.orderBy, params.orderDir || 'asc'));
      }
      if (params.limit) {
        constraints.push(limit(Number(params.limit)));
      }
      
      const q = query(colRef, ...constraints);
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
         const data = doc.data();
         if (!data.id) data.id = doc.id;
         return data as unknown as T;
      });
    } catch (e: any) {
      console.error(`Fetch ${colName} failed`, e);
      throw new Error(`Fetch ${colName} failed`);
    }
  },

  async getDoc<T>(colName: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, colName, id);
      const snapshot = await fbGetDoc(docRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (!data.id) data.id = snapshot.id;
        return data as unknown as T;
      }
      return null;
    } catch (e) {
      console.error(`Fetch doc ${colName}/${id} failed`, e);
      throw new Error(`Fetch doc ${id} failed`);
    }
  },

  async addDoc(colName: string, data: any): Promise<{ id: string }> {
    try {
      if (!data.id) data.id = Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, colName, data.id), data);
      return { id: data.id };
    } catch (e) {
      console.error(`Add to ${colName} failed`, e);
      throw new Error(`Add to ${colName} failed`);
    }
  },

  async updateDoc(colName: string, id: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, colName, id);
      const updateData = { ...data };
      if (updateData.id) delete updateData.id;
      
      // We use setDoc with merge instead of updateDoc in case the doc doesn't exist yet
      await setDoc(docRef, updateData, { merge: true });
    } catch (e) {
      console.error(`Update ${colName}/${id} failed`, e);
      throw new Error(`Update ${id} failed`);
    }
  },

  async deleteDoc(colName: string, id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, colName, id));
    } catch (e) {
      console.error(`Delete ${colName}/${id} failed`, e);
      throw new Error(`Delete ${id} failed`);
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

