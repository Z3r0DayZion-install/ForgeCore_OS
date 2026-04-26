import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.shell-hotswap-test.json');

function launchDesktop(shellMode = 'xxxplorer') {
  return electron.launch({
    args: [path.join(projectRoot, 'main.desktop.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SHELL_MODE: shellMode,
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

test('shell.getMode returns the active shell', async () => {
  const app = await launchDesktop('winshadow');
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const mode = await win.evaluate(() => window.neuralos.shell.getMode());
  expect(mode).toBe('winshadow');

  await app.close();
});

test('shell.execute returns acknowledgment for unknown commands', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.shell.execute('hello'));
  expect(result).toHaveProperty('response');
  expect(result.response).toContain('COMMAND_ACKNOWLEDGED');

  await app.close();
});

test('shell.execute recognises verify keyword', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.shell.execute('verify all sectors'));
  expect(result.response).toContain('VERIFYING_VAULT_LINEAGE');

  await app.close();
});

test('shell.execute recognises seal keyword and returns hardware seal', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.shell.execute('show seal'));
  expect(result.response).toContain('HARDWARE_SEAL:');

  await app.close();
});

test('switch-shell updates active shell in persisted state', async () => {
  const app = await launchDesktop('winshadow');
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  await win.evaluate(() => window.neuralos.shell.switch('neuralmac'));

  // Give the shell switch time to persist
  await expect
    .poll(() => {
      if (!fs.existsSync(stateFile)) return undefined;
      const raw = fs.readFileSync(stateFile, 'utf-8');
      return JSON.parse(raw)?.activeShell;
    }, { timeout: 10000 })
    .toBe('neuralmac');

  await app.close();
});
