import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.memory-engine-test.json');

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

test.beforeEach(() => {
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
});

test.afterEach(() => {
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
});

test('state.get returns the full system state', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const state = await win.evaluate(() => window.neuralos.state.get());
  expect(state).toHaveProperty('activeShell');
  expect(state).toHaveProperty('vaultStatus');
  expect(state).toHaveProperty('settings');
  expect(state.settings).toHaveProperty('desktop');
  expect(state.settings).toHaveProperty('xxxplorer');

  await app.close();
});

test('state.set deep-merges into existing state', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // Set a nested value
  await win.evaluate(() => {
    window.neuralos.state.set({
      settings: { desktop: { windows: { vpn: true } } }
    });
  });

  // Verify the deep merge preserved other defaults
  await expect
    .poll(() => {
      if (!fs.existsSync(stateFile)) return undefined;
      const raw = fs.readFileSync(stateFile, 'utf-8');
      const parsed = JSON.parse(raw);
      return parsed?.settings?.desktop?.windows;
    }, { timeout: 10000 })
    .toEqual({ explorer: true, vpn: true, panel: false });

  await app.close();
});

test('state.onUpdate fires when state changes', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // Set up a listener that captures the first update
  const received = await win.evaluate(() => {
    return new Promise((resolve) => {
      const cleanup = window.neuralos.state.onUpdate((data) => {
        cleanup();
        resolve(data);
      });
      // Trigger a state change
      window.neuralos.state.set({ vaultStatus: 'TEST_UPDATE' });
    });
  });

  expect(received).toBeDefined();

  await app.close();
});

test('shell.onMemoryUpdate fires after shell commands', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // Set up listener before executing command
  const memoryEntry = await win.evaluate(() => {
    return new Promise((resolve) => {
      const cleanup = window.neuralos.shell.onMemoryUpdate((entry) => {
        cleanup();
        resolve(entry);
      });
      // Execute a command that commits memory
      window.neuralos.shell.execute('verify all');
    });
  });

  expect(memoryEntry).toHaveProperty('type');
  expect(memoryEntry).toHaveProperty('timestamp');
  expect(memoryEntry).toHaveProperty('content');

  await app.close();
});

test('state persists across launches with deep-merged values', async () => {
  const app1 = await launchDesktop();
  const win1 = await app1.firstWindow();
  await win1.waitForLoadState('domcontentloaded');

  await win1.evaluate(() => {
    window.neuralos.state.set({
      settings: {
        xxxplorer: { theme: 'light', leftRootPath: '/mnt/data' }
      }
    });
  });

  await expect
    .poll(() => {
      if (!fs.existsSync(stateFile)) return undefined;
      const raw = fs.readFileSync(stateFile, 'utf-8');
      return JSON.parse(raw)?.settings?.xxxplorer?.theme;
    }, { timeout: 10000 })
    .toBe('light');

  await app1.close();

  // Second launch should see the persisted state
  const app2 = await launchDesktop();
  const win2 = await app2.firstWindow();
  await win2.waitForLoadState('domcontentloaded');

  const state = await win2.evaluate(() => window.neuralos.state.get());
  expect(state.settings.xxxplorer.theme).toBe('light');
  expect(state.settings.xxxplorer.leftRootPath).toBe('/mnt/data');
  // Original defaults should be preserved
  expect(state.settings.xxxplorer.rightRootPath).toBe('./packages');

  await app2.close();
});
