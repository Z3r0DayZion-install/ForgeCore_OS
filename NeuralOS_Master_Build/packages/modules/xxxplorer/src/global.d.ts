type NeuralOsFileRecord = {
  name: string;
  type: 'file' | 'folder';
  path: string;
};

type NeuralOsGlobalState = Record<string, unknown>;

declare global {
  interface Window {
    neuralos: {
      fs: {
        ls: (dir: string) => Promise<NeuralOsFileRecord[]>;
        verify: (filePath: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
        vaultMove: (src: string, dest: string) => Promise<{ success: boolean; hash?: string; error?: string }>;
      };
      vpn: {
        status: () => Promise<string>;
        start: (config: unknown) => Promise<{ success: boolean; error?: string }>;
      };
      state: {
        get: () => Promise<NeuralOsGlobalState>;
        set: (patch: NeuralOsGlobalState) => void;
        onUpdate: (callback: (state: NeuralOsGlobalState) => void) => (() => void) | void;
      };
    };
  }
}

export {};
