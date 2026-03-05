"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "specs", "mind_unset", "outputs");

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
        const out = {};
        for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
            out[key] = stable(value[key]);
        }
        return out;
    }
    return value;
}

function writeJson(absPath, obj) {
    const text = `${JSON.stringify(stable(obj), null, 2)}\n`;
    fs.writeFileSync(absPath, text, "utf8");
}

function writeText(absPath, text) {
    fs.writeFileSync(absPath, text.replace(/\r\n/g, "\n"), "utf8");
}

function sha256File(absPath) {
    return crypto.createHash("sha256").update(fs.readFileSync(absPath)).digest("hex").toUpperCase();
}

function main() {
    ensureDir(OUTPUT_DIR);

    const apiContract = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        additionalProperties: false,
        properties: {
            action: {
                enum: ["ingest", "profile", "summarize"],
                type: "string"
            },
            context: {
                additionalProperties: false,
                properties: {
                    domain: { enum: ["memory", "intent", "ops"], type: "string" },
                    sessionId: { minLength: 8, type: "string" },
                    source: { minLength: 3, type: "string" }
                },
                required: ["domain", "sessionId", "source"],
                type: "object"
            },
            payload: {
                additionalProperties: false,
                properties: {
                    content: { minLength: 1, type: "string" },
                    labels: {
                        items: { minLength: 1, type: "string" },
                        minItems: 1,
                        type: "array"
                    },
                    score: { minimum: 0, maximum: 1, type: "number" }
                },
                required: ["content", "labels", "score"],
                type: "object"
            },
            timestamp: { format: "date-time", type: "string" },
            version: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$", type: "string" }
        },
        required: ["action", "context", "payload", "timestamp", "version"],
        title: "MindUnsetContract",
        type: "object"
    };

    const samplePayload = {
        action: "summarize",
        context: {
            domain: "memory",
            sessionId: "sess-0001",
            source: "vault.INTEL_VAULT"
        },
        payload: {
            content: "Map known constraints and high-priority next operations.",
            labels: ["deterministic", "planning", "defensive"],
            score: 0.93
        },
        timestamp: "2026-03-05T20:50:00.000Z",
        version: "1.0.0"
    };

    const intentAllowlist = {
        defaultDecision: "deny",
        rules: [
            {
                action: "mind_unset.memory.snapshot",
                description: "Capture deterministic memory state summary",
                riskTier: "low"
            },
            {
                action: "mind_unset.intent.profile",
                description: "Compute deterministic intent profile from approved sources",
                riskTier: "low"
            },
            {
                action: "mind_unset.summary.emit",
                description: "Emit audit-safe summary payload for HUD and reports",
                riskTier: "medium"
            }
        ],
        version: "1.0.0"
    };

    const auditEventSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        additionalProperties: false,
        properties: {
            eventId: { minLength: 16, type: "string" },
            eventType: { enum: ["memory_snapshot", "intent_profile", "summary_emit"], type: "string" },
            module: { const: "mind_unset", type: "string" },
            outcome: { enum: ["accepted", "rejected"], type: "string" },
            payloadSha256: { pattern: "^[A-F0-9]{64}$", type: "string" },
            reason: { minLength: 3, type: "string" },
            timestamp: { format: "date-time", type: "string" },
            trace: {
                additionalProperties: false,
                properties: {
                    blockCid: { minLength: 32, type: "string" },
                    chainHead: { minLength: 32, type: "string" },
                    sessionId: { minLength: 8, type: "string" }
                },
                required: ["blockCid", "chainHead", "sessionId"],
                type: "object"
            }
        },
        required: ["eventId", "eventType", "module", "outcome", "payloadSha256", "reason", "timestamp", "trace"],
        title: "MindUnsetAuditEvent",
        type: "object"
    };

    const hudWidgetContract = {
        contractId: "mind_unset.context.widget",
        refreshIntervalMs: 4000,
        tiles: [
            { id: "memory_snapshot", label: "Memory Snapshot", type: "status" },
            { id: "intent_profile", label: "Intent Profile", type: "status" },
            { id: "summary_digest", label: "Summary Digest", type: "counter" }
        ],
        version: "1.0.0"
    };

    writeJson(path.join(OUTPUT_DIR, "api_contract.schema.json"), apiContract);
    writeJson(path.join(OUTPUT_DIR, "sample_payload.json"), samplePayload);
    writeJson(path.join(OUTPUT_DIR, "intent_allowlist.json"), intentAllowlist);
    writeJson(path.join(OUTPUT_DIR, "audit_event.schema.json"), auditEventSchema);
    writeJson(path.join(OUTPUT_DIR, "hud_widget_contract.json"), hudWidgetContract);

    const checklistMd = [
        "# Proof Bundle Checklist",
        "",
        "1. Run `npm run specs:check`.",
        "2. Run `npm run specs:materialize:mind_unset`.",
        "3. Run `npm run test:specs:mind_unset`.",
        "4. Run `npm run specs:verify`.",
        "5. Run `npm run specs:sign`.",
        "6. Run `npm run specs:verify:signatures`.",
        "7. Confirm package descriptor hashes in specs manifest.",
        ""
    ].join("\n");
    writeText(path.join(OUTPUT_DIR, "proof_bundle_checklist.md"), checklistMd);

    const notesMd = [
        "# Verification Notes",
        "",
        "Expected sequence:",
        "- `npm run specs:materialize:mind_unset`",
        "- `npm run test:specs:mind_unset`",
        "- `npm run specs:verify`",
        "- `npm run specs:attest`",
        "- `npm run verify:release`",
        "",
        "The release is valid when the hash chain includes:",
        "- `forgecore-os 2.0.0.exe`",
        "- `specs-manifest.json`",
        "- `specs-manifest.signatures.json`",
        ""
    ].join("\n");
    writeText(path.join(OUTPUT_DIR, "verification_notes.md"), notesMd);

    const descriptorFiles = [
        "api_contract.schema.json",
        "sample_payload.json",
        "intent_allowlist.json",
        "audit_event.schema.json",
        "hud_widget_contract.json",
        "proof_bundle_checklist.md",
        "verification_notes.md"
    ];

    const packageDescriptor = {
        bundle: {
            format: "neurodrop-tear",
            module: "mind_unset",
            version: "1.0.0"
        },
        files: descriptorFiles.map((name) => ({
            path: name,
            sha256: sha256File(path.join(OUTPUT_DIR, name))
        })),
        policy: {
            deterministic: true,
            intentFirewallRequired: true,
            offlineFirst: true
        }
    };
    writeJson(path.join(OUTPUT_DIR, "package_descriptor.json"), packageDescriptor);

    const sampleHash = sha256File(path.join(OUTPUT_DIR, "sample_payload.json"));
    console.log(`[mind_unset:materialize] output=${path.relative(ROOT, OUTPUT_DIR).replace(/\\/g, "/")}`);
    console.log("[mind_unset:materialize] files=8");
    console.log(`[mind_unset:materialize] sample_payload_sha256=${sampleHash}`);
    console.log("[mind_unset:materialize] status=OK");
}

try {
    main();
} catch (err) {
    console.error(`[mind_unset:materialize] FAIL: ${err.message}`);
    process.exit(1);
}
