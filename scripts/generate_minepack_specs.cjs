"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LIMIT_DEFAULT = 10;
const DEFAULT_SOURCE_CANDIDATES = [
    path.join(ROOT, "repos", "minepacks", "NeuralEmpire_ChatArchive_MinePack"),
    path.join(process.env.USERPROFILE || "", "Downloads", "NeuralEmpire_ChatArchive_MinePack")
];

const ALIASES = new Map([
    ["tear", "teargrid"],
    ["mindunset", "mindunset"]
]);

function parseArgs(argv) {
    const opts = {
        source: "",
        limit: LIMIT_DEFAULT,
        check: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--source") {
            opts.source = argv[i + 1] || "";
            i += 1;
        } else if (arg === "--limit") {
            opts.limit = Number(argv[i + 1] || LIMIT_DEFAULT);
            i += 1;
        } else if (arg === "--check") {
            opts.check = true;
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!Number.isInteger(opts.limit) || opts.limit < 1) {
        throw new Error("--limit must be an integer >= 1");
    }
    return opts;
}

function resolveSourceDir(opts) {
    const candidates = [];
    if (opts.source) candidates.push(path.resolve(opts.source));
    if (process.env.FORGE_MINEPACK_DIR) candidates.push(path.resolve(process.env.FORGE_MINEPACK_DIR));
    for (const candidate of DEFAULT_SOURCE_CANDIDATES) {
        if (candidate) candidates.push(path.resolve(candidate));
    }

    for (const candidate of candidates) {
        const probe = path.join(candidate, "data", "project_presence.json");
        if (fs.existsSync(probe)) return candidate;
    }

    throw new Error(
        "MinePack not found. Use --source <path> or set FORGE_MINEPACK_DIR. " +
        `Checked: ${candidates.join(", ")}`
    );
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256Text(text) {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex").toUpperCase();
}

function sha256File(filePath) {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
}

function toAscii(value) {
    return String(value || "")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, "-")
        .replace(/×/g, "x")
        .replace(/\u00A0/g, " ")
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function normalizeKey(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function titleFromBase(baseName) {
    return String(baseName || "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(mdText, heading) {
    const re = new RegExp(`## ${escapeRegExp(heading)}\\r?\\n([\\s\\S]*?)(?:\\r?\\n## |$)`);
    const hit = mdText.match(re);
    if (!hit) return "";
    return hit[1].trim();
}

function parseBulletLines(sectionText, maxItems) {
    if (!sectionText) return [];
    const items = sectionText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => toAscii(line.replace(/^- /, "").trim()));
    if (typeof maxItems === "number" && maxItems > 0) {
        return items.slice(0, maxItems);
    }
    return items;
}

function parseRoadmapLines(sectionText) {
    if (!sectionText) return [];
    const items = sectionText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => toAscii(line.replace(/^\d+\)\s*/, "").trim()))
        .filter(Boolean);
    return items;
}

function parsePresenceFromDossier(mdText) {
    const hit = mdText.match(/Conversations containing term:\s*\*\*(\d+)\*\*/i);
    return hit ? Number(hit[1]) : 0;
}

function readDossierMap(sourceDir) {
    const projectsDir = path.join(sourceDir, "projects");
    if (!fs.existsSync(projectsDir)) {
        throw new Error(`Missing projects dir: ${projectsDir}`);
    }

    const files = fs.readdirSync(projectsDir)
        .filter((name) => name.toLowerCase().endsWith(".md"))
        .sort((a, b) => a.localeCompare(b));

    const byKey = new Map();
    for (const fileName of files) {
        const baseName = path.basename(fileName, ".md");
        const key = normalizeKey(baseName);
        byKey.set(key, {
            key,
            baseName,
            displayName: titleFromBase(baseName),
            fileName,
            absPath: path.join(projectsDir, fileName),
            relPath: path.posix.join("projects", fileName)
        });
    }
    return byKey;
}

function resolveProjectKey(name, dossierMap) {
    const rawKey = normalizeKey(name);
    const aliased = ALIASES.get(rawKey) || rawKey;
    if (dossierMap.has(aliased)) return aliased;

    if (rawKey === "tear" && dossierMap.has("teargrid")) return "teargrid";
    return "";
}

function sortPresenceRows(rows) {
    const cleaned = rows
        .filter((row) => Array.isArray(row) && row.length >= 2)
        .map((row) => [String(row[0]), Number(row[1]) || 0]);

    cleaned.sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });
    return cleaned;
}

function selectTopProjects(sourceDir, limit) {
    const presencePath = path.join(sourceDir, "data", "project_presence.json");
    const brandsPath = path.join(sourceDir, "data", "top_brands.json");
    const presenceRows = sortPresenceRows(readJson(presencePath));
    const brandRows = sortPresenceRows(readJson(brandsPath));
    const dossierMap = readDossierMap(sourceDir);
    const selected = [];
    const usedKeys = new Set();

    function takeRows(rows, sourceType) {
        for (const row of rows) {
            if (selected.length >= limit) break;
            const sourceName = row[0];
            const mentions = row[1];
            const projectKey = resolveProjectKey(sourceName, dossierMap);
            if (!projectKey || usedKeys.has(projectKey)) continue;
            usedKeys.add(projectKey);
            selected.push({
                sourceType,
                sourceName: toAscii(sourceName),
                mentions,
                dossier: dossierMap.get(projectKey)
            });
        }
    }

    takeRows(presenceRows, "project_presence");
    if (selected.length < limit) {
        takeRows(brandRows, "top_brands");
    }

    if (selected.length < limit) {
        throw new Error(`Could only resolve ${selected.length}/${limit} projects from MinePack`);
    }

    return selected
        .slice(0, limit)
        .sort((a, b) => {
            if (b.mentions !== a.mentions) return b.mentions - a.mentions;
            return a.dossier.displayName.localeCompare(b.dossier.displayName);
        });
}

function renderSpec(project) {
    const adjacent = project.adjacent.length
        ? project.adjacent.map((line) => `- ${line}`).join("\n")
        : "- No co-mention list found in dossier.";

    const roadmap = project.roadmap.length
        ? project.roadmap.map((line, idx) => `${idx + 1}. ${line}`).join("\n")
        : [
            "1. Freeze boundaries and API contracts.",
            "2. Add deterministic hashing + serialization rules.",
            "3. Add security hooks, packaging rules, and verification."
        ].join("\n");

    return [
        `# ${project.displayName} SPEC`,
        "",
        "## Source Context",
        `- MinePack source: \`${project.minepackRelRoot}\``,
        `- Dossier: \`${project.dossierRelPath}\``,
        `- Selection signal: \`${project.sourceType}\` (${project.sourceName}: ${project.mentions})`,
        `- Dossier presence metric: ${project.dossierPresence}`,
        "",
        "## Mission",
        `Define a defensive-only, deterministic module specification for **${project.displayName}** within ForgeCore.`,
        "",
        "## Co-Mention Context",
        adjacent,
        "",
        "## Scope",
        roadmap,
        "",
        "## Non-Goals",
        "- No stealth/evasion or covert channels.",
        "- No offensive behavior or automation.",
        "- No non-deterministic output formats.",
        "",
        "## Determinism Rules",
        "- UTF-8 text, LF line endings, stable field ordering.",
        "- SHA-256 for every release-relevant artifact.",
        "- Atomic write pattern (`.tmp` + rename) for generated files.",
        "",
        "## Dependency Policy",
        "See `specs/DEPENDENCY_POLICY.md` and `specs/dependency-pins.json`.",
        "",
        "## Acceptance Criteria",
        "1. `TASKS.md` contains only atomic, testable tasks.",
        "2. Output scope is limited to `specs/<project>/outputs/`.",
        "3. `npm run specs:verify` succeeds and emits dist manifests.",
        ""
    ].join("\n");
}

function renderTasks(project) {
    const outputsRoot = `specs/${project.slug}/outputs`;
    return [
        `# ${project.displayName} TASKS`,
        "",
        `All deliverables for this project stay under \`${outputsRoot}/\`.`,
        "",
        "## Atomic tasks",
        "",
        "| ID | Task | Output | Test |",
        "| --- | --- | --- | --- |",
        `| ${project.slug}-001 | Define canonical API contract schema. | \`${outputsRoot}/api_contract.schema.json\` | JSON parses and keys stay stable. |`,
        `| ${project.slug}-002 | Create deterministic sample payload. | \`${outputsRoot}/sample_payload.json\` | SHA-256 unchanged across reruns. |`,
        `| ${project.slug}-003 | Define intent allowlist policy format. | \`${outputsRoot}/intent_allowlist.json\` | Entries are explicit, no wildcards. |`,
        `| ${project.slug}-004 | Define audit event schema. | \`${outputsRoot}/audit_event.schema.json\` | Required fields validated in unit test. |`,
        `| ${project.slug}-005 | Define package descriptor for NeuroDrop/TEAR export. | \`${outputsRoot}/package_descriptor.json\` | Descriptor hash appears in spec manifest. |`,
        `| ${project.slug}-006 | Define HUD widget contract for health/proof display. | \`${outputsRoot}/hud_widget_contract.json\` | Contract versioning validates semver format. |`,
        `| ${project.slug}-007 | Create proof-bundle checklist. | \`${outputsRoot}/proof_bundle_checklist.md\` | Checklist references verify scripts. |`,
        `| ${project.slug}-008 | Add verification notes and expected command flow. | \`${outputsRoot}/verification_notes.md\` | Command list matches package scripts. |`,
        "",
        "## Verification gate",
        "- `npm run specs:verify`",
        ""
    ].join("\n");
}

function renderOutputsReadme(project) {
    return [
        `# ${project.displayName} outputs`,
        "",
        "Reserved deterministic output paths:",
        "- `api_contract.schema.json`",
        "- `sample_payload.json`",
        "- `intent_allowlist.json`",
        "- `audit_event.schema.json`",
        "- `package_descriptor.json`",
        "- `hud_widget_contract.json`",
        "- `proof_bundle_checklist.md`",
        "- `verification_notes.md`",
        "",
        "Rules:",
        "- UTF-8 + LF endings",
        "- Canonical JSON key ordering",
        "- Hashable/reproducible content only",
        ""
    ].join("\n");
}

function renderSpecsReadme(projects) {
    const lines = projects.map((p, idx) => `${idx + 1}. ${p.displayName} (${p.mentions})`);
    return [
        "# MinePack Specs Index",
        "",
        "This directory is generated from the NeuralEmpire ChatArchive MinePack.",
        "",
        "Top-10 selected projects:",
        ...lines,
        "",
        "Commands:",
        "- `npm run specs:generate`",
        "- `npm run specs:check`",
        "- `npm run specs:verify`",
        ""
    ].join("\n");
}

function collectSourceFileHashes(sourceDir) {
    const files = [];

    function walk(dirPath) {
        const names = fs.readdirSync(dirPath).sort((a, b) => a.localeCompare(b));
        for (const name of names) {
            const absPath = path.join(dirPath, name);
            const stat = fs.statSync(absPath);
            if (stat.isDirectory()) {
                walk(absPath);
            } else if (stat.isFile()) {
                const rel = path.relative(sourceDir, absPath).replace(/\\/g, "/");
                files.push({
                    path: rel,
                    bytes: stat.size,
                    sha256: sha256File(absPath)
                });
            }
        }
    }

    walk(sourceDir);
    files.sort((a, b) => a.path.localeCompare(b.path));

    const digestInput = files.map((f) => `${f.path}:${f.sha256}`).join("\n");
    const bundleSha256 = sha256Text(digestInput);
    return { files, bundleSha256 };
}

function collectDependencyPins() {
    const pkgPath = path.join(ROOT, "package.json");
    const lockPath = path.join(ROOT, "package-lock.json");
    const pkg = readJson(pkgPath);
    const lock = readJson(lockPath);
    const names = Object.keys({
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {})
    }).sort((a, b) => a.localeCompare(b));
    const pins = {};

    for (const dep of names) {
        let version = "";
        if (lock.packages && lock.packages[`node_modules/${dep}`]) {
            version = String(lock.packages[`node_modules/${dep}`].version || "");
        } else if (lock.dependencies && lock.dependencies[dep]) {
            version = String(lock.dependencies[dep].version || "");
        }
        if (!version) {
            throw new Error(`Missing lockfile version for dependency: ${dep}`);
        }
        pins[dep] = version;
    }

    return {
        schemaVersion: 1,
        lockfile: "package-lock.json",
        pins
    };
}

function renderDependencyPolicyMd(pinMap) {
    const rows = Object.keys(pinMap.pins)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => `- \`${name}\`: \`${pinMap.pins[name]}\``);
    return [
        "# Dependency Policy",
        "",
        "Policy version: `1`",
        "",
        "Rules:",
        "- Install using `npm ci` only (never floating installs for release).",
        "- `package-lock.json` is the source of truth for pinned versions.",
        "- Release checks must fail on lockfile drift.",
        "- New dependencies require lockfile update and pin verification.",
        "",
        "Pinned packages:",
        ...rows,
        ""
    ].join("\n");
}

function buildProjectData(selection, sourceDir) {
    const sourceRelRoot = path.relative(ROOT, sourceDir).replace(/\\/g, "/");
    return selection.map((item) => {
        const dossierText = fs.readFileSync(item.dossier.absPath, "utf8");
        const adjacent = parseBulletLines(extractSection(dossierText, "Closest adjacent modules (co-mention signal)"), 8);
        const roadmap = parseRoadmapLines(extractSection(dossierText, "Recommended next roadmap (agent-executable)"));
        const dossierPresence = parsePresenceFromDossier(dossierText);
        const displayName = item.dossier.displayName;
        const slug = slugify(displayName);
        return {
            displayName,
            slug,
            sourceType: item.sourceType,
            sourceName: item.sourceName,
            mentions: item.mentions,
            dossierPresence,
            adjacent,
            roadmap,
            minepackRelRoot: sourceRelRoot || ".",
            dossierRelPath: item.dossier.relPath
        };
    });
}

function planWrites(projects, sourceDir) {
    const writes = [];
    const specsRoot = path.join(ROOT, "specs");
    const sourceRelRoot = path.relative(ROOT, sourceDir).replace(/\\/g, "/") || ".";

    const index = projects.map((p) => ({
        name: p.displayName,
        slug: p.slug,
        mentions: p.mentions,
        sourceType: p.sourceType,
        sourceName: p.sourceName,
        dossier: p.dossierRelPath,
        spec: `specs/${p.slug}/SPEC.md`,
        tasks: `specs/${p.slug}/TASKS.md`,
        outputs: `specs/${p.slug}/outputs`
    }));

    index.sort((a, b) => {
        if (b.mentions !== a.mentions) return b.mentions - a.mentions;
        return a.slug.localeCompare(b.slug);
    });

    const sourceHashes = collectSourceFileHashes(sourceDir);
    const depPins = collectDependencyPins();

    writes.push({
        absPath: path.join(specsRoot, "README.md"),
        content: renderSpecsReadme(projects)
    });
    writes.push({
        absPath: path.join(specsRoot, "PROJECT_INDEX.json"),
        content: `${JSON.stringify(index, null, 2)}\n`
    });
    writes.push({
        absPath: path.join(specsRoot, "SOURCE_MANIFEST.json"),
        content: `${JSON.stringify({
            schemaVersion: 1,
            sourceRoot: sourceRelRoot,
            bundleSha256: sourceHashes.bundleSha256,
            files: sourceHashes.files
        }, null, 2)}\n`
    });
    writes.push({
        absPath: path.join(specsRoot, "dependency-pins.json"),
        content: `${JSON.stringify(depPins, null, 2)}\n`
    });
    writes.push({
        absPath: path.join(specsRoot, "DEPENDENCY_POLICY.md"),
        content: renderDependencyPolicyMd(depPins)
    });

    for (const project of projects) {
        const projectRoot = path.join(specsRoot, project.slug);
        writes.push({
            absPath: path.join(projectRoot, "SPEC.md"),
            content: renderSpec(project)
        });
        writes.push({
            absPath: path.join(projectRoot, "TASKS.md"),
            content: renderTasks(project)
        });
        writes.push({
            absPath: path.join(projectRoot, "outputs", "README.md"),
            content: renderOutputsReadme(project)
        });
    }

    return writes;
}

function applyWrites(writes, checkMode) {
    const drift = [];
    let wrote = 0;

    for (const file of writes) {
        const normalized = file.content.replace(/\r\n/g, "\n");
        const exists = fs.existsSync(file.absPath);
        const current = exists ? fs.readFileSync(file.absPath, "utf8").replace(/\r\n/g, "\n") : "";
        const same = exists && current === normalized;

        if (!same) {
            drift.push(path.relative(ROOT, file.absPath).replace(/\\/g, "/"));
            if (!checkMode) {
                ensureDir(path.dirname(file.absPath));
                fs.writeFileSync(file.absPath, normalized, "utf8");
                wrote += 1;
            }
        }
    }

    return { drift, wrote };
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const sourceDir = resolveSourceDir(opts);
    const selected = selectTopProjects(sourceDir, opts.limit);
    const projects = buildProjectData(selected, sourceDir);
    const writes = planWrites(projects, sourceDir);
    const result = applyWrites(writes, opts.check);

    if (opts.check) {
        if (result.drift.length) {
            console.error("[specs:check] Drift detected:");
            for (const file of result.drift) {
                console.error(` - ${file}`);
            }
            process.exit(1);
        }
        console.log(`[specs:check] OK (${writes.length} files match expected output)`);
        return;
    }

    console.log(`[specs:generate] source=${path.relative(ROOT, sourceDir).replace(/\\/g, "/") || "."}`);
    console.log(`[specs:generate] projects=${projects.length}`);
    console.log(`[specs:generate] files_written=${result.wrote}`);
}

try {
    main();
} catch (err) {
    console.error(`[specs:generate] FAIL: ${err.message}`);
    process.exit(1);
}
