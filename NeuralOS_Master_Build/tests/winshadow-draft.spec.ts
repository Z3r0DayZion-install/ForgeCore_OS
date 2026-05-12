import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { readJsonFile } from './helpers/readJsonFile';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.winshadow-draft-test.json');

function launchWinshadow() {
    return electron.launch({
        args: [path.join(projectRoot, 'main.desktop.js')],
        env: {
            ...process.env,
            NODE_ENV: 'test',
            SHELL_MODE: 'winshadow',
            NEURALOS_STATE_FILE: stateFile
        }
    });
}

test('WinShadow persists command draft between launches', async () => {
    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }

    if (process.env.CI) {
        const firstRun = await launchWinshadow();
        const firstWindow = await firstRun.firstWindow();
        await firstWindow.waitForLoadState('load');

        await firstWindow.evaluate(() => {
            window.neuralos.state.set({
                settings: {
                    desktop: {
                        commandDraft: 'vault audit queued'
                    }
                }
            });
        });

        await expect
            .poll(() => {
                return readJsonFile<{ settings?: { desktop?: { commandDraft?: string } } }>(stateFile)?.settings
                    ?.desktop?.commandDraft;
            })
            .toBe('vault audit queued');

        await firstRun.close();

        const secondRun = await launchWinshadow();
        const secondWindow = await secondRun.firstWindow();
        await secondWindow.waitForLoadState('load');
        const rehydratedState = await secondWindow.evaluate(() => window.neuralos.state.get());
        expect(rehydratedState?.settings?.desktop?.commandDraft).toBe('vault audit queued');
        await secondRun.close();

        if (fs.existsSync(stateFile)) {
            fs.unlinkSync(stateFile);
        }
        return;
    }

    const firstRun = await launchWinshadow();
    const firstWindow = await firstRun.firstWindow();
    await firstWindow.waitForLoadState('load');
    const commandInput = firstWindow.locator('input[placeholder="NEURALSHELL // SYSTEM_OVERRIDE_ENABLED"]');
    await expect(commandInput).toBeVisible();
    await commandInput.fill('vault audit queued');

    await expect
        .poll(() => {
            return readJsonFile<{ settings?: { desktop?: { commandDraft?: string } } }>(stateFile)?.settings?.desktop
                ?.commandDraft;
        })
        .toBe('vault audit queued');

    await firstRun.close();

    const secondRun = await launchWinshadow();
    const secondWindow = await secondRun.firstWindow();
    await secondWindow.waitForLoadState('load');
    const rehydratedInput = secondWindow.locator('input[placeholder="NEURALSHELL // SYSTEM_OVERRIDE_ENABLED"]');
    await expect(rehydratedInput).toHaveValue('vault audit queued');
    await secondRun.close();

    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }
});
