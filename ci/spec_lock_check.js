const fs = require("fs");
const { execSync } = require("child_process");

const frozenFiles = [
  "docs/security/CRYPTOGRAPHIC_ARCHITECTURE_SPEC.md",
  "docs/security/ANTI_ROLLBACK_PROTOCOL.md",
  "docs/security/THREAT_REGRESSION_POLICY.md",
  "docs/release/MANIFEST_SPEC.md",
  "release/manifest.schema.json"
];

const lockStateFile = "ARCHITECTURE_LOCK_STATE.md";

function getDiff(file) {
  try {
    return execSync(`git diff HEAD -- ${file}`).toString().trim();
  } catch (e) {
    return "";
  }
}

function getVersionMap(content) {
  const map = {};
  const lines = content.split("\n");
  lines.forEach(line => {
    const match = line.match(/- \*\*(\w+):\*\* v(\d+)/);
    if (match) {
      map[match[1]] = parseInt(match[2], 10);
    }
  });
  return map;
}

function checkSpecLock() {
  console.log("🔍 Running Semantic Spec Lock Check...");
  
  const lockStateDiff = getDiff(lockStateFile);
  const lockStateChanged = lockStateDiff !== "";
  
  let violations = [];
  let changedSpecs = [];

  for (const file of frozenFiles) {
    if (fs.existsSync(file) && getDiff(file) !== "") {
      changedSpecs.push(file);
    }
  }

  if (changedSpecs.length > 0) {
    if (!lockStateChanged) {
      violations.push(`Specs changed [${changedSpecs.join(", ")}] but ${lockStateFile} was not updated.`);
    } else {
      // Semantic Check: Verify versions actually increased
      const oldContent = execSync(`git show HEAD:${lockStateFile}`).toString();
      const newContent = fs.readFileSync(lockStateFile, "utf8");
      
      const oldVersions = getVersionMap(oldContent);
      const newVersions = getVersionMap(newContent);
      
      let incrementDetected = false;
      for (const key in oldVersions) {
        if (newVersions[key] > oldVersions[key]) {
          incrementDetected = true;
          console.log(`✅ Detected version increment for ${key}: v${oldVersions[key]} -> v${newVersions[key]}`);
        } else if (newVersions[key] < oldVersions[key]) {
          violations.push(`CRITICAL: Version DECREMENT detected for ${key} (v${oldVersions[key]} -> v${newVersions[key]}).`);
        }
      }
      
      if (!incrementDetected) {
        violations.push(`${lockStateFile} was modified, but no version fields were incremented.`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("\n❌ SPEC LOCK VIOLATION DETECTED:");
    violations.forEach(v => console.error(` - ${v}`));
    process.exit(1);
  } else {
    console.log("\n✅ Semantic spec lock check passed.");
    process.exit(0);
  }
}

checkSpecLock();
