#!/usr/bin/env tsx
/**
 * LuxGrid Hardware Color Test - Phase 3B Hardened
 * 
 * Sends color commands to physical RGB hardware via OpenRGB.
 * Requires manual visual confirmation.
 * 
 * Usage:
 *   pnpm hardware:test-color
 *   pnpm hardware:test-color -- --host 192.168.1.100 --port 6742
 *   pnpm hardware:test-color -- --device-index 1
 *   pnpm hardware:test-color -- --confirm-visible yes
 *   pnpm hardware:test-color -- --non-interactive --confirm-visible yes
 */

import { OpenRgbClient } from '../packages/luxgrid-core/src/openrgb/OpenRgbClient.js';
import type { RgbColor, RgbDevice } from '../packages/luxgrid-core/src/types.js';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function runHardwareTest() {
  // Parse CLI args
  const args = process.argv.slice(2);
  const argMap: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : 'true';
      argMap[key] = value;
      if (value !== 'true') i++;
    }
  }

  const HOST = argMap['host'] || '127.0.0.1';
  const PORT = parseInt(argMap['port'] || '6742', 10);
  const PREFERRED_DEVICE_INDEX = argMap['device-index'] !== undefined 
    ? parseInt(argMap['device-index'], 10) 
    : undefined;
  const PREFERRED_DEVICE_NAME = argMap['device-name']; // partial match supported
  const CONFIRM_VISIBLE = argMap['confirm-visible']; // 'yes', 'no', or undefined for prompt
  const NON_INTERACTIVE = argMap['non-interactive'] === 'true' || CONFIRM_VISIBLE !== undefined;
  const NO_RESTORE = argMap['no-restore'] === 'true';

  // Timestamped proof folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const timestampedDir = path.resolve(`validation-artifacts/luxgrid-hardware-proof-${timestamp}`);
  const latestDir = path.resolve('validation-artifacts/hardware-proof-latest');

  fs.mkdirSync(timestampedDir, { recursive: true });
  fs.mkdirSync(latestDir, { recursive: true });

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   LuxGrid™ Phase 3B — Hardware Color Test              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`Host: ${HOST}`);
  console.log(`Port: ${PORT}`);
  console.log(`Proof folder: ${timestampedDir}\n`);

  const client = new OpenRgbClient({ host: HOST, port: PORT });

  // Handle errors gracefully
  client.on('error', () => {
    // Error handled in connect()
  });

  // Connect
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Connect to OpenRGB SDK Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let result;
  try {
    result = await client.connect();
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!result.success) {
    const errorCode = (result as any).errorCode || null;
    console.log(`   ❌ Connection failed: ${result.error}${errorCode ? ` (${errorCode})` : ''}`);

    if (errorCode === 'ENOBUFS') {
      console.log('\n⚠️  OpenRGB connection failed with ENOBUFS.');
      console.log('   This indicates a socket/resource issue. Investigate system socket exhaustion, firewall, VPN, or stale processes.\n');
    } else if (errorCode === 'ETIMEDOUT' || String(result.error).toLowerCase().includes('timeout')) {
      console.log('\n⚠️  Connection timed out. Verify OpenRGB SDK Server is running and reachable.\n');
    } else {
      console.log('\n⚠️  Start OpenRGB and enable SDK server first.\n');
    }

    const failResult: any = {
      timestamp: new Date().toISOString(),
      phase: '3B',
      result: 'FAIL',
      openrgb: { connected: false, host: HOST, port: PORT, error: result.error, errorCode },
      note: errorCode === 'ENOBUFS'
        ? 'OpenRGB connection failed with ENOBUFS. Investigate socket/resource issues.'
        : 'Start OpenRGB and enable SDK server (Settings → SDK Server → Start Server)'
    };

    fs.writeFileSync(path.join(timestampedDir, 'HARDWARE_TEST_RESULT.json'), JSON.stringify(failResult, null, 2));
    fs.writeFileSync(path.join(latestDir, 'HARDWARE_TEST_RESULT.json'), JSON.stringify(failResult, null, 2));

    console.log(`📁 Failure artifacts written to: ${timestampedDir}\n`);
    process.exit(1);
  }

  console.log(`   ✅ Connected to OpenRGB!`);
  console.log(`   Protocol Version: ${result.protocolVersion}\n`);

  // Get devices
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Select RGB Device');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const deviceCount = await client.getDeviceCount();
  console.log(`   Devices found: ${deviceCount}\n`);

  if (deviceCount === 0) {
    console.log('❌ No RGB devices found.');
    console.log('   Connect a keyboard, mouse, or RGB device to OpenRGB.');
    console.log('   Hardware color test is blocked until deviceCount > 0.\n');

    const failResult = {
      timestamp: new Date().toISOString(),
      phase: '3B',
      result: 'FAIL',
      openrgb: { connected: true, host: HOST, port: PORT, deviceCount: 0, classification: 'connected-zero-devices' },
      note: 'No RGB devices found in OpenRGB. Hardware color test is blocked until deviceCount > 0.'
    };

    fs.writeFileSync(path.join(timestampedDir, 'HARDWARE_TEST_RESULT.json'), JSON.stringify(failResult, null, 2));
    fs.writeFileSync(path.join(latestDir, 'HARDWARE_TEST_RESULT.json'), JSON.stringify(failResult, null, 2));

    client.disconnect();
    process.exit(1);
  }

  const deviceList = await client.getDeviceList();

  // Device selection logic
  // Priority: 1. --device-index, 2. --device-name, 3. first keyboard, 4. first device
  let selectedDevice: RgbDevice | null = null;
  let selectionReason = '';

  if (PREFERRED_DEVICE_INDEX !== undefined && PREFERRED_DEVICE_INDEX < deviceList.length) {
    selectedDevice = deviceList[PREFERRED_DEVICE_INDEX];
    selectionReason = 'manual-device-index';
  } else if (PREFERRED_DEVICE_NAME) {
    // Try exact match first, then partial (case-insensitive)
    const nameLower = PREFERRED_DEVICE_NAME.toLowerCase();
    const exactMatch = deviceList.find(d => d.name.toLowerCase() === nameLower);
    const partialMatch = deviceList.find(d => d.name.toLowerCase().includes(nameLower));
    selectedDevice = exactMatch || partialMatch || null;
    if (selectedDevice) {
      selectionReason = 'manual-device-name';
    }
  }

  // Fallback: prefer keyboard, then first device
  if (!selectedDevice) {
    const keyboard = deviceList.find(d => d.type === 'keyboard');
    if (keyboard) {
      selectedDevice = keyboard;
      selectionReason = 'keyboard-found';
    } else {
      selectedDevice = deviceList[0];
      selectionReason = 'first-rgb-device-fallback';
    }
  }

  if (!selectedDevice) {
    console.log('❌ Could not select a device.\n');
    process.exit(1);
  }

  console.log('   Device Selection Priority:');
  console.log(`   1. --device-index: ${PREFERRED_DEVICE_INDEX !== undefined ? PREFERRED_DEVICE_INDEX : 'not specified'}`);
  console.log(`   2. --device-name: ${PREFERRED_DEVICE_NAME || 'not specified'}`);
  console.log(`   3. Prefer keyboard: yes`);
  console.log(`   4. Fallback: first RGB device`);
  console.log('');
  console.log('   Selected Device:');
  console.log(`   - Index: ${selectedDevice.index}`);
  console.log(`   - Name: ${selectedDevice.name}`);
  console.log(`   - Type: ${selectedDevice.type}`);
  console.log(`   - LEDs: ${selectedDevice.ledCount}`);
  console.log(`   - Zones: ${selectedDevice.zoneCount}`);
  console.log(`   - Reason: ${selectionReason}\n`);

  // State preservation (attempt to read current state)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: Preserve Original State');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // OpenRGB SDK doesn't provide a standard "get LED colors" command
  // We'll note that readback is unavailable
  const originalState = {
    captured: false,
    reason: 'OpenRGB SDK readback not available',
    note: 'State preservation attempted but readback unavailable. Device will be dimmed after test.'
  };

  console.log('   ⚠️  Original state readback unavailable.');
  console.log('   Will dim device to neutral after test.\n');

  // Run color sequence
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: Run Color Test Sequence');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Watch your physical RGB device!\n');

  const colors: Array<{ name: string; color: RgbColor }> = [
    { name: 'CYAN', color: { r: 0, g: 255, b: 255 } },
    { name: 'RED', color: { r: 255, g: 0, b: 0 } },
    { name: 'GREEN', color: { r: 0, g: 255, b: 0 } },
    { name: 'BLUE', color: { r: 0, g: 0, b: 255 } },
  ];

  const testResults: Array<{
    color: string;
    rgb: RgbColor;
    sent: boolean;
    error?: string;
    timestamp: string;
  }> = [];

  for (const { name, color } of colors) {
    process.stdout.write(`   Sending ${name}... `);

    const cmdResult = await client.setDeviceColor(selectedDevice.index, color);

    testResults.push({
      color: name,
      rgb: color,
      sent: cmdResult.success,
      error: cmdResult.error,
      timestamp: new Date().toISOString()
    });

    if (cmdResult.success) {
      console.log('✅');
    } else {
      console.log(`❌ (${cmdResult.error || 'failed'})`);
    }

    await sleep(2000); // 2 seconds per color
  }

  console.log('');

  // State restoration
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 5: Restore/Dim Device');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!NO_RESTORE) {
    // Dim to neutral gray (cannot restore original without readback)
    console.log('   Dimming to neutral state...');
    await client.setDeviceColor(selectedDevice.index, { r: 32, g: 32, b: 32 });
    console.log('   ✅ Dimmed.\n');
  } else {
    console.log('   Skipped (--no-restore specified)\n');
  }

  // Disconnect
  client.disconnect();

  // Save test results
  const testResult = {
    timestamp: new Date().toISOString(),
    phase: '3B',
    openrgb: {
      connected: true,
      host: HOST,
      port: PORT,
      protocolVersion: result.protocolVersion
    },
    device: {
      index: selectedDevice.index,
      name: selectedDevice.name,
      type: selectedDevice.type,
      ledCount: selectedDevice.ledCount,
      zoneCount: selectedDevice.zoneCount,
      selectionReason
    },
    originalState,
    testSequence: testResults,
    colorsSent: testResults.length,
    colorsSuccessful: testResults.filter(r => r.sent).length
  };

  fs.writeFileSync(path.join(timestampedDir, 'HARDWARE_COLOR_TEST.json'), JSON.stringify(testResult, null, 2));
  fs.writeFileSync(path.join(latestDir, 'HARDWARE_COLOR_TEST.json'), JSON.stringify(testResult, null, 2));

  // Manual confirmation
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 6: Manual Visual Confirmation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let confirmed: boolean;
  let confirmationMethod: string;

  if (CONFIRM_VISIBLE === 'yes') {
    confirmed = true;
    confirmationMethod = 'cli-flag';
    console.log('   Confirmation via --confirm-visible yes\n');
  } else if (CONFIRM_VISIBLE === 'no') {
    confirmed = false;
    confirmationMethod = 'cli-flag';
    console.log('   Confirmation via --confirm-visible no\n');
  } else if (NON_INTERACTIVE) {
    confirmed = false;
    confirmationMethod = 'non-interactive-default';
    console.log('   Non-interactive mode: defaulting to unconfirmed\n');
  } else {
    // Interactive prompt
    const answer = await askQuestion('   Did the physical RGB device visibly change colors? (y/n): ');
    confirmed = answer === 'y' || answer === 'yes';
    confirmationMethod = 'terminal-prompt';
    console.log('');
  }

  // NEVER mark PASS without visual confirmation
  const finalResult = confirmed ? 'PASS' : 'PARTIAL';

  const confirmationResult = {
    timestamp: new Date().toISOString(),
    manualVisualConfirmationRequired: true,
    manualVisualConfirmation: confirmed,
    confirmedByUser: confirmed,
    confirmationMethod,
    result: finalResult,
    note: confirmed
      ? 'User confirmed visible color changes on physical hardware.'
      : 'No visual confirmation. Hardware control unverified.'
  };

  fs.writeFileSync(path.join(timestampedDir, 'HARDWARE_CONFIRMATION.json'), JSON.stringify(confirmationResult, null, 2));
  fs.writeFileSync(path.join(latestDir, 'HARDWARE_CONFIRMATION.json'), JSON.stringify(confirmationResult, null, 2));

  // Summary output
  console.log('═══════════════════════════════════════════════════════');
  if (confirmed) {
    console.log('  ✅ HARDWARE VISUALLY CONFIRMED');
  } else {
    console.log('  ⚠️  HARDWARE NOT CONFIRMED');
    console.log('');
    console.log('  Troubleshooting:');
    console.log('  - Check OpenRGB device mapping (may be wrong device)');
    console.log('  - Verify device is selected/active in OpenRGB');
    console.log('  - Increase brightness in OpenRGB');
    console.log('  - Enable "Direct" mode on device in OpenRGB');
    console.log('  - Try different device with --device-index N');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  // Final summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    phase: '3B',
    result: finalResult,
    openrgb: {
      connected: true,
      host: HOST,
      port: PORT,
      deviceCount,
      selectedDevice: selectedDevice.name
    },
    colorTest: {
      sequenceRun: true,
      colorsSent: testResults.length,
      colorsSuccessful: testResults.filter(r => r.sent).length,
      testResults: testResults.map(r => ({ color: r.color, sent: r.sent }))
    },
    confirmation: confirmationResult,
    originalState,
    artifacts: {
      timestamped: timestampedDir,
      latest: latestDir,
      files: [
        'HARDWARE_COLOR_TEST.json',
        'HARDWARE_CONFIRMATION.json',
        'HARDWARE_TEST_RESULT.json'
      ]
    }
  };

  fs.writeFileSync(path.join(timestampedDir, 'HARDWARE_TEST_RESULT.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(latestDir, 'HARDWARE_TEST_RESULT.json'), JSON.stringify(summary, null, 2));

  // Write optional photo note
  const photoNote = `# Optional Hardware Photo Proof

For stronger proof, capture a phone photo or screen recording showing
the RGB device changing colors during the test:

- Cyan (first color shown)
- Red
- Green  
- Blue

Save it manually beside this artifact folder.

This is optional and not required for script PASS, but recommended
for external verification.
`;
  fs.writeFileSync(path.join(timestampedDir, 'OPTIONAL_PHOTO_OR_SCREENSHOT_TODO.md'), photoNote);

  console.log('📁 Proof artifacts:');
  console.log(`   Timestamped: ${timestampedDir}`);
  console.log(`   Latest: ${latestDir}\n`);
  console.log('   Files created:');
  console.log('   - HARDWARE_COLOR_TEST.json');
  console.log('   - HARDWARE_CONFIRMATION.json');
  console.log('   - HARDWARE_TEST_RESULT.json');
  console.log('   - OPTIONAL_PHOTO_OR_SCREENSHOT_TODO.md\n');

  process.exit(confirmed ? 0 : 1);
}

runHardwareTest();
