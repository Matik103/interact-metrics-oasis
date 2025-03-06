
import { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  isLoading: boolean;
  user: AuthUser | null;
  userRole: 'admin' | 'client' | null;
  setUserRole: (role: 'admin' | 'client' | null) => void;
  session: Session | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  user: null,
  userRole: null,
  setUserRole: () => {},
  session: null,
  signOut: async () => {},
});

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'client' | null>(null);

  // Sign out function
  const signOut = async () => {
    try {
      console.log("Signing out user");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      setUser(null);
      setSession(null);
      setUserRole(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event);
        
        if (session) {
          console.log("Session user metadata:", session.user.user_metadata);
          setUser(session.user);
          setSession(session);
          
          // Additional check for client role
          const isClientUser = session.user.user_metadata?.role === 'client' || 
                               session.user.user_metadata?.client_id;
                               
          if (isClientUser) {
            setUserRole('client');
          } else {
            setUserRole('admin');
          }
        } else {
          setUser(null);
          setSession(null);
          setUserRole(null);
        }
        
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setSession(session);
        
        // Set user role based on metadata
        const isClientUser = session.user.user_metadata?.role === 'client' ||
                             session.user.user_metadata?.client_id;
        
        if (isClientUser) {
          setUserRole('client');
        } else {
          setUserRole('admin');
        }
      }
      setIsLoading(false);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    isLoading,
    user,
    userRole,
    setUserRole,
    session,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
