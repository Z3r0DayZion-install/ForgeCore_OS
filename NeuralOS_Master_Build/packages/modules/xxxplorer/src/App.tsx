import React, { useState, useEffect, useCallback } from 'react';
import { 
  Folder, File, Shield, ArrowRight, Lock, HardDrive, 
  Cpu, MoreVertical, RefreshCcw, LayoutGrid, 
  Sun, Moon, MousePointer2, Copy, ShieldCheck, ExternalLink 
} from 'lucide-react';

declare global {
  interface Window {
    neuralos: any;
  }
}

// --- Types ---
interface FileItemProps {
  name: string;
  type: 'file' | 'folder';
  path: string;
  tier?: number;
  userTier?: number;
  onSelect: (item: any) => void;
  onDragStart: (e: any, item: any) => void;
  onContextMenu: (e: React.MouseEvent, item: any) => void;
}

// --- Components ---

const ContextMenu = ({ x, y, visible, onClose, actions, item }: any) => {
  if (!visible) return null;

  return (
    <div 
      className="fixed z-[100] bg-neural-800 border border-neural-700 shadow-2xl py-1 w-48 font-mono text-[10px]"
      style={{ top: y, left: x }}
      onMouseLeave={onClose}
    >
      {actions.map((action: any, i: number) => (
        <button
          key={i}
          onClick={() => { action.run(item); onClose(); }}
          className="w-full text-left px-3 py-2 hover:bg-neural-700 flex items-center gap-2 text-gray-300 hover:text-neural-green transition-colors"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
};

const FileItem = ({ name, type, path, tier = 1, userTier = 1, onSelect, onDragStart, onContextMenu }: FileItemProps) => {
  const isLocked = tier > userTier;
  
  return (
    <div 
      draggable={!isLocked}
      onDragStart={(e) => onDragStart(e, { name, type, path, tier })}
      onContextMenu={(e) => !isLocked && onContextMenu(e, { name, type, path, tier })}
      onClick={() => !isLocked && onSelect({ name, type, path, tier })}
      className={`flex items-center justify-between p-2 hover:bg-neural-700/50 cursor-pointer border-b border-neural-800/30 group relative transition-all duration-200 ${isLocked ? 'overflow-hidden' : ''}`}
    >
      {isLocked && (
        <div className="absolute inset-0 backdrop-blur-[2px] bg-black/40 z-10 flex items-center justify-center">
          <Lock size={12} className="text-neural-red animate-pulse" />
        </div>
      )}
      
      <div className={`flex items-center gap-3 ${isLocked ? 'blur-[1px]' : ''}`}>
        {type === 'folder' ? (
          <Folder size={16} className="text-neural-blue group-hover:scale-110 transition-transform" />
        ) : (
          <File size={16} className="text-neural-green group-hover:scale-110 transition-transform" />
        )}
        <span className="font-mono text-sm group-hover:text-neural-green transition-colors truncate max-w-[180px] block" title={name}>{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 font-mono opacity-50">T{tier}</span>
        <MoreVertical size={14} className="text-gray-600 opacity-0 group-hover:opacity-100" />
      </div>
    </div>
  );
};

const Pane = ({ title, path, files, onSelect, onDrop, onDragOver, onContextMenu }: any) => {
  return (
    <div 
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, path)}
      className="flex-1 flex flex-col border-r border-neural-800 bg-neural-900/40 backdrop-blur-sm h-full"
    >
      <div className="bg-neural-800/80 p-2.5 flex items-center justify-between border-b border-neural-700">
        <div className="flex items-center gap-2">
          <HardDrive size={14} className="text-neural-green" />
          <span className="text-[11px] font-mono text-gray-300 uppercase tracking-[0.2em]">{title}</span>
        </div>
        <div className="text-[9px] text-neural-green font-mono bg-neural-900/80 px-2 py-0.5 border border-neural-700 rounded tracking-tighter">SECURED_NODE</div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {files.length > 0 ? (
          files.map((f: any, i: number) => (
            <FileItem 
              key={i} 
              {...f} 
              onSelect={onSelect} 
              onContextMenu={onContextMenu}
              onDragStart={(e: any, item: any) => e.dataTransfer.setData('item', JSON.stringify(item))} 
            />
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] font-mono text-gray-600 italic">No assets detected.</div>
        )}
      </div>
      <div className="p-2 bg-neural-900/60 border-t border-neural-800 text-[9px] font-mono text-gray-500 overflow-hidden whitespace-nowrap text-ellipsis italic">
        MOUNT_POINT: {path}
      </div>
    </div>
  );
};

function App() {
  const [leftFiles, setLeftFiles] = useState([]);
  const [rightFiles, setRightFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [userTier] = useState(1); 
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Context Menu State
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, item: null });

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const left = await window.neuralos.fs.ls('./');
      const right = await window.neuralos.fs.ls('./packages');
      
      const tiered = (files: any[]) => files.map(f => ({
        ...f,
        tier: f.name.includes('key') || f.name.includes('vault') || f.name.includes('seal') ? 2 : 1
      }));

      setLeftFiles(tiered(left) as any);
      setRightFiles(tiered(right) as any);
    } catch (err) {
      console.error('Failed to load filesystem:', err);
    }
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const [toast, setToast] = useState<{ visible: boolean, msg: string }>({ visible: false, msg: '' });

  const showToast = (msg: string) => {
    setToast({ visible: true, msg });
    setTimeout(() => setToast({ visible: false, msg: '' }), 3000);
  };

  const onDrop = async (e: React.DragEvent, destDir: string) => {
    e.preventDefault();
    const itemData = e.dataTransfer.getData('item');
    if (!itemData) return;
    
    const item = JSON.parse(itemData);
    const destPath = `${destDir}/${item.name}`;
    if (item.path === destPath) return;

    setIsVerifying(true);
    setFileHash('SOVEREIGN_MOVE_IN_PROGRESS...');
    const result = await window.neuralos.fs.vaultMove(item.path, destPath);
    setIsVerifying(false);

    if (result.success) {
      setFileHash('VERIFIED: ' + result.hash);
      showToast('LINEAGE_CONFIRMED: INTEGRITY_ROOT_MATCH');
      loadFiles();
    } else {
      alert('VAULT_ERROR: ' + result.error);
    }
  };

  const handleVerify = async (file: any) => {
    if (file.type === 'folder') return;
    setIsVerifying(true);
    setFileHash('CALCULATING...');
    const result = await window.neuralos.fs.verify(file.path);
    setIsVerifying(false);
    if (result.success) setFileHash(result.hash);
    else setFileHash('ERROR: ' + result.error);
  };

  const onSelect = (file: any) => {
    setSelectedFile(file);
    if (file.type === 'file') handleVerify(file);
    else setFileHash('N/A (DIRECTORY)');
  };

  const handleContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault();
    setMenu({ visible: true, x: e.clientX, y: e.clientY, item });
  };

  // --- Context Menu Actions ---
  const menuActions = [
    { label: 'OPEN_IN_SHELL', icon: <ExternalLink size={12}/>, run: (item: any) => console.log('Opening:', item.path) },
    { label: 'COPY_TO_VAULT', icon: <Copy size={12}/>, run: (item: any) => console.log('Copying:', item.path) },
    { label: 'FORCE_VERIFY', icon: <ShieldCheck size={12}/>, run: (item: any) => handleVerify(item) },
  ];

  return (
    <div className={`h-screen w-screen flex flex-col font-sans select-none border border-neural-800 transition-colors duration-500 ${theme === 'dark' ? 'bg-neural-900 text-gray-200' : 'bg-gray-100 text-neural-900'}`}>
      
      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-neural-green text-black px-8 py-3 rounded-full font-mono text-xs font-black shadow-[0_0_20px_rgba(0,255,0,0.4)] animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} />
            {toast.msg}
          </div>
        </div>
      )}

      <ContextMenu 
        {...menu} 
        onClose={() => setMenu({ ...menu, visible: false })} 
        actions={menuActions} 
      />

      {/* Header */}
      <div className={`h-14 border-b flex items-center px-4 justify-between backdrop-blur-md sticky top-0 z-50 ${theme === 'dark' ? 'bg-neural-800/90 border-neural-700' : 'bg-white/90 border-gray-300'}`}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-neural-green">
            <Shield size={24} className="drop-shadow-[0_0_8px_rgba(0,255,0,0.4)]" />
            <span className="font-mono font-black tracking-[-0.05em] text-xl">XXXPLORER™</span>
          </div>
          <div className="flex gap-6 text-[11px] font-mono font-bold text-gray-400">
            <button className="hover:text-neural-green transition-colors flex items-center gap-1.5" onClick={loadFiles}>
              <RefreshCcw size={14} /> REFRESH
            </button>
            <button className="hover:text-neural-green transition-colors flex items-center gap-1.5">
               <LayoutGrid size={14} /> WORKSPACES
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2 rounded-full transition-all duration-300 ${theme === 'dark' ? 'bg-neural-700 text-yellow-400 hover:bg-neural-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border transition-colors ${theme === 'dark' ? 'bg-neural-900 border-neural-700' : 'bg-gray-100 border-gray-300'}`}>
            <Cpu size={16} className="text-neural-blue" />
            <span className="text-[10px] font-mono text-neural-blue uppercase font-bold tracking-[0.1em]">Sovereign_V3_Linked</span>
          </div>
        </div>
      </div>

      {/* Main Panes */}
      <div className="flex-1 flex overflow-hidden lg:flex-row flex-col">
        <Pane title="ROOT_SECTOR" path="." files={leftFiles} onSelect={onSelect} onDrop={onDrop} onDragOver={onDragOver} onContextMenu={handleContextMenu} />
        <Pane title="PACKAGE_SECTOR" path="./packages" files={rightFiles} onSelect={onSelect} onDrop={onDrop} onDragOver={onDragOver} onContextMenu={handleContextMenu} />
        
        {/* Info Sidebar */}
        <div className={`w-full lg:w-96 flex flex-col border-l transition-colors ${theme === 'dark' ? 'bg-neural-800/20 border-neural-800' : 'bg-gray-50/80 border-gray-300'}`}>
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-neural-800 bg-neural-900/40' : 'border-gray-300 bg-white'}`}>
            <h3 className="text-[11px] font-mono text-neural-green mb-6 border-b border-neural-700 pb-2 flex items-center gap-2">
              <Shield size={14}/> FILE_METADATA
            </h3>
            {selectedFile ? (
              <div className="space-y-4 font-mono">
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Filename</div>
                  <div className="text-sm font-bold truncate mt-1" title={selectedFile.name}>{selectedFile.name}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">SHA-256_Lineage</div>
                  <div className={`text-[10px] break-all p-3 rounded-lg mt-1.5 transition-all ${theme === 'dark' ? 'bg-black/40 text-neural-blue' : 'bg-gray-200 text-blue-700'} ${isVerifying ? 'animate-pulse' : ''}`}>
                    {fileHash}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Trust_Chain</div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isVerifying ? 'bg-neural-blue animate-ping' : 'bg-neural-green opacity-80 shadow-[0_0_8px_rgba(0,255,0,0.5)]'}`}></div>
                    <span className="text-[10px] text-neural-green font-bold uppercase">Verified_Immutable</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center border-2 border-dashed border-neural-800/30 rounded-xl">
                <div className="text-[11px] font-mono text-gray-600 italic">Select an asset for analysis...</div>
              </div>
            )}
          </div>
          
          <div className="flex-1 p-6">
            <h3 className="text-[11px] font-mono text-neural-red mb-4 border-b border-neural-700 pb-2 uppercase tracking-[0.2em] font-bold">Access_Policy</h3>
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Lock size={14} className="text-neural-red" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider">Current_Tier: {userTier}</span>
            </div>
            <p className="text-[10px] font-mono text-gray-500 leading-relaxed opacity-70">
              Hardware binding detected via Seal_Pulse V3. Local vault sectors are mounted. Integrity mismatch triggers an immediate Sovereign Hard-Fail event.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`h-8 border-t flex items-center px-4 justify-between text-[10px] font-mono transition-colors ${theme === 'dark' ? 'bg-neural-900 border-neural-800 text-gray-500' : 'bg-white border-gray-300 text-gray-400'}`}>
        <div className="flex gap-6">
          <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-neural-green rounded-full"></div> SYSTEM_READY</span>
          <span className="opacity-50">ENV: SOVEREIGN_V0.1</span>
        </div>
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2 px-3 py-0.5 bg-neural-800 text-neural-green rounded border border-neural-700 shadow-inner">
            <Shield size={10} />
            <span className="font-bold tracking-tighter">TRUSTCTL_ALPHA</span>
          </div>
          <span className="bg-neural-800 px-3 py-0.5 text-neural-blue rounded font-bold tracking-widest text-[9px]">
            SEAL: {window.neuralos?.core?.getSeal()?.substring(0, 16) || 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
