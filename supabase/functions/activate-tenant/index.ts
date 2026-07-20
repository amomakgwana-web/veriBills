// Step 4 of tenant onboarding (Section 3.3): "The tenant confirms their
// details and sets their own credentials." This is the one piece of the
// invite/activation flow that a plain Postgres RPC can't do — creating a
// Supabase Auth identity needs the Auth admin API, which only works with
// the service_role key, never something safe to ship to a browser.
//
// Split responsibility with db/007's public.vb_complete_tenant_activation:
// this function's only job is (1) look up the invite by token to get the
// email a real Auth user needs, (2) create that Auth user, then hand off
// to the SQL function for everything else (validating the invite is still
// usable, creating vb_platform.users, linking the lease, marking the
// invite activated) — one place owns that business logic, not duplicated
// here. If the SQL step fails after the Auth user was already created,
// this deletes it again so a retry with the same token doesn't collide
// with a half-activated identity.
//
// Deploy: mcp__Supabase__deploy_edge_function.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActivateRequest {
  token: string;
  name: string;
  password: string;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: ActivateRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { ok: false, data: null, error: { code: "INVALID_REQUEST", message: "Invalid JSON body" } });
  }
  if (!body.token || !body.name || !body.password) {
    return jsonResponse(400, { ok: false, data: null, error: { code: "INVALID_REQUEST", message: "token, name, and password are required" } });
  }
  if (body.password.length < 8) {
    return jsonResponse(400, { ok: false, data: null, error: { code: "WEAK_PASSWORD", message: "password must be at least 8 characters" } });
  }

  // service_role — this endpoint runs before the tenant has any session of
  // their own; the invite token is what proves they're allowed to do this,
  // not a JWT.
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: invite, error: inviteError } = await admin
    .from("vb_tenant_invites")
    .select("email, status")
    .eq("token", body.token)
    .maybeSingle();
  if (inviteError || !invite || invite.status !== "pending") {
    return jsonResponse(404, { ok: false, data: null, error: { code: "INVITE_NOT_FOUND", message: "Invite not found or already used" } });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: invite.email,
    password: body.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const alreadyRegistered = createError?.message?.toLowerCase().includes("already registered");
    return jsonResponse(alreadyRegistered ? 409 : 400, {
      ok: false,
      data: null,
      error: { code: "AUTH_CREATE_FAILED", message: createError?.message ?? "Could not create account" },
    });
  }

  const { data: user, error: rpcError } = await admin.rpc("vb_complete_tenant_activation", {
    p_token: body.token,
    p_name: body.name,
    p_auth_user_id: created.user.id,
  });
  if (rpcError) {
    // Roll back the orphaned Auth user so the same token can be retried.
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
    return jsonResponse(400, { ok: false, data: null, error: { code: "ACTIVATION_FAILED", message: rpcError.message } });
  }

  return jsonResponse(201, { ok: true, data: { userId: user.id, email: user.email }, meta: { service: "activate-tenant" } });
});
