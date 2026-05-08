const { _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function main() {
    if (process.platform !== 'win32') {
        console.log('Skipping packaged Windows smoke test on non-Windows host.');
        return;
    }

    const executablePath = path.resolve(__dirname, '..', 'dist', 'win-unpacked', 'NeuralOS.exe');
    if (!fs.existsSync(executablePath)) {
        throw new Error(`Packaged executable missing: ${executablePath}`);
    }

    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neuralos-packaged-smoke-'));
    const stateFile = path.join(scratchDir, 'NODECHAIN_STATE.json');
    const runtimeDir = path.join(scratchDir, 'runtime');

    let app;
    try {
        app = await electron.launch({
            executablePath,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                SHELL_MODE: 'winshadow',
                NEURALOS_RUNTIME_DIR: runtimeDir,
                NEURALOS_STATE_FILE: stateFile
            }
        });

        const window = await app.firstWindow({ timeout: 45000 });
        await window.waitForLoadState('domcontentloaded');

        const title = await window.title();
        const shellMode = await window.evaluate(() => window.neuralos.shell.getMode());
        if (shellMode !== 'winshadow') {
            throw new Error(`Unexpected packaged shell mode: ${shellMode}`);
        }

        const launchResult = await window.evaluate(() => window.neuralos.system.launch('calc.exe'));
        if (!launchResult || launchResult.success !== true || launchResult.dryRun !== true) {
            throw new Error(`Unexpected packaged native-launch result: ${JSON.stringify(launchResult)}`);
        }

        console.log(
            JSON.stringify({
                ok: true,
                executablePath,
                title,
                shellMode,
                launchResult
            })
        );
    } finally {
        if (app) {
            await app.close().catch(() => {});
        }
        fs.rmSync(scratchDir, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
