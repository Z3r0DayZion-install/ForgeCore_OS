import { _electron as electron, expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

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

  const firstRun = await launchWinshadow();
  const firstWindow = await firstRun.firstWindow();
  const commandInput = firstWindow.locator('input[placeholder="NEURALSHELL // SYSTEM_OVERRIDE_ENABLED"]');
  await expect(commandInput).toBeVisible();
  await commandInput.fill('vault audit queued');

  await expect
    .poll(() => {
      if (!fs.existsSync(stateFile)) {
        return undefined;
      }
      const raw = fs.readFileSync(stateFile, 'utf-8');
      return JSON.parse(raw)?.settings?.desktop?.commandDraft;
    })
    .toBe('vault audit queued');

  await firstRun.close();

  const secondRun = await launchWinshadow();
  const secondWindow = await secondRun.firstWindow();
  const rehydratedInput = secondWindow.locator('input[placeholder="NEURALSHELL // SYSTEM_OVERRIDE_ENABLED"]');
  await expect(rehydratedInput).toHaveValue('vault audit queued');
  await secondRun.close();

  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
});
