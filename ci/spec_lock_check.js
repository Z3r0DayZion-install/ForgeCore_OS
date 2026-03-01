const fs = require("fs");
const { execSync } = require("child_process");

const frozenFiles = [
  "docs/security/CRYPTO_SPEC.md",
  "docs/security/MERKLE_SPEC.md",
  "docs/security/ANTI_ROLLBACK_PROTOCOL.md",
  "release/manifest.schema.json",
  "ARCHITECTURE_LOCK_STATE.md"
];

const lockStateFile = "ARCHITECTURE_LOCK_STATE.md";

function getDiff(file) {
  try {
    return execSync(`git diff HEAD -- ${file}`).toString().trim();
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
    console.error("
❌ SPEC LOCK VIOLATION DETECTED:");
    violations.forEach(v => console.error(` - ${v}`));
    console.error("
Level 3 changes require ARCHITECTURE_LOCK_STATE update and version bump.");
    process.exit(1);
  } else {
    console.log("
✅ Spec lock check passed.");
    process.exit(0);
  }
}

checkSpecLock();
