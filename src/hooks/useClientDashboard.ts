
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
  const [authError, setAuthError] = useState<boolean>(false);

  // Check if auth is valid and refresh session if needed
  const checkAndRefreshAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        console.log("Auth session error or missing:", error);
        // Session is invalid, try refreshing
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("Failed to refresh auth session:", refreshError);
          setAuthError(true);
          return false;
        }
      }
      setAuthError(false);
      return true;
    } catch (err) {
      console.error("Error checking auth session:", err);
      setAuthError(true);
      return false;
    }
  };

  // Query error logs for this client
  const { 
    data: errorLogs = [], 
    isLoading: isLoadingErrorLogs,
    refetch: refetchErrorLogs 
  } = useQuery({
    queryKey: ["errorLogs", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      // Try to ensure auth is valid before making the request
      const isAuthValid = await checkAndRefreshAuth();
      if (!isAuthValid) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("error_logs")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching error logs:", error);
        // Check if it's an auth error
        if (error.code === "PGRST301" || error.message?.includes("JWT")) {
          setAuthError(true);
        }
        throw error;
      }
      return data as ErrorLog[];
    },
    enabled: !!clientId,
    refetchInterval: 15000, // Refetch every 15 seconds
    retry: 3, // Increase retries
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
      
      // Try to ensure auth is valid before making the request
      const isAuthValid = await checkAndRefreshAuth();
      if (!isAuthValid) {
        return [];
      }
      
      const { data, error } = await supabase
        .from("common_queries")
        .select("*")
        .eq("client_id", clientId)
        .order("frequency", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching queries:", error);
        // Check if it's an auth error
        if (error.code === "PGRST301" || error.message?.includes("JWT")) {
          setAuthError(true);
        }
        throw error;
      }
      
      return (data || []).map((item: any) => ({
        id: item.id,
        query_text: item.query_text,
        frequency: item.frequency,
        last_asked: item.updated_at
      })) as QueryItem[];
    },
    enabled: !!clientId,
    refetchInterval: 15000, // Refetch every 15 seconds
    retry: 3, // Increase retries
  });

  // Set up real-time subscriptions
  useEffect(() => {
    if (!clientId) return;
    
    let errorLogsChannel: any;
    let queriesChannel: any;
    let activitiesChannel: any;
    
    const setupChannels = async () => {
      // Try to ensure auth is valid before setting up channels
      const isAuthValid = await checkAndRefreshAuth();
      if (!isAuthValid) return;
      
      errorLogsChannel = supabase
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
        
      queriesChannel = supabase
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

      activitiesChannel = supabase
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
    };
    
    setupChannels();

    return () => {
      if (errorLogsChannel) supabase.removeChannel(errorLogsChannel);
      if (queriesChannel) supabase.removeChannel(queriesChannel);
      if (activitiesChannel) supabase.removeChannel(activitiesChannel);
    };
  }, [clientId, refetchErrorLogs, refetchQueries]);

  // Query client activities for interaction stats
  const fetchStats = async () => {
    if (!clientId) {
      setIsLoadingStats(false);
      return;
    }

    setIsLoadingStats(true);
    try {
      // Try to ensure auth is valid before making requests
      const isAuthValid = await checkAndRefreshAuth();
      if (!isAuthValid) {
        setIsLoadingStats(false);
        return;
      }
      
      // Default to 0 values if requests fail
      let totalInteractions = 0;
      let activeDays = 0;
      let avgResponseTime = 0;
      let topQueriesList: string[] = [];
      
      try {
        const { count, error: countError } = await supabase
          .from("client_activities")
          .select("*", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("activity_type", "chat_interaction");
        
        if (!countError) {
          totalInteractions = count || 0;
        }
      } catch (err) {
        console.error("Error counting interactions:", err);
      }

      try {
        const { data: activeDaysData, error: activeDaysError } = await supabase
          .from("client_activities")
          .select("created_at")
          .eq("client_id", clientId)
          .eq("activity_type", "chat_interaction");
        
        if (!activeDaysError && activeDaysData) {
          const uniqueDates = new Set();
          activeDaysData.forEach(activity => {
            const activityDate = new Date(activity.created_at).toDateString();
            uniqueDates.add(activityDate);
          });
          activeDays = uniqueDates.size;
        }
      } catch (err) {
        console.error("Error fetching active days:", err);
      }

      try {
        const { data: recentInteractions, error: recentError } = await supabase
          .from("client_activities")
          .select("metadata")
          .eq("client_id", clientId)
          .eq("activity_type", "chat_interaction")
          .order("created_at", { ascending: false })
          .limit(30);
        
        if (!recentError && recentInteractions) {
          let totalResponseTime = 0;
          let countWithResponseTime = 0;
          
          recentInteractions.forEach(interaction => {
            if (interaction.metadata && typeof interaction.metadata === 'object' && 'response_time_ms' in interaction.metadata) {
              totalResponseTime += Number(interaction.metadata.response_time_ms);
              countWithResponseTime++;
            }
          });
          
          avgResponseTime = countWithResponseTime > 0 
            ? Number((totalResponseTime / countWithResponseTime / 1000).toFixed(2))
            : 0;
        }
      } catch (err) {
        console.error("Error fetching recent interactions:", err);
      }

      try {
        const { data: topQueries, error: topQueriesError } = await supabase
          .from("common_queries")
          .select("query_text")
          .eq("client_id", clientId)
          .order("frequency", { ascending: false })
          .limit(5);
        
        if (!topQueriesError && topQueries) {
          topQueriesList = topQueries.map(q => q.query_text);
        }
      } catch (err) {
        console.error("Error fetching top queries:", err);
      }

      // Set the stats even if some requests failed
      setStats({
        total_interactions: totalInteractions,
        active_days: activeDays,
        average_response_time: avgResponseTime,
        top_queries: topQueriesList
      });
      
    } catch (err: any) {
      console.error("Error fetching stats:", err);
      // Don't set authError here, allow partial data display
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchStats();
    
    const intervalId = setInterval(fetchStats, 15000); // Refresh every 15 seconds
    
    return () => clearInterval(intervalId);
  }, [clientId]);

  return {
    stats,
    errorLogs,
    queries,
    isLoadingErrorLogs,
    isLoadingQueries,
    isLoadingStats,
    authError
  };
};
