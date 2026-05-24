/**
 * OpenRGB Client
 * Handles TCP communication with OpenRGB SDK server
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';
import type { OpenRgbConfig, OpenRgbConnectionResult, OpenRgbStatus, RgbDevice, RgbColor, RgbCommandResult } from '../types.js';
import { DEFAULT_OPENRGB_CONFIG } from '../types.js';

export class OpenRgbClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: OpenRgbConfig;
  private status: OpenRgbStatus;
  private deviceList: RgbDevice[] = [];
  private isConnected = false;

  constructor(config: Partial<OpenRgbConfig> = {}) {
    super();
    this.config = { ...DEFAULT_OPENRGB_CONFIG, ...config };
    this.status = {
      connected: false,
      mode: 'disconnected',
      host: this.config.host,
      port: this.config.port,
    };
  }

  async connect(): Promise<OpenRgbConnectionResult> {
    return new Promise((resolve) => {
      let resolved = false;
      
      const doResolve = (result: OpenRgbConnectionResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };
      
      try {
        this.socket = new Socket();
        this.socket.setTimeout(this.config.timeoutMs);

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.status.connected = true;
          this.status.mode = 'openrgb';
          this.emit('connected');

          // Send OpenRGB SDK handshake: "ORGB" + protocol version (4 bytes, little-endian)
          const header = Buffer.from('ORGB');
          const version = Buffer.alloc(4);
          version.writeUInt32LE(4, 0); // Protocol version 4
          this.socket?.write(Buffer.concat([header, version]));
          
          // Server should respond with protocol version, wait for it
        });

        this.socket.on('data', (data: Buffer) => {
          // Check if this is protocol version response (command 0)
          if (data.length >= 8 && data.readUInt32LE(0) === 0) {
            const version = data.readUInt32LE(4);
            this.status.protocolVersion = version;
            doResolve({ success: true, protocolVersion: version });
          }
          this.handleResponse(data);
        });

        this.socket.on('error', (err: any) => {
          const code = err && (err.code || err.errno) ? (err.code || err.errno) : null;
          const msg = err instanceof Error ? err.message : String(err);
          this.status.lastError = msg;
          this.emit('error', err);
          try {
            this.socket?.destroy();
          } catch (e) {
            // ignore destroy errors
          }
          doResolve({ success: false, error: msg, errorCode: code });
        });

        this.socket.on('close', () => {
          this.isConnected = false;
          this.status.connected = false;
          this.status.mode = 'disconnected';
          this.emit('disconnected');
        });

        this.socket.on('timeout', () => {
          this.status.lastError = 'Connection timeout';
          try {
            this.socket?.destroy();
          } catch (e) {}
          doResolve({ success: false, error: 'Connection timeout', errorCode: 'ETIMEDOUT' });
        });

        this.socket.connect(this.config.port, this.config.host);
        
        // Timeout fallback
        setTimeout(() => {
          if (this.isConnected && !resolved) {
            // Connected but no response - might be old protocol version
            doResolve({ success: true, protocolVersion: 4 });
          } else if (!resolved) {
            doResolve({ success: false, error: 'Connection timeout - no response from server' });
          }
        }, this.config.timeoutMs || 5000);

      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const code = error && (error.code || error.errno) ? (error.code || error.errno) : null;
        this.status.lastError = errorMsg;
        try {
          this.socket?.destroy();
        } catch (e) {}
        doResolve({ success: false, error: errorMsg, errorCode: code });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
    this.status.connected = false;
    this.status.mode = 'disconnected';
  }

  getStatus(): OpenRgbStatus {
    return { ...this.status };
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async getDeviceCount(): Promise<number> {
    if (!this.isConnected) return 0;
    
    return new Promise((resolve) => {
      // Command 0x01: Get device count
      this.sendCommand(0x01, Buffer.alloc(0));
      
      const timeout = setTimeout(() => resolve(0), 3000);
      
      this.once('deviceCount', (count: number) => {
        clearTimeout(timeout);
        resolve(count);
      });
    });
  }

  async getDeviceList(): Promise<RgbDevice[]> {
    if (!this.isConnected) return [];

    const count = await this.getDeviceCount();
    const devices: RgbDevice[] = [];

    for (let i = 0; i < count; i++) {
      const device = await this.getDeviceData(i);
      if (device) {
        devices.push(device);
      }
    }

    this.deviceList = devices;
    return devices;
  }

  private async getDeviceData(index: number): Promise<RgbDevice | null> {
    return new Promise((resolve) => {
      // Command 0x02: Get device data
      const deviceIdBuffer = Buffer.alloc(4);
      deviceIdBuffer.writeUInt32LE(index, 0);
      this.sendCommand(0x02, deviceIdBuffer);

      const timeout = setTimeout(() => resolve(null), 3000);

      this.once(`deviceData_${index}`, (device: RgbDevice) => {
        clearTimeout(timeout);
        resolve(device);
      });
    });
  }

  async setDeviceColor(deviceIndex: number, color: RgbColor): Promise<RgbCommandResult> {
    if (!this.isConnected) {
      return {
        success: false,
        deviceId: deviceIndex.toString(),
        command: 'setDeviceColor',
        error: 'Not connected to OpenRGB',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Get LED count first
      const device = this.deviceList.find(d => d.index === deviceIndex);
      const ledCount = device?.ledCount || 100;

      // Build LED data: Command 0x03 (Update LEDs)
      const header = Buffer.alloc(5);
      header.writeUInt8(0x03, 0); // Command
      header.writeUInt32LE(deviceIndex, 1); // Device ID

      const ledCountBuf = Buffer.alloc(4);
      ledCountBuf.writeUInt32LE(ledCount, 0);

      // LED colors: RGB for each LED
      const colorData = Buffer.alloc(ledCount * 3);
      for (let i = 0; i < ledCount; i++) {
        colorData.writeUInt8(color.r, i * 3);
        colorData.writeUInt8(color.g, i * 3 + 1);
        colorData.writeUInt8(color.b, i * 3 + 2);
      }

      const fullBuffer = Buffer.concat([header, ledCountBuf, colorData]);
      this.socket?.write(fullBuffer);

      return {
        success: true,
        deviceId: deviceIndex.toString(),
        command: 'setDeviceColor',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        deviceId: deviceIndex.toString(),
        command: 'setDeviceColor',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async setLedColor(deviceIndex: number, ledIndex: number, color: RgbColor): Promise<RgbCommandResult> {
    if (!this.isConnected) {
      return {
        success: false,
        deviceId: `${deviceIndex}-${ledIndex}`,
        command: 'setLedColor',
        error: 'Not connected to OpenRGB',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Command 0x03 with single LED
      const header = Buffer.alloc(5);
      header.writeUInt8(0x03, 0);
      header.writeUInt32LE(deviceIndex, 1);

      const ledCountBuf = Buffer.alloc(4);
      ledCountBuf.writeUInt32LE(1, 0); // Single LED

      const colorData = Buffer.from([color.r, color.g, color.b]);
      const fullBuffer = Buffer.concat([header, ledCountBuf, colorData]);
      
      this.socket?.write(fullBuffer);

      return {
        success: true,
        deviceId: `${deviceIndex}-${ledIndex}`,
        command: 'setLedColor',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        deviceId: `${deviceIndex}-${ledIndex}`,
        command: 'setLedColor',
        error: errorMsg,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private sendCommand(commandId: number, data: Buffer): void {
    if (!this.socket || !this.isConnected) return;

    const header = Buffer.alloc(4);
    header.writeUInt32LE(commandId, 0);
    
    const packet = Buffer.concat([header, data]);
    this.socket.write(packet);
  }

  private handleResponse(data: Buffer): void {
    // Parse OpenRGB protocol responses
    if (data.length < 4) return;

    const commandId = data.readUInt32LE(0);

    switch (commandId) {
      case 0x00: // Protocol version
        const version = data.readUInt32LE(4);
        this.emit('protocolVersion', version);
        break;

      case 0x01: // Device count
        const count = data.readUInt32LE(4);
        this.emit('deviceCount', count);
        break;

      case 0x02: // Device data
        // Parse device data (simplified)
        const deviceIndex = data.readUInt32LE(4);
        const deviceNameLen = data.readUInt16LE(8);
        const deviceName = data.slice(10, 10 + deviceNameLen).toString('utf-8');
        
        const device: RgbDevice = {
          id: `device-${deviceIndex}`,
          index: deviceIndex,
          name: deviceName,
          type: 'keyboard', // Would parse from actual data
          ledCount: 104, // Would parse from actual data
          zoneCount: 1,
        };
        
        this.emit(`deviceData_${deviceIndex}`, device);
        break;
    }
  }
}
