
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { NotesInterface } from './components/NotesInterface';
import { StudioHub } from './components/StudioHub';
import { LiveInterface } from './components/LiveInterface';
import { AppTab, Source } from './types';

const App: React.FC = () => {
  const [sources, setSources] = useState<Source[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.CHAT);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('darkmode') === 'true');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    
    // Listen for PWA install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('sources');
    if (saved) setSources(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('sources', JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
    localStorage.setItem('darkmode', isDarkMode.toString());
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const addSource = (newSource: Omit<Source, 'id' | 'dateAdded'>) => {
    setSources([...sources, { ...newSource, id: Date.now().toString(), dateAdded: Date.now() }]);
  };

  const removeSource = (id: string) => setSources(sources.filter(s => s.id !== id));

  if (showSplash) {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-700 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl animate-bounce">
          <i className="fa-solid fa-brain"></i>
        </div>
        <h1 className="mt-8 text-3xl font-black tracking-tighter text-slate-800 dark:text-white">Notebook Pro</h1>
        <p className="mt-2 text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">Intelligence Studio</p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-80 shrink-0 border-r dark:border-slate-800 bg-white dark:bg-slate-950">
        <Sidebar sources={sources} onAddSource={addSource} onRemoveSource={removeSource} onSelectSource={() => {}} isDarkMode={isDarkMode} />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative pt-safe">
        <header className="h-16 md:h-20 flex items-center justify-between px-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl z-30 shrink-0 border-b dark:border-slate-900">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-slate-500 w-11 h-11 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-900 active:scale-90 transition-transform" onClick={() => setIsMobileMenuOpen(true)}>
              <i className="fa-solid fa-bars-staggered"></i>
            </button>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Notebook Pro</span>
              <h1 className="text-lg font-black tracking-tight dark:text-white">Android Hub</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {deferredPrompt && (
               <button onClick={handleInstallClick} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                 <i className="fa-solid fa-download"></i> Install App
               </button>
             )}
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
               <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
             </button>
             <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg">NP</div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <div className={`h-full transition-all duration-500 ${activeTab === AppTab.CHAT ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute inset-0 pointer-events-none'}`}>
            <ChatInterface sources={sources} />
          </div>
          <div className={`h-full transition-all duration-500 ${activeTab === AppTab.NOTES ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute inset-0 pointer-events-none'}`}>
            <NotesInterface />
          </div>
          <div className={`h-full transition-all duration-500 ${activeTab === AppTab.STUDIO ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute inset-0 pointer-events-none'}`}>
            <StudioHub sources={sources} />
          </div>
          <div className={`h-full transition-all duration-500 ${activeTab === AppTab.LIVE ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute inset-0 pointer-events-none'}`}>
            <LiveInterface />
          </div>
        </main>

        {/* Bottom Navigation (Android Native Style) */}
        <div className="md:hidden glass-panel fixed bottom-0 left-0 right-0 h-20 border-t dark:border-slate-800 flex justify-around items-center px-6 z-50 rounded-t-[2.5rem] shadow-2xl pb-safe">
          {[
            { id: AppTab.CHAT, icon: 'fa-message', label: 'Chat' },
            { id: AppTab.NOTES, icon: 'fa-note-sticky', label: 'Notes' },
            { id: AppTab.STUDIO, icon: 'fa-wand-magic-sparkles', label: 'Studio' },
            { id: AppTab.LIVE, icon: 'fa-microphone', label: 'Live' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as AppTab)} 
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 w-16 relative`}
            >
              {activeTab === tab.id && (
                <div className="absolute -top-2 w-12 h-1 bg-blue-600 rounded-full animate-pulse"></div>
              )}
              <div className={`w-14 h-8 rounded-full flex items-center justify-center transition-all ${activeTab === tab.id ? 'bg-blue-600/10 text-blue-600' : 'text-slate-400'}`}>
                <i className={`fa-solid ${tab.icon} text-lg`}></i>
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <div className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className={`absolute left-0 top-0 bottom-0 w-[85%] bg-white dark:bg-slate-950 transition-transform duration-500 cubic-bezier ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="h-full flex flex-col pt-safe">
             <Sidebar sources={sources} onAddSource={addSource} onRemoveSource={removeSource} onSelectSource={() => setIsMobileMenuOpen(false)} onClose={() => setIsMobileMenuOpen(false)} isDarkMode={isDarkMode} />
             {deferredPrompt && (
               <div className="p-6 border-t dark:border-slate-800">
                 <button onClick={handleInstallClick} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-blue-200 dark:shadow-none">
                   <i className="fa-solid fa-mobile-screen-button"></i> Install ke Android
                 </button>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
