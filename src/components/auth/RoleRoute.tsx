
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type RoleRouteProps = {
  children: React.ReactNode;
  allowedRoles: ('admin' | 'client')[];
};

export const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
  const { user, isLoading, userRole } = useAuth();
  const location = useLocation();

  console.log("RoleRoute checking - User role:", userRole, "Allowed roles:", allowedRoles);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!userRole || !allowedRoles.includes(userRole)) {
    // Redirect admin to admin dashboard, clients to client dashboard
    const redirectPath = userRole === 'admin' ? '/' : '/client/view';
    console.log(`User role ${userRole} not allowed, redirecting to ${redirectPath}`);
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};
