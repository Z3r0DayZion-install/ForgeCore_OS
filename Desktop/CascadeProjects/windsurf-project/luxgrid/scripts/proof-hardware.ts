#!/usr/bin/env tsx
/**
 * LuxGrid Phase 3B Hardware Proof Aggregator
 * 
 * Runs the complete hardware proof flow:
 * 1. Check OpenRGB connection
 * 2. List devices
 * 3. Run color test
 * 4. Collect manual confirmation
 * 5. Generate timestamped proof artifacts
 * 
 * Usage:
 *   pnpm proof:hardware
 *   pnpm proof:hardware -- --host 192.168.1.100 --port 6742
 *   pnpm proof:hardware -- --device-index 1
 *   pnpm proof:hardware -- --confirm-visible yes
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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
const PORT = argMap['port'] || '6742';
const DEVICE_INDEX = argMap['device-index'] !== undefined ? `--device-index ${argMap['device-index']}` : '';
const DEVICE_NAME = argMap['device-name'] !== undefined ? `--device-name "${argMap['device-name']}"` : '';
const CONFIRM_VISIBLE = argMap['confirm-visible'] !== undefined ? `--confirm-visible ${argMap['confirm-visible']}` : '';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.resolve(`validation-artifacts/luxgrid-hardware-proof-${timestamp}`);

function runCommand(cmd: string): { success: boolean; output: string; error?: string } {
  try {
    const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd() });
    return { success: true, output };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error };
  }
}

async function runHardwareProof() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   LuxGrid™ Phase 3B — Physical OpenRGB Hardware Proof  ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`Host: ${HOST}`);
  console.log(`Port: ${PORT}\n`);

  fs.mkdirSync(outDir, { recursive: true });
  console.log(`📁 Output: ${outDir}\n`);

  // Step 1: Check OpenRGB
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Check OpenRGB Connection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const checkCmd = `pnpm check:openrgb -- --host ${HOST} --port ${PORT}`;
  const checkResult = runCommand(checkCmd);
  console.log(checkResult.output);

  // Find the most recent timestamped check result
  const artifactsDir = path.resolve('validation-artifacts');
  const dirs = fs.readdirSync(artifactsDir)
    .filter(d => d.startsWith('luxgrid-hardware-proof-'))
    .sort()
    .reverse();
  const latestCheckDir = dirs.length > 0 ? path.join(artifactsDir, dirs[0]) : null;

  // Copy check results from timestamped folder
  if (latestCheckDir && fs.existsSync(latestCheckDir)) {
    const files = fs.readdirSync(latestCheckDir);
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.md')) {
        fs.copyFileSync(
          path.join(latestCheckDir, file),
          path.join(outDir, file)
        );
      }
    }
  }

  if (!checkResult.success) {
    // Attempt to read the CHECK_RESULT.json written by check-openrgb for richer error info
    let checkJson: any = null;
    try {
      const candidate = latestCheckDir ? path.join(latestCheckDir, 'CHECK_RESULT.json') : null;
      if (candidate && fs.existsSync(candidate)) {
        checkJson = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      }
    } catch (e) {
      checkJson = null;
    }

    const errorCode = checkJson?.openrgb?.errorCode || null;

    if (errorCode === 'ENOBUFS') {
      console.log('\n❌ STEP 1 FAILED: OpenRGB connection error (ENOBUFS)');
      console.log('   This indicates a socket/resource issue. Investigate socket exhaustion, firewall, VPN, or stale processes.\n');
    } else {
      console.log('\n❌ STEP 1 FAILED: OpenRGB not reachable');
      console.log('   Start OpenRGB and enable SDK server.\n');
    }

    fs.writeFileSync(
      path.join(outDir, 'SUMMARY.md'),
      `# LuxGrid Phase 3B Hardware Proof - FAILED

**Result:** FAIL

**Reason:** ${errorCode === 'ENOBUFS' ? 'OpenRGB connection error (ENOBUFS) - investigate socket/resource issues' : `OpenRGB not reachable at ${HOST}:${PORT}`} 

**Required Action:**
${errorCode === 'ENOBUFS' ? '1. Investigate socket/resource exhaustion on this host\n2. Check firewall, VPN, or stale OpenRGB processes\n3. Free sockets or reboot if needed' : '1. Start OpenRGB\n2. Go to Settings → SDK Server\n3. Click "Start Server"\n4. Re-run `pnpm proof:hardware`'}

**Timestamp:** ${timestamp}
`
    );

    process.exit(1);
  }

  console.log('✅ STEP 1 PASSED: OpenRGB connected\n');

  // Step 2: Hardware color test
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Hardware Color Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🎨 This will send color commands to your physical RGB device.\n');

  const testCmd = `pnpm hardware:test-color -- --host ${HOST} --port ${PORT} ${DEVICE_INDEX} ${DEVICE_NAME} ${CONFIRM_VISIBLE}`;
  const testResult = runCommand(testCmd);
  console.log(testResult.output);

  // Find the most recent test results
  const testDirs = fs.readdirSync(artifactsDir)
    .filter(d => d.startsWith('luxgrid-hardware-proof-'))
    .sort()
    .reverse();
  const latestTestDir = testDirs.length > 0 ? path.join(artifactsDir, testDirs[0]) : null;

  // Copy test results from timestamped folder
  if (latestTestDir && latestTestDir !== outDir && fs.existsSync(latestTestDir)) {
    const files = fs.readdirSync(latestTestDir);
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.md')) {
        const src = path.join(latestTestDir, file);
        const dst = path.join(outDir, file);
        // Don't overwrite if already exists from check step
        if (!fs.existsSync(dst)) {
          fs.copyFileSync(src, dst);
        }
      }
    }
  }

  // Read confirmation result
  const confirmationPath = path.join(outDir, 'HARDWARE_CONFIRMATION.json');
  let manualConfirmed = false;
  let confirmationMethod = 'unknown';

  if (fs.existsSync(confirmationPath)) {
    const confirmation = JSON.parse(fs.readFileSync(confirmationPath, 'utf-8'));
    manualConfirmed = confirmation.manualVisualConfirmation === true;
    confirmationMethod = confirmation.confirmationMethod || 'unknown';
  }

  // Step 3: Generate summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: Generate Proof Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Read device info
  const checkResultPath = path.join(outDir, 'CHECK_RESULT.json');
  let deviceInfo: { deviceCount?: number; devices?: any[] } = {};
  if (fs.existsSync(checkResultPath)) {
    deviceInfo = JSON.parse(fs.readFileSync(checkResultPath, 'utf-8'));
  }

  // Read test result
  const testResultPath = path.join(outDir, 'HARDWARE_TEST_RESULT.json');
  let testInfo: any = {};
  if (fs.existsSync(testResultPath)) {
    testInfo = JSON.parse(fs.readFileSync(testResultPath, 'utf-8'));
  }

  // NEVER mark PASS without visual confirmation
  // Commands sent but unconfirmed = PARTIAL, not FAIL
  const finalResult = manualConfirmed ? 'PASS' : (testResult.success ? 'PARTIAL' : 'FAIL');

  // Generate SUMMARY.md
  const summaryMd = `# LuxGrid Phase 3B Hardware Proof

## Result

**${finalResult}**

## Commands Run

\`\`\`bash
pnpm check:openrgb -- --host ${HOST} --port ${PORT}
pnpm hardware:test-color -- --host ${HOST} --port ${PORT} ${DEVICE_INDEX} ${DEVICE_NAME} ${CONFIRM_VISIBLE}
\`\`\`

## OpenRGB Status

| Item | Value |
|------|-------|
| Host | ${HOST} |
| Port | ${PORT} |
| Connected | ✅ Yes |
| Device Count | ${deviceInfo.deviceCount || 0} |

## Devices Found

| Index | Name | Type | LEDs | Zones |
|-------|------|------|------|-------|
${deviceInfo.devices?.map((d: any) => 
  `| ${d.index ?? '-'} | ${d.name} | ${d.type} | ${d.ledCount} | ${d.zoneCount} |`
).join('\n') || '| - | None | - | - | - |'}

## Selected Device

- **Name:** ${testInfo.device?.name || 'N/A'}
- **Type:** ${testInfo.device?.type || 'N/A'}
- **Index:** ${testInfo.device?.index ?? 'N/A'}
- **LEDs:** ${testInfo.device?.ledCount ?? 'N/A'}
- **Selection Reason:** ${testInfo.device?.selectionReason || 'N/A'}

## Color Test

| Color | Sent | Result |
|-------|------|--------|
${testInfo.colorTest?.testResults?.map((c: any) => 
  `| ${c.color} | ${c.sent ? '✅' : '❌'} | ${c.sent ? 'Sent' : c.error || 'Failed'} |`
).join('\n') || '| N/A | N/A | N/A |'}

- **Colors Sent:** ${testInfo.colorTest?.colorsSent || 0}
- **Colors Successful:** ${testInfo.colorTest?.colorsSuccessful || 0}

## Original State Preservation

${testInfo.originalState?.captured 
  ? '- ✅ Original state captured' 
  : `- ⚠️ ${testInfo.originalState?.reason || 'Readback unavailable'}`}

## Manual Visual Confirmation

- **Required:** Yes
- **Method:** ${confirmationMethod}
- **Result:** ${manualConfirmed ? '✅ YES — User confirmed visible color changes' : '❌ NO — Not confirmed'}

${!manualConfirmed ? `
### Troubleshooting

If colors didn't appear:
1. Check OpenRGB device mapping (may be wrong device)
2. Verify device is selected/active in OpenRGB
3. Increase brightness in OpenRGB
4. Enable "Direct" mode on device in OpenRGB
5. Try different device with \`--device-index N\`
` : ''}

## Artifact Folder

\`${outDir}\`

## Files Created

- \`CHECK_RESULT.json\` — OpenRGB connection status
- \`DEVICES.md\` — Device list table
- \`HARDWARE_COLOR_TEST.json\` — Color test details
- \`HARDWARE_CONFIRMATION.json\` — Manual confirmation
- \`HARDWARE_TEST_RESULT.json\` — Final summary
- \`KNOWN_LIMITATIONS.md\` — Honest limitations
- \`OPTIONAL_PHOTO_OR_SCREENSHOT_TODO.md\` — Photo guidance
- \`SUMMARY.md\` — This file

## Honest Assessment

${manualConfirmed 
  ? `**LuxGrid successfully controlled physical RGB hardware via OpenRGB.**

The color commands were sent and visually confirmed on the physical device.
**Status:** Hardware-verified in addition to renderer-verified.`
  : testResult.success 
    ? `**LuxGrid connected to OpenRGB and sent color commands, but physical changes were not confirmed.**

Commands were sent successfully, but without visual confirmation, hardware control is unverified.
**Status:** Connection-verified only (PARTIAL).`
    : `**LuxGrid failed to complete hardware test.**

**Status:** FAIL — Check error messages above.`}

## What Works

${manualConfirmed ? `- ✅ OpenRGB connection
- ✅ Device detection
- ✅ Color command sending
- ✅ Visual confirmation received` : testResult.success ? `- ✅ OpenRGB connection
- ✅ Device detection  
- ⚠️ Color commands sent (unconfirmed)` : '- ❌ Hardware test failed'}

## What Failed

${!manualConfirmed && testResult.success ? '- ❌ Visual confirmation not received' : !testResult.success ? '- ❌ Hardware test execution' : '- None'}

## Remaining Limitations

| Item | Status | Notes |
|------|--------|-------|
| Multiple devices | NOT TESTED | Only first/selected device tested |
| LED-by-LED control | NOT TESTED | Full device color only |
| Zone mapping accuracy | NOT VERIFIED | May not match physical layout |
| Readback verification | NOT AVAILABLE | No camera/photodiode proof |
| Long-term stability | NOT TESTED | 30-second test only |
| Different device types | NOT TESTED | Keyboard/mouse/mousepad/etc |

## Next Recommended Step

${manualConfirmed
  ? 'Consider packaging for distribution or testing with multiple devices.'
  : 'Troubleshoot OpenRGB device mapping and re-run \`pnpm proof:hardware\`'}

---

**Timestamp:** ${timestamp}
**Phase:** 3B
**Evidence Level:** ${manualConfirmed ? 'hardware-verified' : testResult.success ? 'connection-verified' : 'fail'}
`;

  fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), summaryMd);

  // Generate KNOWN_LIMITATIONS.md
  const limitationsMd = `# Known Limitations - Hardware Proof

## This Proof Does NOT Verify

| Item | Status | Notes |
|------|--------|-------|
| Multiple devices | NOT TESTED | Only first device tested |
| LED-by-LED control | NOT TESTED | Full device color only |
| Zone mapping accuracy | NOT VERIFIED | May not match physical layout |
| Readback verification | NOT AVAILABLE | No camera/photodiode proof |
| Long-term stability | NOT TESTED | 30-second test only |
| Different device types | NOT TESTED | Keyboard/mouse/mousepad/etc |

## Assumptions

1. OpenRGB SDK protocol works as documented
2. Device responds to \`setDeviceColor\` command
3. Device is not in a locked/software-exclusive mode
4. Colors are approximately correct (no calibration)

## Risks

| Risk | Likelihood | Impact |
|------|------------|--------|
| Wrong device selected | Medium | Wrong LEDs light up |
| Color inaccurate | High | Looks different than expected |
| Zone mapping wrong | Medium | Keys in wrong positions |
| Device doesn't respond | Low | No visual change |

---

**This is a functional proof, not a comprehensive hardware test.**
`;

  fs.writeFileSync(path.join(outDir, 'KNOWN_LIMITATIONS.md'), limitationsMd);

  // Generate final DEVICE_PROOF.json
  const deviceProof = {
    timestamp: timestamp,
    phase: '3B',
    mode: 'openrgb',
    result: finalResult,
    openrgb: {
      connected: true,
      host: HOST,
      port: parseInt(PORT, 10),
      protocolVersion: testInfo.openrgb?.protocolVersion
    },
    device: {
      count: deviceInfo.deviceCount || 0,
      list: deviceInfo.devices || [],
      selected: {
        name: testInfo.device?.name,
        type: testInfo.device?.type,
        index: testInfo.device?.index,
        ledCount: testInfo.device?.ledCount,
        zoneCount: testInfo.device?.zoneCount,
        selectionReason: testInfo.device?.selectionReason
      }
    },
    test: {
      colorsAttempted: testInfo.colorTest?.colorsSent || 0,
      colorsSuccessful: testInfo.colorTest?.colorsSuccessful || 0,
      sequence: testInfo.colorTest?.testResults?.map((r: any) => ({
        color: r.color,
        sent: r.sent,
        error: r.error
      })) || []
    },
    originalState: testInfo.originalState || { captured: false },
    confirmation: {
      required: true,
      received: manualConfirmed,
      method: confirmationMethod,
      result: finalResult
    },
    artifacts: {
      folder: outDir,
      files: [
        'CHECK_RESULT.json',
        'DEVICES.md',
        'HARDWARE_COLOR_TEST.json',
        'HARDWARE_CONFIRMATION.json',
        'HARDWARE_TEST_RESULT.json',
        'KNOWN_LIMITATIONS.md',
        'OPTIONAL_PHOTO_OR_SCREENSHOT_TODO.md',
        'SUMMARY.md'
      ]
    }
  };

  fs.writeFileSync(
    path.join(outDir, 'DEVICE_PROOF.json'),
    JSON.stringify(deviceProof, null, 2)
  );

  console.log('✅ Proof artifacts generated\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  LUXGRID PHASE 3B HARDWARE PROOF COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Result: ${finalResult}`);
  console.log(`Location: ${outDir}\n`);

  if (manualConfirmed) {
    console.log('🎉 Hardware is VERIFIED!');
    console.log('   LuxGrid controls physical RGB devices via OpenRGB.\n');
  } else if (testResult.success) {
    console.log('⚠️  Hardware NOT confirmed (PARTIAL).');
    console.log('   Commands sent but visual confirmation not received.\n');
  } else {
    console.log('❌ Hardware proof FAILED.');
    console.log('   See SUMMARY.md for troubleshooting.\n');
  }

  // Exit with appropriate code
  if (manualConfirmed) {
    process.exit(0);
  } else if (testResult.success) {
    process.exit(2); // PARTIAL - commands worked but no confirmation
  } else {
    process.exit(1);
  }
}

runHardwareProof();
