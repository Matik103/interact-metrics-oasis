
import { useQuery, useMutation, QueryFunction } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DriveLink {
  id: number;
  client_id: string;
  link: string;
  refresh_rate: number;
  created_at?: string;
}

const getDriveLinks: QueryFunction<DriveLink[], [string, string | undefined]> = 
async ({ queryKey }) => {
  const [_, clientId] = queryKey;
  if (!clientId) return [];
  
  const { data, error } = await supabase
    .from("google_drive_links")
    .select("*")
    .eq("client_id", clientId);
    
  if (error) throw error;
  return data || [];
};

export const useDriveLinks = (clientId: string | undefined) => {
  const { data: driveLinks = [], refetch: refetchDriveLinks } = useQuery({
    queryKey: ["driveLinks", clientId],
    queryFn: getDriveLinks,
    enabled: !!clientId,
  });

  const checkDriveLinkAccess = async (link: string): Promise<boolean> => {
    try {
      const matches = link.match(/[-\w]{25,}/);
      if (!matches) {
        throw new Error("Invalid Google Drive link format");
      }
      
      const { data: existingData } = await supabase
        .from('ai_agent')
        .select('*')
        .eq('metadata->client_id', clientId)
        .eq('metadata->url', link)
        .maybeSingle();

      if (existingData) {
        await supabase
          .from('ai_agent')
          .delete()
          .eq('metadata->client_id', clientId)
          .eq('metadata->url', link);
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${matches[0]}?fields=capabilities&key=${process.env.GOOGLE_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error("Drive file is not publicly accessible");
      }

      await fetch(process.env.N8N_WEBHOOK_URL || "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          url: link,
          type: "google_drive"
        })
      });

      return true;
    } catch (error: any) {
      await supabase.from("error_logs").insert({
        client_id: clientId,
        error_type: "drive_link_access",
        message: error.message,
        status: "error"
      });
      
      throw error;
    }
  };

  const addDriveLinkMutation = useMutation<
    DriveLink,
    Error,
    { link: string; refresh_rate: number }
  >({
    mutationFn: async ({ link, refresh_rate }) => {
      if (!clientId) throw new Error("Client ID is required");
      await checkDriveLinkAccess(link);
      
      const { data, error } = await supabase
        .from("google_drive_links")
        .insert([{ 
          client_id: clientId, 
          link, 
          refresh_rate 
        }])
        .select()
        .single();
        
      if (error) throw error;
      if (!data) throw new Error("Failed to create drive link");
      return data;
    },
    onSuccess: () => {
      refetchDriveLinks();
      toast.success("Drive link added successfully");
    },
    onError: (error) => {
      toast.error(`Error adding drive link: ${error.message}`);
    },
  });

  const deleteDriveLinkMutation = useMutation<
    void,
    Error,
    number
  >({
    mutationFn: async (linkId) => {
      const { error } = await supabase
        .from("google_drive_links")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDriveLinks();
      toast.success("Drive link removed successfully");
    },
    onError: (error) => {
      toast.error(`Error removing drive link: ${error.message}`);
    },
  });

  return {
    driveLinks,
    refetchDriveLinks,
    addDriveLinkMutation,
    deleteDriveLinkMutation,
  };
};
