/**
 * XXXplorer Sovereign IPC Bridge Interface
 * Wraps electron contextBridge for React components.
 */

export type GlobalStatePatch = Record<string, unknown>;

export const sovereignFS = {
  list: async (path: string) => window.neuralos.fs.ls(path),
  verify: async (path: string) => window.neuralos.fs.verify(path),
  move: async (src: string, dst: string) => window.neuralos.fs.vaultMove(src, dst),
  hash: async (path: string) => window.neuralos.fs.verify(path)
};

export const sovereignVPN = {
  status: async () => window.neuralos.vpn.status(),
  start: async (config: unknown) => window.neuralos.vpn.start(config)
};

export const sovereignState = {
  get: async () => window.neuralos.state.get(),
  set: (patch: GlobalStatePatch) => window.neuralos.state.set(patch),
  onUpdate: (callback: (state: unknown) => void) => window.neuralos.state.onUpdate(callback)
};
