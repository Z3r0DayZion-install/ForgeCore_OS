/**
 * OpenRGB Client
 * Handles TCP communication with OpenRGB SDK server
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';
import type { OpenRgbConfig, OpenRgbConnectionResult, OpenRgbStatus, RgbDevice, RgbColor, RgbCommandResult } from '../types.js';
import { DEFAULT_OPENRGB_CONFIG } from '../types.js';

const OPENRGB_PACKET_MAGIC = 'ORGB';
const PACKET_ID_REQUEST_CONTROLLER_COUNT = 0;
const PACKET_ID_REQUEST_CONTROLLER_DATA = 1;
const PACKET_ID_REQUEST_PROTOCOL_VERSION = 40;
const PACKET_ID_SET_CLIENT_NAME = 50;
const PACKET_ID_RGBCONTROLLER_UPDATELEDS = 1050;
const PACKET_ID_RGBCONTROLLER_UPDATEZONELEDS = 1051;
const PACKET_ID_RGBCONTROLLER_UPDATESINGLELED = 1052;

export class OpenRgbClient extends EventEmitter {
  private socket: Socket | null = null;
  private config: OpenRgbConfig;
  private status: OpenRgbStatus;
  private deviceList: RgbDevice[] = [];
  private readBuffer = Buffer.alloc(0);
  private isConnected = false;
  private handshakeComplete = false;
  private clientName = 'LuxGrid';

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

          // Send OpenRGB SDK protocol version request packet.
          const payload = Buffer.alloc(4);
          payload.writeUInt32LE(4, 0);
          this.sendPacket(0, PACKET_ID_REQUEST_PROTOCOL_VERSION, payload);
        });

        this.socket.on('data', (data: Buffer) => {
          this.readBuffer = Buffer.concat([this.readBuffer, data]);
          this.parseIncomingData(doResolve);
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

  private parseIncomingData(doResolve?: (result: OpenRgbConnectionResult) => void): void {
    while (this.readBuffer.length >= 16) {
      if (this.readBuffer.toString('utf-8', 0, 4) !== OPENRGB_PACKET_MAGIC) {
        const magicIndex = this.readBuffer.indexOf(OPENRGB_PACKET_MAGIC, 1, 'utf-8');
        if (magicIndex === -1) {
          this.readBuffer = Buffer.alloc(0);
          break;
        }
        this.readBuffer = this.readBuffer.slice(magicIndex);
        if (this.readBuffer.length < 16) break;
      }

      const deviceIndex = this.readBuffer.readUInt32LE(4);
      const packetId = this.readBuffer.readUInt32LE(8);
      const packetSize = this.readBuffer.readUInt32LE(12);
      const totalLength = 16 + packetSize;

      if (this.readBuffer.length < totalLength) break;

      const payload = this.readBuffer.slice(16, totalLength);
      this.readBuffer = this.readBuffer.slice(totalLength);
      this.handleResponse(packetId, deviceIndex, payload, doResolve);
    }
  }

  private sendClientName(): void {
    if (!this.socket) return;

    const clientNameBuffer = Buffer.from(`${this.clientName}\0`, 'utf-8');
    this.sendPacket(0, PACKET_ID_SET_CLIENT_NAME, clientNameBuffer);
  }

  private buildPacketHeader(deviceIndex: number, packetId: number, payloadLength: number): Buffer {
    const header = Buffer.alloc(16);
    header.write(OPENRGB_PACKET_MAGIC, 0, 'utf-8');
    header.writeUInt32LE(deviceIndex, 4);
    header.writeUInt32LE(packetId, 8);
    header.writeUInt32LE(payloadLength, 12);
    return header;
  }

  private sendPacket(deviceIndex: number, packetId: number, payload: Buffer): void {
    if (!this.socket || !this.isConnected) return;
    const header = this.buildPacketHeader(deviceIndex, packetId, payload.length);
    this.socket.write(Buffer.concat([header, payload]));
  }

  private sendCommand(commandId: number, data: Buffer): void {
    this.sendPacket(0, commandId, data);
  }

  private handleResponse(commandId: number, deviceIndex: number, payload: Buffer, doResolve?: (result: OpenRgbConnectionResult) => void): void {
    switch (commandId) {
      case PACKET_ID_REQUEST_PROTOCOL_VERSION: {
        if (payload.length >= 4) {
          const version = payload.readUInt32LE(0);
          this.status.protocolVersion = version;
          this.emit('protocolVersion', version);

          if (!this.handshakeComplete) {
            this.sendClientName();
            this.handshakeComplete = true;
          }

          if (doResolve) {
            doResolve({ success: true, protocolVersion: version });
          }
        }
        break;
      }

      case PACKET_ID_REQUEST_CONTROLLER_COUNT: {
        if (payload.length >= 4) {
          const count = payload.readUInt32LE(0);
          this.emit('deviceCount', count);
        }
        break;
      }

      case PACKET_ID_REQUEST_CONTROLLER_DATA: {
        if (payload.length >= 10) {
          const type = payload.readInt32LE(4);
          const nameLen = payload.readUInt16LE(8);
          const nameStart = 10;
          const nameEnd = nameStart + nameLen;
          const deviceName = payload.slice(nameStart, nameEnd).toString('utf-8').replace(/\0/g, '');

          const device: RgbDevice = {
            id: `device-${deviceIndex}`,
            index: deviceIndex,
            name: deviceName,
            type: 'unknown',
            ledCount: 0,
            zoneCount: 0,
          };

          if (deviceName) {
            this.emit(`deviceData_${deviceIndex}`, device);
          }
        }
        break;
      }
    }
  }

  private encodeUInt32LE(value: number): number[] {
    return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff];
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
      this.sendPacket(0, PACKET_ID_REQUEST_CONTROLLER_COUNT, Buffer.alloc(0));
      
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
      const deviceIdBuffer = Buffer.alloc(4);
      deviceIdBuffer.writeUInt32LE(index, 0);
      this.sendPacket(index, PACKET_ID_REQUEST_CONTROLLER_DATA, deviceIdBuffer);

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

      // OpenRGB SDK Protocol: Update LEDs command (1050)
      // Packet format: [4 bytes device ID][4 bytes LED count][RGB data...]
      const deviceIdBuf = Buffer.alloc(4);
      deviceIdBuf.writeUInt32LE(deviceIndex, 0);

      const ledCountBuf = Buffer.alloc(4);
      ledCountBuf.writeUInt32LE(ledCount, 0);

      // LED colors: RGB for each LED
      const colorData = Buffer.alloc(ledCount * 3);
      for (let i = 0; i < ledCount; i++) {
        colorData.writeUInt8(color.r, i * 3);
        colorData.writeUInt8(color.g, i * 3 + 1);
        colorData.writeUInt8(color.b, i * 3 + 2);
      }

      const dataBuffer = Buffer.concat([deviceIdBuf, ledCountBuf, colorData]);
      this.sendPacket(deviceIndex, PACKET_ID_RGBCONTROLLER_UPDATELEDS, dataBuffer);

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
}
