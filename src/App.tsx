
import { Toaster } from "sonner";
import { Header } from "@/components/layout/Header";
import { ClientHeader } from "@/components/layout/ClientHeader";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import ClientList from "@/pages/ClientList";
import Settings from "@/pages/Settings";
import ClientView from "@/pages/ClientView";
import AddEditClient from "@/pages/AddEditClient";
import WidgetSettings from "@/pages/WidgetSettings";
import { RoleRoute } from "@/components/auth/RoleRoute";
import { useAuth } from "./contexts/AuthContext";
import ClientSettings from "@/pages/client/Settings";
import ClientDashboard from "@/pages/client/Dashboard";
import ClientSetup from "@/pages/client/Setup";
import { useEffect, useState } from "react";

function App() {
  const { isLoading, user, userRole } = useAuth();
  const location = useLocation();
  const [showLoader, setShowLoader] = useState(true);
  
  console.log("Current user role:", userRole);
  console.log("Current location:", location.pathname);
  
  // Set a timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 3000); // Show loader for max 3 seconds
      
      return () => clearTimeout(timer);
    } else {
      setShowLoader(false);
    }
  }, [isLoading]);

  // Check if this is a public route
  const isPublicRoute = 
    location.pathname === '/auth' || 
    location.pathname.startsWith('/client/setup');
  
  // Show loading spinner only for a brief moment while checking auth
  if (isLoading && showLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
          <p className="text-sm text-gray-500">Loading your application...</p>
        </div>
      </div>
    );
  }

  // If loading timed out or finished, and no user, and not on a public route, redirect to auth
  if ((!isLoading || !showLoader) && !user && !isPublicRoute) {
    return <Navigate to="/auth" replace />;
  }

  // Determine which header to show based on user role
  const showClientHeader = userRole === 'client';

  return (
    <div className="min-h-screen bg-background">
      {user && (showClientHeader ? <ClientHeader /> : <Header />)}
      <Routes>
        {/* Public Routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/client/setup" element={<ClientSetup />} />
        
        {/* Admin Routes */}
        <Route path="/" element={
          <RoleRoute allowedRoles={['admin']}>
            <Index />
          </RoleRoute>
        } />
        <Route path="/admin/clients" element={
          <RoleRoute allowedRoles={['admin']}>
            <ClientList />
          </RoleRoute>
        } />
        <Route path="/settings" element={
          <RoleRoute allowedRoles={['admin']}>
            <Settings />
          </RoleRoute>
        } />
        <Route path="/admin/clients/new" element={
          <RoleRoute allowedRoles={['admin']}>
            <AddEditClient />
          </RoleRoute>
        } />
        <Route path="/admin/clients/:id" element={
          <RoleRoute allowedRoles={['admin']}>
            <ClientView />
          </RoleRoute>
        } />
        <Route path="/admin/clients/:id/edit" element={
          <RoleRoute allowedRoles={['admin']}>
            <AddEditClient />
          </RoleRoute>
        } />
        <Route path="/admin/clients/:id/widget-settings" element={
          <RoleRoute allowedRoles={['admin']}>
            <WidgetSettings />
          </RoleRoute>
        } />
        
        {/* Client Routes */}
        <Route path="/client/view" element={
          <RoleRoute allowedRoles={['client']}>
            <ClientDashboard />
          </RoleRoute>
        } />
        <Route path="/client/settings" element={
          <RoleRoute allowedRoles={['client']}>
            <ClientSettings />
          </RoleRoute>
        } />
        <Route path="/client/edit" element={
          <RoleRoute allowedRoles={['client']}>
            <AddEditClient />
          </RoleRoute>
        } />
        <Route path="/client/widget-settings" element={
          <RoleRoute allowedRoles={['client']}>
            <WidgetSettings />
          </RoleRoute>
        } />
        
        {/* Fallback route - redirect to appropriate homepage based on role */}
        <Route path="*" element={
          userRole === 'admin' ? <Navigate to="/" replace /> : 
          userRole === 'client' ? <Navigate to="/client/view" replace /> : 
          <Navigate to="/auth" replace />
        } />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
