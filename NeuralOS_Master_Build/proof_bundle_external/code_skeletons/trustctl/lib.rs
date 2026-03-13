// trustctl/src/lib.rs
//! Minimal skeleton for deterministic build verification.

pub fn verify_sha256(path: &str, expected: &str) -> anyhow::Result<()> {
    use std::fs::File;
    use std::io::{Read};
    use sha2::{Sha256, Digest};

    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 8192];
    loop {
        let read = file.read(&mut buf)?;
        if read == 0 { break; }
        hasher.update(&buf[..read]);
    }
    let result = format!("{:x}", hasher.finalize());
    anyhow::ensure!(result == expected, "Hash mismatch");
    Ok(())
}
