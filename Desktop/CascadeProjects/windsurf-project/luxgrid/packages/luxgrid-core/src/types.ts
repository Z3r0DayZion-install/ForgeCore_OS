/**
 * LuxGrid Core Types
 * Core type definitions for the RGB engine
 */

// OpenRGB Connection Types
export interface OpenRgbConfig {
  host: string;
  port: number;
  clientName: string;
  timeoutMs: number;
}

export interface OpenRgbConnectionResult {
  success: boolean;
  protocolVersion?: number;
  error?: string;
  errorCode?: string | null;
}

export interface OpenRgbStatus {
  connected: boolean;
  mode: 'openrgb' | 'simulator' | 'disconnected' | 'unavailable';
  host: string;
  port: number;
  protocolVersion?: number;
  lastError?: string;
}

// RGB Device Types
export interface RgbDevice {
  id: string;
  index: number;
  name: string;
  type: 'keyboard' | 'mouse' | 'headset' | 'mousepad' | 'lightstrip' | 'unknown';
  ledCount: number;
  zoneCount: number;
  ledMapping?: RgbLed[];
}

export interface RgbLed {
  index: number;
  name?: string;
  position?: {
    row?: number;
    col?: number;
  };
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface RgbCommandResult {
  success: boolean;
  deviceId: string;
  command: string;
  error?: string;
  timestamp: string;
}

// Zone Types
export interface LuxGridZone {
  id: string;
  name: string;
  deviceId: string;
  keys: LuxGridKeyTarget[];
  source: LuxGridSource;
  effect: LuxGridEffect;
  palette: LuxGridPalette;
  enabled: boolean;
  priority: number;
}

export interface LuxGridKeyTarget {
  label: string;
  ledIndex?: number;
  row?: number;
  col?: number;
  column?: number; // alias for col
}

export type LuxGridSource =
  | { type: 'static'; color: string }
  | { type: 'cpu_temp'; minC: number; maxC: number }
  | { type: 'gpu_temp'; minC: number; maxC: number }
  | { type: 'cpu_usage'; min: number; max: number }
  | { type: 'memory_usage'; min: number; max: number }
  | { type: 'battery'; min: number; max: number }
  | { type: 'timer_progress'; eventChannel: string }
  | { type: 'timer_remaining'; eventChannel: string }
  | { type: 'audio_level' }
  | { type: 'network_activity' }
  | { type: 'custom_event'; eventName: string };

export type LuxGridEffect =
  | { type: 'solid' }
  | { type: 'gradient' }
  | { type: 'pulse'; speedMs: number }
  | { type: 'blink'; speedMs: number }
  | { type: 'breath'; speedMs: number }
  | { type: 'progress_fill'; direction: 'left_to_right' | 'right_to_left' | 'center_out' }
  | { type: 'warning_flash'; threshold: number };

export type LuxGridPalette =
  | { type: 'heat'; cool: string; normal: string; warm: string; hot: string; critical: string }
  | { type: 'cyber'; primary: string; secondary: string; danger: string }
  | { type: 'night'; start: string; end: string }
  | { type: 'custom'; stops: { value: number; color: string }[] };

// Profile Types
export interface LuxGridProfile {
  id: string;
  name: string;
  description?: string;
  zones: LuxGridZone[];
  createdAt: string;
  updatedAt: string;
  version: string;
}

// Metric Types
export interface MetricResult<T> {
  available: boolean;
  value?: T;
  source?: string;
  error?: string;
}

export interface CpuMetrics {
  usage: MetricResult<number>;
  temperature?: MetricResult<number>;
}

export interface GpuMetrics {
  usage?: MetricResult<number>;
  temperature?: MetricResult<number>;
}

export interface MemoryMetrics {
  usagePercent: MetricResult<number>;
  usedBytes?: MetricResult<number>;
  totalBytes?: MetricResult<number>;
}

export interface BatteryMetrics {
  level: MetricResult<number>;
  charging?: MetricResult<boolean>;
}

// Validation Proof Types
export interface DeviceProof {
  timestamp: string;
  mode: 'openrgb' | 'simulator' | 'disconnected' | 'unavailable';
  connected: boolean;
  host: string;
  port: number;
  deviceCount: number;
  devices: RgbDevice[];
  testCommand?: {
    target: string;
    color: string;
    result: 'success' | 'failed';
    error?: string;
  };
}

// Default configs
export const DEFAULT_OPENRGB_CONFIG: OpenRgbConfig = {
  host: '127.0.0.1',
  port: 6742,
  clientName: 'LuxGrid',
  timeoutMs: 5000,
};
