import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from './types';
import { apiService } from './services/apiService';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We try to sync with Firebase auth to have accurate real-state
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
       if (firebaseUser) {
         try {
           const dbUser = await apiService.getDoc<User>('users', firebaseUser.uid);
           if (dbUser) setUser(dbUser);
         } catch (e) {
           console.error('Failed to load user doc from Firebase:', e);
         }
       } else {
         // Fallback to token if Firebase somehow loses state but local has token 
         // though we should strictly trust Firebase in paid firebase mode.
         const token = localStorage.getItem('token');
         if (token) {
           try {
             const payload = JSON.parse(decodeURIComponent(escape(atob(token.split('.')[1]))));
             setUser(payload);
           } catch (e) {
             localStorage.removeItem('token');
             setUser(null);
           }
         } else {
           setUser(null);
         }
       }
       setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string = 'Zeena123') => {
    try {
      const loginRes = await apiService.login(email, password);
      localStorage.setItem('token', loginRes.token);
      setUser(loginRes.user);
    } catch (e: any) {
      throw new Error(e.message || 'Login failed');
    }
  };

  const signInWithGoogle = async () => {
    try {
      const loginRes = await apiService.loginWithGoogle();
      localStorage.setItem('token', loginRes.token);
      setUser(loginRes.user);
    } catch (e: any) {
      throw new Error(e.message || 'Google login failed');
    }
  };

  const signOut = async () => {
    const auth = getAuth();
    await firebaseSignOut(auth);
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
