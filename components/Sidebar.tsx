
import React, { useState, useRef, useEffect } from 'react';
import { Source } from '../types';
import { gemini } from '../services/geminiService';

interface SidebarProps {
  sources: Source[];
  onAddSource: (source: Omit<Source, 'id' | 'dateAdded'>) => void;
  onRemoveSource: (id: string) => void;
  onSelectSource: (source: Source) => void;
  onClose?: () => void;
  highlightedId?: string | null;
  isDarkMode?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ sources, onAddSource, onRemoveSource, onSelectSource, onClose, highlightedId, isDarkMode }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewSource, setPreviewSource] = useState<Source | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (highlightedId) {
      const source = sources.find(s => s.id === highlightedId);
      if (source) {
        setPreviewSource(null);
        setTimeout(() => {
          const element = document.getElementById(`source-${highlightedId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [highlightedId, sources]);

  const processFile = async (file: File) => {
    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      const mimeType = file.type;

      try {
        if (mimeType.startsWith('image/')) {
          const description = await gemini.describeImage(base64Data, mimeType);
          onAddSource({
            title: file.name,
            description: `Image: ${file.name}`,
            content: description || "No visual description available.",
            type: 'file'
          });
        } else if (mimeType === 'application/pdf') {
          onAddSource({
            title: file.name,
            description: `PDF Document`,
            content: `[Extracted content from ${file.name}]\n\nNote: PDF parsing is simulated.`,
            type: 'file'
          });
        } else {
          const text = atob(base64Data);
          onAddSource({ title: file.name, description: 'File', content: text, type: 'file' });
        }
      } catch (err) {
        console.error(err);
        alert("Upload failed.");
      } finally {
        setIsUploading(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleAddUrl = () => {
    const url = prompt("Enter URL (supports Website or YouTube):");
    if (!url) return;

    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');

    if (isYouTube) {
      const title = prompt("Enter Video Title:", "YouTube Video");
      const summary = prompt("Enter a brief summary or paste the transcript for the AI to index:");
      
      onAddSource({
        title: title || "YouTube Video",
        description: url,
        content: `Source: YouTube (${url})\n\nContext/Transcript:\n${summary || "No summary provided."}`,
        type: 'url'
      });
    } else {
      onAddSource({ 
        title: url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], 
        description: 'Web Source', 
        content: `Content from ${url}`, 
        type: 'url' 
      });
    }
  };

  const getIcon = (source: Source) => {
    const title = source.title.toLowerCase();
    const content = source.content.toLowerCase();
    
    if (content.includes('youtube.com') || content.includes('youtu.be')) {
      return { icon: 'fa-brands fa-youtube', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
    }
    if (title.endsWith('.pdf')) return { icon: 'fa-file-pdf', color: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' };
    if (source.type === 'url') return { icon: 'fa-link', color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' };
    if (title.match(/\.(png|jpg|jpeg|webp)$/)) return { icon: 'fa-image', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' };
    return { icon: 'fa-file-lines', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
  };

  return (
    <div 
      className="w-full h-full bg-white dark:bg-slate-950 flex flex-col overflow-hidden relative"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm border-4 border-dashed border-blue-500 flex items-center justify-center p-8">
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-center">
             <i className="fa-solid fa-cloud-arrow-up text-5xl text-blue-600 mb-4 animate-bounce"></i>
             <p className="font-black text-xl text-slate-800 dark:text-white">Drop to add</p>
           </div>
        </div>
      )}

      <div className={`flex flex-col h-full transition-transform duration-500 cubic-bezier ${previewSource ? '-translate-x-full' : 'translate-x-0'}`}>
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Sources</h2>
            {onClose && (
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95 shadow-sm"
            >
              <i className={`fa-solid ${isUploading ? 'fa-spinner fa-spin' : 'fa-plus'} text-xl mb-2`}></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Add File</span>
            </button>
            <button 
              onClick={handleAddUrl}
              className="flex flex-col items-center justify-center p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-500 hover:border-indigo-500 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"
            >
              <i className="fa-solid fa-link text-xl mb-2"></i>
              <span className="text-[10px] font-black uppercase tracking-widest">Add Link</span>
            </button>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.pdf,.txt" onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-3 pb-8 custom-scrollbar">
          {sources.length === 0 ? (
            <div className="text-center py-20 opacity-30">
              <i className="fa-solid fa-folder-open text-5xl mb-6"></i>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">No sources yet</p>
            </div>
          ) : (
            sources.map(source => {
              const config = getIcon(source);
              const isHighlighted = highlightedId === source.id;
              return (
                <div 
                  id={`source-${source.id}`}
                  key={source.id} 
                  onClick={() => { setPreviewSource(source); onSelectSource(source); }}
                  className={`group relative p-5 rounded-[2rem] transition-all cursor-pointer border ${
                    isHighlighted 
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 shadow-xl scale-[1.02]' 
                    : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${config.color} shadow-sm group-hover:scale-110 transition-transform`}>
                      <i className={`${config.icon} text-lg`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate pr-6">{source.title}</h3>
                      <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest mt-1">
                        {new Date(source.dateAdded).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRemoveSource(source.id); }}
                    className="absolute top-5 right-5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-2"
                  >
                    <i className="fa-solid fa-trash-can text-sm"></i>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div className={`absolute inset-0 bg-white dark:bg-slate-950 z-10 flex flex-col transition-transform duration-500 cubic-bezier ${previewSource ? 'translate-x-0' : 'translate-x-full'}`}>
        {previewSource && (
          <>
            <div className="h-16 px-6 border-b dark:border-slate-900 flex items-center justify-between bg-white dark:bg-slate-950">
              <button 
                onClick={() => setPreviewSource(null)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400"
              >
                <i className="fa-solid fa-arrow-left"></i> Back
              </button>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Source View</h4>
              <button className="text-slate-400 p-2"><i className="fa-solid fa-ellipsis"></i></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="flex items-center gap-4 mb-10">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-xl ${getIcon(previewSource).color}`}>
                  <i className={`${getIcon(previewSource).icon} text-2xl`}></i>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight">{previewSource.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-[9px] font-black uppercase text-slate-500">{previewSource.type}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{new Date(previewSource.dateAdded).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2.5rem] border dark:border-slate-800 whitespace-pre-wrap text-sm leading-relaxed font-serif text-slate-700 dark:text-slate-300">
                {previewSource.content}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
