
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface InvitationRequest {
  clientId: string;
  email: string;
  clientName: string;
}

// Function to generate a random password
const generateTemporaryPassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  try {
    console.log("Client invitation function started");
    
    // Parse request body
    const { clientId, email, clientName }: InvitationRequest = await req.json();
    console.log(`Setting up account for client: ${clientName} (${email})`);
    
    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Generate a temporary password
    const temporaryPassword = generateTemporaryPassword();
    
    // Create user account with service role
    const { data: user, error: signUpError } = await supabase.auth.admin.createUser({
      email: email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        client_id: clientId,
        password_change_required: true,
      }
    });

    if (signUpError || !user) {
      console.error("Error creating user:", signUpError);
      throw signUpError || new Error("Failed to create user");
    }
    
    console.log("User account created with ID:", user.user.id);
    
    // Set up user role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.user.id,
        role: "client",
        client_id: clientId
      });
      
    if (roleError) {
      console.error("Error setting user role:", roleError);
      throw roleError;
    }
    
    // Send confirmation email with temporary password
    console.log("Sending confirmation email");
    await supabase.functions.invoke("send-setup-confirmation", {
      body: { 
        email: email,
        clientName: clientName,
        temporaryPassword: temporaryPassword
      }
    });
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Client account created and confirmation email sent"
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error: any) {
    console.error("Error in send-client-invitation function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to set up client account"
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
