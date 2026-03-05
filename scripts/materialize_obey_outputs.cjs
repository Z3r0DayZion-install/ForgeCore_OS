"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "specs", "obey", "outputs");

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
                enum: ["simulate", "validate", "audit"],
                type: "string"
            },
            actor: {
                additionalProperties: false,
                properties: {
                    id: { minLength: 3, type: "string" },
                    role: { enum: ["founder", "operator", "auditor"], type: "string" }
                },
                required: ["id", "role"],
                type: "object"
            },
            intent: {
                additionalProperties: false,
                properties: {
                    category: { type: "string" },
                    riskTier: { enum: ["low", "medium", "high"], type: "string" },
                    tags: {
                        items: { minLength: 1, type: "string" },
                        minItems: 1,
                        type: "array"
                    }
                },
                required: ["category", "riskTier", "tags"],
                type: "object"
            },
            payload: {
                additionalProperties: false,
                properties: {
                    command: { minLength: 3, type: "string" },
                    parameters: { type: "object" }
                },
                required: ["command", "parameters"],
                type: "object"
            },
            timestamp: { format: "date-time", type: "string" },
            version: { pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$", type: "string" }
        },
        required: ["action", "actor", "intent", "payload", "timestamp", "version"],
        title: "ObeyCommandContract",
        type: "object"
    };

    const samplePayload = {
        action: "validate",
        actor: {
            id: "operator.local",
            role: "founder"
        },
        intent: {
            category: "governance",
            riskTier: "low",
            tags: ["deterministic", "defensive"]
        },
        payload: {
            command: "obey.validate.contract",
            parameters: {
                strict: true
            }
        },
        timestamp: "2026-03-05T20:00:00.000Z",
        version: "1.0.0"
    };

    const intentAllowlist = {
        defaultDecision: "deny",
        rules: [
            {
                action: "obey.read.status",
                description: "Read-only module status query",
                riskTier: "low"
            },
            {
                action: "obey.validate.contract",
                description: "Validate contract payload against deterministic schema",
                riskTier: "low"
            },
            {
                action: "obey.audit.emit",
                description: "Emit immutable audit event for accepted action",
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
            eventType: { enum: ["allow", "deny", "audit"], type: "string" },
            module: { const: "obey", type: "string" },
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
        title: "ObeyAuditEvent",
        type: "object"
    };

    const hudWidgetContract = {
        contractId: "obey.health.proof.widget",
        refreshIntervalMs: 5000,
        tiles: [
            { id: "intent_decision", label: "Intent Decision", type: "status" },
            { id: "audit_sync", label: "Audit Sync", type: "status" },
            { id: "proof_bundle", label: "Proof Bundle", type: "counter" }
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
        "2. Run `npm run specs:verify`.",
        "3. Run `npm run specs:sign`.",
        "4. Run `npm run specs:verify:signatures`.",
        "5. Run `npm run verify:release`.",
        "6. Confirm `dist/specs-manifest.json` and detached signatures are present.",
        ""
    ].join("\n");
    writeText(path.join(OUTPUT_DIR, "proof_bundle_checklist.md"), checklistMd);

    const notesMd = [
        "# Verification Notes",
        "",
        "Expected sequence:",
        "- `npm run specs:check`",
        "- `npm run specs:verify`",
        "- `npm run specs:sign`",
        "- `npm run specs:verify:signatures`",
        "- `npm run founder:ops`",
        "",
        "The release hash chain is valid when `dist/artifact_hashes.txt` includes both:",
        "- `forgecore-os 2.0.0.exe`",
        "- `specs-manifest.json`",
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
            module: "obey",
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
    console.log(`[obey:materialize] output=${path.relative(ROOT, OUTPUT_DIR).replace(/\\/g, "/")}`);
    console.log(`[obey:materialize] files=8`);
    console.log(`[obey:materialize] sample_payload_sha256=${sampleHash}`);
    console.log("[obey:materialize] status=OK");
}

try {
    main();
} catch (err) {
    console.error(`[obey:materialize] FAIL: ${err.message}`);
    process.exit(1);
}
