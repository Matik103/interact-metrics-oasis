
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DriveLink {
  id: number;
  client_id: string;
  link: string;
  refresh_rate: number;
  created_at?: string;
}

interface AddDriveLinkInput {
  link: string;
  refresh_rate: number;
}

type DriveLinkQueryFn = () => Promise<DriveLink[]>;

export const useDriveLinks = (clientId: string | undefined) => {
  const queryFn: DriveLinkQueryFn = async () => {
    if (!clientId) return [];
    const { data, error } = await supabase
      .from("google_drive_links")
      .select("*")
      .eq("client_id", clientId);
    if (error) throw error;
    return data as DriveLink[];
  };

  const query = useQuery({
    queryKey: ["driveLinks"] as const,
    queryFn,
    enabled: !!clientId,
  });

  const driveLinks = (query.data || []) as DriveLink[];

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

  const addDriveLink = async (input: AddDriveLinkInput): Promise<DriveLink> => {
    if (!clientId) throw new Error("Client ID is required");
    await checkDriveLinkAccess(input.link);
    
    const { data, error } = await supabase
      .from("google_drive_links")
      .insert([{ 
        client_id: clientId, 
        link: input.link, 
        refresh_rate: input.refresh_rate 
      }])
      .select()
      .single();
      
    if (error) throw error;
    if (!data) throw new Error("Failed to create drive link");
    return data;
  };

  const deleteDriveLink = async (linkId: number): Promise<void> => {
    const { error } = await supabase
      .from("google_drive_links")
      .delete()
      .eq("id", linkId);
    if (error) throw error;
  };

  const addDriveLinkMutation = useMutation({
    mutationFn: addDriveLink,
    onSuccess: () => {
      query.refetch();
      toast.success("Drive link added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Error adding drive link: ${error.message}`);
    }
  });

  const deleteDriveLinkMutation = useMutation({
    mutationFn: deleteDriveLink,
    onSuccess: () => {
      query.refetch();
      toast.success("Drive link removed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Error removing drive link: ${error.message}`);
    }
  });

  return {
    driveLinks,
    refetchDriveLinks: query.refetch,
    addDriveLinkMutation,
    deleteDriveLinkMutation,
  };
};
