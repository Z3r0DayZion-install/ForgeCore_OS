import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { readJsonFile } from './helpers/readJsonFile';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.persistence-test.json');

function launchDesktop() {
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

test('NodeChain persists desktop settings between app launches', async () => {
    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }

    const firstRun = await launchDesktop();
    const firstWindow = await firstRun.firstWindow();
    await firstWindow.waitForLoadState('domcontentloaded');

    await firstWindow.evaluate(() => {
        window.neuralos.state.set({
            settings: {
                desktop: {
                    windows: {
                        explorer: true,
                        vpn: true,
                        panel: true
                    },
                    commandDraft: 'persist-me'
                }
            }
        });
    });

    await expect
        .poll(() => {
            return readJsonFile<{ settings?: { desktop?: { commandDraft?: string } } }>(stateFile)?.settings?.desktop
                ?.commandDraft;
        })
        .toBe('persist-me');

    await firstRun.close();

    const secondRun = await launchDesktop();
    const secondWindow = await secondRun.firstWindow();
    await secondWindow.waitForLoadState('domcontentloaded');

    const persistedState = await secondWindow.evaluate(async () => {
        return window.neuralos.state.get();
    });

    expect(persistedState?.settings?.desktop?.windows).toEqual({
        explorer: true,
        vpn: true,
        panel: true
    });

    await secondRun.close();

    if (fs.existsSync(stateFile)) {
        fs.unlinkSync(stateFile);
    }
});
