"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");
const {
  resolvePassphraseHash,
  verifyPassphrase,
  resolveSafeRootPath,
  resolveUtilityArtifactPath
} = require("../security_guards");

test("resolvePassphraseHash prefers valid env hash", () => {
  const previous = process.env.FORGECORE_PASSPHRASE_HASH;
  process.env.FORGECORE_PASSPHRASE_HASH = "a".repeat(64);
  assert.equal(resolvePassphraseHash("b".repeat(64)), "a".repeat(64));
  if (previous === undefined) {
    delete process.env.FORGECORE_PASSPHRASE_HASH;
  } else {
    process.env.FORGECORE_PASSPHRASE_HASH = previous;
  }
});

test("resolvePassphraseHash can derive from env passphrase when hash is absent", () => {
  const previousHash = process.env.FORGECORE_PASSPHRASE_HASH;
  const previousPassphrase = process.env.FORGECORE_MASTER_PASSPHRASE;
  delete process.env.FORGECORE_PASSPHRASE_HASH;
  process.env.FORGECORE_MASTER_PASSPHRASE = "forgecore-secret";
  const expected = crypto.createHash("sha256").update("forgecore-secret", "utf8").digest("hex");
  assert.equal(resolvePassphraseHash(""), expected);
  if (previousHash === undefined) {
    delete process.env.FORGECORE_PASSPHRASE_HASH;
  } else {
    process.env.FORGECORE_PASSPHRASE_HASH = previousHash;
  }
  if (previousPassphrase === undefined) {
    delete process.env.FORGECORE_MASTER_PASSPHRASE;
  } else {
    process.env.FORGECORE_MASTER_PASSPHRASE = previousPassphrase;
  }
});

test("verifyPassphrase uses constant-time hash compare and rejects malformed hash", () => {
  const passphrase = "SOVEREIGN_TEST";
  const goodHash = crypto.createHash("sha256").update(passphrase, "utf8").digest("hex");
  assert.equal(verifyPassphrase(passphrase, goodHash), true);
  assert.equal(verifyPassphrase("wrong", goodHash), false);
  assert.equal(verifyPassphrase(passphrase, "not-a-hash"), false);
});

test("resolveUtilityArtifactPath blocks traversal", () => {
  const vaultRoot = path.join("C:\\", "vaults");
  const okPath = resolveUtilityArtifactPath(vaultRoot, "artifact.js");
  assert.ok(okPath.endsWith(path.join("UTILITY_VAULT", "artifact.js")));

  assert.throws(() => resolveUtilityArtifactPath(vaultRoot, "..\\evil.js"), /Invalid artifact name|Path traversal blocked/);
  assert.throws(() => resolveUtilityArtifactPath(vaultRoot, "../evil.js"), /Invalid artifact name|Path traversal blocked/);
});

test("resolveSafeRootPath blocks traversal and absolute escapes", () => {
  const root = path.join("C:\\", "forgecore");
  const okPath = resolveSafeRootPath(root, "vaults/INTEL_VAULT/readme.txt");
  assert.ok(okPath.includes(path.join("forgecore", "vaults")));

  assert.throws(() => resolveSafeRootPath(root, "../outside.txt"), /Invalid path|Path traversal blocked/);
  assert.throws(() => resolveSafeRootPath(root, "..\\outside.txt"), /Invalid path|Path traversal blocked/);
  assert.throws(() => resolveSafeRootPath(root, "C:\\Windows\\win.ini"), /Path traversal blocked/);
});
