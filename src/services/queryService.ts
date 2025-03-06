
import { supabase } from "@/integrations/supabase/client";
import { QueryItem } from "@/types/client-dashboard";
import { checkAndRefreshAuth } from "./authService";

/**
 * Fetches common queries for a client
 */
export const fetchQueries = async (clientId: string): Promise<QueryItem[]> => {
  if (!clientId) return [];
  
  try {
    // Ensure auth is valid before making request
    const isAuthValid = await checkAndRefreshAuth();
    if (!isAuthValid) {
      throw new Error("Authentication failed");
    }
    
    // First try to get from common_queries table
    const { data: commonQueries, error: commonQueriesError } = await supabase
      .from("common_queries")
      .select("*")
      .eq("client_id", clientId)
      .order("frequency", { ascending: false })
      .limit(10);
    
    if (!commonQueriesError && commonQueries?.length > 0) {
      // Convert database objects to QueryItem type
      return commonQueries.map(q => ({
        id: q.id,
        query_text: q.query_text,
        frequency: q.frequency,
        // Include created_at as last_asked if needed
        last_asked: q.created_at
      })) as QueryItem[];
    }
    
    // If no common queries found, try to get from agent's table
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("agent_name")
      .eq("id", clientId)
      .single();
    
    if (clientError || !clientData) {
      console.error("Error fetching client agent name:", clientError);
      return [];
    }
    
    const sanitizedAgentName = clientData.agent_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Try to get user queries from agent table metadata using Edge Function
    const { data, error } = await supabase
      .functions
      .invoke("dynamically-query-table", {
        body: {
          tableName: sanitizedAgentName,
          query: "SELECT id, metadata FROM \"${tableName}\" WHERE metadata IS NOT NULL ORDER BY id DESC LIMIT 100"
        }
      });
    
    if (error || !data || !Array.isArray(data)) {
      console.log(`Error querying ${sanitizedAgentName} table:`, error);
      return [];
    }
    
    // Extract user queries from metadata and count frequency
    const queryFrequency: Record<string, number> = {};
    
    data.forEach(item => {
      if (item && item.metadata && item.metadata.user_message) {
        const query = item.metadata.user_message.trim();
        queryFrequency[query] = (queryFrequency[query] || 0) + 1;
      }
    });
    
    // Convert to QueryItem format
    const queryItems: QueryItem[] = Object.entries(queryFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, frequency], index) => ({
        id: `${index}`,
        client_id: clientId,
        query_text: query,
        frequency,
        last_asked: new Date().toISOString()
      }));
    
    return queryItems;
  } catch (err) {
    console.error("Error fetching queries:", err);
    return [];
  }
};

/**
 * Sets up a real-time subscription for queries
 */
export const subscribeToQueries = (clientId: string, onUpdate: () => void) => {
  const channel = supabase
    .channel('queries-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'common_queries',
        filter: `client_id=eq.${clientId}`
      },
      (payload) => {
        console.log('Queries changed:', payload);
        onUpdate();
      }
    )
    .subscribe();
    
  return channel;
};
