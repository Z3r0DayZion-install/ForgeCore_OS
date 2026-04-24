import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const projectRoot = path.join(__dirname, '..');
const stateFile = path.join(projectRoot, 'memory', 'NODECHAIN_STATE.native-launch-test.json');

test('native launcher allowlists Windows app targets and blocks shell injection', async () => {
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }

  const electronApp = await electron.launch({
    args: [path.join(projectRoot, 'main.desktop.js')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SHELL_MODE: 'xxxplorer',
      NEURALOS_STATE_FILE: stateFile
    }
  });

  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  const allowed = await window.evaluate(async () => window.neuralos.system.launch('calc.exe'));
  expect(allowed).toMatchObject({
    success: true,
    dryRun: true,
    target: { command: 'calc.exe' }
  });

  const blocked = await window.evaluate(async () => window.neuralos.system.launch('calc.exe & whoami'));
  expect(blocked).toMatchObject({
    success: false,
    error: 'Unsupported native launch target.'
  });

  await electronApp.close();

  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
});
