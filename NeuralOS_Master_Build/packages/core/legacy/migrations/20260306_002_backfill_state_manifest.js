"use strict";

module.exports = {
    id: "20260306_002_backfill_state_manifest",
    description: "Backfill persistent state manifest for operator diagnostics.",
    up({ stateRoot, fs, path }) {
        const vaultRoot = path.join(stateRoot, "vaults");
        const manifestDir = path.join(stateRoot, "logs");
        const manifestPath = path.join(manifestDir, "state_manifest.json");

        if (!fs.existsSync(manifestDir)) {
            fs.mkdirSync(manifestDir, { recursive: true });
        }

        let vaults = [];
        if (fs.existsSync(vaultRoot)) {
            vaults = fs.readdirSync(vaultRoot, { withFileTypes: true })
                .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
                .map((entry) => entry.name)
                .sort();
        }

        const manifest = {
            generatedAt: new Date().toISOString(),
            stateRoot,
            vaults,
            vaultCount: vaults.length
        };

        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
};
