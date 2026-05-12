import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { readJsonFile } from './helpers/readJsonFile';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.xxxplorer-prefs-test.json');

function launchXxxplorer() {
    return electron.launch({
        args: [path.join(projectRoot, 'main.desktop.js')],
        env: {
            ...process.env,
            NODE_ENV: 'test',
            SHELL_MODE: 'xxxplorer',
            NEURALOS_STATE_FILE: stateFile
        }
    });
}

test('XXXplorer persists theme and sector roots', async () => {
    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }

    const firstRun = await launchXxxplorer();
    const firstWindow = await firstRun.firstWindow();
    await firstWindow.waitForSelector('text=XXXPLORER™');

    await firstWindow.selectOption('select[aria-label="left root path"]', './memory');
    await firstWindow.selectOption('select[aria-label="right root path"]', './proof_bundle');
    await firstWindow.click('button[aria-label="toggle theme"]');

    await expect
        .poll(() => {
            const prefs = readJsonFile<{
                settings?: { xxxplorer?: { theme?: string; leftRootPath?: string; rightRootPath?: string } };
            }>(stateFile)?.settings?.xxxplorer;
            return `${prefs?.theme}|${prefs?.leftRootPath}|${prefs?.rightRootPath}`;
        })
        .toBe('light|./memory|./proof_bundle');

    await firstRun.close();

    const secondRun = await launchXxxplorer();
    const secondWindow = await secondRun.firstWindow();
    await secondWindow.waitForSelector('text=XXXPLORER™');

    await expect(secondWindow.locator('select[aria-label="left root path"]')).toHaveValue('./memory');
    await expect(secondWindow.locator('select[aria-label="right root path"]')).toHaveValue('./proof_bundle');
    await expect(secondWindow.locator('[data-theme="light"]')).toBeVisible();

    await secondRun.close();

    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }
});
