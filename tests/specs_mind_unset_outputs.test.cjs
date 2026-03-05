"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "specs", "mind_unset", "outputs");

function readJson(name) {
    const filePath = path.join(OUTPUT_DIR, name);
    assert.ok(fs.existsSync(filePath), `missing file: ${name}`);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256File(name) {
    const filePath = path.join(OUTPUT_DIR, name);
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function main() {
    const api = readJson("api_contract.schema.json");
    const sample = readJson("sample_payload.json");
    const allowlist = readJson("intent_allowlist.json");
    const audit = readJson("audit_event.schema.json");
    const descriptor = readJson("package_descriptor.json");
    const hud = readJson("hud_widget_contract.json");

    assert.strictEqual(api.title, "MindUnsetContract", "api contract title mismatch");
    assert.ok(Array.isArray(api.required), "api required missing");
    assert.ok(api.required.includes("action"), "api required.action missing");
    assert.ok(api.required.includes("timestamp"), "api required.timestamp missing");

    assert.strictEqual(sample.action, "summarize", "sample action mismatch");
    assert.strictEqual(sample.version, "1.0.0", "sample version mismatch");
    const sampleHash = sha256File("sample_payload.json");
    assert.strictEqual(
        sampleHash,
        "7E69A6D5EB452E7EDD533950160C3CC9365C2916E3155204F618C9D7142E0380",
        "sample payload hash drift"
    );

    assert.strictEqual(allowlist.defaultDecision, "deny", "allowlist defaultDecision mismatch");
    assert.ok(Array.isArray(allowlist.rules) && allowlist.rules.length > 0, "allowlist rules missing");
    for (const rule of allowlist.rules) {
        assert.ok(rule.action && !String(rule.action).includes("*"), `wildcard action forbidden: ${rule.action}`);
    }

    assert.ok(Array.isArray(audit.required), "audit required missing");
    for (const key of ["eventId", "eventType", "module", "outcome", "payloadSha256", "timestamp", "trace"]) {
        assert.ok(audit.required.includes(key), `audit required missing: ${key}`);
    }

    assert.ok(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(String(hud.version || "")), "hud version not semver");

    const descriptorFiles = Array.isArray(descriptor.files) ? descriptor.files : [];
    const expectedPaths = [
        "api_contract.schema.json",
        "sample_payload.json",
        "intent_allowlist.json",
        "audit_event.schema.json",
        "hud_widget_contract.json",
        "proof_bundle_checklist.md",
        "verification_notes.md"
    ];
    assert.strictEqual(descriptorFiles.length, expectedPaths.length, "descriptor file count mismatch");
    for (const rel of expectedPaths) {
        const row = descriptorFiles.find((f) => f.path === rel);
        assert.ok(row, `descriptor missing path: ${rel}`);
        assert.strictEqual(String(row.sha256 || ""), sha256File(rel), `descriptor hash mismatch: ${rel}`);
    }

    for (const md of ["proof_bundle_checklist.md", "verification_notes.md"]) {
        const text = fs.readFileSync(path.join(OUTPUT_DIR, md), "utf8");
        assert.ok(text.includes("npm run specs:verify"), `${md} missing specs:verify reference`);
    }

    console.log("[test:specs:mind_unset] status=OK");
}

try {
    main();
} catch (err) {
    console.error(`[test:specs:mind_unset] FAIL: ${err.message}`);
    process.exit(1);
}
