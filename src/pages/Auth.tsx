
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate, useLocation } from "react-router-dom";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const { session, isLoading, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Check for auth callback in URL (password recovery, etc.)
    const handleAuthCallback = async () => {
      if (location.hash && location.hash.includes('access_token')) {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (data.session) {
            // Get user role to determine redirect
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', data.session.user.id)
              .single();
            
            if (roleData?.role === 'client') {
              navigate('/client/view', { replace: true });
            } else {
              navigate('/', { replace: true });
            }
            
            toast.success('Successfully authenticated');
          }
        } catch (error: any) {
          console.error('Error handling auth callback:', error);
          toast.error(error.message || 'Authentication failed');
        }
      }
    };
    
    handleAuthCallback();
  }, [location, navigate]);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect authenticated users based on their role
  if (session) {
    if (userRole === 'client') {
      return <Navigate to="/client/view" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Check if email already exists in Supabase
  const checkEmailExists = async (email: string) => {
    setIsCheckingEmail(true);
    try {
      // Call the auth.admin.getUserByEmail() through a secure edge function
      const { data, error } = await supabase.functions.invoke("check-email-exists", {
        body: { email }
      });
      
      if (error) throw error;
      
      return data.exists;
    } catch (error: any) {
      console.error("Error checking email:", error);
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isAuthLoading || isCheckingEmail) return;
    setIsAuthLoading(true);

    try {
      if (isSignUp) {
        console.log("Starting sign up process for:", email);
        
        // Check if email already exists
        const emailExists = await checkEmailExists(email);
        if (emailExists) {
          console.log("Email already exists:", email);
          toast.error("An account with this email already exists. Please sign in instead.");
          setIsSignUp(false); // Switch to sign in mode
          setIsAuthLoading(false);
          return;
        }
        
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        
        if (error) throw error;
        
        console.log("Sign up successful, verification email should be sent");
        toast.success("Check your email for the confirmation link!");
        
        // Log to help debug
        console.log("Auth sign up response:", data);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Successfully signed in!");
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      
      // Check for specific error messages related to existing accounts
      if (error.message?.includes("already registered")) {
        toast.error("An account with this email already exists. Please sign in instead.");
        setIsSignUp(false); // Switch to sign in mode
      } else {
        toast.error(error.message || "Authentication failed");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            {isSignUp ? "Create an account" : "Sign in"}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? "Enter your details to create your account"
              : "Enter your credentials to access your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={isSignUp}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  placeholder="m@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isAuthLoading || isCheckingEmail}>
              {isAuthLoading || isCheckingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSignUp ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            Continue with Google
          </Button>

          <div className="mt-4 text-center text-sm">
            {isSignUp ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary hover:underline"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
