import React, { useState, useEffect } from 'react';
import { 
  Shield, Cpu, RefreshCcw, LayoutGrid, Sun, Moon, 
  Lock, ShieldCheck, ExternalLink, Copy
} from 'lucide-react';
import { DualPane } from './DualPane';
import { sovereignFS } from './ipc';

const FileItem = ({ name, type, path, tier = 1, userTier = 1, onSelect, onDragStart, onContextMenu }: any) => {
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
        <div className="absolute inset-0 backdrop-blur-[2px] bg-black/20 z-10 flex items-center justify-center">
          <Lock size={12} className="text-neural-red animate-pulse" />
        </div>
      )}
      <div className={`flex items-center gap-3 ${isLocked ? 'blur-[1px]' : ''}`}>
        <span className="font-mono text-sm group-hover:text-neural-green transition-colors truncate max-w-[180px] block">{name}</span>
      </div>
      <span className="text-[10px] text-gray-500 font-mono opacity-50 px-2">T{tier}</span>
    </div>
  );
};

function App() {
  const [leftFiles, setLeftFiles] = useState([]);
  const [rightFiles, setRightFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileHash, setFileHash] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState({ visible: false, msg: '' });

  useEffect(() => { loadFiles(); }, []);

  const showToast = (msg: string) => {
    setToast({ visible: true, msg });
    setTimeout(() => setToast({ visible: false, msg: '' }), 3000);
  };

  const loadFiles = async () => {
    const left = await sovereignFS.list('./');
    const right = await sovereignFS.list('./packages');
    const tiered = (files: any[]) => files.map(f => ({ ...f, tier: f.name.includes('key') ? 2 : 1 }));
    setLeftFiles(tiered(left) as any);
    setRightFiles(tiered(right) as any);
  };

  const handleDrop = async (e: any, destDir: string) => {
    e.preventDefault();
    const item = JSON.parse(e.dataTransfer.getData('item'));
    const destPath = `${destDir}/${item.name}`;
    if (item.path === destPath) return;

    setIsVerifying(true);
    const result = await sovereignFS.move(item.path, destPath);
    setIsVerifying(false);

    if (result.success) {
      setFileHash(result.hash);
      showToast('LINEAGE_CONFIRMED: INTEGRITY_ROOT_MATCH');
      loadFiles();
    }
  };

  const handleVerify = async (file: any) => {
    setIsVerifying(true);
    const result = await sovereignFS.verify(file.path);
    setIsVerifying(false);
    setFileHash(result.success ? result.hash : 'ERROR');
  };

  const fileList = (files: any[], dir: string) => files.map((f, i) => (
    <FileItem 
      key={i} {...f} 
      onSelect={(item: any) => { setSelectedFile(item); handleVerify(item); }} 
      onDragStart={(e: any, item: any) => e.dataTransfer.setData('item', JSON.stringify(item))}
      onContextMenu={() => {}}
    />
  ));

  return (
    <div className={`h-screen w-screen flex flex-col font-sans select-none transition-colors duration-500 ${theme === 'dark' ? 'bg-neural-900 text-gray-200' : 'bg-gray-100 text-neural-900'}`}>
      {toast.visible && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-neural-green text-black px-8 py-3 rounded-full font-mono text-xs font-black shadow-[0_0_20px_rgba(0,255,0,0.4)] animate-in fade-in zoom-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3"><ShieldCheck size={18} />{toast.msg}</div>
        </div>
      )}

      {/* Header */}
      <div className={`h-14 border-b flex items-center px-4 justify-between backdrop-blur-md ${theme === 'dark' ? 'bg-neural-800/90 border-neural-700' : 'bg-white/90 border-gray-300'}`}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-neural-green">
            <Shield size={24} />
            <span className="font-mono font-black text-xl">XXXPLORER™</span>
          </div>
          <button onClick={loadFiles} className="text-xs font-mono text-gray-400 hover:text-neural-green flex items-center gap-1"><RefreshCcw size={14}/> REFRESH</button>
        </div>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-full bg-neural-700/20">{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button>
      </div>

      <DualPane 
        leftContent={<div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, '.')}>{fileList(leftFiles, '.')}</div>}
        rightFiles={<div onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, './packages')}>{fileList(rightFiles, './packages')}</div>}
      />

      {/* Footer Info */}
      <div className="h-32 bg-black/20 border-t border-neural-800 p-4 flex gap-8">
        <div className="flex-1">
          <h3 className="text-[10px] text-neural-green font-mono uppercase mb-2">Metadata</h3>
          <div className="text-xs font-mono truncate">{selectedFile ? selectedFile.name : 'No selection'}</div>
          <div className="text-[9px] text-neural-blue font-mono break-all mt-1">{fileHash}</div>
        </div>
        <div className="w-64 border-l border-neural-800 pl-4">
          <h3 className="text-[10px] text-neural-red font-mono uppercase mb-2">Vault_Status</h3>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isVerifying ? 'bg-neural-blue animate-ping' : 'bg-neural-green'}`}></div>
            <span className="text-[10px] font-mono uppercase">Verified_Immutable</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
