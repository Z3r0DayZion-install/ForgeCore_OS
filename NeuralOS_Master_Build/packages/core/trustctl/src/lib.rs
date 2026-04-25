use neon::prelude::*;
use sha2::{Sha256, Digest};
use std::fs;

fn calculate_hash(mut cx: FunctionContext) -> JsResult<JsString> {
    let file_path = cx.argument::<JsString>(0)?.value(&mut cx);
    
    match fs::read(&file_path) {
        Ok(content) => {
            let mut hasher = Sha256::new();
            hasher.update(content);
            let result = hasher.finalize();
            let hash_hex = hex::encode(result);
            Ok(cx.string(hash_hex))
        }
        Err(e) => cx.throw_error(format!("Failed to read file: {}", e))
    }
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("calculateHash", calculate_hash)?;
    Ok(())
}
