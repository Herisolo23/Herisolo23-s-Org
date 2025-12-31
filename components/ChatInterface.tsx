
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Source } from '../types';
import { gemini } from '../services/geminiService';

interface ChatInterfaceProps {
  sources: Source[];
  onCitationClick?: (title: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sources, onCitationClick }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [attachment, setAttachment] = useState<{file: File, type: 'image'|'video', preview: string} | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('image/') ? 'image' : 'video';
    const preview = URL.createObjectURL(file);
    setAttachment({ file, type, preview });
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;

    const userMsg: ChatMessage = { 
      role: 'user', 
      text: input,
      attachment: attachment ? { type: attachment.type, url: attachment.preview } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const sourceTexts = sources.map(s => `Title: ${s.title}\nContent: ${s.content}`);
      let response: any;

      if (attachment) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(attachment.file);
        });
        const base64Data = await base64Promise;
        const text = await gemini.analyzeMultimedia(input || "Analyze this", base64Data, attachment.file.type);
        response = { text };
      } else if (isThinkingMode) {
        response = await gemini.complexReasoning(input, sourceTexts);
      } else {
        let location: any;
        if (useMaps) {
          const pos: any = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
          location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
        response = await gemini.chatWithGrounding(input, sourceTexts, useSearch, useMaps, location);
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: response.text, 
        groundingChunks: response.groundingChunks 
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "An error occurred during generation." }]);
    } finally {
      setIsLoading(false);
      setAttachment(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors">
      <div className="h-14 border-b dark:border-slate-800 flex items-center px-4 gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur shrink-0">
        <button 
          onClick={() => setIsThinkingMode(!isThinkingMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isThinkingMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
        >
          <i className="fa-solid fa-brain"></i> Thinking
        </button>
        <button 
          onClick={() => setUseSearch(!useSearch)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${useSearch ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
        >
          <i className="fa-brands fa-google"></i> Search
        </button>
        <button 
          onClick={() => setUseMaps(!useMaps)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${useMaps ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
        >
          <i className="fa-solid fa-location-dot"></i> Maps
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar pb-40">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-300`}>
            <div className={`max-w-[90%] md:max-w-[75%] rounded-[2rem] px-6 py-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white dark:bg-blue-700 rounded-tr-none' 
                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border dark:border-slate-800 rounded-tl-none'
            }`}>
              {msg.attachment && (
                <div className="mb-4 rounded-2xl overflow-hidden border dark:border-slate-800">
                  {msg.attachment.type === 'image' ? <img src={msg.attachment.url} className="w-full max-h-64 object-cover" /> : <video src={msg.attachment.url} className="w-full" controls />}
                </div>
              )}
              <div className="text-[15px] whitespace-pre-wrap leading-relaxed">{msg.text}</div>
              {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                <div className="mt-4 pt-4 border-t dark:border-slate-800 flex flex-wrap gap-2">
                  {msg.groundingChunks.map((chunk: any, i: number) => (
                    <a key={i} href={chunk.web?.uri || chunk.maps?.uri} target="_blank" className="text-[10px] px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full font-bold text-blue-500 truncate max-w-[200px]">
                      {chunk.web?.title || chunk.maps?.title || "View Source"}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div className="animate-pulse flex gap-2"><div className="w-2 h-2 bg-blue-500 rounded-full"></div><div className="w-2 h-2 bg-blue-500 rounded-full delay-75"></div><div className="w-2 h-2 bg-blue-500 rounded-full delay-150"></div></div>}
      </div>

      <div className="absolute bottom-6 left-4 right-4 md:left-8 md:right-8">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {attachment && (
            <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border dark:border-slate-800 flex items-center gap-3 self-start shadow-xl animate-in slide-in-from-bottom-2">
               <div className="w-12 h-12 rounded-xl overflow-hidden">
                 {attachment.type === 'image' ? <img src={attachment.preview} className="w-full h-full object-cover" /> : <i className="fa-solid fa-video flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800"></i>}
               </div>
               <span className="text-xs font-bold truncate max-w-[150px]">{attachment.file.name}</span>
               <button onClick={() => setAttachment(null)} className="p-2 text-red-500"><i className="fa-solid fa-xmark"></i></button>
            </div>
          )}
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-2xl rounded-[2.5rem] p-2 flex items-center gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500"><i className="fa-solid fa-paperclip"></i></button>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
            <input 
              className="flex-1 bg-transparent px-4 py-3 focus:outline-none dark:text-white font-medium"
              placeholder="Message your research hub..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button onClick={handleSend} disabled={isLoading} className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"><i className="fa-solid fa-arrow-up"></i></button>
          </div>
        </div>
      </div>
    </div>
  );
};
