// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GUESTS_ADMIN_TOKEN = Deno.env.get("GUESTS_ADMIN_TOKEN") || "";

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

function ok(body: Record<string, unknown>) {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

function randomToken() {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const chars = crypto.getRandomValues(new Uint8Array(16));
    let token = "tk_";
    for (const value of chars) {
        token += alphabet[value % alphabet.length];
    }
    return token;
}

async function verifyInviteToken(
    supabase: ReturnType<typeof createClient>,
    code: string,
    token: string
) {
    const tokenHash = await sha256Hex(token);
    const { data: tokenRow, error: tokenErr } = await supabase
        .from("invite_tokens")
        .select("code,token_hash")
        .eq("code", code)
        .maybeSingle();

    if (tokenErr) {
        throw new Error(`Token check failed: ${tokenErr.message}`);
    }

    if (!tokenRow || tokenRow.token_hash !== tokenHash) {
        return false;
    }
    return true;
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

    const action = String(payload?.action || "").trim();
    if (!action) {
        return bad("action is required");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (action === "admin_list" || action === "admin_upsert" || action === "admin_delete" || action === "admin_issue_link") {
        const adminToken = String(payload?.admin_token || "").trim();
        if (!GUESTS_ADMIN_TOKEN) {
            return bad("Admin token is not configured on server", 500);
        }
        if (!adminToken || adminToken !== GUESTS_ADMIN_TOKEN) {
            return bad("Invalid admin token", 403);
        }

        if (action === "admin_list") {
            const { data, error } = await supabase
                .from("invites")
                .select("code,name,status,updated_at,invite_tokens(token_plain)")
                .order("code", { ascending: true });

            if (error) {
                return bad(`Failed to list guests: ${error.message}`, 500);
            }

            const rows = (data || []).map((row: any) => ({
                code: row.code,
                name: row.name,
                token: row.invite_tokens?.token_plain || "",
                status: row.status || null,
                updated_at: row.updated_at || null
            }));
            return ok({ guests: rows });
        }

        if (action === "admin_upsert") {
            const code = String(payload?.code || "").trim().toLowerCase();
            const name = String(payload?.name || "").trim();
            const token = String(payload?.token || "").trim();
            if (!code || !name) {
                return bad("code and name are required");
            }
            const nowIso = new Date().toISOString();

            const { error: inviteErr } = await supabase.from("invites").upsert(
                {
                    code,
                    name,
                    updated_at: nowIso
                },
                { onConflict: "code" }
            );
            if (inviteErr) {
                return bad(`Failed to upsert invite: ${inviteErr.message}`, 500);
            }

            if (token) {
                const tokenHash = await sha256Hex(token);
                const { error: tokenErr } = await supabase.from("invite_tokens").upsert(
                    {
                        code,
                        token_plain: token,
                        token_hash: tokenHash
                    },
                    { onConflict: "code" }
                );
                if (tokenErr) {
                    return bad(`Failed to upsert token: ${tokenErr.message}`, 500);
                }
            }

            return ok({ ok: true });
        }

        if (action === "admin_delete") {
            const code = String(payload?.code || "").trim().toLowerCase();
            if (!code) {
                return bad("code is required");
            }
            await supabase.from("invite_tokens").delete().eq("code", code);
            const { error } = await supabase.from("invites").delete().eq("code", code);
            if (error) {
                return bad(`Failed to delete invite: ${error.message}`, 500);
            }
            return ok({ ok: true });
        }

        if (action === "admin_issue_link") {
            const code = String(payload?.code || "").trim().toLowerCase();
            if (!code) {
                return bad("code is required");
            }

            const token = randomToken();
            const tokenHash = await sha256Hex(token);
            const { error } = await supabase.from("invite_tokens").upsert(
                {
                    code,
                    token_plain: token,
                    token_hash: tokenHash
                },
                { onConflict: "code" }
            );
            if (error) {
                return bad(`Failed to issue invite link: ${error.message}`, 500);
            }
            return ok({ code, token });
        }
    }

    if (action === "set") {
        const code = String(payload?.code || "").trim().toLowerCase();
        const token = String(payload?.token || "").trim();
        const status = payload?.status;
        const name = String(payload?.name || "").trim();
        if (!code || !token) {
            return bad("code and token are required");
        }
        if (status !== "yes" && status !== "no") {
            return bad("status must be yes or no");
        }
        if (!name) {
            return bad("name is required");
        }
        try {
            const valid = await verifyInviteToken(supabase, code, token);
            if (!valid) {
                return bad("Invalid invite token", 403);
            }
        } catch (error) {
            return bad((error as Error).message, 500);
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

        return ok({ ok: true });
    }

    if (action === "clear") {
        const code = String(payload?.code || "").trim().toLowerCase();
        const token = String(payload?.token || "").trim();
        if (!code || !token) {
            return bad("code and token are required");
        }
        try {
            const valid = await verifyInviteToken(supabase, code, token);
            if (!valid) {
                return bad("Invalid invite token", 403);
            }
        } catch (error) {
            return bad((error as Error).message, 500);
        }

        const { error } = await supabase
            .from("invites")
            .update({ status: null, updated_at: new Date().toISOString() })
            .eq("code", code);
        if (error) {
            return bad(`Failed to clear RSVP: ${error.message}`, 500);
        }

        return ok({ ok: true });
    }

    return bad("Unknown action");
});
