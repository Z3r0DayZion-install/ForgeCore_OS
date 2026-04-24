import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Battery,
  Command,
  Cpu,
  Folder,
  Globe,
  HardDrive,
  Maximize2,
  Minimize2,
  Shield,
  X,
  Zap
} from 'lucide-react';

type DesktopWindows = {
  explorer: boolean;
  vpn: boolean;
  panel: boolean;
};

type DesktopStatePayload = {
  lastOperation?: {
    status?: string;
  };
  settings?: {
    desktop?: {
      windows?: DesktopWindows;
      commandDraft?: string;
    };
  };
};

type NeuralOSBridge = {
  shell?: {
    execute?: (cmd: string) => Promise<{ response?: string }>;
  };
  core?: {
    getSeal?: () => Promise<string>;
  };
  state?: {
    get?: () => Promise<DesktopStatePayload>;
    set?: (patch: DesktopStatePayload) => void;
    onUpdate?: (callback: (state: DesktopStatePayload) => void) => (() => void) | void;
  };
  system?: {
    launch?: (path: string) => Promise<{ success?: boolean; error?: string }>;
    metrics?: () => Promise<{ cpu?: number; ram?: number; battery?: number }>;
  };
  vpn?: {
    start?: (config: string) => Promise<{ success?: boolean }>;
    stop?: () => Promise<{ success?: boolean }>;
    status?: () => Promise<string>;
  };
};

declare global {
  interface Window {
    neuralos?: NeuralOSBridge;
  }
}

const DEFAULT_WINDOWS: DesktopWindows = {
  explorer: true,
  vpn: false,
  panel: false
};

function isDesktopWindows(value: unknown): value is DesktopWindows {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as DesktopWindows;
  return (
    typeof candidate.explorer === 'boolean' &&
    typeof candidate.vpn === 'boolean' &&
    typeof candidate.panel === 'boolean'
  );
}

function sameWindows(a: DesktopWindows, b: DesktopWindows) {
  return a.explorer === b.explorer && a.vpn === b.vpn && a.panel === b.panel;
}

type OSWindowProps = {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  defaultPos?: { x: number; y: number };
};

const OSWindow = ({ title, icon: Icon, children, isOpen, onClose, defaultPos = { x: 100, y: 100 } }: OSWindowProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="absolute bg-neural-900/95 backdrop-blur-3xl border border-neural-800 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-xl overflow-hidden flex flex-col"
      style={{ top: defaultPos.y, left: defaultPos.x, width: '900px', height: '600px', zIndex: 50 }}
    >
      <div className="h-11 bg-neural-800/40 border-b border-neural-700 flex items-center justify-between px-4 cursor-move select-none">
        <div className="flex items-center gap-2.5">
          <Icon size={16} className="text-neural-green" />
          <span className="font-mono text-[10px] font-black text-gray-200 uppercase tracking-[0.2em]">{title}</span>
        </div>
        <div className="flex gap-4">
          <button className="text-gray-500 hover:text-white transition-colors">
            <Minimize2 size={14} />
          </button>
          <button className="text-gray-500 hover:text-white transition-colors">
            <Maximize2 size={14} />
          </button>
          <button onClick={onClose} className="text-neural-red hover:text-red-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-black/20">{children}</div>
    </div>
  );
};

const VIPNPanel = () => {
  const [status, setStatus] = useState('OFFLINE');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const nextStatus = await window.neuralos?.vpn?.status?.();
        if (mounted && typeof nextStatus === 'string') {
          setStatus(nextStatus);
        }
      } catch {
        if (mounted) {
          setStatus('OFFLINE');
        }
      }
    };

    void checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleVPN = async () => {
    setIsConnecting(true);
    try {
      if (status === 'OFFLINE') {
        const res = await window.neuralos?.vpn?.start?.('{"node":"Oasis-Prime"}');
        if (res?.success) {
          setStatus('CONNECTED');
        }
      } else {
        const res = await window.neuralos?.vpn?.stop?.();
        if (res?.success) {
          setStatus('OFFLINE');
        }
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="p-12 h-full flex flex-col items-center justify-center bg-gradient-to-br from-neural-900 via-black to-neural-800/20">
      <div
        className={`w-40 h-40 rounded-full border-2 flex items-center justify-center transition-all duration-1000 ${
          status === 'CONNECTED'
            ? 'border-neural-green shadow-[0_0_50px_rgba(0,255,0,0.15)]'
            : 'border-neural-red shadow-[0_0_50px_rgba(255,0,0,0.1)]'
        }`}
      >
        <Globe size={64} className={status === 'CONNECTED' ? 'text-neural-green animate-pulse' : 'text-neural-red'} />
      </div>
      <h2 className={`mt-8 font-mono font-black text-3xl tracking-tighter ${status === 'CONNECTED' ? 'text-neural-green' : 'text-neural-red'}`}>
        {status}
      </h2>
      <div className="mt-3 text-gray-500 font-mono text-[10px] uppercase tracking-[0.4em] font-bold">
        WFP_NETWORK_LOCK: {status === 'CONNECTED' ? 'ENGAGED' : 'READY'}
      </div>

      <button
        onClick={toggleVPN}
        disabled={isConnecting}
        className={`mt-12 px-16 py-4 rounded-full font-mono text-sm font-black border transition-all duration-300 ${
          status === 'CONNECTED'
            ? 'bg-neural-green text-black border-neural-green hover:shadow-[0_0_30px_rgba(0,255,0,0.4)]'
            : 'bg-transparent text-neural-red border-neural-red hover:bg-neural-red hover:text-white'
        }`}
      >
        {isConnecting ? 'INITIALIZING_TUNNEL...' : status === 'OFFLINE' ? 'SECURE_CONNECTION' : 'DISCONNECT_NODE'}
      </button>
    </div>
  );
};

function App() {
  const [windows, setWindows] = useState<DesktopWindows>(DEFAULT_WINDOWS);
  const [seal, setSeal] = useState('...');
  const [commandInput, setCommandInput] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [operationToast, setOperationToast] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [metrics, setMetrics] = useState({ cpu: 0, ram: 0, battery: 100 });
  const skipInitialPersist = useRef(true);
  const skipInitialDraftPersist = useRef(true);
  const draftDirtyRef = useRef(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const saved = await window.neuralos?.state?.get?.();
        const savedWindows = saved?.settings?.desktop?.windows;
        const savedDraft = saved?.settings?.desktop?.commandDraft;

        if (!cancelled && isDesktopWindows(savedWindows)) {
          setWindows(savedWindows);
        }
        if (!cancelled && typeof savedDraft === 'string') {
          setCommandInput(savedDraft);
          draftDirtyRef.current = false;
        }
      } catch {
        // Ignore hydration failure and keep defaults.
      } finally {
        if (!cancelled) {
          setSettingsReady(true);
        }
      }
    };

    void hydrate();

    const unsubscribe = window.neuralos?.state?.onUpdate?.((nextState) => {
      const nextWindows = nextState?.settings?.desktop?.windows;
      const nextDraft = nextState?.settings?.desktop?.commandDraft;
      const operationStatus = nextState?.lastOperation?.status;

      if (isDesktopWindows(nextWindows)) {
        setWindows((current) => (sameWindows(current, nextWindows) ? current : nextWindows));
      }

      if (typeof nextDraft === 'string') {
        if (!draftDirtyRef.current) {
          setCommandInput((current) => (current === nextDraft ? current : nextDraft));
        }
      }

      if (typeof operationStatus === 'string' && operationStatus.length > 0) {
        setOperationToast(operationStatus);
        if (toastTimer.current !== null) {
          window.clearTimeout(toastTimer.current);
        }
        toastTimer.current = window.setTimeout(() => setOperationToast(''), 5000);
      }
    });

    return () => {
      cancelled = true;
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!settingsReady || !window.neuralos?.state?.set) {
      return undefined;
    }

    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      window.neuralos?.state?.set?.({
        settings: {
          desktop: {
            windows
          }
        }
      });
    }, 120);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [windows, settingsReady]);

  useEffect(() => {
    if (!settingsReady || !window.neuralos?.state?.set) {
      return undefined;
    }

    if (skipInitialDraftPersist.current) {
      skipInitialDraftPersist.current = false;
      return undefined;
    }

    if (!draftDirtyRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      window.neuralos?.state?.set?.({
        settings: {
          desktop: {
            commandDraft: commandInput
          }
        }
      });
      draftDirtyRef.current = false;
    }, 120);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [commandInput, settingsReady]);

  useEffect(() => {
    let mounted = true;

    const fetchMetrics = async () => {
      try {
        const nextMetrics = await window.neuralos?.system?.metrics?.();
        if (!mounted || !nextMetrics) {
          return;
        }
        setMetrics({
          cpu: Number(nextMetrics.cpu || 0),
          ram: Number(nextMetrics.ram || 0),
          battery: Number(nextMetrics.battery ?? 100)
        });
      } catch {
        if (mounted) {
          setMetrics({ cpu: 0, ram: 0, battery: 100 });
        }
      }
    };

    void fetchMetrics();
    const interval = window.setInterval(fetchMetrics, 2000);

    void window.neuralos?.core?.getSeal?.().then((nextSeal) => {
      if (mounted && typeof nextSeal === 'string' && nextSeal.length > 0) {
        setSeal(nextSeal);
      }
    });

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleCommand = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!commandInput.trim()) {
      return;
    }

    setIsTyping(true);
    try {
      const result = await window.neuralos?.shell?.execute?.(commandInput);
      setAiResponse(result?.response || 'COMMAND_PIPELINE_ERROR');
      draftDirtyRef.current = true;
      setCommandInput('');
      window.setTimeout(() => setAiResponse(''), 8000);
    } catch {
      setAiResponse('COMMAND_PIPELINE_ERROR');
    } finally {
      setIsTyping(false);
    }
  };

  const launchApp = async (appPath: string) => {
    try {
      const result = await window.neuralos?.system?.launch?.(appPath);
      if (!result?.success) {
        setAiResponse(result?.error || 'NATIVE_LAUNCH_FAILED');
        window.setTimeout(() => setAiResponse(''), 6000);
      }
    } catch {
      setAiResponse('NATIVE_LAUNCH_FAILED');
      window.setTimeout(() => setAiResponse(''), 6000);
    }
  };

  const openWindow = (name: keyof DesktopWindows) => {
    setWindows((current) => ({ ...current, [name]: true }));
  };

  const closeWindow = (name: keyof DesktopWindows) => {
    setWindows((current) => ({ ...current, [name]: false }));
  };

  return (
    <div className="h-screen w-screen bg-[#020202] text-white overflow-hidden relative select-none font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0a0a0a_0%,#020202_100%)] opacity-100 z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20 z-0" />

      <div className="absolute top-12 left-12 grid grid-cols-1 gap-10 z-10 text-center">
        <div onClick={() => openWindow('explorer')} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-5 bg-neural-800/30 rounded-2xl border border-white/5 group-hover:bg-neural-700/50 transition-all shadow-2xl backdrop-blur-md">
            <Folder size={36} className="text-neural-blue" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest font-black uppercase">Vault</span>
        </div>
        <div onClick={() => launchApp('calc.exe')} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-5 bg-neural-800/30 rounded-2xl border border-white/5 group-hover:bg-neural-700/50 transition-all shadow-2xl backdrop-blur-md">
            <Activity size={36} className="text-neural-green" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest font-black uppercase">Calculator</span>
        </div>
        <div onClick={() => launchApp('notepad.exe')} className="flex flex-col items-center gap-2 group cursor-pointer">
          <div className="p-5 bg-neural-800/30 rounded-2xl border border-white/5 group-hover:bg-neural-700/50 transition-all shadow-2xl backdrop-blur-md">
            <HardDrive size={36} className="text-neural-red" />
          </div>
          <span className="text-[10px] font-mono text-gray-400 group-hover:text-white tracking-widest font-black uppercase">Notepad</span>
        </div>
      </div>

      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] z-[100] flex flex-col items-center">
        <form
          onSubmit={handleCommand}
          className={`w-full bg-neural-800/60 backdrop-blur-2xl border rounded-full flex items-center px-8 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all ${
            isTyping ? 'border-neural-blue' : 'border-white/10 hover:border-neural-green/50'
          }`}
        >
          <Command size={20} className={isTyping ? 'text-neural-blue animate-spin' : 'text-neural-green mr-5'} />
          <input
            type="text"
            value={commandInput}
            onChange={(event) => {
              draftDirtyRef.current = true;
              setCommandInput(event.target.value);
            }}
            placeholder="NEURALSHELL // SYSTEM_OVERRIDE_ENABLED"
            className="bg-transparent border-none outline-none flex-1 font-mono text-xs text-neural-green uppercase tracking-widest font-bold"
          />
        </form>
        {aiResponse && (
          <div className="mt-4 bg-neural-900/80 border border-neural-800 px-8 py-3 rounded-2xl backdrop-blur-3xl animate-in fade-in slide-in-from-top-4 duration-500">
            <span className="font-mono text-[11px] text-neural-blue uppercase tracking-widest font-bold">{aiResponse}</span>
          </div>
        )}
      </div>

      {operationToast && (
        <div className="absolute top-24 right-10 z-[120] bg-neural-900/90 border border-neural-green/40 px-5 py-3 rounded-xl backdrop-blur-2xl">
          <span className="font-mono text-[11px] text-neural-green uppercase tracking-widest font-black">{operationToast}</span>
        </div>
      )}

      <OSWindow
        title="VIPN™ // Native_KillSwitch"
        icon={Shield}
        isOpen={windows.vpn}
        onClose={() => closeWindow('vpn')}
        defaultPos={{ x: 400, y: 220 }}
      >
        <VIPNPanel />
      </OSWindow>
      <OSWindow title="XXXPLORER™ // Dual_Pane_Lineage" icon={Folder} isOpen={windows.explorer} onClose={() => closeWindow('explorer')} defaultPos={{ x: 180, y: 160 }}>
        <iframe src="../../../modules/xxxplorer/dist/index.html" className="w-full h-full border-none" />
      </OSWindow>
      <OSWindow title="VaultPanel+ // Cockpit" icon={Zap} isOpen={windows.panel} onClose={() => closeWindow('panel')} defaultPos={{ x: 600, y: 100 }}>
        <iframe src="../../../modules/vaultpanel-plus/dist/index.html" className="w-full h-full border-none" />
      </OSWindow>

      <div className="absolute bottom-0 left-0 right-0 h-14 bg-black/40 backdrop-blur-3xl border-t border-white/5 flex items-center px-8 justify-between z-[1000]">
        <div className="flex items-center gap-10">
          <Shield size={22} className="text-neural-green drop-shadow-[0_0_8px_rgba(0,255,0,0.4)] cursor-pointer" />
          <div className="flex gap-8">
            <Folder onClick={() => openWindow('explorer')} size={20} className="text-gray-500 hover:text-neural-blue cursor-pointer" />
            <Globe onClick={() => openWindow('vpn')} size={20} className="text-gray-500 hover:text-neural-green cursor-pointer" />
            <Zap onClick={() => openWindow('panel')} size={20} className="text-gray-500 hover:text-neural-green cursor-pointer" />
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="flex gap-6 font-mono text-[10px] text-gray-500 font-black">
            <div className="flex items-center gap-2">
              <Cpu size={12} className="text-neural-blue" /> {metrics.cpu}%
            </div>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-neural-green" /> {metrics.ram}%
            </div>
            <div className="flex items-center gap-2">
              <Battery size={12} className="text-neural-green" /> {metrics.battery}%
            </div>
          </div>
          <div className="h-7 w-[1px] bg-white/5" />
          <div className="flex flex-col items-end font-mono">
            <span className="text-[10px] text-neural-green font-black">SOVEREIGN_V0.1</span>
            <span className="text-[9px] text-gray-600 uppercase">Seal: {seal.substring(0, 16)}</span>
          </div>
          <div className="h-7 w-[1px] bg-white/5" />
          <div className="text-neural-green font-mono text-sm font-black tabular-nums">{new Date().toLocaleTimeString()}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
