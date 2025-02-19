import { useState } from "react";
import { ArrowRight, Plus, Users, Settings, Link, UserPlus, Edit, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { Json } from "@/integrations/supabase/types";

const MetricCard = ({ title, value, change }: { title: string; value: string | number; change?: string }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 animate-fade-in">
    <h3 className="text-gray-500 text-sm font-medium mb-2">{title}</h3>
    <div className="flex items-end gap-2">
      <span className="text-3xl font-bold text-gray-900">{value}</span>
      {change && (
        <span className="text-secondary text-sm font-medium mb-1">
          {change.startsWith('-') ? '' : '+'}{change}%
        </span>
      )}
    </div>
  </div>
);

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'client_created':
      return <UserPlus className="w-4 h-4 text-primary" />;
    case 'client_updated':
      return <Edit className="w-4 h-4 text-primary" />;
    case 'widget_settings_updated':
      return <Settings className="w-4 h-4 text-primary" />;
    case 'website_url_added':
    case 'drive_link_added':
      return <Link className="w-4 h-4 text-primary" />;
    default:
      return <Users className="w-4 h-4 text-primary" />;
  }
};

const ActivityItem = ({ item }: { item: { 
  activity_type: string;
  description: string;
  created_at: string;
  metadata: Json;
  client_name?: string;
} }) => (
  <div className="flex items-center gap-4 py-3 animate-slide-in">
    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
      {getActivityIcon(item.activity_type)}
    </div>
    <div className="flex-1">
      <p className="text-sm text-gray-900">
        <span className="font-medium">{item.client_name}</span>{" "}
        {item.description}
      </p>
      <p className="text-xs text-gray-500">{format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}</p>
    </div>
  </div>
);

const ActionButton = ({ children, primary = false, onClick }: { children: React.ReactNode; primary?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`${
      primary
        ? "bg-primary text-white hover:bg-primary/90"
        : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
    } px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors duration-200`}
  >
    {children}
  </button>
);

const Index = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"1d" | "1m" | "1y" | "all">("all");

  const { data: clientStats } = useQuery({
    queryKey: ["client-stats", timeRange],
    queryFn: async () => {
      const now = new Date();
      let startDate;

      switch (timeRange) {
        case "1d":
          startDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case "1m":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "1y":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }

      const { data: totalClients, error: totalError } = await supabase
        .from("clients")
        .select("*", { count: "exact" });

      if (totalError) throw totalError;

      const { data: activeClients, error: activeError } = await supabase
        .from("clients")
        .select("*")
        .eq("status", 'active');

      if (activeError) throw activeError;

      const previousPeriodStart = new Date(startDate);
      const previousPeriodEnd = new Date(startDate);
      
      switch (timeRange) {
        case "1d":
          previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
          break;
        case "1m":
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
          break;
        case "1y":
          previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
          break;
      }

      const { data: previousActive } = await supabase
        .from("clients")
        .select("*")
        .eq("status", 'active')
        .gte("last_active", previousPeriodStart.toISOString())
        .lt("last_active", previousPeriodEnd.toISOString());

      const currentActiveCount = activeClients?.length ?? 0;
      const previousActiveCount = previousActive?.length ?? 0;
      
      const changePercentage = previousActiveCount === 0 
        ? currentActiveCount > 0 ? 100 : 0
        : ((currentActiveCount - previousActiveCount) / previousActiveCount * 100);

      return {
        total: totalClients?.length ?? 0,
        active: currentActiveCount,
        change: changePercentage.toFixed(1)
      };
    }
  });

  const { data: interactionStats } = useQuery({
    queryKey: ["interaction-stats", timeRange],
    queryFn: async () => {
      const { data: activities, error } = await supabase
        .from("client_activities")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const now = new Date();
      let startDate;

      switch (timeRange) {
        case "1d":
          startDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case "1m":
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case "1y":
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = new Date(0);
      }

      const filteredActivities = activities?.filter(
        activity => new Date(activity.created_at) >= startDate
      );

      const totalInteractions = filteredActivities?.length ?? 0;
      const avgInteractions = Math.round(totalInteractions / (clientStats?.total || 1));

      const previousActivities = activities?.filter(
        activity => {
          const activityDate = new Date(activity.created_at);
          return activityDate >= startDate && activityDate < now;
        }
      );

      const previousTotal = previousActivities?.length ?? 0;
      const changePercentage = previousTotal === 0 
        ? totalInteractions > 0 ? 100 : 0
        : ((totalInteractions - previousTotal) / previousTotal * 100);

      return {
        total: totalInteractions,
        average: avgInteractions,
        change: changePercentage.toFixed(1)
      };
    },
    enabled: !!clientStats?.total
  });

  const { data: recentActivities } = useQuery({
    queryKey: ["recent-activities"],
    queryFn: async () => {
      const { data: activities, error } = await supabase
        .from("client_activities")
        .select(`
          activity_type,
          description,
          created_at,
          metadata,
          clients:client_id (
            client_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error("Error fetching activities:", error);
        throw error;
      }

      return activities.map(activity => ({
        activity_type: activity.activity_type,
        description: activity.description,
        created_at: activity.created_at,
        metadata: activity.metadata,
        client_name: activity.clients?.client_name || "Unknown Client"
      }));
    },
    refetchInterval: 3000
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">AI Chatbot Admin System</h1>
          <p className="text-gray-500">Monitor and manage your AI chatbot clients</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title="Total Clients" 
            value={clientStats?.total || 0}
          />
          <MetricCard 
            title="Active Clients" 
            value={clientStats?.active || 0}
            change={clientStats?.change}
          />
          <MetricCard 
            title="Avg. Interactions" 
            value={interactionStats?.average || 0}
          />
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Total Interactions</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-3xl font-bold text-gray-900">
                {interactionStats?.total || 0}
              </span>
              <span className="text-secondary text-sm font-medium">
                {interactionStats?.change && 
                  `${interactionStats.change.startsWith('-') ? '' : '+'}${interactionStats.change}%`
                }
              </span>
            </div>
            <div className="flex gap-2">
              {(["1d", "1m", "1y", "all"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 text-xs rounded-md ${
                    timeRange === range
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  } transition-colors duration-200`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="divide-y divide-gray-100">
            {recentActivities?.length === 0 ? (
              <p className="text-gray-500 py-4">No recent activities</p>
            ) : (
              recentActivities?.map((activity, index) => (
                <ActivityItem key={`${activity.created_at}-${index}`} item={activity} />
              ))
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <ActionButton primary onClick={() => navigate('/clients/new')}>
            <Plus className="w-4 h-4" /> Add New Client
          </ActionButton>
          <ActionButton onClick={() => navigate("/clients")}>
            View Client List <ArrowRight className="w-4 h-4" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

export default Index;
