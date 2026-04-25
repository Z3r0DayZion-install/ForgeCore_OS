"use strict";

/**
 * BASE ENGINE SDK v1.0
 * The scaffold for creating new Sovereign propulsion and field engines.
 */

class BaseEngine {
    constructor(name, version) {
        this.name = name;
        this.version = version;
    }

    /**
     * Define the expected schema for the artifact. 
     * To be leveraged by Intent Parser.
     */
    getSchema() {
        return {
            type: "object",
            properties: {
                target: { type: "string" },
                intensity: { type: "number" }
            },
            required: ["target"]
        };
    }

    /**
     * Main execution logic. Must be overridden.
     */
    async execute(artifact, emitTelemetry = null) {
        throw new Error("Execute method not implemented by engine subclass.");
    }
}

// To be used by external developers: 
// module.exports = class MyEngine extends BaseEngine { ... }

module.exports = BaseEngine;
