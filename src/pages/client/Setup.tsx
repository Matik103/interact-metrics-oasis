
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingState } from "@/components/client/setup/LoadingState";
import { InvalidTokenState } from "@/components/client/setup/InvalidTokenState";
import { SetupForm } from "@/components/client/setup/SetupForm";
import { useTokenVerification } from "@/hooks/useTokenVerification";

const ClientSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extract token from URL
  const query = new URLSearchParams(location.search);
  const token = query.get("token");

  // Use custom hook for token verification
  const { isLoading, tokenData } = useTokenVerification(token);

  const handleSubmit = async (password: string, confirmPassword: string) => {
    if (!tokenData?.isValid) {
      toast.error("Invalid invitation");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setIsSubmitting(true);

      // Check if user already exists
      const { data: existingUser, error: existingUserError } = await supabase.auth.signInWithPassword({
        email: tokenData.email,
        password: password, // Try sign in to check if user exists
      });

      // If user exists, sign them in directly
      if (!existingUserError && existingUser?.user) {
        // Update invitation status regardless
        await supabase
          .from("client_invitations")
          .update({ 
            status: "accepted", 
            accepted_at: new Date().toISOString() 
          })
          .eq("token", token);

        toast.success("Signed in successfully! Redirecting to dashboard...");
        
        setTimeout(() => {
          navigate("/client/view");
        }, 1500);
        return;
      }

      // Create user account if they don't exist
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: tokenData.email,
        password: password,
        options: {
          data: {
            full_name: tokenData.clientName || "",
            client_id: tokenData.clientId
          }
        }
      });

      if (signUpError) throw signUpError;

      // Update invitation status
      const { error: updateError } = await supabase
        .from("client_invitations")
        .update({ 
          status: "accepted", 
          accepted_at: new Date().toISOString() 
        })
        .eq("token", token);

      if (updateError) throw updateError;

      // Create user role for the client
      await supabase.from("user_roles").insert({
        user_id: signUpData.user!.id,
        role: "client"
      });

      toast.success("Account created successfully! Redirecting to dashboard...");
      
      // Allow time for toast to be seen
      setTimeout(() => {
        navigate("/client/view");
      }, 1500);
    } catch (error: any) {
      console.error("Error setting up account:", error);
      toast.error(error.message || "Failed to set up your account");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (!tokenData?.isValid) {
    return <InvalidTokenState />;
  }

  return (
    <SetupForm 
      tokenData={tokenData} 
      onSubmit={(password, confirmPassword) => handleSubmit(password, confirmPassword)}
      isSubmitting={isSubmitting} 
    />
  );
};

export default ClientSetup;
