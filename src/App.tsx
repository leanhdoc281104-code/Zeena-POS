import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { POS } from './pages/POS';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Purchases } from './pages/Purchases';
import { Expenses } from './pages/Expenses';
import { Customers } from './pages/Customers';
import { Settings } from './pages/Settings';
import { Partnership } from './pages/Partnership';
import { Roles } from './pages/Roles';
import { Manufacturing } from './pages/Manufacturing';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles?: string[] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<POS />} />
            <Route path="dashboard" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="inventory" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Inventory />
              </ProtectedRoute>
            } />
            <Route path="sales" element={<Sales />} />
            <Route path="purchases" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Purchases />
              </ProtectedRoute>
            } />
            <Route path="expenses" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Expenses />
              </ProtectedRoute>
            } />
            <Route path="customers" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Customers />
              </ProtectedRoute>
            } />
            <Route path="manufacturing" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Manufacturing />
              </ProtectedRoute>
            } />
            <Route path="partnership" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Partnership />
              </ProtectedRoute>
            } />
            <Route path="roles" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Roles />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute roles={['admin', 'observer']}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
