const fs = require("fs");
const { execSync } = require("child_process");

const frozenFiles = [
  "docs/security/CRYPTOGRAPHIC_ARCHITECTURE_SPEC.md",
  "docs/security/ANTI_ROLLBACK_PROTOCOL.md",
  "docs/security/THREAT_REGRESSION_POLICY.md",
  "docs/release/MANIFEST_SPEC.md",
  "release/manifest.schema.json",
  "ARCHITECTURE_LOCK_STATE.md"
];

const lockStateFile = "ARCHITECTURE_LOCK_STATE.md";

function getDiff(file) {
  try {
    // Check both staged and unstaged changes against HEAD
    const diff = execSync(`git diff HEAD -- ${file}`).toString().trim();
    return diff;
  } catch (e) {
    return "";
  }
}

function checkSpecLock() {
  console.log("🔍 Running Spec Lock Check...");
  
  let violations = [];
  let lockStateChanged = getDiff(lockStateFile) !== "";
  
  for (const file of frozenFiles) {
    if (file === lockStateFile) continue;
    
    if (fs.existsSync(file)) {
      const diff = getDiff(file);
      if (diff !== "") {
        console.log(`⚠️  Detected change in frozen file: ${file}`);
        if (!lockStateChanged) {
          violations.push(`File ${file} was modified but ${lockStateFile} was not updated.`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error("\n❌ SPEC LOCK VIOLATION DETECTED:");
    violations.forEach(v => console.error(` - ${v}`));
    console.error("\nChanges to frozen specifications require ARCHITECTURE_LOCK_STATE update.");
    process.exit(1);
  } else {
    console.log("\n✅ Spec lock check passed.");
    process.exit(0);
  }
}

checkSpecLock();
