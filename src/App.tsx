
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import Auth from "./pages/Auth";
import { RoleRoute } from "./components/auth/RoleRoute";
import { ClientLayout } from "./components/layout/ClientLayout";
import ClientSetup from "./pages/client/Setup";
import ClientDashboard from "./pages/client/Dashboard";
import ClientEdit from "./pages/client/Edit";
import ClientWidgetSettings from "./pages/client/WidgetSettings";
import ClientView from "./pages/ClientView";
import ClientSettings from "./pages/client/Settings";

const queryClient = new QueryClient();

function App() {
  return (
    <Router>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            
            <Route
              path="/clients/:id"
              element={
                <RoleRoute allowedRoles={["admin"]}>
                  <ClientView />
                </RoleRoute>
              }
            />
            
            <Route path="/client/setup" element={<ClientSetup />} />
            
            <Route
              path="/client/view"
              element={
                <RoleRoute allowedRoles={["client"]}>
                  <ClientLayout>
                    <ClientDashboard />
                  </ClientLayout>
                </RoleRoute>
              }
            />
            
            <Route
              path="/client/settings"
              element={
                <RoleRoute allowedRoles={["client"]}>
                  <ClientLayout>
                    <ClientSettings />
                  </ClientLayout>
                </RoleRoute>
              }
            />
            
            <Route
              path="/client/edit"
              element={
                <RoleRoute allowedRoles={["client"]}>
                  <ClientLayout>
                    <ClientEdit />
                  </ClientLayout>
                </RoleRoute>
              }
            />
            
            <Route
              path="/client/widget/settings"
              element={
                <RoleRoute allowedRoles={["client"]}>
                  <ClientLayout>
                    <ClientWidgetSettings />
                  </ClientLayout>
                </RoleRoute>
              }
            />
            
          </Routes>
          <Toaster position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
