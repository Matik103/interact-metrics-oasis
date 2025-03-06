
import { useAuth } from "@/contexts/AuthContext";
import { useClientData } from "@/hooks/useClientData";
import { useClientActivity } from "@/hooks/useClientActivity";
import { ClientDetails } from "@/components/client/ClientDetails";
import { ClientResourceSections } from "@/components/client/ClientResourceSections";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Database, User, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const EditInfo = () => {
  const { user } = useAuth();
  const clientId = user?.user_metadata?.client_id;
  const { client, isLoadingClient, error } = useClientData(clientId);
  const { logClientActivity } = useClientActivity(clientId);

  console.log("EditInfo: client ID from auth:", clientId);

  if (isLoadingClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-red-700">Error loading client data: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link 
          to="/client/view"
          className="text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Information</h1>
          <p className="text-gray-500">Update client information</p>
        </div>
      </div>
      
      <div className="space-y-8">
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientDetails 
              client={client} 
              clientId={clientId} 
              isClientView={true}
              logClientActivity={logClientActivity}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientResourceSections
              clientId={clientId}
              isClientView={true}
              logClientActivity={logClientActivity}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditInfo;
