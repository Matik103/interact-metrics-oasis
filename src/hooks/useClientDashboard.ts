
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InteractionStats {
  total_interactions: number;
  active_days: number;
  average_response_time: number;
  top_queries: string[];
}

export interface ErrorLog {
  id: string;
  error_type: string;
  message: string;
  created_at: string;
  status: string;
  client_id: string;
}

export interface QueryItem {
  id: string;
  query_text: string;
  frequency: number;
  last_asked: string;
}

export const useClientDashboard = (clientId: string | undefined) => {
  const [stats, setStats] = useState<InteractionStats>({
    total_interactions: 0,
    active_days: 0,
    average_response_time: 0,
    top_queries: []
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Query error logs for this client
  const { 
    data: errorLogs = [], 
    isLoading: isLoadingErrorLogs,
    refetch: refetchErrorLogs 
  } = useQuery({
    queryKey: ["errorLogs", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching error logs:", error);
        toast.error(`Error fetching error logs: ${error.message}`);
        return [];
      }
      return data as ErrorLog[];
    },
    enabled: !!clientId,
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Query common queries for this client
  const { 
    data: queries = [], 
    isLoading: isLoadingQueries,
    refetch: refetchQueries 
  } = useQuery({
    queryKey: ["queries", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("common_queries")
        .select("*")
        .eq("client_id", clientId)
        .order("frequency", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching queries:", error);
        toast.error(`Error fetching queries: ${error.message}`);
        return [];
      }
      
      // Transform the data to match the QueryItem interface
      return (data || []).map((item: any) => ({
        id: item.id,
        query_text: item.query_text,
        frequency: item.frequency,
        last_asked: item.updated_at // Use updated_at as last_asked
      })) as QueryItem[];
    },
    enabled: !!clientId,
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  // Set up real-time subscriptions
  useEffect(() => {
    if (!clientId) return;
    
    // Subscribe to realtime updates for error_logs
    const errorLogsChannel = supabase
      .channel('error-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'error_logs',
          filter: `client_id=eq.${clientId}`
        },
        (payload) => {
          console.log('Error logs changed:', payload);
          refetchErrorLogs();
        }
      )
      .subscribe();
      
    // Subscribe to realtime updates for common_queries
    const queriesChannel = supabase
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
          console.log('Common queries changed:', payload);
          refetchQueries();
        }
      )
      .subscribe();

    // Subscribe to realtime updates for client_activities
    const activitiesChannel = supabase
      .channel('activities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_activities',
          filter: `client_id=eq.${clientId}`
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(errorLogsChannel);
      supabase.removeChannel(queriesChannel);
      supabase.removeChannel(activitiesChannel);
    };
  }, [clientId, refetchErrorLogs, refetchQueries]);

  // Query client activities for interaction stats
  const fetchStats = async () => {
    if (!clientId) return;

    setIsLoadingStats(true);
    try {
      console.log("Fetching stats for client:", clientId);
      
      // Get total interactions count
      const { count: totalInteractions, error: countError } = await supabase
        .from("client_activities")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("activity_type", "chat_interaction");
      
      if (countError) {
        console.error("Error getting total interactions:", countError);
        throw countError;
      }

      // Get active days using a direct query instead of RPC
      const { data: activeDaysData, error: activeDaysError } = await supabase
        .from("client_activities")
        .select("created_at")
        .eq("client_id", clientId)
        .eq("activity_type", "chat_interaction");
      
      if (activeDaysError) {
        console.error("Error getting active days:", activeDaysError);
        throw activeDaysError;
      }
      
      // Calculate active days by counting distinct dates
      const uniqueDates = new Set();
      activeDaysData?.forEach(activity => {
        const activityDate = new Date(activity.created_at).toDateString();
        uniqueDates.add(activityDate);
      });
      const activeDays = uniqueDates.size;

      // Get response time data from the last 30 interactions
      const { data: recentInteractions, error: recentError } = await supabase
        .from("client_activities")
        .select("metadata")
        .eq("client_id", clientId)
        .eq("activity_type", "chat_interaction")
        .order("created_at", { ascending: false })
        .limit(30);
      
      if (recentError) {
        console.error("Error getting recent interactions:", recentError);
        throw recentError;
      }
      
      // Calculate actual average response time from metadata
      let totalResponseTime = 0;
      let countWithResponseTime = 0;
      
      recentInteractions?.forEach(interaction => {
        if (interaction.metadata && typeof interaction.metadata === 'object' && 'response_time_ms' in interaction.metadata) {
          totalResponseTime += Number(interaction.metadata.response_time_ms);
          countWithResponseTime++;
        }
      });
      
      const avgResponseTime = countWithResponseTime > 0 
        ? (totalResponseTime / countWithResponseTime / 1000).toFixed(2) 
        : 0;

      // Get top query topics
      const { data: topQueries, error: topQueriesError } = await supabase
        .from("common_queries")
        .select("query_text")
        .eq("client_id", clientId)
        .order("frequency", { ascending: false })
        .limit(5);
      
      if (topQueriesError) {
        console.error("Error getting top queries:", topQueriesError);
        throw topQueriesError;
      }

      const newStats = {
        total_interactions: totalInteractions || 0,
        active_days: activeDays || 0,
        average_response_time: Number(avgResponseTime),
        top_queries: (topQueries || []).map(q => q.query_text)
      };
      
      console.log("Stats fetched successfully:", newStats);
      setStats(newStats);
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      toast.error("Failed to fetch interaction statistics");
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (clientId) {
      fetchStats();
      
      // Set up an interval to periodically refresh the data
      const intervalId = setInterval(fetchStats, 15000); // Refresh every 15 seconds
      
      return () => clearInterval(intervalId);
    } else {
      setIsLoadingStats(false); // No client ID, so we're not loading
    }
  }, [clientId]);

  return {
    stats,
    errorLogs,
    queries,
    isLoadingErrorLogs,
    isLoadingQueries,
    isLoadingStats,
  };
};
