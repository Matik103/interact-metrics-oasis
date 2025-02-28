
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays } from "date-fns";

export function useClientDashboard() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);

  // Get client ID associated with current user
  useEffect(() => {
    const fetchClientInfo = async () => {
      if (!user) return;

      try {
        const { data: clientInfo, error } = await supabase
          .from("clients")
          .select("id, client_name, agent_name")
          .eq("email", user.email)
          .maybeSingle();

        if (clientInfo) {
          setClientId(clientInfo.id);
        }
      } catch (error) {
        console.error("Error fetching client info:", error);
      }
    };

    fetchClientInfo();
  }, [user]);

  // Fetch interaction statistics for the chatbot
  const interactionStatsQuery = useQuery({
    queryKey: ["client-interactions", clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // Get last 30 days interactions
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      
      // Get interactions based on agent type
      const { data: clientData } = await supabase
        .from("clients")
        .select("agent_name")
        .eq("id", clientId)
        .single();
      
      if (!clientData?.agent_name) return null;
      
      // Try to get the agent-specific table name
      let agentName = clientData.agent_name.toLowerCase().replace(/\s+/g, '_');
      
      // Fallback to ai_agent table if no specific agent table
      let tableName = 'ai_agent';
      const { data: hasTable } = await supabase.rpc('check_table_exists', { table_name: agentName });
      
      if (hasTable) {
        tableName = agentName;
      }
      
      // Query for interactions in the past 30 days
      const { data: interactions, error } = await supabase.from(tableName)
        .select('*')
        .filter('metadata->type', 'eq', 'chat_interaction')
        .filter('metadata->timestamp', 'gte', thirtyDaysAgo)
        .filter('metadata->client_id', 'eq', clientId);

      if (error) throw error;
      
      // Calculate success rate
      const totalCount = interactions?.length || 0;
      const successCount = interactions?.filter(i => i.metadata?.success)?.length || 0;
      const successRate = totalCount ? Math.round((successCount / totalCount) * 100) : 0;
      
      return {
        total: totalCount,
        successRate: successRate,
        averagePerDay: totalCount > 0 ? Math.round(totalCount / 30) : 0
      };
    },
    enabled: !!clientId,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Fetch common queries asked to the chatbot
  const commonQueriesQuery = useQuery({
    queryKey: ["common-queries", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("common_queries")
        .select("*")
        .eq("client_id", clientId)
        .order("frequency", { ascending: false })
        .limit(5);
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId
  });

  // Fetch recent error logs
  const errorLogsQuery = useQuery({
    queryKey: ["error-logs", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId
  });

  // Fetch recent activities
  const activitiesQuery = useQuery({
    queryKey: ["recent-activities", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from("client_activities")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId
  });

  return {
    clientId,
    interactionStats: interactionStatsQuery.data,
    isLoadingStats: interactionStatsQuery.isLoading,
    commonQueries: commonQueriesQuery.data,
    isLoadingQueries: commonQueriesQuery.isLoading,
    errorLogs: errorLogsQuery.data,
    isLoadingErrors: errorLogsQuery.isLoading,
    activities: activitiesQuery.data,
    isLoadingActivities: activitiesQuery.isLoading
  };
}
