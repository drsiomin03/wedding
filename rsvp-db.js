(function () {
    const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
    const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
    const TABLE = "invites";

    function isConfigured() {
        return (
            SUPABASE_URL &&
            SUPABASE_ANON_KEY &&
            !SUPABASE_URL.includes("YOUR_PROJECT_REF") &&
            !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")
        );
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

    async function setInviteStatus(invite) {
        const status = normalizeStatus(invite.status);
        if (!status) {
            throw new Error("Status must be yes or no.");
        }

        const payload = {
            code: invite.code,
            name: invite.name,
            status,
            updated_at: new Date().toISOString()
        };

        await request(
            "POST",
            TABLE,
            [payload],
            "resolution=merge-duplicates,return=representation"
        );
    }

    async function clearInviteStatus(code) {
        const safe = encodeURIComponent(code);
        await request("DELETE", `${TABLE}?code=eq.${safe}`, null);
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
        getInviteStatus,
        setInviteStatus,
        clearInviteStatus,
        getStatuses
    };
})();
