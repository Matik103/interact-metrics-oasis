
import { useClient } from "./useClient";
import { useClientMutation } from "./useClientMutation";
import { useClientInvitation } from "./useClientInvitation";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useClientData = (id: string | undefined) => {
  const { user } = useAuth();
  const [resolvedClientId, setResolvedClientId] = useState<string | undefined>(id);
  const [resolvingId, setResolvingId] = useState(id === undefined);
  
  // If in client view but no ID is passed, try to resolve client ID
  useEffect(() => {
    const resolveClientId = async () => {
      console.log("useClientData - ID provided:", id);
      console.log("useClientData - User metadata client_id:", user?.user_metadata?.client_id);
      
      if (id) {
        console.log("Using provided ID:", id);
        setResolvedClientId(id);
        setResolvingId(false);
        return;
      } 
      
      if (user?.user_metadata?.client_id) {
        console.log("Using client ID from user metadata:", user.user_metadata.client_id);
        setResolvedClientId(user.user_metadata.client_id);
        setResolvingId(false);
        return;
      }
      
      // If client ID is still not found and we have a user email, try to look it up
      if (user?.email) {
        try {
          console.log("Looking up client ID by email:", user.email);
          const { data, error } = await supabase
            .from("clients")
            .select("id")
            .eq("email", user.email)
            .single();
            
          if (error) {
            console.error("Error finding client by email:", error);
          } else if (data?.id) {
            console.log("Found client ID from database:", data.id);
            setResolvedClientId(data.id);
          } else {
            console.log("No client found with email:", user.email);
          }
        } catch (err) {
          console.error("Error in resolveClientId:", err);
        }
      } else {
        console.log("No client ID available from props or user metadata, and no user email to lookup");
      }
      
      setResolvingId(false);
    };
    
    if (resolvingId) {
      resolveClientId();
    }
  }, [id, user, resolvingId]);
  
  console.log("useClientData - Resolved client ID being used:", resolvedClientId);
  
  // Even if resolvedClientId is undefined, we'll proceed anyway
  // The useClient hook should handle this gracefully
  const { client, isLoadingClient, error } = useClient(resolvedClientId);
  const clientMutation = useClientMutation(resolvedClientId);
  const { sendInvitation } = useClientInvitation();

  return {
    client,
    isLoadingClient,
    error,
    clientMutation,
    sendInvitation,
    clientId: resolvedClientId,
    isResolvingId: resolvingId
  };
};
