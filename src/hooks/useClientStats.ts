
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useClientStats = () => {
  return useQuery({
    queryKey: ["client-stats"],
    queryFn: async () => {
      const now = new Date();
      
      // Get total clients (independent of time range)
      const { data: allClients } = await supabase
        .from("clients")
        .select("*", { count: "exact" })
        .is("deletion_scheduled_at", null);
      
      const totalClientCount = allClients?.length ?? 0;

      // Get active clients (always last 48 hours)
      const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
      const { data: activeClients } = await supabase
        .from("client_activities")
        .select("DISTINCT client_id")
        .eq('activity_type', 'chat_interaction')
        .gte("created_at", fortyEightHoursAgo.toISOString());

      const currentActiveCount = activeClients?.length ?? 0;

      // Previous 48-hour window for active clients change calculation
      const previousFortyEightHours = new Date(fortyEightHoursAgo.getTime() - (48 * 60 * 60 * 1000));
      const { data: previousActive } = await supabase
        .from("client_activities")
        .select("DISTINCT client_id")
        .eq('activity_type', 'chat_interaction')
        .gte("created_at", previousFortyEightHours.toISOString())
        .lt("created_at", fortyEightHoursAgo.toISOString());

      const previousActiveCount = previousActive?.length ?? 0;
      const activeChangePercentage = previousActiveCount === 0 
        ? currentActiveCount > 0 ? 100 : 0
        : ((currentActiveCount - previousActiveCount) / previousActiveCount * 100);

      return {
        totalClients: totalClientCount,
        activeClients: currentActiveCount,
        activeClientsChange: activeChangePercentage.toFixed(1),
      };
    },
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
};
