import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DriveLink } from "@/types/client";

export function useDriveLinks(clientId: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery({
    queryKey: ["driveLinks", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      console.log("Fetching drive links for client:", clientId);
      const { data, error } = await supabase
        .from("google_drive_links")
        .select("*")
        .eq("client_id", clientId);
        
      if (error) {
        console.error("Error fetching drive links:", error);
        throw error;
      }
      
      console.log("Fetched drive links:", data);
      return data as DriveLink[];
    },
    enabled: !!clientId,
  });

  const extractDriveFileId = (link: string): string => {
    console.log("Extracting file ID from link:", link);
    let fileId = '';
    
    try {
      // Handle Google Drive folder URLs
      if (link.includes('drive.google.com/drive/folders/')) {
        const folderMatch = link.match(/folders\/([^/?]+)/);
        if (folderMatch && folderMatch[1]) {
          fileId = folderMatch[1];
        }
      }
      // Handle Google Docs, Sheets, Slides URLs
      else if (link.includes('docs.google.com/document/d/') || 
               link.includes('docs.google.com/spreadsheets/d/') ||
               link.includes('docs.google.com/presentation/d/')) {
        const docsMatch = link.match(/\/d\/([^/]+)/);
        if (docsMatch && docsMatch[1]) {
          fileId = docsMatch[1];
        }
      }
      // Handle Google Drive file URLs
      else if (link.includes('/file/d/')) {
        fileId = link.split('/file/d/')[1]?.split('/')[0];
      } 
      // Handle URLs with id parameter
      else if (link.includes('id=')) {
        fileId = new URL(link).searchParams.get('id') || '';
      } 
      // Handle shortened /d/ URLs
      else if (link.includes('/d/')) {
        fileId = link.split('/d/')[1]?.split('/')[0];
      }
      
      console.log("Extracted file ID:", fileId);
      
      if (!fileId) {
        throw new Error("Invalid Google Drive link format - couldn't extract file ID");
      }
      
      return fileId;
    } catch (error) {
      console.error("Error extracting file ID:", error);
      throw new Error("Invalid Google Drive link format - couldn't extract file ID");
    }
  };

  const checkDriveLinkAccess = async (link: string): Promise<boolean> => {
    try {
      // Extract file ID from Google Drive link
      const fileId = extractDriveFileId(link);
      console.log("Extracted file ID:", fileId);
      
      // Check if the file is publicly accessible
      const accessCheckUrl = `https://drive.google.com/uc?id=${fileId}`;
      
      console.log("Checking access with URL:", accessCheckUrl);
      
      // Attempt to access the file without authentication
      const response = await fetch(accessCheckUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        redirect: 'follow',
      }).catch(error => {
        console.error("Drive file access check error:", error);
        throw new Error("Drive file appears to be inaccessible. Please check sharing settings.");
      });

      console.log(`Drive link access check response: ${response ? response.status : 'No response'}`);
      
      // Check if there's already data for this URL in the AI agent table
      const { data: existingData } = await supabase
        .from('ai_agent')
        .select('id')
        .eq('metadata->>client_id', clientId)
        .eq('metadata->>url', link)
        .maybeSingle();
      
      if (existingData) {
        // Delete existing data to avoid duplicates
        await supabase
          .from('ai_agent')
          .delete()
          .eq('id', existingData.id);
      }

      return true;
    } catch (error: any) {
      // Log error to database
      if (clientId) {
        await supabase.from("error_logs").insert({
          client_id: clientId,
          error_type: "drive_link_access",
          message: error.message,
          status: "error"
        });
      }
      
      // Immediately notify the user of the error
      toast.error(`Google Drive access error: ${error.message}`);
      
      throw error;
    }
  };

  const addDriveLink = async (input: { link: string; refresh_rate: number }): Promise<DriveLink> => {
    if (!clientId) {
      console.error("Client ID is missing");
      throw new Error("Client ID is required");
    }
    
    console.log("Adding drive link with client ID:", clientId);
    console.log("Input data:", input);
    
    // Validate Google Drive link accessibility
    try {
      await checkDriveLinkAccess(input.link);
    } catch (error) {
      console.error("Drive link access check failed:", error);
      throw error;
    }
    
    // If validation passes, add the link to the database
    try {
      const { data, error } = await supabase
        .from("google_drive_links")
        .insert({
          client_id: clientId, 
          link: input.link, 
          refresh_rate: input.refresh_rate 
        })
        .select()
        .single();
      
      console.log("Supabase response:", { data, error });
        
      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      if (!data) {
        throw new Error("Failed to create drive link - no data returned");
      }
      
      return data as DriveLink;
    } catch (insertError) {
      console.error("Error inserting drive link:", insertError);
      throw insertError;
    }
  };

  const deleteDriveLink = async (linkId: number): Promise<number> => {
    const { error } = await supabase
      .from("google_drive_links")
      .delete()
      .eq("id", linkId);
    if (error) throw error;
    return linkId;
  };

  const addDriveLinkMutation = useMutation({
    mutationFn: addDriveLink,
    onSuccess: (data) => {
      console.log("Drive link added successfully:", data);
      queryClient.invalidateQueries({ queryKey: ["driveLinks", clientId] });
      toast.success("Drive link added successfully");
    },
    onError: (error: Error) => {
      console.error("Drive link mutation error:", error);
      toast.error(`Error adding drive link: ${error.message}`);
    }
  });

  const deleteDriveLinkMutation = useMutation({
    mutationFn: deleteDriveLink,
    onSuccess: (id) => {
      console.log("Drive link deleted successfully, ID:", id);
      queryClient.invalidateQueries({ queryKey: ["driveLinks", clientId] });
      toast.success("Drive link removed successfully");
    },
    onError: (error: Error) => {
      console.error("Drive link deletion error:", error);
      toast.error(`Error removing drive link: ${error.message}`);
    }
  });

  return {
    driveLinks: query.data || [],
    refetchDriveLinks: query.refetch,
    addDriveLinkMutation,
    deleteDriveLinkMutation,
    isLoading: query.isLoading,
    isError: query.isError
  };
}
