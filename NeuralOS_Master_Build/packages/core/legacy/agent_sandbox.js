"use strict";

const LazarusWasm = require('./lazarus_wasm');
const AIOversoul = require('./oversoul_slm');
const TelemetryLedger = require('./telemetry_ledger');

/**
 * AGENTIC_SANDBOX Module (IP Gold)
 * --------------------------------
 * Cryptographically Restrained Autonomous AI Coder Environment.
 * Wraps LazarusWasm to allow AI to execute tasks while monitored by Oversoul.
 */
class AgentSandbox {
    constructor() {
        this.maxExecutionTimeMs = 5000;
    }

    /**
     * Executes AI-generated code within the isolated Wasm sandbox.
     */
    async executeAgentTask(agentId, taskPayload, wasmBuffer) {
        console.log(`[AGENT_SANDBOX] Analyzing intent for agent ${agentId}...`);
        
        // 1. Oversoul Intent Scan
        const intent = await AIOversoul.analyzeIntent([{ raw: `AGENT_${agentId}: ` + JSON.stringify(taskPayload) }]);
        
        if (intent.classification === 'MALICIOUS_EXFILTRATION') {
            console.error(`[OVERSOUL_INTERCEPT] Agent ${agentId} attempted exfiltration. Shredding agent context.`);
            TelemetryLedger.log("AGENT_TERMINATED", { agentId, reason: intent.reasoning });
            return { success: false, error: "KERNEL_INTERVENTION: Agent context terminated." };
        }

        console.log(`[AGENT_SANDBOX] Intent cleared. Booting Wasm isolation for ${agentId}...`);

        // 2. Barren Compute Execution
        // We supply highly restricted imports. The agent cannot access the host filesystem or network.
        const restrictedImports = {
            env: {
                log: () => { /* allow benign logging */ },
                abort: () => { throw new Error("Agent Wasm Aborted"); }
            }
        };

        const result = await LazarusWasm.execute(wasmBuffer, restrictedImports);
        
        TelemetryLedger.log("AGENT_EXECUTION_COMPLETE", { agentId, success: result.success });
        
        return result;
    }
}

module.exports = new AgentSandbox();
