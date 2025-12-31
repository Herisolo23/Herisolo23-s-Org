
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Note, Folder } from '../types';
import { gemini } from '../services/geminiService';

type ViewState = 'folders' | 'notes' | 'editor';

const FOLDER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'
];

export const NotesInterface: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'none'>('all');
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [viewState, setViewState] = useState<ViewState>('folders');
  
  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedNotes = localStorage.getItem('gemini-notebook-notes');
    const savedFolders = localStorage.getItem('gemini-notebook-folders');
    if (savedNotes) { try { setNotes(JSON.parse(savedNotes)); } catch (e) { console.error(e); } }
    if (savedFolders) { try { setFolders(JSON.parse(savedFolders)); } catch (e) { console.error(e); } }
  }, []);

  useEffect(() => {
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      localStorage.setItem('gemini-notebook-notes', JSON.stringify(notes));
      localStorage.setItem('gemini-notebook-folders', JSON.stringify(folders));
      setSaveStatus('saved');
    }, 1000); 
    return () => clearTimeout(timer);
  }, [notes, folders]);

  useEffect(() => {
    if (editorRef.current && activeNote) {
      if (editorRef.current.innerHTML !== activeNote.content) {
        editorRef.current.innerHTML = activeNote.content;
      }
    }
  }, [activeNote?.id]);

  const createNote = () => {
    const newNote: Note = { 
      id: Date.now().toString(), 
      title: '', 
      content: '', 
      tags: [], 
      dateCreated: Date.now(),
      folderId: activeFolderId !== 'all' && activeFolderId !== 'none' ? activeFolderId : undefined
    };
    setNotes([newNote, ...notes]);
    setActiveNote(newNote);
    setViewState('editor');
    setTimeout(() => titleInputRef.current?.focus(), 50);
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: Folder = {
      id: Date.now().toString(),
      name: newFolderName.trim(),
      dateCreated: Date.now(),
      color: FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)]
    };
    setFolders([...folders, newFolder]);
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  const renameFolder = (id: string, name: string) => {
    setFolders(folders.map(f => f.id === id ? { ...f, name } : f));
    setEditingFolderId(null);
  };

  const updateFolderColor = (id: string, color: string) => {
    setFolders(folders.map(f => f.id === id ? { ...f, color } : f));
  };

  const deleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this folder? Notes inside will become uncategorized.')) {
      setFolders(folders.filter(f => f.id !== id));
      setNotes(notes.map(n => n.folderId === id ? { ...n, folderId: undefined } : n));
      if (activeFolderId === id) setActiveFolderId('all');
    }
  };

  const updateActiveNote = (updates: Partial<Note>) => {
    if (!activeNote) return;
    const updated = { ...activeNote, ...updates }; 
    setActiveNote(updated);
    setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
  };

  const deleteNote = (id: string) => {
    if (confirm('Delete this note?')) {
      const remaining = notes.filter(n => n.id !== id);
      setNotes(remaining);
      if (activeNote?.id === id) setActiveNote(null);
      setViewState('notes');
    }
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim() && activeNote) {
      const tag = tagInput.trim().toLowerCase();
      if (!activeNote.tags.includes(tag)) updateActiveNote({ tags: [...activeNote.tags, tag] });
      setTagInput('');
    }
  };

  const handleSummarize = async () => {
    if (!activeNote || !activeNote.content || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const summary = await gemini.summarizeSource(editorRef.current?.innerText || activeNote.content);
      if (summary) updateActiveNote({ summary });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSummarizing(false);
    }
  };

  const execCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    if (editorRef.current) updateActiveNote({ content: editorRef.current.innerHTML });
    editorRef.current?.focus();
  };

  const filteredNotes = useMemo(() => {
    if (activeFolderId === 'all') return notes;
    if (activeFolderId === 'none') return notes.filter(n => !n.folderId);
    return notes.filter(n => n.folderId === activeFolderId);
  }, [notes, activeFolderId]);

  const activeFolder = useMemo(() => {
    return folders.find(f => f.id === activeFolderId);
  }, [activeFolderId, folders]);

  const activeFolderName = useMemo(() => {
    if (activeFolderId === 'all') return 'All Notes';
    if (activeFolderId === 'none') return 'Uncategorized';
    return activeFolder?.name || 'Folder';
  }, [activeFolderId, activeFolder]);

  const handleFolderSelect = (id: string | 'all' | 'none') => {
    setActiveFolderId(id);
    setViewState('notes');
  };

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* 1. Folder Sidebar */}
      <div className={`w-full lg:w-72 bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col shrink-0 lg:flex ${viewState === 'folders' ? 'flex' : 'hidden'}`}>
        <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tighter">Collections</h2>
          <button onClick={() => setIsAddingFolder(true)} className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
            <i className="fa-solid fa-folder-plus"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1">
          <button 
            onClick={() => handleFolderSelect('all')}
            className={`w-full px-4 py-3 rounded-2xl text-left text-sm font-bold flex items-center gap-4 transition-all ${activeFolderId === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <i className="fa-solid fa-layer-group w-5 text-center"></i> 
            <span className="flex-1">All Notes</span>
            <span className={`text-[10px] font-black ${activeFolderId === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>{notes.length}</span>
          </button>
          
          <button 
            onClick={() => handleFolderSelect('none')}
            className={`w-full px-4 py-3 rounded-2xl text-left text-sm font-bold flex items-center gap-4 transition-all ${activeFolderId === 'none' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <i className="fa-solid fa-inbox w-5 text-center"></i> 
            <span className="flex-1">Uncategorized</span>
            <span className={`text-[10px] font-black ${activeFolderId === 'none' ? 'text-blue-100' : 'text-slate-400'}`}>{notes.filter(n => !n.folderId).length}</span>
          </button>

          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">My Categories</p>
          </div>

          {isAddingFolder && (
            <div className="px-4 py-3 space-y-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-in slide-in-from-top-2">
              <input 
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createFolder()}
                placeholder="New Category..."
                className="w-full px-4 py-2 text-sm bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-xl focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={createFolder} className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg shadow-md">Create</button>
                <button onClick={() => { setIsAddingFolder(false); setNewFolderName(''); }} className="flex-1 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 text-[10px] font-black uppercase rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          {folders.map(folder => (
            <div key={folder.id} className="group relative">
              {editingFolderId === folder.id ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-3">
                  <input 
                    autoFocus
                    defaultValue={folder.name}
                    onKeyDown={(e) => e.key === 'Enter' && renameFolder(folder.id, (e.target as HTMLInputElement).value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-xl text-sm font-bold focus:outline-none"
                  />
                  <div className="flex justify-between items-center px-1">
                    <div className="flex gap-1.5">
                      {FOLDER_COLORS.map(c => (
                        <button 
                          key={c} 
                          onClick={() => updateFolderColor(folder.id, c)}
                          className={`w-4 h-4 rounded-full border border-white dark:border-slate-700 transition-transform ${folder.color === c ? 'scale-125 shadow-md' : 'scale-100'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button onClick={() => setEditingFolderId(null)} className="text-[9px] font-black uppercase text-blue-600">Done</button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => handleFolderSelect(folder.id)}
                  className={`w-full px-4 py-3 rounded-2xl text-left text-sm font-bold flex items-center gap-4 transition-all group ${activeFolderId === folder.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <i 
                    className={`fa-solid ${activeFolderId === folder.id ? 'fa-folder-open' : 'fa-folder'} w-5 text-center`}
                    style={{ color: activeFolderId === folder.id ? '#fff' : (folder.color || '#3b82f6') }}
                  ></i>
                  <span className="truncate flex-1">{folder.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black group-hover:hidden ${activeFolderId === folder.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      {notes.filter(n => n.folderId === folder.id).length}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); }} className={`hover:scale-110 transition-transform ${activeFolderId === folder.id ? 'text-white' : 'text-slate-400 hover:text-blue-500'}`}>
                        <i className="fa-solid fa-pen text-[10px]"></i>
                      </button>
                      <button onClick={(e) => deleteFolder(folder.id, e)} className={`hover:scale-110 transition-transform ${activeFolderId === folder.id ? 'text-white' : 'text-slate-400 hover:text-red-500'}`}>
                        <i className="fa-solid fa-trash-can text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Note List */}
      <div className={`w-full lg:w-96 bg-slate-50 dark:bg-slate-950 border-r dark:border-slate-800 flex flex-col lg:flex shrink-0 ${viewState === 'notes' ? 'flex' : 'hidden'}`}>
        <header className="h-16 px-6 border-b dark:border-slate-800 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewState('folders')} className="lg:hidden w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shadow-sm active:scale-90 transition-transform">
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>
            <div className="flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{activeFolderName}</h3>
              <p className="text-[9px] font-bold text-slate-500">{filteredNotes.length} research units</p>
            </div>
          </div>
          <button onClick={createNote} className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-all">
            <i className="fa-solid fa-plus"></i>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300">
               <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm flex items-center justify-center mb-6">
                 <i className="fa-solid fa-note-sticky text-2xl"></i>
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Nothing here yet</p>
               <p className="text-[9px] font-medium text-slate-400">Capture your first thought</p>
            </div>
          ) : (
            filteredNotes.map(note => {
              const noteFolder = folders.find(f => f.id === note.folderId);
              return (
                <button 
                  key={note.id}
                  onClick={() => { setActiveNote(note); setViewState('editor'); }}
                  className={`group w-full rounded-[2rem] text-left transition-all border overflow-hidden relative ${activeNote?.id === note.id ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl scale-[1.02]' : 'bg-white dark:bg-slate-900 border-transparent hover:shadow-md'}`}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1.5 transition-all"
                    style={{ backgroundColor: noteFolder?.color || 'transparent' }}
                  />
                  <div className="p-5 pl-6">
                    <div className="flex items-center justify-between mb-2">
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{new Date(note.dateCreated).toLocaleDateString()}</p>
                       {noteFolder && (
                         <span 
                           className="px-2 py-0.5 text-[8px] font-black uppercase rounded-md border"
                           style={{ 
                             backgroundColor: `${noteFolder.color}15`, 
                             color: noteFolder.color,
                             borderColor: `${noteFolder.color}30`
                           }}
                         >
                           {noteFolder.name}
                         </span>
                       )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-relaxed">{note.title || 'Untitled Thought'}</h3>
                    <div className="flex gap-1 mt-4">
                      {note.tags.length > 0 ? (
                        note.tags.slice(0, 3).map(t => <span key={t} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[8px] font-bold text-slate-400 uppercase tracking-tighter">#{t}</span>)
                      ) : (
                        <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700"></span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Editor */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-slate-950 relative overflow-hidden lg:flex ${viewState === 'editor' ? 'flex' : 'hidden'}`}>
        {activeNote ? (
          <>
            <header className="h-16 px-6 border-b dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-10 shrink-0">
              <div className="flex items-center gap-4 flex-1">
                <button onClick={() => setViewState('notes')} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 text-slate-500 active:scale-95 transition-all">
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                <div className="flex flex-col flex-1 min-w-0">
                  <input 
                    ref={titleInputRef}
                    value={activeNote.title}
                    onChange={e => updateActiveNote({ title: e.target.value })}
                    placeholder="Note Title"
                    className="text-lg font-black bg-transparent focus:outline-none w-full truncate"
                  />
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: folders.find(f => f.id === activeNote.folderId)?.color || '#94a3b8' }}
                    />
                    <select 
                      value={activeNote.folderId || 'none'} 
                      onChange={(e) => updateActiveNote({ folderId: e.target.value === 'none' ? undefined : e.target.value })}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-transparent border-none focus:outline-none cursor-pointer hover:text-blue-500 transition-colors"
                    >
                      <option value="none">No Category</option>
                      {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-slate-400">
                  {saveStatus === 'saving' ? 'Syncing...' : 'Saved'}
                </span>
                <button onClick={() => deleteNote(activeNote.id)} className="w-10 h-10 rounded-2xl text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all flex items-center justify-center">
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 md:px-12 pt-8 pb-40 custom-scrollbar">
              <div className="max-w-3xl mx-auto space-y-8 animate-enter">
                {activeNote.summary && (
                  <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800/50 relative group shadow-sm">
                    <button onClick={() => updateActiveNote({ summary: undefined })} className="absolute top-4 right-4 text-indigo-300 hover:text-red-500 transition-all">
                       <i className="fa-solid fa-circle-xmark"></i>
                    </button>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-[10px]">
                        <i className="fa-solid fa-sparkles"></i>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">AI Synthesis</span>
                    </div>
                    <p className="text-sm font-medium text-indigo-900/80 dark:text-indigo-200 leading-relaxed italic">"{activeNote.summary}"</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 items-center">
                  {activeNote.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-white dark:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border dark:border-slate-700 shadow-sm">
                      #{tag}
                    </span>
                  ))}
                  <div className="flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded-full border border-dashed border-slate-200 dark:border-slate-800">
                    <i className="fa-solid fa-plus text-[8px] text-slate-400 mr-2"></i>
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} placeholder="ADD TAG" className="text-[9px] font-black uppercase tracking-widest bg-transparent focus:outline-none w-16 text-slate-600" />
                  </div>
                </div>

                <div 
                  ref={editorRef}
                  contentEditable
                  onInput={(e) => updateActiveNote({ content: (e.target as HTMLDivElement).innerHTML })}
                  className="prose prose-slate lg:prose-xl dark:prose-invert max-w-none focus:outline-none min-h-[60vh] leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/50"
                  placeholder="Record your research insights here..."
                ></div>
              </div>
            </div>

            {/* Android-style Floating Toolbar */}
            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-2 bg-white/90 dark:bg-slate-900/90 border dark:border-slate-800 shadow-2xl rounded-[2.5rem] transition-all hover:scale-[1.02] backdrop-blur-xl">
              <div className="flex px-2 border-r dark:border-slate-800 gap-1">
                <button onClick={() => execCommand('bold')} className="w-11 h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center"><i className="fa-solid fa-bold"></i></button>
                <button onClick={() => execCommand('italic')} className="w-11 h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center"><i className="fa-solid fa-italic"></i></button>
              </div>
              <div className="flex px-2 border-r dark:border-slate-800 gap-1">
                <button onClick={() => execCommand('insertUnorderedList')} className="w-11 h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center"><i className="fa-solid fa-list-ul"></i></button>
              </div>
              <div className="flex px-2 gap-1">
                <button onClick={handleSummarize} disabled={isSummarizing} className="px-6 h-11 rounded-full bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest flex items-center gap-3 hover:bg-blue-700 transition-all disabled:opacity-30 shadow-lg shadow-blue-200 dark:shadow-none">
                  {isSummarizing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
                  Synthesize
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-sm animate-enter">
              <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl flex items-center justify-center mb-10 mx-auto border dark:border-slate-800 rotate-3">
                <i className="fa-solid fa-feather-pointed text-4xl text-blue-600"></i>
              </div>
              <h3 className="text-3xl font-black tracking-tighter mb-4 text-slate-800 dark:text-white">Knowledge Hub</h3>
              <p className="text-slate-500 text-lg leading-relaxed mb-10">Select a research unit from your collections to begin your deep dive.</p>
              <button onClick={createNote} className="px-10 py-4 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-blue-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all">Create New Note</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
