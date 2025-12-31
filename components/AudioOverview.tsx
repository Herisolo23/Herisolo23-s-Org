
import React, { useState, useRef, useEffect } from 'react';
import { Source } from '../types';
import { gemini } from '../services/geminiService';

interface AudioOverviewProps {
  sources: Source[];
}

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const AudioOverview: React.FC<AudioOverviewProps> = ({ sources }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    return () => stopPlayback();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const stopPlayback = () => {
    if (activeSourceNodeRef.current) {
      try { activeSourceNodeRef.current.stop(); } catch (e) {}
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
    }
    activeSourceNodeRef.current = null;
    setIsPlaying(false);
  };

  const startPlayback = (buffer: AudioBuffer, fromOffset: number = 0) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    stopPlayback();
    const sourceNode = audioContextRef.current.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(audioContextRef.current.destination);
    startTimeRef.current = audioContextRef.current.currentTime;
    offsetRef.current = fromOffset;
    setIsPlaying(true);
    setCurrentTime(fromOffset);
    sourceNode.onended = () => {
      if (audioContextRef.current && Math.abs((audioContextRef.current.currentTime - startTimeRef.current) + offsetRef.current - buffer.duration) < 0.1) {
        setIsPlaying(false);
        setCurrentTime(0);
        offsetRef.current = 0;
      }
    };
    activeSourceNodeRef.current = sourceNode;
    sourceNode.start(0, fromOffset);
    progressIntervalRef.current = window.setInterval(() => {
      if (!audioContextRef.current) return;
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) + offsetRef.current;
      setCurrentTime(Math.min(elapsed, buffer.duration));
    }, 100);
  };

  const pauseAudio = () => {
    if (!audioContextRef.current || !activeSourceNodeRef.current) return;
    offsetRef.current += (audioContextRef.current.currentTime - startTimeRef.current);
    try { activeSourceNodeRef.current.stop(); } catch(e) {}
    activeSourceNodeRef.current = null;
    setIsPlaying(false);
    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
  };

  const resumeAudio = () => { if (audioBuffer) startPlayback(audioBuffer, offsetRef.current); };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioBuffer) { startPlayback(audioBuffer, newTime); }
  };

  const generateAudio = async () => {
    if (sources.length === 0) return;
    setIsGenerating(true);
    setAudioBuffer(null);
    setCurrentTime(0);
    offsetRef.current = 0;
    setLoadingStep('Reviewing your sources...');

    try {
      const sourceTexts = sources.map(s => `Title: ${s.title}\nContent: ${s.content}`);
      const audioBase64 = await gemini.generatePodcast(sourceTexts);
      if (audioBase64) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const bytes = decodeBase64(audioBase64);
        const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
        setAudioBuffer(buffer);
        startPlayback(buffer);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate audio overview.");
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-950 p-6 md:p-8 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar transition-colors">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[2rem] p-8 md:p-12 shadow-2xl dark:shadow-none border border-gray-100 dark:border-slate-800 text-center animate-in fade-in zoom-in duration-500">
        {!audioBuffer && !isGenerating ? (
          <>
            <div className="bg-purple-100 dark:bg-purple-900/30 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-8 rotate-3 shadow-inner">
              <i className="fa-solid fa-microphone-lines text-purple-600 dark:text-purple-400 text-4xl"></i>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 mb-4">Audio Deep Dive</h2>
            <p className="text-gray-500 dark:text-slate-400 mb-10 text-lg leading-relaxed">Generate an engaging podcast discussion between two AI experts who break down your research materials.</p>
            <button onClick={generateAudio} disabled={sources.length === 0} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-5 rounded-3xl font-bold flex items-center justify-center gap-4 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-purple-200 dark:shadow-none">
              <i className="fa-solid fa-wand-magic-sparkles"></i> Create Podcast Discussion
            </button>
          </>
        ) : isGenerating ? (
          <div className="space-y-10 py-6">
            <div className="relative">
              <div className="w-32 h-32 bg-purple-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-purple-100 dark:border-slate-700 animate-pulse">
                <i className="fa-solid fa-brain text-purple-600 dark:text-purple-400 text-5xl"></i>
              </div>
            </div>
            <div className="space-y-4">
              <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 h-full w-2/3 animate-[progress_3s_ease-in-out_infinite]"></div>
              </div>
              <p className="text-purple-600 dark:text-purple-400 font-bold text-sm tracking-widest uppercase animate-pulse">{loadingStep}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-3xl shadow-xl flex items-center justify-center text-white mb-6">
                 <i className={`fa-solid ${isPlaying ? 'fa-volume-high animate-pulse' : 'fa-volume-off'} text-4xl`}></i>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Deep Dive Ready</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm mt-2">Featuring Joe and Jane</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-inner">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex flex-col items-start">
                   <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Duration</span>
                   <span className="text-sm font-mono font-bold text-gray-700 dark:text-slate-300">{formatTime(currentTime)} / {formatTime(audioBuffer.duration)}</span>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => isPlaying ? pauseAudio() : resumeAudio()} className="w-16 h-16 rounded-3xl bg-blue-600 dark:bg-blue-700 text-white flex items-center justify-center shadow-xl shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all">
                      <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                    </button>
                 </div>
                 <div className="w-10"></div>
               </div>
               <div className="relative group">
                 <input type="range" min="0" max={audioBuffer.duration} step="0.1" value={currentTime} onChange={handleSeek} className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400" />
               </div>
            </div>
            <button onClick={generateAudio} className="text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline">Regenerate Overview</button>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}} />
    </div>
  );
};
