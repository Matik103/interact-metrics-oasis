
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import { ClientRoute } from "@/components/auth/ClientRoute";
import { Header } from "@/components/layout/Header";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ClientAuth from "./pages/client/Auth";
import ClientDashboard from "./pages/client/Dashboard";
import ClientSettings from "./pages/client/Settings";
import ClientList from "./pages/ClientList";
import AddEditClient from "./pages/AddEditClient";
import ClientView from "./pages/ClientView";
import WidgetSettings from "./pages/WidgetSettings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/client-auth" element={<ClientAuth />} />
        
        {/* Protected routes with Header */}
        <Route
          path="/*"
          element={
            <>
              <Header />
              <Routes>
                <Route
                  path="/"
                  element={
                    <PrivateRoute>
                      <Index />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <PrivateRoute>
                      <Settings />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <PrivateRoute>
                      <ClientList />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/clients/new"
                  element={
                    <PrivateRoute>
                      <AddEditClient />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/clients/:id"
                  element={
                    <PrivateRoute>
                      <ClientView />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/clients/:id/edit"
                  element={
                    <PrivateRoute>
                      <AddEditClient />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/clients/:id/widget-settings"
                  element={
                    <PrivateRoute>
                      <WidgetSettings />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/client-dashboard"
                  element={
                    <ClientRoute>
                      <ClientDashboard />
                    </ClientRoute>
                  }
                />
                <Route
                  path="/client-settings"
                  element={
                    <ClientRoute>
                      <ClientSettings />
                    </ClientRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </>
          }
        />
      </Routes>
      <Toaster />
      <Sonner />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <AppRoutes />
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
