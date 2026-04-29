import { useState, useEffect } from 'react';
import { Download, Copy, Play, Loader2, Sparkles, Code, Eye, FileArchive, Settings2, Key, Check, X, ShieldCheck } from 'lucide-react';
import JSZip from 'jszip';
import { generateSvg, AIProvider } from './lib/aiService';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [svgCodes, setSvgCodes] = useState<string[]>(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%"><rect width="400" height="400" fill="#f8fafc" /><text x="200" y="200" font-family="sans-serif" font-size="24" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8">Your SVG will appear here</text></svg>']);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [generateCount, setGenerateCount] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [activeProvider, setActiveProvider] = useState<AIProvider>(() => (localStorage.getItem('AI_PROVIDER') as AIProvider) || 'gemini');
  const [customGeminiApiKey, setCustomGeminiApiKey] = useState<string>(() => localStorage.getItem('GEMINI_CUSTOM_API_KEY') || '');
  const [groqApiKey, setGroqApiKey] = useState<string>(() => localStorage.getItem('GROQ_API_KEY') || '');
  const [claudeApiKey, setClaudeApiKey] = useState<string>(() => localStorage.getItem('CLAUDE_API_KEY') || '');
  const [deepseekApiKey, setDeepseekApiKey] = useState<string>(() => localStorage.getItem('DEEPSEEK_API_KEY') || '');
  const [autoFallback, setAutoFallback] = useState<boolean>(() => localStorage.getItem('AUTO_FALLBACK') !== 'false');
  const [showSettings, setShowSettings] = useState(false);
  
  useEffect(() => {
    localStorage.setItem('AI_PROVIDER', activeProvider);
  }, [activeProvider]);

  useEffect(() => {
    localStorage.setItem('AUTO_FALLBACK', String(autoFallback));
  }, [autoFallback]);

  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Content = (event.target?.result as string).split(',')[1];
      setSelectedImage({
        data: base64Content,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setPrompt('');
    setSvgCodes([]);
    setSelectedIndex(0);
    setError(null);
    setSelectedImage(null);
  };
  
  const handleGenerate = async () => {
    if (!prompt.trim() && !selectedImage) {
      setError("Please provide a prompt or an image.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      let apiKey: string | undefined;
      let providerToUse = activeProvider;
      
      if (providerToUse === 'gemini') apiKey = customGeminiApiKey;
      else if (providerToUse === 'groq') apiKey = groqApiKey;
      else if (providerToUse === 'claude') apiKey = claudeApiKey;
      else if (providerToUse === 'deepseek') apiKey = deepseekApiKey;

      const promptToSubmit = prompt || "Analyze this image and create a professional vector representation.";
      
      let codes: string[];
      try {
        codes = await generateSvg(promptToSubmit, generateCount, apiKey || undefined, providerToUse, selectedImage || undefined);
      } catch (err: any) {
        const errorMsg = (err.message || '').toLowerCase();
        const isQuotaOrBalance = errorMsg.includes("quota") || errorMsg.includes("balance") || errorMsg.includes("credit") || errorMsg.includes("402") || errorMsg.includes("429");
        
        if (autoFallback && providerToUse !== 'gemini' && isQuotaOrBalance) {
          console.warn("Provider failed, falling back to Gemini...", err);
          codes = await generateSvg(promptToSubmit, generateCount, customGeminiApiKey || undefined, 'gemini', selectedImage || undefined);
        } else {
          throw err;
        }
      }
      
      setSvgCodes(codes);
      setSelectedIndex(0);
      setActiveTab('preview');
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || '';
      
      const isQuotaError = errorMessage.includes("quota") || errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
      const isBalanceError = errorMessage.includes("balance") || errorMessage.includes("credit") || errorMessage.includes("billing") || errorMessage.includes("402") || errorMessage.includes("Insufficient Balance");
      const isPermissionError = errorMessage.includes("403") || errorMessage.includes("Permission Denied") || errorMessage.includes("PERMISSION_DENIED");
      const isJsonError = errorMessage.includes("JSON Error");

      if (isQuotaError) {
        setError("AI Quota Exceeded. The current provider is busy or limit reached. Please try again in 60s or switch providers in Settings.");
      } else if (isBalanceError) {
        setError("Insufficient API Balance (402). Your account for " + activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1) + " does not have enough credits. Please check your billing dashboard.");
      } else if (isPermissionError) {
        setError("Permission Denied (403). The API key for " + activeProvider.charAt(0).toUpperCase() + activeProvider.slice(1) + " is invalid or restricted. Please check your API settings.");
      } else if (isJsonError) {
        setError(errorMessage);
      } else {
        setError(errorMessage || 'Failed to generate SVG. Please check your connection or API key and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToGemini = () => {
    setActiveProvider('gemini');
    setError(null);
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
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
            className={`p-2 rounded-md transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>
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

      {/* Settings Overlay */}
      {showSettings && (
        <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm animate-in slide-in-from-top duration-200">
          <div className="max-w-xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-indigo-500" />
                AI Configuration
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select AI Provider</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setActiveProvider('gemini')}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-sm font-medium rounded-md border-2 transition-all ${
                    activeProvider === 'gemini' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Gemini
                </button>
                <button
                  onClick={() => setActiveProvider('claude')}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-sm font-medium rounded-md border-2 transition-all ${
                    activeProvider === 'claude' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Claude
                </button>
                <button
                  onClick={() => setActiveProvider('deepseek')}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-sm font-medium rounded-md border-2 transition-all ${
                    activeProvider === 'deepseek' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  DeepSeek
                </button>
                <button
                  onClick={() => setActiveProvider('groq')}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-sm font-medium rounded-md border-2 transition-all ${
                    activeProvider === 'groq' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Groq
                </button>
              </div>
            </div>

            {activeProvider === 'gemini' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gemini API Key</h3>
                  {!customGeminiApiKey && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Default Key Active</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={customGeminiApiKey}
                    onChange={(e) => {
                      setCustomGeminiApiKey(e.target.value);
                      localStorage.setItem('GEMINI_CUSTOM_API_KEY', e.target.value);
                    }}
                    placeholder="Enter your Gemini API Key..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {customGeminiApiKey && (
                    <button onClick={() => {
                      setCustomGeminiApiKey('');
                      localStorage.removeItem('GEMINI_CUSTOM_API_KEY');
                    }} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors">Clear</button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Stored locally in your browser. Not sent to our servers.</p>
              </div>
            )}

            {activeProvider === 'claude' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anthropic API Key</h3>
                  {!claudeApiKey && <span className="text-[10px] text-orange-500 font-medium">Required for Claude</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={claudeApiKey}
                    onChange={(e) => {
                      setClaudeApiKey(e.target.value);
                      localStorage.setItem('CLAUDE_API_KEY', e.target.value);
                    }}
                    placeholder="sk-ant-..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {claudeApiKey && (
                    <button onClick={() => {
                      setClaudeApiKey('');
                      localStorage.removeItem('CLAUDE_API_KEY');
                    }} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors">Clear</button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Claude 3.5 Sonnet is highly recommended for complex vector art.</p>
              </div>
            )}

            {activeProvider === 'deepseek' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">DeepSeek API Key</h3>
                  {!deepseekApiKey && <span className="text-[10px] text-orange-500 font-medium">Required for DeepSeek</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={deepseekApiKey}
                    onChange={(e) => {
                      setDeepseekApiKey(e.target.value);
                      localStorage.setItem('DEEPSEEK_API_KEY', e.target.value);
                    }}
                    placeholder="sk-..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {deepseekApiKey && (
                    <button onClick={() => {
                      setDeepseekApiKey('');
                      localStorage.removeItem('DEEPSEEK_API_KEY');
                    }} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors">Clear</button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">DeepSeek-V3 is an excellent cost-effective option for SVG generation.</p>
              </div>
            )}

            {activeProvider === 'groq' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Groq API Key</h3>
                  {!groqApiKey && <span className="text-[10px] text-orange-500 font-medium">Required for Groq</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={groqApiKey}
                    onChange={(e) => {
                      setGroqApiKey(e.target.value);
                      localStorage.setItem('GROQ_API_KEY', e.target.value);
                    }}
                    placeholder="gsk_..."
                    className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {groqApiKey && (
                    <button onClick={() => {
                      setGroqApiKey('');
                      localStorage.removeItem('GROQ_API_KEY');
                    }} className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors">Clear</button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">Stored locally in your browser. Groq is recommended for faster generation.</p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative inline-flex items-center">
                  <input 
                    type="checkbox" 
                    checked={autoFallback}
                    onChange={(e) => setAutoFallback(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-[11px] font-medium text-slate-600 group-hover:text-indigo-600 transition-colors">
                  Auto-fallback to Gemini (Free) on provider error
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Controls & Code */}
        <aside className="w-full lg:w-1/3 flex flex-col bg-white border-r border-slate-200 shadow-sm z-0">
          
          {/* Prompt Section */}
          <div className="p-6 border-b border-slate-100 flex-shrink-0">
            <div className="flex flex-col gap-4">
              {/* Image Upload Area */}
              <div className="relative group">
                <div className={`border-2 border-dashed rounded-lg p-4 transition-all ${selectedImage ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}>
                  {selectedImage ? (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                          className="w-12 h-12 rounded object-cover border border-indigo-200" 
                          alt="Source preview" 
                        />
                        <div>
                          <p className="text-xs font-semibold text-indigo-700">Source Image Active</p>
                          <p className="text-[10px] text-indigo-500">Image analysis enabled</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedImage(null)}
                        className="p-1.5 hover:bg-indigo-100 rounded text-indigo-400 hover:text-indigo-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-2">
                      <FileArchive className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      <span className="text-xs font-medium text-slate-500 group-hover:text-indigo-600">
                        Drop source image or <span className="text-indigo-600 underline">browse</span>
                      </span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="prompt" className="block text-sm font-semibold text-slate-700 mb-2">
                  Instructions for the AI
                </label>
                <textarea
                  id="prompt"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={selectedImage ? "Describe how to modify this image or just click Generate..." : "A cute robot waving hello, colorful flat design..."}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
              </div>
            </div>
            
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
                <option value={20}>20 Images (Slower)</option>
                <option value={50}>50 Images (High Quota Risk)</option>
                <option value={100}>100 Images (Expert/Custom Key)</option>
              </select>
            </div>

            {generateCount >= 20 && (
              <p className="mt-2 text-[10px] text-amber-600 font-medium bg-amber-50 p-1.5 rounded border border-amber-100 italic">
                Note: Generating many variations at once may hit AI rate limits or take significantly longer.
              </p>
            )}

            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100 flex flex-col gap-2">
                <p>{error}</p>
                {(activeProvider !== 'gemini' && (
                  error.toLowerCase().includes('quota') || 
                  error.toLowerCase().includes('balance') || 
                  error.toLowerCase().includes('credit') || 
                  error.toLowerCase().includes('402') ||
                  error.toLowerCase().includes('insufficient')
                )) && (
                  <button 
                    onClick={handleSwitchToGemini}
                    className="text-xs font-bold bg-white text-indigo-600 px-3 py-2 rounded-md border border-indigo-200 hover:bg-indigo-50 transition-colors w-fit flex items-center gap-1.5 shadow-sm mt-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Switch back to Gemini (Free)
                  </button>
                )}
              </div>
            )}
            
            <div className="mt-4 flex gap-2">
              <button
                id="generate-button"
                onClick={handleGenerate}
                disabled={isLoading || !prompt.trim()}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
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
              
              <button
                onClick={handleClear}
                disabled={isLoading || (!prompt.trim() && svgCodes.length === 0)}
                title="Clear all inputs and results"
                className="px-4 py-2.5 rounded-md font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-slate-200"
              >
                Clear
              </button>
            </div>
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

                {svgCodes[selectedIndex] && (
                  <div className="absolute bottom-4 right-4 flex gap-2">
                    <button
                      onClick={() => handleCopy()}
                      className="p-2 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-sm border border-slate-200 transition-all flex items-center gap-2 text-sm font-medium"
                      title="Copy SVG Code"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                    <button
                      onClick={() => handleDownloadSingle()}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-2 text-sm font-medium"
                      title="Download SVG"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                )}
                
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
              <div className="h-28 bg-white border-t border-slate-200 flex-shrink-0 flex items-center px-4 overflow-x-auto gap-3 py-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {svgCodes.map((code, idx) => (
                  <div key={idx} className="relative group flex-shrink-0">
                    <button
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-16 h-16 rounded-md border-2 overflow-hidden transition-all checkerboard ${
                        selectedIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-200 ring-offset-1' : 'border-slate-200 hover:border-indigo-300 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div 
                        className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full p-1"
                        dangerouslySetInnerHTML={{ __html: code }}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const blob = new Blob([code], { type: 'image/svg+xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `variation-${idx + 1}.svg`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="absolute -top-1 -right-1 p-1.5 bg-indigo-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md scale-75 hover:scale-100"
                      title="Download Individual"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <div className="absolute -bottom-5 left-0 right-0 text-[10px] text-center text-slate-400 font-mono">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
