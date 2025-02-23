
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req) => {
  console.log("Function invoked with method:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    console.log("Received request body:", body);

    const { clientId, clientName, email } = body;

    if (!clientId || !clientName || !email) {
      console.error("Missing parameters:", { clientId, clientName, email });
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create recovery token
    const token = crypto.randomUUID();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Creating recovery token in database...");
    const { error: tokenError } = await supabase
      .from("client_recovery_tokens")
      .insert({
        client_id: clientId,
        token: token,
        expires_at: expiryDate.toISOString(),
      });

    if (tokenError) {
      console.error("Token creation error:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to create recovery token" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const recoveryUrl = `${origin}/recover?token=${token}`;

    console.log("Sending email to:", email);
    try {
      const emailResult = await resend.emails.send({
        from: "AI Chatbot Admin <onboarding@resend.dev>",
        to: [email],
        subject: "Your Account Deletion Request",
        html: `
          <h1>Account Deletion Notice</h1>
          <p>Dear ${clientName},</p>
          <p>Your account has been scheduled for deletion in 30 days.</p>
          <p>If you wish to recover your account, you can do so by clicking the link below:</p>
          <p><a href="${recoveryUrl}">Recover My Account</a></p>
          <p>This recovery link will expire in 30 days.</p>
          <p>If you don't want to recover your account, no action is needed. Your account will be permanently deleted after 30 days.</p>
          <p>Best regards,<br>AI Chatbot Admin Team</p>
        `,
      });

      console.log("Email sent successfully:", emailResult);
      return new Response(
        JSON.stringify({ data: { success: true, message: "Email sent successfully" } }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // If email fails, we should revert the token creation
      if (token) {
        await supabase
          .from("client_recovery_tokens")
          .delete()
          .eq("token", token);
      }
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError.message }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred", details: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
