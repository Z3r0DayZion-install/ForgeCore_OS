"use strict";

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function typeName(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function validatePrimitive(spec, value, path, errors) {
    const expected = String(spec.type || "");
    if (!expected) return;

    if (expected === "string") {
        if (typeof value !== "string") {
            errors.push(`${path}:expected_string`);
            return;
        }
        if (Number.isFinite(spec.minLength) && value.length < spec.minLength) {
            errors.push(`${path}:min_length_${spec.minLength}`);
        }
        if (Number.isFinite(spec.maxLength) && value.length > spec.maxLength) {
            errors.push(`${path}:max_length_${spec.maxLength}`);
        }
        if (spec.pattern && !(new RegExp(spec.pattern).test(value))) {
            errors.push(`${path}:pattern_mismatch`);
        }
        if (spec.format === "base64" && !BASE64_RE.test(value)) {
            errors.push(`${path}:invalid_base64`);
        }
        if (Array.isArray(spec.enum) && !spec.enum.includes(value)) {
            errors.push(`${path}:enum_mismatch`);
        }
        return;
    }

    if (expected === "number") {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            errors.push(`${path}:expected_number`);
            return;
        }
        if (Number.isFinite(spec.min) && value < spec.min) errors.push(`${path}:min_${spec.min}`);
        if (Number.isFinite(spec.max) && value > spec.max) errors.push(`${path}:max_${spec.max}`);
        return;
    }

    if (expected === "boolean") {
        if (typeof value !== "boolean") errors.push(`${path}:expected_boolean`);
        return;
    }
}

function validateSchema(spec, value, path, errors) {
    if (!spec || typeof spec !== "object") return;

    if (value === null || value === undefined) {
        if (!spec.optional && !spec.nullable) {
            errors.push(`${path}:missing`);
        }
        return;
    }

    if (spec.type === "object") {
        if (!isObject(value)) {
            errors.push(`${path}:expected_object`);
            return;
        }
        const required = Array.isArray(spec.required) ? spec.required : [];
        for (const key of required) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                errors.push(`${path}.${key}:missing_required`);
            }
        }
        const props = isObject(spec.properties) ? spec.properties : {};
        for (const [key, rule] of Object.entries(props)) {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                if (rule && rule.optional) continue;
                continue;
            }
            validateSchema(rule, value[key], `${path}.${key}`, errors);
        }
        if (spec.additionalProperties === false) {
            for (const key of Object.keys(value)) {
                if (!Object.prototype.hasOwnProperty.call(props, key)) {
                    errors.push(`${path}.${key}:unexpected_property`);
                }
            }
        }
        return;
    }

    if (spec.type === "array") {
        if (!Array.isArray(value)) {
            errors.push(`${path}:expected_array`);
            return;
        }
        if (Number.isFinite(spec.minItems) && value.length < spec.minItems) {
            errors.push(`${path}:min_items_${spec.minItems}`);
        }
        if (Number.isFinite(spec.maxItems) && value.length > spec.maxItems) {
            errors.push(`${path}:max_items_${spec.maxItems}`);
        }
        if (spec.items) {
            for (let i = 0; i < value.length; i += 1) {
                validateSchema(spec.items, value[i], `${path}[${i}]`, errors);
            }
        }
        return;
    }

    validatePrimitive(spec, value, path, errors);
}

const REQUEST_SCHEMAS = {
    "POST /api/handshake": {
        type: "object",
        required: ["target", "nonce"],
        properties: {
            target: { type: "string", minLength: 1, maxLength: 256 },
            nonce: { type: "string", minLength: 1, maxLength: 128 },
            zkpProof: { type: "object", optional: true }
        },
        additionalProperties: false
    },
    "POST /api/system/unlock": {
        type: "object",
        required: ["passphrase"],
        properties: {
            passphrase: { type: "string", minLength: 1, maxLength: 1024 }
        },
        additionalProperties: false
    },
    "POST /api/system/logout": {
        type: "object",
        optional: true,
        properties: {},
        additionalProperties: false
    },
    "POST /api/system/passphrase/bootstrap": {
        type: "object",
        required: ["passphrase"],
        properties: {
            passphrase: { type: "string", minLength: 1, maxLength: 1024 },
            confirm: { type: "string", minLength: 1, maxLength: 1024, optional: true }
        },
        additionalProperties: false
    },
    "POST /api/system/passphrase/recover/reset": {
        type: "object",
        required: ["passphrase", "confirmPhrase"],
        properties: {
            passphrase: { type: "string", minLength: 1, maxLength: 1024 },
            confirm: { type: "string", minLength: 1, maxLength: 1024, optional: true },
            confirmPhrase: {
                type: "string",
                minLength: 1,
                maxLength: 128,
                enum: ["RESET MASTER PASSPHRASE"]
            }
        },
        additionalProperties: false
    },
    "POST /api/system/doctor/repair": {
        type: "object",
        properties: {
            mode: { type: "string", optional: true, enum: ["safe", "full"] }
        },
        additionalProperties: false
    },
    "POST /api/swarm/dispatch": {
        type: "object",
        required: ["target", "type"],
        properties: {
            target: { type: "string", minLength: 1, maxLength: 128 },
            type: { type: "string", minLength: 1, maxLength: 128 },
            data: { type: "object", optional: true }
        }
    },
    "POST /api/vipn/arm": {
        type: "object",
        optional: true,
        properties: {},
        additionalProperties: false
    },
    "POST /api/vipn/connect": {
        type: "object",
        optional: true,
        properties: {},
        additionalProperties: false
    },
    "POST /api/vipn/disconnect": {
        type: "object",
        optional: true,
        properties: {},
        additionalProperties: false
    },
    "POST /api/vipn/restore": {
        type: "object",
        optional: true,
        properties: {},
        additionalProperties: false
    },
    "POST /api/zerotrace/purge": {
        type: "object",
        required: ["paths"],
        properties: {
            paths: {
                type: "array",
                minItems: 1,
                maxItems: 1024,
                items: { type: "string", minLength: 1, maxLength: 4096 }
            }
        },
        additionalProperties: false
    },
    "POST /api/engines/launch": {
        type: "object",
        properties: {
            engine: { type: "string", minLength: 1, maxLength: 128, optional: true, pattern: "^[A-Za-z0-9_\\-\\.]+$" },
            id: { type: "string", minLength: 1, maxLength: 128, optional: true, pattern: "^[A-Za-z0-9_\\-\\.]+$" },
            payload: { type: "object", optional: true },
            offload: { type: "boolean", optional: true },
            target: { type: "string", minLength: 1, maxLength: 128, optional: true, pattern: "^[A-Za-z0-9_\\-]+$" }
        }
    },
    "POST /api/xxxplorer/history": {
        type: "object",
        required: ["vault"],
        properties: {
            vault: { type: "string", minLength: 1, maxLength: 128 }
        },
        additionalProperties: false
    },
    "POST /api/xxxplorer/resurrect": {
        type: "object",
        required: ["vault", "cid"],
        properties: {
            vault: { type: "string", minLength: 1, maxLength: 128 },
            cid: { type: "string", minLength: 3, maxLength: 2048 }
        },
        additionalProperties: false
    },
    "POST /api/neuralpass/store": {
        type: "object",
        required: ["id", "secret"],
        properties: {
            id: { type: "string", minLength: 1, maxLength: 256 },
            secret: { type: "string", minLength: 1, maxLength: 8192 }
        },
        additionalProperties: false
    },
    "POST /api/neuralpass/retrieve": {
        type: "object",
        required: ["id"],
        properties: {
            id: { type: "string", minLength: 1, maxLength: 256 }
        },
        additionalProperties: false
    },
    "POST /api/neuralpass/delete": {
        type: "object",
        required: ["id"],
        properties: {
            id: { type: "string", minLength: 1, maxLength: 256 }
        },
        additionalProperties: false
    },
    "POST /api/system/diagnostics/export": {
        type: "object",
        properties: {
            note: { type: "string", optional: true, maxLength: 2048 }
        },
        additionalProperties: false
    },
    "POST /api/system/action-provenance": {
        type: "object",
        required: ["actionId", "phase"],
        properties: {
            actionId: { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_\\-\\.]+$" },
            phase: { type: "string", minLength: 1, maxLength: 32, enum: ["dispatch", "ok", "blocked", "error", "probe"] },
            route: { type: "string", optional: true, maxLength: 2048 },
            reason: { type: "string", optional: true, maxLength: 512 },
            activeTab: { type: "string", optional: true, maxLength: 128 },
            durationMs: { type: "number", optional: true, min: 0, max: 600000 },
            source: { type: "string", optional: true, maxLength: 64 }
        },
        additionalProperties: false
    },
    "POST /api/system/tamper": {
        type: "object",
        properties: {
            type: { type: "string", optional: true, maxLength: 64 },
            source: { type: "string", optional: true, maxLength: 64 }
        },
        additionalProperties: false
    },
    "POST /api/system/execute": {
        type: "object",
        properties: {
            command: { type: "string", optional: true, maxLength: 256 },
            args: { type: "array", optional: true, maxItems: 64, items: { type: "string", maxLength: 2048 } },
            commandString: { type: "string", optional: true, maxLength: 8192 }
        }
    },
    "POST /api/tear/seal": {
        type: "object",
        required: ["vault"],
        properties: {
            vault: { type: "string", minLength: 1, maxLength: 128 }
        },
        additionalProperties: false
    },
    "POST /api/tear/verify": {
        type: "object",
        required: ["container"],
        properties: {
            container: { type: "object" }
        },
        additionalProperties: false
    },
    "POST /api/forge/save": {
        type: "object",
        required: ["path", "content"],
        properties: {
            path: { type: "string", minLength: 1, maxLength: 4096 },
            content: { type: "string", minLength: 0, maxLength: 12_000_000 }
        },
        additionalProperties: false
    },
    "POST /api/forge/execute": {
        type: "object",
        required: ["path"],
        properties: {
            path: { type: "string", minLength: 1, maxLength: 4096 }
        },
        additionalProperties: false
    },
    "POST /api/forge/git/init": {
        type: "object",
        required: ["repo"],
        properties: {
            repo: { type: "string", minLength: 1, maxLength: 256 }
        },
        additionalProperties: false
    },
    "POST /api/forge/git/commit": {
        type: "object",
        required: ["repo", "message"],
        properties: {
            repo: { type: "string", minLength: 1, maxLength: 256 },
            message: { type: "string", minLength: 1, maxLength: 2048 },
            author: { type: "string", optional: true, maxLength: 256 }
        },
        additionalProperties: false
    },
    "POST /api/system/settings": {
        type: "object",
        properties: {
            theme: { type: "string", optional: true, maxLength: 64 },
            matrixOpacity: { type: "number", optional: true, min: 0, max: 1 },
            shadowMask: { type: "boolean", optional: true }
        },
        additionalProperties: false
    },
    "POST /api/quantum/gen-key": {
        type: "object",
        properties: {
            type: { type: "string", optional: true, maxLength: 64 }
        },
        additionalProperties: false
    },
    "POST /api/quantum/encrypt": {
        type: "object",
        required: ["message", "publicKey"],
        properties: {
            message: { type: "string", minLength: 1, maxLength: 1024 * 1024 },
            publicKey: { type: "string", minLength: 1, maxLength: 64 * 1024 }
        },
        additionalProperties: false
    },
    "POST /api/quantum/decrypt": {
        type: "object",
        required: ["ciphertext", "privateKey"],
        properties: {
            ciphertext: { type: "string", minLength: 1, maxLength: 1024 * 1024 },
            privateKey: { type: "string", minLength: 1, maxLength: 64 * 1024 }
        },
        additionalProperties: false
    },
    "POST /api/quantum/sign": {
        type: "object",
        required: ["message", "privateKey"],
        properties: {
            message: { type: "string", minLength: 1, maxLength: 1024 * 1024 },
            privateKey: { type: "string", minLength: 1, maxLength: 64 * 1024 }
        },
        additionalProperties: false
    },
    "POST /api/quantum/verify": {
        type: "object",
        required: ["message", "signature", "publicKey"],
        properties: {
            message: { type: "string", minLength: 1, maxLength: 1024 * 1024 },
            signature: { type: "string", minLength: 1, maxLength: 64 * 1024 },
            publicKey: { type: "string", minLength: 1, maxLength: 64 * 1024 }
        },
        additionalProperties: false
    },
    "POST /api/vault/delete": {
        type: "object",
        required: ["vault", "file"],
        properties: {
            vault: { type: "string", minLength: 1, maxLength: 128 },
            file: { type: "string", minLength: 1, maxLength: 1024 }
        },
        additionalProperties: false
    },
    "POST /api/vault/new": {
        type: "object",
        required: ["vault", "name"],
        properties: {
            vault: { type: "string", minLength: 1, maxLength: 128 },
            name: { type: "string", minLength: 1, maxLength: 1024 },
            content: { type: "string", optional: true, maxLength: 4 * 1024 * 1024 }
        },
        additionalProperties: false
    },
    "POST /api/vault/upload": {
        type: "object",
        required: ["vault", "name", "b64"],
        properties: {
            vault: { type: "string", minLength: 1, maxLength: 128 },
            name: { type: "string", minLength: 1, maxLength: 1024 },
            b64: { type: "string", minLength: 1, maxLength: 70 * 1024 * 1024, format: "base64" }
        },
        additionalProperties: false
    },
    "POST /api/runtime/ak/scenario": {
        type: "object",
        properties: {
            outDir: { type: "string", optional: true, minLength: 1, maxLength: 4096 },
            proofOut: { type: "string", optional: true, minLength: 1, maxLength: 4096 }
        },
        additionalProperties: false
    },
    "POST /api/runtime/ak/proof": {
        type: "object",
        properties: {
            outDir: { type: "string", optional: true, minLength: 1, maxLength: 4096 },
            out: { type: "string", optional: true, minLength: 1, maxLength: 4096 },
            proofOut: { type: "string", optional: true, minLength: 1, maxLength: 4096 }
        },
        additionalProperties: false
    },
    "POST /api/neural-empire/agents/run": {
        type: "object",
        required: ["agentId"],
        properties: {
            agentId: { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_\\-\\.]+$" },
            payload: { type: "object", optional: true }
        },
        additionalProperties: false
    },
    "POST /api/neural-empire/hypersnatch/decode": {
        type: "object",
        required: ["url"],
        properties: {
            url: { type: "string", minLength: 1, maxLength: 8192 },
            baseUrl: { type: "string", optional: true, minLength: 1, maxLength: 8192 }
        },
        additionalProperties: false
    },
    "POST /api/neural-empire/neuraltube/analyze": {
        type: "object",
        properties: {
            video: { type: "object", optional: true },
            transcript: { type: "string", optional: true, maxLength: 2 * 1024 * 1024 },
            text: { type: "string", optional: true, maxLength: 2 * 1024 * 1024 },
            preferences: { type: "object", optional: true },
            maxSummarySentences: { type: "number", optional: true, min: 1, max: 12 }
        },
        additionalProperties: false
    },
    "POST /api/save": {
        type: "object",
        required: ["path", "content"],
        properties: {
            path: { type: "string", minLength: 1, maxLength: 4096 },
            content: { type: "string", maxLength: 12_000_000 }
        },
        additionalProperties: false
    }
};

function normalizeKey(method, pathname) {
    return `${String(method || "GET").toUpperCase()} ${String(pathname || "").trim()}`;
}

function validate(method, pathname, body) {
    const key = normalizeKey(method, pathname);
    const spec = REQUEST_SCHEMAS[key];
    if (!spec) {
        return { ok: true, key, skipped: true };
    }

    const candidate = body === undefined ? null : body;
    const errors = [];
    validateSchema(spec, candidate, "body", errors);
    return {
        ok: errors.length === 0,
        key,
        errors
    };
}

function hasSchema(method, pathname) {
    const key = normalizeKey(method, pathname);
    return Object.prototype.hasOwnProperty.call(REQUEST_SCHEMAS, key);
}

module.exports = {
    REQUEST_SCHEMAS,
    validate,
    hasSchema,
    normalizeKey,
    _internal: {
        validateSchema,
        typeName
    }
};
