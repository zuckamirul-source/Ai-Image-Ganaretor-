import { useState } from 'react';
import { Download, Copy, Play, Loader2, Sparkles, Code, Eye, FileArchive, Settings2 } from 'lucide-react';
import { generateSvg } from './lib/gemini';
import JSZip from 'jszip';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [svgCodes, setSvgCodes] = useState<string[]>(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">\\n  <rect width="400" height="400" fill="#f8fafc" />\\n  <text x="200" y="200" font-family="sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8">\\n    Your SVG will appear here\\n  </text>\\n</svg>']);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [generateCount, setGenerateCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const codes = await generateSvg(prompt, generateCount);
      setSvgCodes(codes);
      setSelectedIndex(0);
      setActiveTab('preview');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate SVG. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(svgCodes[selectedIndex]);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([svgCodes[selectedIndex]], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated-${Date.now()}-${selectedIndex + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = async () => {
    if (svgCodes.length === 1) {
      handleDownloadSingle();
      return;
    }
    
    const zip = new JSZip();
    svgCodes.forEach((code, index) => {
      zip.file(`svg-variation-${index + 1}.svg`, code);
    });
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svg-variations-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 text-indigo-600">
          <Sparkles className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tight">AI SVG Generator</h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleCopy}
            title="Copy Current SVG Code"
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <Copy className="w-5 h-5" />
          </button>
          <button 
            onClick={svgCodes.length > 1 ? handleDownloadAll : handleDownloadSingle}
            title={svgCodes.length > 1 ? "Download All as ZIP" : "Download SVG"}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md transition-colors"
          >
            {svgCodes.length > 1 ? <FileArchive className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {svgCodes.length > 1 ? "Download All (ZIP)" : "Download"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Controls & Code */}
        <aside className="w-full lg:w-1/3 flex flex-col bg-white border-r border-slate-200 shadow-sm z-0">
          
          {/* Prompt Section */}
          <div className="p-6 border-b border-slate-100 flex-shrink-0">
            <label htmlFor="prompt" className="block text-sm font-semibold text-slate-700 mb-2">
              Describe what you want to create
            </label>
            <textarea
              id="prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A cute robot waving hello, colorful flat design..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            
            <div className="mt-4 flex items-center justify-between">
              <label htmlFor="count" className="text-sm font-medium text-slate-600 flex items-center gap-1">
                <Settings2 className="w-4 h-4" />
                Variations
              </label>
              <select 
                id="count"
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="text-sm rounded-md border border-slate-300 px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>1 Image</option>
                <option value={4}>4 Images</option>
                <option value={10}>10 Images</option>
              </select>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                {error}
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating {generateCount}...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Generate {generateCount} (Cmd+Enter)
                </>
              )}
            </button>
          </div>

          {/* Code Editor Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Code className="w-4 h-4" />
                Raw SVG Code {svgCodes.length > 1 && `(${selectedIndex + 1}/${svgCodes.length})`}
              </h2>
            </div>
            <div className="flex-1 p-0 relative">
              <textarea
                value={svgCodes[selectedIndex] || ''}
                onChange={(e) => {
                  const newCodes = [...svgCodes];
                  newCodes[selectedIndex] = e.target.value;
                  setSvgCodes(newCodes);
                }}
                className="absolute inset-0 w-full h-full p-6 text-sm font-mono text-slate-600 bg-slate-50 border-none focus:outline-none focus:ring-0 resize-none leading-relaxed"
                spellCheck="false"
              />
            </div>
          </div>
        </aside>

        {/* Right Content: Preview */}
        <section className="flex-1 flex flex-col min-h-[50vh] bg-slate-100/50 relative">
          {/* Mobile Tabs */}
          <div className="lg:hidden flex border-b border-slate-200 bg-white">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'preview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'code' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
              }`}
            >
              <Code className="w-4 h-4" />
              Code
            </button>
          </div>
          
          <div className={`flex-1 flex flex-col overflow-hidden ${activeTab === 'code' ? 'hidden lg:flex' : 'flex'}`}>
            {/* Main Preview */}
            <div className="flex-1 relative p-6 flex justify-center items-center">
              <div className="absolute inset-x-8 inset-y-8 lg:inset-16 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex items-center justify-center checkerboard">
                <style>{`
                  .checkerboard {
                    background-image: linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
                      linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
                      linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
                    background-size: 20px 20px;
                    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                  }
                `}</style>
                
                <div 
                  className="w-full h-full max-w-full max-h-full flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto transition-all"
                  dangerouslySetInnerHTML={{ __html: svgCodes[selectedIndex] || '' }}
                />
                
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10 w-full h-full">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                      <p className="text-sm font-medium text-slate-600 animate-pulse">Designing your SVGs...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {svgCodes.length > 1 && (
              <div className="h-24 bg-white border-t border-slate-200 flex-shrink-0 flex items-center px-4 overflow-x-auto gap-3 py-2 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                {svgCodes.map((code, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex-shrink-0 w-16 h-16 rounded-md border-2 overflow-hidden transition-all checkerboard ${
                      selectedIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-200 ring-offset-1' : 'border-slate-200 hover:border-indigo-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div 
                      className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full"
                      dangerouslySetInnerHTML={{ __html: code }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
