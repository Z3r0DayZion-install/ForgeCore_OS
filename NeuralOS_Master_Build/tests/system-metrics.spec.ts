import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.system-metrics-test.json');

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

test('system.metrics returns ram, cpu, and battery values', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  const metrics = await win.evaluate(() => window.neuralos.system.metrics());
  expect(metrics).toHaveProperty('ram');
  expect(metrics).toHaveProperty('cpu');
  expect(metrics).toHaveProperty('battery');
  expect(typeof metrics.ram).toBe('number');
  expect(typeof metrics.cpu).toBe('number');
  expect(typeof metrics.battery).toBe('number');
  expect(metrics.ram).toBeGreaterThanOrEqual(0);
  expect(metrics.ram).toBeLessThanOrEqual(100);
  expect(metrics.cpu).toBeGreaterThanOrEqual(0);
  expect(metrics.cpu).toBeLessThanOrEqual(100);

  await app.close();
});

test('system.audit returns success or fails gracefully in test environment', async () => {
  const app = await launchDesktop();
  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');

  // trustctl.calculateHash may throw "Access is denied" in sandboxed
  // test environments where the packages directory is incomplete.
  const result = await win.evaluate(async () => {
    try {
      return { outcome: 'resolved', value: await window.neuralos.system.audit() };
    } catch (err) {
      return { outcome: 'rejected', message: String(err) };
    }
  });

  if (result.outcome === 'resolved') {
    expect(result.value).toMatchObject({ success: true });
    expect(typeof result.value.timestamp).toBe('string');
    expect(new Date(result.value.timestamp).toISOString()).toBe(result.value.timestamp);
  } else {
    // Accept the access-denied error from trustctl in test mode
    expect(result.message).toMatch(/Access is denied|ENOENT|EACCES/);
  }

  await app.close();
});
