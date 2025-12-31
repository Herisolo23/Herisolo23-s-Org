
import React, { useState, useMemo, useRef, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  MarkerType,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import { Source } from '../types';
import { gemini } from '../services/geminiService';
import { marked } from 'marked';

const VIDEO_STYLES = ['Cinematic', 'Cyberpunk', 'Noir', 'Vibrant', 'Minimalist', 'Vintage', 'Abstract', 'Sci-Fi'];
const VIDEO_CAMERAS = ['Static', 'Slow Pan', 'Tracking Shot', 'Drone Flyover', 'Handheld', 'Low Angle', 'Zoom In'];
const VIDEO_MOODS = ['Epic', 'Mysterious', 'Energetic', 'Melancholic', 'Serene', 'Intense', 'Hopeful'];

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const MindMapContent = ({ data }: { data: any }) => {
  const { setCenter } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const initialNodes = useMemo(() => (data.nodes || []).map((node: any, idx: number) => ({
    id: node.id,
    data: { label: node.label, description: node.description },
    position: { x: 400 + Math.cos(idx * (2 * Math.PI / data.nodes.length)) * 300, y: 400 + Math.sin(idx * (2 * Math.PI / data.nodes.length)) * 300 },
    style: { padding: '16px', fontWeight: 'bold', borderRadius: '1.5rem', border: 'none', backgroundColor: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: 150, textAlign: 'center' }
  })), [data]);

  const initialEdges = useMemo(() => (data.edges || []).map((edge: any, idx: number) => ({
    id: `e-${idx}`, source: edge.source, target: edge.target, animated: true, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
  })), [data]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = (_: any, node: any) => {
    setSelectedNode(node.data);
    setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 800 });
  };

  return (
    <div className="w-full h-full relative bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} fitView>
        <Background />
        <Controls />
      </ReactFlow>
      {selectedNode && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-sm w-[90%] bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-2xl animate-enter">
          <h4 className="text-lg font-black mb-2">{selectedNode.label}</h4>
          <p className="text-sm text-slate-500 italic">{selectedNode.description}</p>
          <button onClick={() => setSelectedNode(null)} className="mt-4 w-full py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-bold">Tutup</button>
        </div>
      )}
    </div>
  );
};

export const StudioHub: React.FC<{ sources: Source[] }> = ({ sources }) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const [imageSize, setImageSize] = useState<"1K"|"2K"|"4K">("1K");
  const [imagePrompt, setImagePrompt] = useState("");
  const [veoPrompt, setVeoPrompt] = useState("");
  const [veoRatio, setVeoRatio] = useState<'16:9'|'9:16'>('16:9');
  const [veoStyle, setVeoStyle] = useState(VIDEO_STYLES[0]);
  const [veoCamera, setVeoCamera] = useState(VIDEO_CAMERAS[0]);
  const [veoMood, setVeoMood] = useState(VIDEO_MOODS[0]);

  const handleToolAction = async (id: string) => {
    if (sources.length === 0 && !['imagePro', 'veoVideo'].includes(id)) return alert("Tambahkan sumber terlebih dahulu.");
    setLoading(true);
    setActiveTool(id);
    try {
      const texts = sources.map(s => s.content);
      if (id === 'mindmap') setResult(await gemini.generateMindMap(texts));
      if (id === 'report') setResult(await gemini.generateReport(texts));
      if (id === 'podcast') setResult(await gemini.generatePodcast(texts));
      if (id === 'summary') setResult(await gemini.generateExecutiveSummary(texts));
    } catch (e) { setActiveTool(null); }
    finally { setLoading(false); }
  };

  const generateImage = async () => {
    if (!(await (window as any).aistudio.hasSelectedApiKey())) await (window as any).aistudio.openSelectKey();
    setLoading(true);
    try { setResult(await gemini.generateImagePro(imagePrompt, imageSize)); }
    catch (e) { alert("Gagal membuat gambar."); }
    finally { setLoading(false); }
  };

  const generateVideo = async () => {
    if (!(await (window as any).aistudio.hasSelectedApiKey())) await (window as any).aistudio.openSelectKey();
    setLoading(true);
    try {
      const fullPrompt = `Style: ${veoStyle}, Camera: ${veoCamera}, Mood: ${veoMood}. Action: ${veoPrompt}`;
      setResult(await gemini.generateVideoVeo(fullPrompt, veoRatio));
    } catch (e) { alert("Gagal membuat video."); }
    finally { setLoading(false); }
  };

  const playPodcast = async (base64: string) => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const buffer = await decodeAudioData(decodeBase64(base64), ctx, 24000, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  };

  const tools = [
    { id: 'summary', title: 'Executive Summary', icon: 'fa-compress', color: 'bg-cyan-500', desc: 'Ringkasan eksekutif dari seluruh riset.' },
    { id: 'imagePro', title: 'Nano Image Pro', icon: 'fa-palette', color: 'bg-amber-500', desc: 'Hasilkan ilustrasi riset kualitas 1K-4K.' },
    { id: 'veoVideo', title: 'Veo Video Lab', icon: 'fa-clapperboard', color: 'bg-rose-500', desc: 'Ubah ide menjadi video sinematik AI.' },
    { id: 'mindmap', title: 'Mind Map', icon: 'fa-network-wired', color: 'bg-indigo-500', desc: 'Visualisasi hubungan antar konsep.' },
    { id: 'podcast', title: 'Audio Deep Dive', icon: 'fa-microphone-lines', color: 'bg-purple-600', desc: 'Dengarkan Joe & Jane membahas risetmu.' },
    { id: 'report', title: 'Formal Report', icon: 'fa-file-invoice', color: 'bg-slate-700', desc: 'Laporan akademik terstruktur otomatis.' }
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors p-4 md:p-8 overflow-hidden">
      {!activeTool ? (
        <div className="max-w-5xl mx-auto w-full pt-4">
          <header className="mb-10">
            <h2 className="text-4xl font-black tracking-tighter text-slate-800 dark:text-white">AI Studio Lab</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Transformasikan risetmu menjadi aset digital.</p>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map(tool => (
              <button key={tool.id} onClick={() => handleToolAction(tool.id)} className="group bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 text-left hover:shadow-2xl transition-all active:scale-95">
                <div className={`${tool.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg`}><i className={`fa-solid ${tool.icon} text-2xl`}></i></div>
                <h3 className="text-xl font-black mb-2 dark:text-white">{tool.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{tool.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full animate-enter">
          <header className="flex items-center justify-between mb-8">
            <button onClick={() => { setActiveTool(null); setResult(null); }} className="px-6 py-3 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 font-black uppercase text-[10px] tracking-widest text-slate-500 flex items-center gap-2">
              <i className="fa-solid fa-arrow-left"></i> Kembali
            </button>
            <div className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest">
              {tools.find(t => t.id === activeTool)?.title}
            </div>
          </header>

          <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-2xl border dark:border-slate-800 overflow-hidden flex flex-col relative">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                 <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                 <h3 className="text-xl font-black mb-2 dark:text-white">Memproses Data AI...</h3>
                 <p className="text-slate-500 text-sm italic">Gemini sedang bekerja untuk risetmu.</p>
              </div>
            ) : result ? (
              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center">
                 {activeTool === 'imagePro' && <img src={result} className="max-h-[70vh] rounded-3xl shadow-2xl border-4 border-white dark:border-slate-800" />}
                 {activeTool === 'veoVideo' && <video src={result} controls autoPlay className="max-h-[70vh] rounded-3xl shadow-2xl" />}
                 {activeTool === 'mindmap' && <ReactFlowProvider><MindMapContent data={result} /></ReactFlowProvider>}
                 {activeTool === 'report' || activeTool === 'summary' ? <div className="prose dark:prose-invert max-w-none w-full p-6" dangerouslySetInnerHTML={{ __html: marked.parse(result) }} /> : null}
                 {activeTool === 'podcast' && (
                    <div className="text-center">
                       <div className="w-48 h-48 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 mb-8 mx-auto"><i className="fa-solid fa-microphone-lines text-6xl animate-pulse"></i></div>
                       <button onClick={() => playPodcast(result)} className="px-12 py-5 bg-purple-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-sm shadow-xl active:scale-95"><i className="fa-solid fa-play mr-3"></i> Putar Podcast</button>
                    </div>
                 )}
                 <button onClick={() => setResult(null)} className="mt-10 px-10 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-500">Buat Baru</button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                {activeTool === 'imagePro' && (
                  <div className="max-w-2xl mx-auto space-y-8">
                    <h3 className="text-3xl font-black text-center dark:text-white">AI Art Generator</h3>
                    <textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Contoh: Representasi abstrak dari teori relativitas dalam gaya seni futuristik..." className="w-full p-8 bg-slate-50 dark:bg-slate-950 rounded-[2rem] text-lg font-medium italic border-none focus:ring-4 ring-amber-500/10 min-h-[150px] dark:text-white" />
                    <div className="flex gap-4">
                       {["1K", "2K", "4K"].map(s => <button key={s} onClick={() => setImageSize(s as any)} className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all ${imageSize === s ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-transparent'}`}>{s}</button>)}
                    </div>
                    <button onClick={generateImage} className="w-full py-6 bg-amber-500 text-white rounded-[2.5rem] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Hasilkan Karya Seni</button>
                  </div>
                )}
                
                {activeTool === 'veoVideo' && (
                  <div className="max-w-3xl mx-auto space-y-10">
                    <h3 className="text-3xl font-black text-center dark:text-white">Veo Cinema Lab</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Gaya Visual</label>
                        <select value={veoStyle} onChange={e => setVeoStyle(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border-none text-xs font-bold dark:text-white">
                          {VIDEO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Gerakan Kamera</label>
                        <select value={veoCamera} onChange={e => setVeoCamera(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border-none text-xs font-bold dark:text-white">
                          {VIDEO_CAMERAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nuansa (Mood)</label>
                        <select value={veoMood} onChange={e => setVeoMood(e.target.value)} className="w-full p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border-none text-xs font-bold dark:text-white">
                          {VIDEO_MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea value={veoPrompt} onChange={e => setVeoPrompt(e.target.value)} placeholder="Apa yang terjadi di video ini? Jelaskan aksi atau subjeknya..." className="w-full p-8 bg-slate-50 dark:bg-slate-950 rounded-[2rem] text-lg font-medium italic border-none focus:ring-4 ring-rose-500/10 min-h-[140px] dark:text-white" />
                    <div className="flex gap-4">
                       <button onClick={() => setVeoRatio('16:9')} className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all ${veoRatio === '16:9' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-transparent'}`}>Landscape (16:9)</button>
                       <button onClick={() => setVeoRatio('9:16')} className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all ${veoRatio === '9:16' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-transparent'}`}>Portrait (9:16)</button>
                    </div>
                    <button onClick={generateVideo} className="w-full py-6 bg-rose-500 text-white rounded-[2.5rem] font-black uppercase tracking-widest shadow-xl active:scale-95">Mulai Render Video</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
