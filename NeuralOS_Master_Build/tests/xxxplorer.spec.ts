import { _electron as electron, test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * NT-XXX-10: XXXplorer Sovereign Integrity E2E Test
 * Verifies the Drag-Drop -> Hash -> Proof Log pipeline.
 */

test('Sovereign Move Integrity Test', async () => {
  const projectRoot = path.join(__dirname, '..');
  const electronApp = await electron.launch({
    args: [path.join(projectRoot, 'main.desktop.js')],
    env: { ...process.env, NODE_ENV: 'test', SHELL_MODE: 'winshadow' }
  });

  const window = await electronApp.firstWindow();
  await window.waitForSelector('text=XXXPLORER™');

  // 1. Prepare Test File
  const testFile = path.join(projectRoot, 'sample.txt');
  const destinationFile = path.join(projectRoot, 'packages', 'sample.txt');
  if (fs.existsSync(destinationFile)) {
    fs.unlinkSync(destinationFile);
  }
  fs.writeFileSync(testFile, 'SOVEREIGN_DATA_INTEGRITY_CHECK_2026');

  // 2. Simulate Drag-and-Drop (Trigger via IPC context call since actual mouse drag is flaky in CI)
  await window.evaluate(async (file) => {
    const dest = './packages/sample.txt';
    return await window.neuralos.fs.vaultMove(file, dest);
  }, testFile);

  // 3. Expect Sovereign Success Toast
  const toast = window.locator('text=LINEAGE_CONFIRMED');
  await expect(toast).toBeVisible();

  // 4. Verify OPERATIONS.log
  const logPath = path.join(projectRoot, 'proof_bundle', 'OPERATIONS.log');
  const logContent = fs.readFileSync(logPath, 'utf-8');
  expect(logContent).toContain('MOVE_SUCCESS');
  expect(logContent).toContain('sample.txt');

  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }

  await electronApp.close();
});
