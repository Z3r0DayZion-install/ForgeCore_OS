"use strict";

const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
    const out = {
        channel: "stable"
    };
    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] || "");
        if (token === "--channel") out.channel = String(argv[++i] || "stable");
    }
    return out;
}

function runStep(step, env) {
    return new Promise((resolve, reject) => {
        const isWin = process.platform === "win32";
        const cmd = isWin ? "cmd.exe" : step.cmd;
        const args = isWin ? ["/c", step.cmd, ...step.args] : step.args;
        console.log(`\n[release-harden] >>> ${step.label}`);
        const child = spawn(cmd, args, {
            cwd: ROOT,
            env,
            shell: false,
            stdio: "inherit"
        });
        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`${step.label} failed with exit code ${code}`));
        });
    });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const channel = String(opts.channel || "stable").trim().toLowerCase() || "stable";
    const env = {
        ...process.env,
        FORGE_RELEASE_CHANNEL: channel
    };

    const steps = [
        { label: "Specs Generate", cmd: "npm", args: ["run", "specs:generate"] },
        { label: "Obey Materialize", cmd: "npm", args: ["run", "specs:materialize:obey"] },
        { label: "Obey Unit Test", cmd: "npm", args: ["run", "test:specs:obey"] },
        { label: "MindUnset Materialize", cmd: "npm", args: ["run", "specs:materialize:mind_unset"] },
        { label: "MindUnset Unit Test", cmd: "npm", args: ["run", "test:specs:mind_unset"] },
        { label: "Specs Attestation", cmd: "npm", args: ["run", "specs:attest"] },
        { label: "Publish Portable", cmd: "npm", args: ["run", "publish:portable"] },
        { label: "Verify Release", cmd: "npm", args: ["run", "verify:release"] },
        { label: "Deploy Local Feed", cmd: "npm", args: ["run", "deploy:publish:local"] },
        { label: "Feed Verify Local", cmd: "npm", args: ["run", "feed:verify:local"] },
        {
            label: "Release/Feed Alignment Gate",
            cmd: "node",
            args: ["scripts/check_release_feed_alignment.cjs", "--channel", channel, "--require-deployed"]
        },
        { label: "Ship Ready Bundle", cmd: "npm", args: ["run", "ship:ready"] }
    ];

    console.log(`[release-harden] channel=${channel}`);
    for (const step of steps) {
        await runStep(step, env);
    }
    console.log("\n[release-harden] STATUS=OK");
    console.log("[release-harden] OUTPUT=release/ship_ready");
}

main().catch((err) => {
    console.error(`\n[release-harden] STATUS=FAIL: ${err.message}`);
    process.exit(1);
});
