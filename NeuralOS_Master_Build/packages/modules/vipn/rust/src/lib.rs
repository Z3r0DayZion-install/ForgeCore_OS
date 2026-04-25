use neon::prelude::*;

mod tap;

fn vpn_start(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let config_json = cx.argument::<JsString>(0)?.value(&mut cx);
    println!("[VIPN-CORE] Starting VPN with config: {}", config_json);
    
    // Trigger Native Hardening
    match tap::create_tap() {
        Ok(_) => println!("[VIPN-CORE] TAP_ADAPTER_ONLINE"),
        Err(e) => return cx.throw_error(format!("TAP_FAILURE: {}", e))
    }

    match tap::enable_killswitch() {
        Ok(_) => println!("[VIPN-CORE] WFP_KILLSWITCH_ENGAGED"),
        Err(e) => return cx.throw_error(format!("WFP_FAILURE: {}", e))
    }

    Ok(cx.boolean(true))
}

fn vpn_stop(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    println!("[VIPN-CORE] Stopping VPN and flushing WFP rules...");
    let _ = tap::disable_killswitch();
    Ok(cx.boolean(true))
}

fn vpn_status(mut cx: FunctionContext) -> JsResult<JsString> {
    Ok(cx.string("CONNECTED"))
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("vpnStart", vpn_start)?;
    cx.export_function("vpnStop", vpn_stop)?;
    cx.export_function("vpnStatus", vpn_status)?;
    Ok(())
}
