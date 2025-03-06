
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserCircle } from "lucide-react";

interface ProfileSectionProps {
  initialFullName: string;
  initialEmail: string;
}

export const ProfileSection = ({ initialFullName, initialEmail }: ProfileSectionProps) => {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(initialFullName);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");

  useEffect(() => {
    // Update state when props change
    setFullName(initialFullName);
    setEmail(initialEmail);
  }, [initialFullName, initialEmail]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      console.log("Updating profile with:", { email, fullName });
      
      const { error: updateError } = await supabase.auth.updateUser({
        email: email,
        data: { full_name: fullName }
      });
      
      if (updateError) {
        console.error("Profile update error:", updateError);
        setError(updateError.message);
        toast.error(updateError.message);
        return;
      }
      
      console.log("Profile updated successfully");
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Error in profile update:", error);
      setError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Profile Information
        </CardTitle>
        <CardDescription>
          Update your profile details and email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Update Profile
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
