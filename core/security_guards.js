"use strict";

const crypto = require("crypto");
const path = require("path");

const SHA256_HEX = /^[a-f0-9]{64}$/;

function normalizeHash(value) {
  return String(value || "").trim().toLowerCase();
}

function resolvePassphraseHash(configHash) {
  const envHash = normalizeHash(process.env.FORGECORE_PASSPHRASE_HASH);
  if (SHA256_HEX.test(envHash)) {
    return envHash;
  }
  if (typeof process.env.FORGECORE_MASTER_PASSPHRASE === "string" && process.env.FORGECORE_MASTER_PASSPHRASE.length > 0) {
    return crypto.createHash("sha256").update(process.env.FORGECORE_MASTER_PASSPHRASE, "utf8").digest("hex");
  }
  const fileHash = normalizeHash(configHash);
  return SHA256_HEX.test(fileHash) ? fileHash : null;
}

function verifyPassphrase(passphrase, expectedHash) {
  const normalizedExpected = normalizeHash(expectedHash);
  if (!SHA256_HEX.test(normalizedExpected)) {
    return false;
  }
  if (typeof passphrase !== "string") {
    return false;
  }
  const expectedBuffer = Buffer.from(normalizedExpected, "hex");
  const inputBuffer = crypto.createHash("sha256").update(passphrase, "utf8").digest();
  if (expectedBuffer.length !== inputBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

function ensureInsideRoot(rootDir, targetPath) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal blocked");
  }
  return resolvedTarget;
}

function hasTraversalSegments(requestPath) {
  return /(^|[\\/])\.\.([\\/]|$)/.test(requestPath);
}

function resolveSafeRootPath(rootDir, requestPath) {
  const value = String(requestPath || "");
  if (!value || value.includes("\0") || hasTraversalSegments(value)) {
    throw new Error("Invalid path");
  }
  return ensureInsideRoot(rootDir, path.join(rootDir, value));
}

function resolveUtilityArtifactPath(vaultDir, artifactName) {
  const utilityDir = path.resolve(vaultDir, "UTILITY_VAULT");
  const requestedName = String(artifactName || "");
  const safeName = path.basename(requestedName);
  if (
    !safeName ||
    safeName === "." ||
    safeName === ".." ||
    safeName.includes("\0") ||
    requestedName !== safeName
  ) {
    throw new Error("Invalid artifact name");
  }
  return ensureInsideRoot(utilityDir, path.join(utilityDir, safeName));
}

module.exports = {
  resolvePassphraseHash,
  verifyPassphrase,
  resolveSafeRootPath,
  resolveUtilityArtifactPath
};
