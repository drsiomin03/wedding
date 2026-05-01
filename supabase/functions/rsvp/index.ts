// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function sha256Hex(input: string) {
    const bytes = new TextEncoder().encode(input);
    return crypto.subtle.digest("SHA-256", bytes).then((buf) => {
        const arr = Array.from(new Uint8Array(buf));
        return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
    });
}

function bad(message: string, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return bad("Method not allowed", 405);
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
        return bad("Server is not configured", 500);
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return bad("Invalid JSON payload");
    }

    const action = payload?.action;
    const code = String(payload?.code || "").trim().toLowerCase();
    const token = String(payload?.token || "").trim();

    if (!action || !code || !token) {
        return bad("action, code and token are required");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenErr } = await supabase
        .from("invite_tokens")
        .select("code,token_hash")
        .eq("code", code)
        .maybeSingle();

    if (tokenErr) {
        return bad(`Token check failed: ${tokenErr.message}`, 500);
    }

    if (!tokenRow || tokenRow.token_hash !== tokenHash) {
        return bad("Invalid invite token", 403);
    }

    if (action === "set") {
        const status = payload?.status;
        const name = String(payload?.name || "").trim();
        if (status !== "yes" && status !== "no") {
            return bad("status must be yes or no");
        }
        if (!name) {
            return bad("name is required");
        }

        const { error } = await supabase.from("invites").upsert(
            {
                code,
                name,
                status,
                updated_at: new Date().toISOString()
            },
            { onConflict: "code" }
        );

        if (error) {
            return bad(`Failed to save RSVP: ${error.message}`, 500);
        }

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    if (action === "clear") {
        const { error } = await supabase.from("invites").delete().eq("code", code);
        if (error) {
            return bad(`Failed to clear RSVP: ${error.message}`, 500);
        }

        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    return bad("Unknown action");
});
