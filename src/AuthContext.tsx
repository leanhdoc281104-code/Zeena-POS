import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User, Role } from './types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { apiService } from './services/apiService';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Sync with local API
          // Since we're using Google Auth on frontend, we send a magic request to register/login on our backend
          // For simplicity in this radical shift, we'll try to register the user on our backend if not exists
          const role: Role = firebaseUser.email === 'leanhdoc281104@gmail.com' ? 'admin' : 'cashier';
          
          const userData = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            password: 'google-auth-user', // dummy password, in a real app we'd use idToken
            role
          };

          try {
            await apiService.register(userData);
          } catch (e) {
            // Probably already exists
          }

          // Generate a local token (simulated login for now to get headers)
          // Ideally we would verify the idToken on backend
          // For the "Radical Solution" we'll make the backend trust the UID for now or use a secret bypass
          const loginRes = await apiService.login(userData.email, 'google-auth-user');
          localStorage.setItem('token', loginRes.token);
          setUser(loginRes.user);

        } catch (error) {
          console.error('Error syncing with local API:', error);
          // Fallback to firebase data for now so they aren't locked out
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Unknown',
            email: firebaseUser.email || '',
            role: 'cashier',
            createdAt: new Date().toISOString()
          });
        }
      } else {
        setUser(null);
        localStorage.removeItem('token');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
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
