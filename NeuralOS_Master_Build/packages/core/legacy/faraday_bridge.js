"use strict";

const crypto = require('crypto');

/**
 * FARADAY BRIDGE (IP Gold - Tier 7)
 * ---------------------------------
 * Air-Gapped Optical Data Diode.
 * Converts critical state (Merkle CIDs, ZKP Proofs) into sequential 
 * optical payloads for transmission across physically isolated networks.
 */
class FaradayBridge {
    constructor() {
        this.chunkSize = 256; // Bytes per optical frame
    }

    /**
     * Encodes a Sovereign Payload into a sequence of optical frames.
     * In the UI, these would be rendered as a rapidly cycling QR code.
     */
    encodeOpticalStream(payloadObject) {
        console.log("[FARADAY] Encoding state into Optical Diode Stream...");
        const jsonStr = JSON.stringify(payloadObject);
        const buffer = Buffer.from(jsonStr, 'utf8');
        
        const frames = [];
        const totalFrames = Math.ceil(buffer.length / this.chunkSize);
        const streamId = crypto.randomBytes(4).toString('hex');

        for (let i = 0; i < totalFrames; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, buffer.length);
            const chunk = buffer.subarray(start, end).toString('base64');
            
            // Frame Header: [StreamID]:[Index]/[Total]:[Data]
            frames.push(`FC_OPTICAL|${streamId}|${i}|${totalFrames}|${chunk}`);
        }

        return {
            streamId,
            frameCount: frames.length,
            opticalFrames: frames
        };
    }

    /**
     * Reassembles frames captured via webcam.
     */
    decodeOpticalStream(frames) {
        console.log("[FARADAY] Decoding Optical Stream...");
        // Assumes frames are correctly ordered for this prototype
        let base64Data = "";
        for (const frame of frames) {
            const parts = frame.split('|');
            if (parts[0] !== 'FC_OPTICAL') throw new Error("Invalid optical frame header.");
            base64Data += parts[4];
        }

        const jsonStr = Buffer.from(base64Data, 'base64').toString('utf8');
        return JSON.parse(jsonStr);
    }
}

module.exports = new FaradayBridge();
