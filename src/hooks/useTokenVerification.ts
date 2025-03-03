
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TokenData {
  clientId: string;
  email: string;
  clientName: string;
  isValid: boolean;
}

export const useTokenVerification = (token: string | null) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        toast.error("Invalid or missing invitation token");
        navigate("/auth");
        return;
      }

      try {
        setIsLoading(true);
        
        // Check if token exists and is valid
        const { data: invitation, error } = await supabase
          .from("client_invitations")
          .select("client_id, email, expires_at, status")
          .eq("token", token)
          .single();

        if (error || !invitation) {
          console.error("Invalid token error:", error);
          toast.error("Invalid or expired invitation token");
          setTokenData({ clientId: "", email: "", clientName: "", isValid: false });
          return;
        }

        // Check if token is expired
        if (new Date(invitation.expires_at) < new Date() || invitation.status !== "pending") {
          console.error("Token expired or already used");
          toast.error("This invitation has expired or already been used");
          setTokenData({ clientId: "", email: "", clientName: "", isValid: false });
          return;
        }

        // Get client information
        const { data: client } = await supabase
          .from("clients")
          .select("client_name")
          .eq("id", invitation.client_id)
          .single();

        setTokenData({
          clientId: invitation.client_id,
          email: invitation.email,
          clientName: client?.client_name || "Your Company",
          isValid: true
        });
      } catch (error: any) {
        console.error("Error verifying token:", error);
        toast.error("There was a problem verifying your invitation");
        setTokenData({ clientId: "", email: "", clientName: "", isValid: false });
      } finally {
        setIsLoading(false);
      }
    };

    verifyToken();
  }, [token, navigate]);

  return { isLoading, tokenData };
};
