#!/usr/bin/env tsx
/**
 * LuxGrid OpenRGB Hardware Check - Phase 3B Hardened
 * 
 * Checks OpenRGB connection and lists devices.
 * Writes timestamped proof artifacts.
 * 
 * Usage:
 *   pnpm check:openrgb
 *   pnpm check:openrgb -- --host 192.168.1.100 --port 6742
 *   pnpm check:openrgb -- --gui-devices-present yes
 */

import { OpenRgbClient } from '../packages/luxgrid-core/src/openrgb/OpenRgbClient.js';
import type { RgbDevice } from '../packages/luxgrid-core/src/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

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
const GUI_DEVICES_PRESENT = argMap['gui-devices-present'] === 'yes' || argMap['gui-devices-present'] === 'true';

// Timestamped proof folder
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const timestampedDir = path.resolve(`validation-artifacts/luxgrid-hardware-proof-${timestamp}`);
const latestDir = path.resolve('validation-artifacts/hardware-check-latest');

// Create both dirs
fs.mkdirSync(timestampedDir, { recursive: true });
fs.mkdirSync(latestDir, { recursive: true });

async function checkOpenRGB() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   LuxGrid™ Phase 3B — OpenRGB Hardware Check          ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  console.log(`Host: ${HOST}`);
  console.log(`Port: ${PORT}`);
  console.log(`OpenRGB GUI devices present: ${GUI_DEVICES_PRESENT ? 'yes' : 'no'}`);
  console.log(`Proof folder: ${timestampedDir}\n`);

  const client = new OpenRgbClient({ host: HOST, port: PORT });

  // Handle connection errors gracefully
  client.on('error', () => {
    // Error handled in connect() promise
  });

  // Try to connect
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Connect to OpenRGB SDK Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  let result;
  try {
    result = await client.connect();
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const status = {
    timestamp: new Date().toISOString(),
    host: HOST,
    port: PORT,
    connected: result.success,
    protocolVersion: result.protocolVersion,
    error: result.error || null
  };

  if (!result.success) {
    const errorCode = (result as any).errorCode || null;
    console.log(`   ❌ Connection failed: ${result.error}${errorCode ? ` (${errorCode})` : ''}`);

    if (errorCode === 'ENOBUFS') {
      console.log('\n⚠️  OpenRGB connection failed with ENOBUFS.');
      console.log('   This is a socket/resource error, not the normal "server not running" state.');
      console.log('   Check for socket exhaustion, firewall/VPN interference, or stale OpenRGB processes.\n');
    } else if (errorCode === 'ETIMEDOUT' || String(result.error).toLowerCase().includes('timeout')) {
      console.log('\n⚠️  Connection timed out. The OpenRGB SDK server did not respond.');
      console.log('   Verify host/port and that OpenRGB SDK Server is running.\n');
    } else {
      console.log('\n⚠️  OpenRGB is not reachable.');
      console.log('   Start OpenRGB and enable SDK server.');
      console.log('   (Settings → SDK Server → Start Server)\n');
    }

    const openRgbClassification = errorCode === 'ENOBUFS'
      ? 'enobufs'
      : errorCode === 'ETIMEDOUT' || String(result.error).toLowerCase().includes('timeout')
        ? 'openrgb-unreachable'
        : errorCode === 'ECONNREFUSED'
          ? 'openrgb-server-not-running'
          : 'openrgb-connection-failed';

    const failContent: any = {
      timestamp: status.timestamp,
      phase: '3B',
      result: 'FAIL',
      openrgb: {
        connected: false,
        host: HOST,
        port: PORT,
        error: result.error,
        errorCode: errorCode,
        classification: openRgbClassification
      },
      deviceCount: 0,
      devices: [],
      hardwareProofReady: false,
      canRunColorTest: false,
      note: errorCode === 'ENOBUFS'
        ? 'OpenRGB connection failed with ENOBUFS. Investigate socket/resource issues.'
        : 'Start OpenRGB and enable SDK server (Settings → SDK Server → Start Server)'
    };

    const statusTxt = `OpenRGB Status: DISCONNECTED
Host: ${HOST}
Port: ${PORT}
Error: ${result.error}${errorCode ? ` (${errorCode})` : ''}

Classification: ${openRgbClassification}

To fix: ${errorCode === 'ENOBUFS' ? 'Investigate socket/resource exhaustion (ENOBUFS).' : 'Start OpenRGB and enable SDK server.'}
(Settings → SDK Server → Start Server)`;

    // Write to both dirs
    fs.writeFileSync(path.join(timestampedDir, 'OPENRGB_STATUS.txt'), statusTxt);
    fs.writeFileSync(path.join(latestDir, 'OPENRGB_STATUS.txt'), statusTxt);
    fs.writeFileSync(path.join(timestampedDir, 'CHECK_RESULT.json'), JSON.stringify(failContent, null, 2));
    fs.writeFileSync(path.join(latestDir, 'CHECK_RESULT.json'), JSON.stringify(failContent, null, 2));

    console.log(`\n📁 Artifacts written to: ${timestampedDir}\n`);
    process.exit(1);
  }

  console.log(`   ✅ Connected to OpenRGB!`);
  console.log(`   Protocol Version: ${result.protocolVersion}\n`);

  // Get device count
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: List RGB Devices');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const deviceCount = await client.getDeviceCount();
  console.log(`   Device count: ${deviceCount}\n`);

  // Get devices
  const devices: Array<{
    index: number;
    name: string;
    type: string;
    ledCount: number;
    zoneCount: number;
  }> = [];

  if (deviceCount > 0) {
    const deviceList = await client.getDeviceList();
    for (let i = 0; i < deviceList.length; i++) {
      const device = deviceList[i];
      devices.push({
        index: device.index ?? i,
        name: device.name,
        type: device.type || 'unknown',
        ledCount: device.ledCount || 0,
        zoneCount: device.zoneCount || 0
      });
      console.log(`   [${i}] ${device.name}`);
      console.log(`       Type: ${device.type || 'unknown'}`);
      console.log(`       LEDs: ${device.ledCount || 0}`);
      console.log(`       Zones: ${device.zoneCount || 0}`);
    }
  } else {
    console.log('   ⚠️  No RGB devices found.');
    console.log('      Connect a keyboard, mouse, or RGB device to OpenRGB.\n');
  }

  console.log('\n✅ OpenRGB check complete.\n');

  // Prepare result
  const classification = deviceCount > 0
    ? 'connected-devices'
    : GUI_DEVICES_PRESENT
      ? 'sdk-mismatch'
      : 'connected-zero-devices';

  const checkResult = {
    timestamp: status.timestamp,
    phase: '3B',
    result: deviceCount > 0 ? 'PASS' : 'PARTIAL',
    openrgb: {
      connected: true,
      host: HOST,
      port: PORT,
      protocolVersion: result.protocolVersion,
      deviceCount,
      guiDevicesPresent: GUI_DEVICES_PRESENT,
      classification
    },
    devices,
    hardwareProofReady: deviceCount > 0,
    canRunColorTest: deviceCount > 0,
    note: deviceCount > 0
      ? 'OpenRGB connected and devices found. Ready for color test.'
      : GUI_DEVICES_PRESENT
        ? 'OpenRGB GUI reports devices, but OpenRGB SDK returned zero devices. This indicates a likely SDK protocol mismatch in LuxGrid.'
        : 'OpenRGB connected but no devices found. Connect RGB hardware or verify OpenRGB SDK device listing.'
  };

  const statusTxt = `OpenRGB Status: CONNECTED
Host: ${HOST}
Port: ${PORT}
Protocol: ${result.protocolVersion}
Device Count: ${deviceCount}
GUI Devices Present: ${GUI_DEVICES_PRESENT ? 'yes' : 'no'}
Classification: ${classification}
Result: ${checkResult.result}

${deviceCount > 0
  ? 'Ready for hardware color test. Run: pnpm hardware:test-color'
  : GUI_DEVICES_PRESENT
    ? 'OpenRGB GUI shows devices, but LuxGrid OpenRGB SDK reports zero devices. Investigate SDK client/protocol mismatch.'
    : 'OpenRGB is connected, but no RGB devices are detected. Hardware color proof is blocked until deviceCount > 0.'}`;

  // Write to both dirs
  fs.writeFileSync(path.join(timestampedDir, 'OPENRGB_STATUS.txt'), statusTxt);
  fs.writeFileSync(path.join(latestDir, 'OPENRGB_STATUS.txt'), statusTxt);
  fs.writeFileSync(path.join(timestampedDir, 'CHECK_RESULT.json'), JSON.stringify(checkResult, null, 2));
  fs.writeFileSync(path.join(latestDir, 'CHECK_RESULT.json'), JSON.stringify(checkResult, null, 2));

  // Write device table for easy reading
  const deviceTable = `# RGB Devices Detected

| Index | Name | Type | LEDs | Zones |
|-------|------|------|------|-------|
${devices.map(d => `| ${d.index} | ${d.name} | ${d.type} | ${d.ledCount} | ${d.zoneCount} |`).join('\n') || '| - | None | - | - | - |'}

Total: ${deviceCount} device(s)
`;
  fs.writeFileSync(path.join(timestampedDir, 'DEVICES.md'), deviceTable);

  console.log(`📁 Artifacts written to: ${timestampedDir}\n`);
  console.log(`   - OPENRGB_STATUS.txt`);
  console.log(`   - CHECK_RESULT.json`);
  console.log(`   - DEVICES.md\n`);

  // Disconnect
  client.disconnect();
  process.exit(deviceCount > 0 ? 0 : 1);
}

checkOpenRGB();
