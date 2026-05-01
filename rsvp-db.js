(function () {
    const SUPABASE_URL = "https://uiauuqblbuijgtlpbgeq.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_OILlOPnB8q7WmHaKp-ZCsA_G9wY5MiV";
    const TABLE = "invites";
    const FUNCTION_NAME = "rsvp";
    let guestsAdminToken = "";

    function isConfigured() {
        return (
            SUPABASE_URL &&
            SUPABASE_ANON_KEY &&
            !SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
            !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
        );
    }

    function hasAdminToken() {
        return (
            guestsAdminToken &&
            !guestsAdminToken.includes("YOUR_GUESTS_ADMIN_TOKEN")
        );
    }

    function setAdminToken(token) {
        guestsAdminToken = String(token || "").trim();
    }

    async function request(method, queryPath, body, preferHeader) {
        if (!isConfigured()) {
            throw new Error("Supabase is not configured.");
        }

        const headers = {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
        };

        if (preferHeader) {
            headers.Prefer = preferHeader;
        }

        const response = await fetch(`${SUPABASE_URL}/rest/v1/${queryPath}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Supabase request failed: ${response.status} ${text}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    async function functionRequest(payload) {
        if (!isConfigured()) {
            throw new Error("Supabase is not configured.");
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`RSVP function failed: ${response.status} ${text}`);
        }

        return response.json();
    }

    function normalizeStatus(status) {
        return status === "yes" || status === "no" ? status : null;
    }

    async function getInviteStatus(code) {
        const safe = encodeURIComponent(code);
        const rows = await request("GET", `${TABLE}?select=code,status,updated_at&code=eq.${safe}&limit=1`, null);
        if (!rows || rows.length === 0) {
            return null;
        }
        return rows[0];
    }

    async function getInviteMeta(code) {
        const safe = encodeURIComponent(code);
        const rows = await request("GET", `${TABLE}?select=code,name,status,updated_at&code=eq.${safe}&limit=1`, null);
        if (!rows || rows.length === 0) {
            return null;
        }
        return rows[0];
    }

    async function setInviteStatus(invite) {
        const status = normalizeStatus(invite.status);
        if (!status) {
            throw new Error("Status must be yes or no.");
        }

        await functionRequest({
            action: "set",
            code: invite.code,
            token: invite.token,
            name: invite.name,
            status
        });
    }

    async function clearInviteStatus(code, token) {
        await functionRequest({
            action: "clear",
            code,
            token
        });
    }

    async function listGuests() {
        if (!hasAdminToken()) {
            throw new Error("Guests admin token is not configured.");
        }
        return functionRequest({
            action: "admin_list",
            admin_token: guestsAdminToken
        });
    }

    async function upsertGuest(guest) {
        if (!hasAdminToken()) {
            throw new Error("Guests admin token is not configured.");
        }
        const payload = {
            action: "admin_upsert",
            admin_token: guestsAdminToken,
            code: guest.code,
            name: guest.name
        };
        if (guest.token) {
            payload.token = guest.token;
        }
        return functionRequest(payload);
    }

    async function deleteGuest(code) {
        if (!hasAdminToken()) {
            throw new Error("Guests admin token is not configured.");
        }
        return functionRequest({
            action: "admin_delete",
            admin_token: guestsAdminToken,
            code
        });
    }

    async function issueGuestLink(code) {
        if (!hasAdminToken()) {
            throw new Error("Guests admin token is not configured.");
        }
        return functionRequest({
            action: "admin_issue_link",
            admin_token: guestsAdminToken,
            code
        });
    }

    async function getStatuses(codes) {
        const filtered = (codes || []).filter(Boolean);
        if (filtered.length === 0) {
            return {};
        }

        const inList = filtered.map((c) => `"${c}"`).join(",");
        const rows = await request(
            "GET",
            `${TABLE}?select=code,status,updated_at&code=in.(${encodeURIComponent(inList)})`,
            null
        );

        const map = {};
        (rows || []).forEach((row) => {
            if (row && row.code) {
                map[row.code] = row;
            }
        });
        return map;
    }

    window.RSVP_DB = {
        isConfigured,
        hasAdminToken,
        setAdminToken,
        getInviteMeta,
        getInviteStatus,
        setInviteStatus,
        clearInviteStatus,
        getStatuses,
        listGuests,
        upsertGuest,
        deleteGuest,
        issueGuestLink
    };
})();
