
import { InteractionStats } from "@/types/client-dashboard";
import { supabase } from "@/integrations/supabase/client";
import { fetchTopQueries } from "./topQueriesService";
import { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Fetches dashboard statistics for a specific client
 */
export const fetchDashboardStats = async (clientId: string): Promise<InteractionStats> => {
  if (!clientId) {
    return {
      total_interactions: 0,
      active_days: 0,
      average_response_time: 0,
      top_queries: []
    };
  }

  try {
    // Get the client details to find the agent table name
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("agent_name")
      .eq("id", clientId)
      .single();

    if (clientError || !client?.agent_name) {
      console.error("Error fetching client data:", clientError);
      throw new Error("Could not determine AI agent name");
    }

    // Sanitize agent name to get the table name format (matches the convention in function create_ai_agent_table)
    const agentTableName = client.agent_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Fetch interaction data from the agent table
    const { data: interactions, error: interactionsError } = await supabase
      .from(agentTableName)
      .select("metadata, created_at")
      .eq("metadata->>type", "chat_interaction");

    if (interactionsError) {
      console.error(`Error fetching data from ${agentTableName}:`, interactionsError);
      throw interactionsError;
    }

    // Calculate total interactions
    const totalInteractions = interactions?.length || 0;

    // Calculate active days (unique days when interactions occurred)
    const uniqueDates = new Set();
    interactions?.forEach(interaction => {
      if (interaction.created_at) {
        const dateStr = new Date(interaction.created_at).toDateString();
        uniqueDates.add(dateStr);
      } else if (interaction.metadata?.timestamp) {
        const dateStr = new Date(interaction.metadata.timestamp).toDateString();
        uniqueDates.add(dateStr);
      }
    });
    const activeDays = uniqueDates.size;

    // Calculate average response time
    let totalResponseTime = 0;
    let responsesWithTime = 0;
    
    interactions?.forEach(interaction => {
      if (interaction.metadata?.response_time_ms) {
        totalResponseTime += Number(interaction.metadata.response_time_ms);
        responsesWithTime++;
      }
    });
    
    const avgResponseTime = responsesWithTime > 0 
      ? Number((totalResponseTime / responsesWithTime / 1000).toFixed(2)) 
      : 0;

    // Fetch top queries
    const topQueriesList = await fetchTopQueries(clientId);

    // Return the combined stats
    return {
      total_interactions: totalInteractions,
      active_days: activeDays,
      average_response_time: avgResponseTime,
      top_queries: topQueriesList
    };
    
  } catch (err) {
    console.error("Error fetching stats:", err);
    // Return default values in case of error
    return {
      total_interactions: 0,
      active_days: 0,
      average_response_time: 0,
      top_queries: []
    };
  }
};

/**
 * Sets up a real-time subscription for client's AI agent table
 * @param clientId - The client ID to subscribe to
 * @param agentName - The name of the AI agent (table name)
 * @param onUpdate - Callback function that will be called when updates occur
 * @returns The subscription channel for cleanup
 */
export const subscribeToAgentData = async (
  clientId: string,
  onUpdate: () => void
): Promise<RealtimeChannel | null> => {
  if (!clientId) {
    console.error("No client ID provided for agent data subscription");
    return null;
  }

  try {
    // Get the client details to find the agent table name
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("agent_name")
      .eq("id", clientId)
      .single();

    if (clientError || !client?.agent_name) {
      console.error("Error fetching client data for subscription:", clientError);
      return null;
    }

    // Sanitize agent name to get the table name format
    const agentTableName = client.agent_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    console.log(`Setting up subscription for AI agent table: ${agentTableName}`);
    
    const channel = supabase
      .channel(`agent-data-${clientId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: agentTableName,
        },
        (payload) => {
          console.log("AI agent data change detected:", payload);
          onUpdate();
        }
      )
      .subscribe((status) => {
        console.log(`Subscription to ${agentTableName} status:`, status);
      });
      
    return channel;
  } catch (err) {
    console.error("Error setting up agent data subscription:", err);
    return null;
  }
};

// Export the activity subscription functions
export { subscribeToActivities } from "./activitySubscriptionService";
