import React, { useEffect, useRef, useState } from 'react';
import {
  Lock,
  Moon,
  RefreshCcw,
  Shield,
  ShieldCheck,
  Sun
} from 'lucide-react';
import { DualPane } from './DualPane';
import { sovereignFS, sovereignState } from './ipc';

type RootPath = '.' | './packages' | './memory' | './proof_bundle';

type FileItemRecord = {
  name: string;
  type: 'file' | 'folder';
  path: string;
  tier: number;
};

type XxplorerPrefs = {
  theme?: 'dark' | 'light';
  leftRootPath?: string;
  rightRootPath?: string;
};

type GlobalState = {
  settings?: {
    xxxplorer?: XxplorerPrefs;
  };
};

const ROOT_OPTIONS: RootPath[] = ['.', './packages', './memory', './proof_bundle'];

function normalizeRootPath(pathValue: unknown, fallback: RootPath): RootPath {
  if (typeof pathValue !== 'string') {
    return fallback;
  }
  return ROOT_OPTIONS.includes(pathValue as RootPath) ? (pathValue as RootPath) : fallback;
}

function extractPrefs(state: unknown): Required<XxplorerPrefs> {
  const source = (state as GlobalState)?.settings?.xxxplorer;
  const theme = source?.theme === 'light' ? 'light' : 'dark';
  return {
    theme,
    leftRootPath: normalizeRootPath(source?.leftRootPath, '.'),
    rightRootPath: normalizeRootPath(source?.rightRootPath, './packages')
  };
}

function formatPaneTitle(pathValue: RootPath, fallback: 'Sector_A' | 'Sector_B') {
  if (pathValue === '.') {
    return `${fallback}: root`;
  }
  return `${fallback}: ${pathValue.replace('./', '')}`;
}

const FileItem = ({
  name,
  type,
  path,
  tier = 1,
  userTier = 1,
  onSelect,
  onDragStart,
  onContextMenu
}: FileItemRecord & {
  userTier?: number;
  onSelect: (item: FileItemRecord) => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, item: FileItemRecord) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>, item: FileItemRecord) => void;
}) => {
  const isLocked = tier > userTier;
  return (
    <div
      draggable={!isLocked}
      onDragStart={(event) => onDragStart(event, { name, type, path, tier })}
      onContextMenu={(event) => !isLocked && onContextMenu(event, { name, type, path, tier })}
      onClick={() => !isLocked && onSelect({ name, type, path, tier })}
      className={`flex items-center justify-between p-2 hover:bg-neural-700/50 cursor-pointer border-b border-neural-800/30 group relative transition-all duration-200 ${
        isLocked ? 'overflow-hidden' : ''
      }`}
    >
      {isLocked && (
        <div className="absolute inset-0 backdrop-blur-[2px] bg-black/20 z-10 flex items-center justify-center">
          <Lock size={12} className="text-neural-red animate-pulse" />
        </div>
      )}
      <div className={`flex items-center gap-3 ${isLocked ? 'blur-[1px]' : ''}`}>
        <span className="font-mono text-sm group-hover:text-neural-green transition-colors truncate max-w-[220px] block">{name}</span>
      </div>
      <span className="text-[10px] text-gray-500 font-mono opacity-50 px-2">T{tier}</span>
    </div>
  );
};

function App() {
  const [leftFiles, setLeftFiles] = useState<FileItemRecord[]>([]);
  const [rightFiles, setRightFiles] = useState<FileItemRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItemRecord | null>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [leftRootPath, setLeftRootPath] = useState<RootPath>('.');
  const [rightRootPath, setRightRootPath] = useState<RootPath>('./packages');
  const [toast, setToast] = useState({ visible: false, msg: '' });
  const [settingsReady, setSettingsReady] = useState(false);
  const skipInitialPersist = useRef(true);
  const toastTimer = useRef<number | null>(null);
  const loadRequestRef = useRef(0);

  const showToast = (msg: string) => {
    setToast({ visible: true, msg });
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => setToast({ visible: false, msg: '' }), 3000);
  };

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const persistedState = await sovereignState.get();
        const prefs = extractPrefs(persistedState);
        if (!cancelled) {
          setTheme(prefs.theme);
          setLeftRootPath(normalizeRootPath(prefs.leftRootPath, '.'));
          setRightRootPath(normalizeRootPath(prefs.rightRootPath, './packages'));
        }
      } finally {
        if (!cancelled) {
          setSettingsReady(true);
        }
      }
    };

    void hydrate();

    const unsubscribe = sovereignState.onUpdate((nextState) => {
      const prefs = extractPrefs(nextState);
      setTheme((current) => (current === prefs.theme ? current : prefs.theme));
      setLeftRootPath((current) => (current === prefs.leftRootPath ? current : normalizeRootPath(prefs.leftRootPath, '.')));
      setRightRootPath((current) =>
        current === prefs.rightRootPath ? current : normalizeRootPath(prefs.rightRootPath, './packages')
      );
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
    if (!settingsReady) {
      return undefined;
    }

    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      sovereignState.set({
        settings: {
          xxxplorer: {
            theme,
            leftRootPath,
            rightRootPath
          }
        }
      });
    }, 120);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [theme, leftRootPath, rightRootPath, settingsReady]);

  const loadFiles = async () => {
    const requestId = ++loadRequestRef.current;
    try {
      const [left, right] = await Promise.all([
        sovereignFS.list(leftRootPath),
        sovereignFS.list(rightRootPath)
      ]);
      if (requestId !== loadRequestRef.current) {
        return;
      }
      const tiered = (files: { name: string; type: 'file' | 'folder'; path: string }[]): FileItemRecord[] =>
        files.map((fileItem) => ({ ...fileItem, tier: fileItem.name.includes('key') ? 2 : 1 }));
      setLeftFiles(tiered(left));
      setRightFiles(tiered(right));
    } catch {
      if (requestId === loadRequestRef.current) {
        showToast('SECTOR_SYNC_FAILED');
      }
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [leftRootPath, rightRootPath]);

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>, destDir: RootPath) => {
    event.preventDefault();
    const rawItem = event.dataTransfer.getData('item');
    if (!rawItem) {
      return;
    }

    const item = JSON.parse(rawItem) as FileItemRecord;
    const destPath = `${destDir}/${item.name}`;
    if (item.path === destPath) {
      return;
    }

    setIsVerifying(true);
    try {
      const result = await sovereignFS.move(item.path, destPath);
      if (result.success) {
        setFileHash(result.hash || 'NO_HASH_RETURNED');
        showToast('LINEAGE_CONFIRMED: INTEGRITY_ROOT_MATCH');
        await loadFiles();
        return;
      }
      setFileHash('MOVE_CRITICAL_ERROR');
      showToast('MOVE_CRITICAL_ERROR');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerify = async (file: FileItemRecord) => {
    setIsVerifying(true);
    try {
      const result = await sovereignFS.verify(file.path);
      if (result.success) {
        setFileHash(result.hash || 'NO_HASH_RETURNED');
      } else {
        setFileHash('ERROR');
        showToast('VERIFY_FAIL');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const renderFileList = (files: FileItemRecord[]) =>
    files.map((fileItem) => (
      <FileItem
        key={`${fileItem.path}:${fileItem.name}`}
        {...fileItem}
        onSelect={(item) => {
          setSelectedFile(item);
          void handleVerify(item);
        }}
        onDragStart={(event, item) => event.dataTransfer.setData('item', JSON.stringify(item))}
        onContextMenu={(event) => event.preventDefault()}
      />
    ));

  return (
    <div
      data-theme={theme}
      className={`h-screen w-screen flex flex-col font-sans select-none transition-colors duration-500 ${
        theme === 'dark' ? 'bg-neural-900 text-gray-200' : 'bg-gray-100 text-neural-900'
      }`}
    >
      {toast.visible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-neural-green text-black px-8 py-3 rounded-full font-mono text-xs font-black shadow-[0_0_20px_rgba(0,255,0,0.4)] animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} />
            {toast.msg}
          </div>
        </div>
      )}

      <div
        className={`h-16 border-b flex items-center px-4 justify-between backdrop-blur-md ${
          theme === 'dark' ? 'bg-neural-800/90 border-neural-700' : 'bg-white/90 border-gray-300'
        }`}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-neural-green">
            <Shield size={24} />
            <span className="font-mono font-black text-xl">XXXPLORER™</span>
          </div>
          <button
            aria-label="refresh sectors"
            onClick={() => void loadFiles()}
            className="text-xs font-mono text-gray-400 hover:text-neural-green flex items-center gap-1"
          >
            <RefreshCcw size={14} /> REFRESH
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[10px] font-mono text-gray-500 uppercase">A</label>
          <select
            aria-label="left root path"
            value={leftRootPath}
            onChange={(event) => setLeftRootPath(normalizeRootPath(event.target.value, '.'))}
            className="bg-neural-700/30 border border-neural-700 text-[10px] font-mono px-2 py-1 rounded"
          >
            {ROOT_OPTIONS.map((pathValue) => (
              <option key={`left-${pathValue}`} value={pathValue}>
                {pathValue}
              </option>
            ))}
          </select>
          <label className="text-[10px] font-mono text-gray-500 uppercase">B</label>
          <select
            aria-label="right root path"
            value={rightRootPath}
            onChange={(event) => setRightRootPath(normalizeRootPath(event.target.value, './packages'))}
            className="bg-neural-700/30 border border-neural-700 text-[10px] font-mono px-2 py-1 rounded"
          >
            {ROOT_OPTIONS.map((pathValue) => (
              <option key={`right-${pathValue}`} value={pathValue}>
                {pathValue}
              </option>
            ))}
          </select>
          <button
            aria-label="toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-full bg-neural-700/20"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      <DualPane
        leftTitle={formatPaneTitle(leftRootPath, 'Sector_A')}
        rightTitle={formatPaneTitle(rightRootPath, 'Sector_B')}
        leftContent={
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, leftRootPath)}>
            {renderFileList(leftFiles)}
          </div>
        }
        rightFiles={
          <div onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, rightRootPath)}>
            {renderFileList(rightFiles)}
          </div>
        }
      />

      <div className="h-32 bg-black/20 border-t border-neural-800 p-4 flex gap-8">
        <div className="flex-1">
          <h3 className="text-[10px] text-neural-green font-mono uppercase mb-2">Metadata</h3>
          <div className="text-xs font-mono truncate">{selectedFile ? selectedFile.name : 'No selection'}</div>
          <div className="text-[9px] text-neural-blue font-mono break-all mt-1">{fileHash}</div>
        </div>
        <div className="w-64 border-l border-neural-800 pl-4">
          <h3 className="text-[10px] text-neural-red font-mono uppercase mb-2">Vault_Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isVerifying ? 'bg-neural-blue animate-ping' : 'bg-neural-green'}`} />
            <span className="text-[10px] font-mono uppercase">{isVerifying ? 'Verifying' : 'Verified_Immutable'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
