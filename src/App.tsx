
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import { Header } from "@/components/layout/Header";
import Auth from "./pages/Auth";
import ClientList from "./pages/ClientList";
import AddEditClient from "./pages/AddEditClient";
import ClientView from "./pages/ClientView";
import WidgetSettings from "./pages/WidgetSettings";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1">
              <Routes>
                {/* Redirect root to clients for authenticated users */}
                <Route
                  path="/"
                  element={<Navigate to="/clients" replace />}
                />
                <Route path="/auth" element={<Auth />} />
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
          <Toaster />
          <Sonner />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
