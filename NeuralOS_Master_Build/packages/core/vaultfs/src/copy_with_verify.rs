use sha2::{Sha256, Digest};
use std::fs;
use std::io;
use std::path::Path;

/**
 * Sovereign copy-with-verify routine.
 * Ensures 100% integrity during vault transfers.
 */
pub fn copy_and_hash(src: &Path, dst: &Path) -> io::Result<String> {
    // 1. Calculate Source Hash
    let src_bytes = fs::read(src)?;
    let mut hasher = Sha256::new();
    hasher.update(&src_bytes);
    let src_hash = hex::encode(hasher.finalize());

    // 2. Perform Copy
    fs::copy(src, dst)?;

    // 3. Calculate Destination Hash
    let dst_bytes = fs::read(dst)?;
    let mut hasher_dst = Sha256::new();
    hasher_dst.update(&dst_bytes);
    let dst_hash = hex::encode(hasher_dst.finalize());

    // 4. Verify
    if src_hash != dst_hash {
        fs::remove_file(dst)?; // Hard-Fail
        return Err(io::Error::new(io::ErrorKind::InvalidData, "Lineage Corruption Detected"));
    }

    Ok(dst_hash)
}
