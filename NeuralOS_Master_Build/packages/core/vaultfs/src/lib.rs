use neon::prelude::*;
use std::path::Path;

mod copy_with_verify;

fn vault_move(mut cx: FunctionContext) -> JsResult<JsString> {
    let src_path = cx.argument::<JsString>(0)?.value(&mut cx);
    let dst_path = cx.argument::<JsString>(1)?.value(&mut cx);
    
    match copy_with_verify::copy_and_hash(Path::new(&src_path), Path::new(&dst_path)) {
        Ok(hash) => {
            // After successful copy & verify, remove source
            let _ = std::fs::remove_file(src_path);
            Ok(cx.string(hash))
        },
        Err(e) => cx.throw_error(format!("Vault Move Failure: {}", e))
    }
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("vaultMove", vault_move)?;
    Ok(())
}
