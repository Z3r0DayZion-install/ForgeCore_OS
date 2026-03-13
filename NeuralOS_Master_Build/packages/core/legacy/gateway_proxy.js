const net = require('net');

/**
 * FORGECORE™ SECURE GATEWAY PROXY
 * Lightweight SOCKS5 Implementation for per-application secure routing.
 * Provides "VPN-like" functionality without OS-level network disruption.
 */
class GatewayProxy {
    constructor() {
        this.server = null;
        this.active = false;
        this.port = 9050;
        this.host = '127.0.0.1'; // Secure local binding to stay "non-invasive"
    }

    start(logCallback) {
        if (this.active) return;

        this.server = net.createServer(socket => {
            socket.once('data', data => {
                // SOCKS5 Handshake
                if (data[0] !== 0x05) return socket.end();

                // Response: SOCKS5, No Authentication Required
                socket.write(Buffer.from([0x05, 0x00]));

                socket.once('data', data => {
                    const cmd = data[1];
                    const atyp = data[3];

                    if (cmd !== 0x01) { // Only Support CONNECT command
                        return socket.end(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                    }

                    let dstAddr = '';
                    let dstPort = 0;
                    let offset = 4;

                    if (atyp === 0x01) { // IPv4
                        dstAddr = data.slice(offset, offset + 4).join('.');
                        dstPort = data.readUInt16BE(offset + 4);
                    } else if (atyp === 0x03) { // Domain Name
                        const addrLen = data[offset];
                        dstAddr = data.slice(offset + 1, offset + 1 + addrLen).toString();
                        dstPort = data.readUInt16BE(offset + 1 + addrLen);
                    } else if (atyp === 0x04) { // IPv6 (Unsupported for now)
                        return socket.end(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                    }

                    try {
                        const remote = net.connect(dstPort, dstAddr, () => {
                            // Tell client connection is successful
                            socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                            socket.pipe(remote);
                            remote.pipe(socket);

                            if (logCallback) logCallback(`Routing: ${dstAddr}:${dstPort}`, 'OK');
                        });

                        remote.on('error', (err) => {
                            if (logCallback) logCallback(`Relay error: ${err.message}`, 'ERR');
                            socket.end();
                        });

                        socket.on('error', () => remote.destroy());

                    } catch (err) {
                        if (logCallback) logCallback(`Proxy connection failure: ${err.message}`, 'ERR');
                        socket.end();
                    }
                });
            });

            socket.on('error', () => { }); // Catch-all for premature socket closes
        });

        this.server.on('error', (err) => {
            if (logCallback) logCallback(`Gateway Engine Error: ${err.message}`, 'CRITICAL');
            this.active = false;
        });

        this.server.listen(this.port, this.host, () => {
            this.active = true;
            if (logCallback) logCallback(`SECURE_CORE_GATEWAY: Proxy active on ${this.host}:${this.port}`, 'OK');
        });
    }

    stop(logCallback) {
        if (!this.active || !this.server) return;
        this.server.close(() => {
            this.active = false;
            if (logCallback) logCallback("SECURE_CORE_GATEWAY: Proxy engine terminated.", "SYS");
        });
    }

    getStatus() {
        return {
            active: this.active,
            port: this.port,
            host: this.host,
            protocol: 'SOCKS5'
        };
    }
}

module.exports = new GatewayProxy();
