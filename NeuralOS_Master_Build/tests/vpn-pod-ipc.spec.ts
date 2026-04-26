import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.vpn-pod-test.json');

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

test('vpn.start returns a success flag', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.vpn.start({ region: 'us-east-1' }));
  expect(result).toHaveProperty('success');
  expect(typeof result.success).toBe('boolean');

  await app.close();
});

test('vpn.stop returns a success flag', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.vpn.stop());
  expect(result).toHaveProperty('success');
  expect(typeof result.success).toBe('boolean');

  await app.close();
});

test('vpn.status returns a defined value', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const status = await win.evaluate(() => window.neuralos.vpn.status());
  expect(status).toBeDefined();
  // vipn module may return a string or object depending on its state
  expect(['string', 'object']).toContain(typeof status);

  await app.close();
});

test('pod.start returns a success flag', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.pod.start());
  expect(result).toHaveProperty('success');
  expect(typeof result.success).toBe('boolean');

  await app.close();
});

test('pod.stop returns a success flag', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const result = await win.evaluate(() => window.neuralos.pod.stop());
  expect(result).toHaveProperty('success');
  expect(typeof result.success).toBe('boolean');

  await app.close();
});

test('pod.status returns a defined value', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const status = await win.evaluate(() => window.neuralos.pod.status());
  expect(status).toBeDefined();
  // neuralpod module may return a string or object depending on its state
  expect(['string', 'object']).toContain(typeof status);

  await app.close();
});
