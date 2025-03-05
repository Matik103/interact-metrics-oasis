
import React from "react";
import { format } from "date-fns";
import { 
  Users, Settings, Link, UserPlus, Edit, Trash2, 
  RotateCcw, Upload, Eye, Code, Image 
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ActivityItemProps {
  item: {
    activity_type: string;
    description: string;
    created_at: string;
    metadata: Json;
    client_name?: string;
  };
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'client_created':
      return <UserPlus className="w-4 h-4 text-primary" />;
    case 'client_updated':
      return <Edit className="w-4 h-4 text-primary" />;
    case 'client_deleted':
      return <Trash2 className="w-4 h-4 text-destructive" />;
    case 'client_recovered':
      return <RotateCcw className="w-4 h-4 text-green-500" />;
    case 'widget_settings_updated':
      return <Settings className="w-4 h-4 text-primary" />;
    case 'website_url_added':
    case 'drive_link_added':
      return <Link className="w-4 h-4 text-primary" />;
    case 'website_url_removed':
    case 'drive_link_removed':
      return <Trash2 className="w-4 h-4 text-primary" />;
    case 'logo_uploaded':
      return <Image className="w-4 h-4 text-primary" />;
    case 'embed_code_copied':
      return <Code className="w-4 h-4 text-primary" />;
    case 'widget_previewed':
      return <Eye className="w-4 h-4 text-primary" />;
    default:
      return <Users className="w-4 h-4 text-primary" />;
  }
};

export const ActivityItem = ({ item }: ActivityItemProps) => (
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
