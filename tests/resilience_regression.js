"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");

const PORT = 3000;
const HOST = "127.0.0.1";
const MASTER = "FORGE_MASTER_2026";
const ROOT_DIR = path.join(__dirname, "..");
const TEST_VAULT = "INTEL_VAULT";
const TEST_FILE = `resilience_probe_${Date.now()}.txt`;
const EXPECTED_CONTENT = `RESILIENCE_BASELINE_${Date.now()}`;

let SESSION_TOKEN = null;

function request(route, method = "GET", body = null) {
    return new Promise((resolve, reject) => {
        const headers = {};
        if (SESSION_TOKEN) headers["Authorization"] = `Bearer ${SESSION_TOKEN}`;
        if (body) headers["Content-Type"] = "application/json";

        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: route,
            method,
            headers
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = data ? JSON.parse(data) : null;
                } catch {
                    parsed = data;
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });

        req.on("error", reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function main() {
    console.log("=== RESILIENCE REGRESSION ===");

    const unlock = await request("/api/system/unlock", "POST", { passphrase: MASTER });
    assert(unlock.status === 200, `Unlock failed: ${unlock.status}`);
    assert(unlock.body && unlock.body.token, "Unlock token missing.");
    SESSION_TOKEN = unlock.body.token;
    console.log("✅ Unlocked.");

    const create = await request("/api/vault/new", "POST", {
        vault: TEST_VAULT,
        name: TEST_FILE,
        content: EXPECTED_CONTENT
    });
    assert(create.status === 200 && create.body && create.body.ok, `Vault write failed: ${create.status} ${JSON.stringify(create.body)}`);
    console.log(`✅ Baseline file created: ${TEST_FILE}`);

    const witnessSummary = await request("/api/tear/witnesses");
    assert(witnessSummary.status === 200, `Witness summary failed: ${witnessSummary.status}`);
    assert(
        witnessSummary.body &&
        witnessSummary.body.localSummary &&
        typeof witnessSummary.body.localSummary.headCount === "number",
        "Witness summary payload malformed."
    );
    console.log(`✅ Witness summary reachable (headCount=${witnessSummary.body.localSummary.headCount}).`);

    const latestHead = Array.isArray(witnessSummary.body.localSummary.heads) && witnessSummary.body.localSummary.heads.length
        ? witnessSummary.body.localSummary.heads[witnessSummary.body.localSummary.heads.length - 1].headCID
        : null;

    if (latestHead) {
        const witnessDetail = await request(`/api/tear/witnesses?head=${encodeURIComponent(latestHead)}&timeoutMs=400`);
        assert(witnessDetail.status === 200, `Witness detail failed: ${witnessDetail.status}`);
        assert(Array.isArray(witnessDetail.body.localWitnesses), "Witness detail malformed: localWitnesses not array.");
        console.log(`✅ Witness detail reachable for head ${latestHead.substring(0, 12)}...`);
    } else {
        console.log("ℹ️ No execution-chain head available yet for detailed witness query.");
    }

    const absFile = path.join(ROOT_DIR, "vaults", TEST_VAULT, TEST_FILE);
    fs.writeFileSync(absFile, "TAMPERED_PAYLOAD", "utf8");
    console.log("✅ Tamper injected directly on disk.");

    const triggerHeal = await request(`/api/list?vault=${encodeURIComponent(TEST_VAULT)}`);
    assert(triggerHeal.status === 200, `List/heal trigger failed: ${triggerHeal.status}`);

    const healedContent = fs.readFileSync(absFile, "utf8");
    assert(healedContent === EXPECTED_CONTENT, "Auto-heal did not restore original content.");
    console.log("✅ Auto-heal restored tampered file.");

    const cleanup = await request("/api/vault/delete", "POST", {
        vault: TEST_VAULT,
        file: TEST_FILE
    });
    assert(cleanup.status === 200 && cleanup.body && cleanup.body.ok, `Cleanup failed: ${cleanup.status} ${JSON.stringify(cleanup.body)}`);
    console.log("✅ Cleanup complete.");

    console.log("🎯 RESILIENCE REGRESSION PASSED.");
}

main().catch((err) => {
    console.error("❌ RESILIENCE REGRESSION FAILED:", err.message);
    process.exit(1);
});
