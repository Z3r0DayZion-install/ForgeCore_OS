"use strict";

module.exports = {
    id: "20260306_001_seed_state_layout",
    description: "Seed persistent state layout directories.",
    up({ stateRoot, fs, path }) {
        const dirs = [
            stateRoot,
            path.join(stateRoot, "vaults"),
            path.join(stateRoot, "repos"),
            path.join(stateRoot, "logs"),
            path.join(stateRoot, "logs", "diagnostics")
        ];
        dirs.forEach((dir) => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }
};
