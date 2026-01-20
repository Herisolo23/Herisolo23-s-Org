
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
    const timer = setTimeout(() => setShowSplash(false), 1800);
    
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
    } else {
      alert("Untuk menginstal: Klik titik tiga di pojok kanan atas Chrome, lalu pilih 'Instal Aplikasi'.");
    }
  };

  const addSource = (newSource: Omit<Source, 'id' | 'dateAdded'>) => {
    setSources([...sources, { ...newSource, id: Date.now().toString(), dateAdded: Date.now() }]);
  };

  const removeSource = (id: string) => setSources(sources.filter(s => s.id !== id));

  if (showSplash) {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-700 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-4xl shadow-2xl animate-pulse">
          <i className="fa-solid fa-brain"></i>
        </div>
        <div className="mt-8 text-center">
          <h1 className="text-3xl font-black tracking-tighter text-slate-800 dark:text-white">Notebook Pro</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
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
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 active-haptic">
               <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'}`}></i>
             </button>
             <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shadow-lg">NP</div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {activeTab === AppTab.CHAT && <ChatInterface sources={sources} />}
          {activeTab === AppTab.NOTES && <NotesInterface />}
          {activeTab === AppTab.STUDIO && <StudioHub sources={sources} />}
          {activeTab === AppTab.LIVE && <LiveInterface />}
        </main>

        {/* Bottom Navigation Optimized for WebAPK */}
        <div className="md:hidden glass-panel fixed bottom-0 left-0 right-0 h-20 border-t dark:border-slate-800 flex justify-around items-center px-6 z-50 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe">
          {[
            { id: AppTab.CHAT, icon: 'fa-message', label: 'Chat' },
            { id: AppTab.NOTES, icon: 'fa-note-sticky', label: 'Notes' },
            { id: AppTab.STUDIO, icon: 'fa-wand-magic-sparkles', label: 'Studio' },
            { id: AppTab.LIVE, icon: 'fa-microphone', label: 'Live' }
          ].map(tab => {
            const isSelected = activeTab === tab.id;
            return (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as AppTab)} 
                className={`flex flex-col items-center gap-1 w-16 relative active-haptic`}
              >
                <div className={`w-14 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-blue-600/15 text-blue-600' : 'text-slate-400'}`}>
                  <i className={`fa-solid ${tab.icon} ${isSelected ? 'text-xl' : 'text-lg'}`}></i>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${isSelected ? 'text-blue-600' : 'text-slate-400'}`}>{tab.label}</span>
                {isSelected && (
                  <div className="absolute -bottom-1 w-1 h-1 bg-blue-600 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <div className={`fixed inset-0 z-[60] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className={`absolute left-0 top-0 bottom-0 w-[85%] bg-white dark:bg-slate-950 transition-transform duration-500 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
           <div className="h-full flex flex-col pt-safe">
             <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between">
               <h2 className="text-xl font-black">Notebook Menu</h2>
               <button onClick={() => setIsMobileMenuOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                 <i className="fa-solid fa-xmark"></i>
               </button>
             </div>
             
             <div className="flex-1 overflow-y-auto">
                <Sidebar sources={sources} onAddSource={addSource} onRemoveSource={removeSource} onSelectSource={() => setIsMobileMenuOpen(false)} isDarkMode={isDarkMode} />
             </div>

             <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
               <button onClick={handleInstallClick} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl active-haptic">
                 <i className="fa-solid fa-mobile-screen-button"></i> 
                 {deferredPrompt ? 'Instal ke Layar Utama' : 'Cara Instal App'}
               </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
