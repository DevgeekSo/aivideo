import React, { useState, useEffect } from 'react';
import { Sparkles, Key, FileText, Plus, Trash2, Video, RefreshCw } from 'lucide-react';
import { generateVideoScript } from '../utils/aiHelpers';

const PRESETS = [
  {
    name: "Faceless Tech",
    prompt: "A motivational short vertical video about why coding is the superpower of the 21st century.",
    icon: "🎬"
  },
  {
    name: "Dialogue Podcast",
    prompt: "A funny back-and-forth dialogue between two programmers discussing tabs vs spaces in code.",
    icon: "🎙️"
  },
  {
    name: "Solo Guru Tip",
    prompt: "Provide a high-impact productivity tip for developers to beat procrastination and build projects.",
    icon: "💡"
  },
  {
    name: "Tweet Slide",
    prompt: "Showcase a funny tweet complaining about spending hours debugging a missing semicolon.",
    icon: "🐦"
  }
];

export default function ScriptGenerator({
  onScriptGenerated = () => {},
  scenes = [],
  setScenes = () => {},
  videoProfile = 'faceless',
  setVideoProfile = () => {},
  scriptData = null,
  setScriptData = () => {},
  targetDuration = 'auto',
  setTargetDuration = () => {}
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  // API keys states loaded from localStorage (hardcoded user keys as default fallbacks)
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('key_gemini') || import.meta.env.VITE_GEMINI_API_KEY || "");
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('key_anthropic') || import.meta.env.VITE_ANTHROPIC_API_KEY || "");
  const [pexelsKey, setPexelsKey] = useState(() => localStorage.getItem('key_pexels') || import.meta.env.VITE_PEXELS_API_KEY || "");
  const [pixabayKey, setPixabayKey] = useState(() => localStorage.getItem('key_pixabay') || "");
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('key_ai_provider') || "anthropic");

  // AI Video keys states
  const [aiVideoProvider, setAiVideoProvider] = useState(() => localStorage.getItem('key_aivideo_provider') || "mock");
  const [aiVideoKey, setAiVideoKey] = useState(() => localStorage.getItem('key_aivideo_key') || "");
  const [aiVideoCustomUrl, setAiVideoCustomUrl] = useState(() => localStorage.getItem('key_aivideo_custom_url') || "");
  const [aiVideoCustomHeaders, setAiVideoCustomHeaders] = useState(() => localStorage.getItem('key_aivideo_custom_headers') || '{\n  "Content-Type": "application/json"\n}');
  const [aiVideoCustomPayload, setAiVideoCustomPayload] = useState(() => localStorage.getItem('key_aivideo_custom_payload') || '{\n  "prompt": "{{prompt}}",\n  "aspect_ratio": "9:16"\n}');
  const [aiVideoCustomPath, setAiVideoCustomPath] = useState(() => localStorage.getItem('key_aivideo_custom_path') || 'video.url');

  // AI Image keys states
  const [aiImageProvider, setAiImageProvider] = useState(() => localStorage.getItem('key_aiimage_provider') || "cloudflare");
  const [aiImageKey, setAiImageKey] = useState(() => localStorage.getItem('key_aiimage_key') || "");
  const [aiImageAccountId, setAiImageAccountId] = useState(() => localStorage.getItem('key_aiimage_account_id') || "");
  const [aiImageModel, setAiImageModel] = useState(() => localStorage.getItem('key_aiimage_model') || "@cf/stabilityai/stable-diffusion-xl-base-1.0");

  // Sync keys to local storage on change
  useEffect(() => {
    localStorage.setItem('key_gemini', geminiKey);
  }, [geminiKey]);

  useEffect(() => {
    localStorage.setItem('key_anthropic', anthropicKey);
  }, [anthropicKey]);

  useEffect(() => {
    localStorage.setItem('key_pexels', pexelsKey);
  }, [pexelsKey]);

  useEffect(() => {
    localStorage.setItem('key_pixabay', pixabayKey);
  }, [pixabayKey]);

  useEffect(() => {
    localStorage.setItem('key_ai_provider', aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    localStorage.setItem('key_aivideo_provider', aiVideoProvider);
  }, [aiVideoProvider]);

  useEffect(() => {
    localStorage.setItem('key_aivideo_key', aiVideoKey);
  }, [aiVideoKey]);

  useEffect(() => {
    localStorage.setItem('key_aivideo_custom_url', aiVideoCustomUrl);
  }, [aiVideoCustomUrl]);

  useEffect(() => {
    localStorage.setItem('key_aivideo_custom_headers', aiVideoCustomHeaders);
  }, [aiVideoCustomHeaders]);

  useEffect(() => {
    localStorage.setItem('key_aivideo_custom_payload', aiVideoCustomPayload);
  }, [aiVideoCustomPayload]);

  useEffect(() => {
    localStorage.setItem('key_aivideo_custom_path', aiVideoCustomPath);
  }, [aiVideoCustomPath]);

  useEffect(() => {
    localStorage.setItem('key_aiimage_provider', aiImageProvider);
  }, [aiImageProvider]);

  useEffect(() => {
    localStorage.setItem('key_aiimage_key', aiImageKey);
  }, [aiImageKey]);

  useEffect(() => {
    localStorage.setItem('key_aiimage_account_id', aiImageAccountId);
  }, [aiImageAccountId]);

  useEffect(() => {
    localStorage.setItem('key_aiimage_model', aiImageModel);
  }, [aiImageModel]);

  // Ensure local storage is initialized with these defaults on load
  useEffect(() => {
    if (!localStorage.getItem('key_gemini')) {
      localStorage.setItem('key_gemini', import.meta.env.VITE_GEMINI_API_KEY || "");
    }
    if (!localStorage.getItem('key_anthropic')) {
      localStorage.setItem('key_anthropic', import.meta.env.VITE_ANTHROPIC_API_KEY || "");
    }
    if (!localStorage.getItem('key_pexels')) {
      localStorage.setItem('key_pexels', import.meta.env.VITE_PEXELS_API_KEY || "");
    }
    if (!localStorage.getItem('key_aiimage_key')) {
      localStorage.setItem('key_aiimage_key', '');
    }
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const activeKey = aiProvider === 'gemini' ? geminiKey : 
                        aiProvider === 'anthropic' ? anthropicKey : 
                        aiProvider === 'groq' ? (localStorage.getItem('key_groq') || "") : "";

      const data = await generateVideoScript(prompt, activeKey, targetDuration, aiProvider);
      
      // Update parent states
      setVideoProfile(data.videoProfile);
      setScriptData(data);
      
      // Process scenes to ensure proper IDs and default speakers
      const processedScenes = (data.scenes || []).map((s, idx) => ({
        ...s,
        id: s.id || `scene-${Date.now()}-${idx}`
      }));
      
      setScenes(processedScenes);
      onScriptGenerated(processedScenes, {
        geminiKey,
        anthropicKey,
        pexelsKey,
        pixabayKey,
        aiVideoProvider,
        aiVideoKey,
        aiVideoCustomUrl,
        aiVideoCustomHeaders,
        aiVideoCustomPayload,
        aiVideoCustomPath,
        aiImageProvider,
        aiImageKey,
        aiImageAccountId,
        aiImageModel
      }, data);
    } catch (e) {
      alert("Error generating script: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSceneChange = (id, field, value) => {
    const updated = scenes.map(s => {
      if (s.id === id) {
        return { ...s, [field]: value };
      }
      return s;
    });
    setScenes(updated);
  };

  const addScene = () => {
    const newScene = {
      id: `scene-${Date.now()}`,
      text: "New phrase block",
      text2: "",
      searchKeyword: "nature",
      duration: 3.5,
      speaker: "A",
      isSentenceBreak: false,
      videoSource: "pexels",
      promptForAiVideo: ""
    };
    setScenes([...scenes, newScene]);
  };

  const deleteScene = (id) => {
    setScenes(scenes.filter(s => s.id !== id));
  };

  return (
    <div className="flex-col gap-4 w-full">
      {/* Main prompt creator */}
      <div className="glass-panel flex-col gap-3" style={{ marginTop: '16px' }}>
        <div className="flex-row items-center justify-between" style={{ width: '100%' }}>
          <h3 className="flex-row items-center gap-2" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            <Sparkles size={16} style={{ color: 'var(--color-primary)' }} /> Start with AI Prompt
          </h3>
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="flex-row items-center gap-1"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Key size={12} /> {showKeys ? "Hide Settings" : "AI Settings"}
          </button>
        </div>

        {showKeys && (
          <div className="flex-col gap-3" style={{
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '4px',
            marginBottom: '8px'
          }}>
            <div className="form-group">
              <label className="input-label" style={{ fontSize: '10px' }}>AI Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="select-input"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <option value="anthropic">Anthropic Claude (Recommended)</option>
                <option value="gemini">Google Gemini</option>
                <option value="groq">Groq Llama 3</option>
                <option value="offline">Offline Sandbox (No API Keys)</option>
              </select>
            </div>

            {aiProvider === 'anthropic' && (
              <div className="form-group">
                <label className="input-label" style={{ fontSize: '10px' }}>Claude API Key</label>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
              </div>
            )}

            {aiProvider === 'gemini' && (
              <div className="form-group">
                <label className="input-label" style={{ fontSize: '10px' }}>Gemini API Key</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
              </div>
            )}

            {aiProvider === 'groq' && (
              <div className="form-group">
                <label className="input-label" style={{ fontSize: '10px' }}>Groq API Key</label>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={localStorage.getItem('key_groq') || ""}
                  onChange={(e) => {
                    localStorage.setItem('key_groq', e.target.value);
                    // force render
                    setPrompt(p => p);
                  }}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
              </div>
            )}

            <div className="form-group">
              <label className="input-label" style={{ fontSize: '10px' }}>Pexels Stock Footage Key</label>
              <input
                type="password"
                placeholder="Pexels API key..."
                value={pexelsKey}
                onChange={(e) => setPexelsKey(e.target.value)}
                className="text-input"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              />
            </div>

            {/* AI Video Settings Section */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '12px 0 8px 0' }}></div>
            <label className="input-label" style={{ fontSize: '9px', color: 'var(--color-primary)', fontWeight: 'bold', letterSpacing: '0.5px' }}>AI Video Model Settings</label>
            
            <div className="form-group">
              <label className="input-label" style={{ fontSize: '10px' }}>AI Video Provider</label>
              <select
                value={aiVideoProvider}
                onChange={(e) => setAiVideoProvider(e.target.value)}
                className="select-input"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <option value="mock">Mock / Sandbox AI Video (No Keys)</option>
                <optgroup label="Fal.ai Models">
                  <option value="fal-luma">Fal.ai Luma Dream Machine</option>
                  <option value="fal-kling">Fal.ai Kling Video</option>
                  <option value="fal-hunyuan">Fal.ai Hunyuan Video</option>
                  <option value="fal-mochi">Fal.ai Mochi 1 (Preview)</option>
                  <option value="fal-minimax">Fal.ai Minimax (Hailuo)</option>
                  <option value="fal-svd">Fal.ai Stable Video Diffusion</option>
                </optgroup>
                <optgroup label="Replicate Models">
                  <option value="replicate-luma">Replicate Luma Dream Machine</option>
                  <option value="replicate-hunyuan">Replicate Hunyuan Video</option>
                  <option value="replicate-minimax">Replicate Minimax (Hailuo)</option>
                  <option value="replicate-svd">Replicate Stable Video Diffusion</option>
                </optgroup>
                <optgroup label="Advanced Custom">
                  <option value="custom">Custom API Endpoint</option>
                </optgroup>
              </select>
            </div>

            {aiVideoProvider !== 'mock' && (
              <div className="form-group">
                <label className="input-label" style={{ fontSize: '10px' }}>
                  {aiVideoProvider.startsWith('replicate') ? 'Replicate API Token' : aiVideoProvider === 'custom' ? 'API Key / Bearer Token' : 'Fal.ai API Key'}
                </label>
                <input
                  type="password"
                  placeholder={
                    aiVideoProvider.startsWith('replicate') ? "r8_..." :
                    aiVideoProvider === 'custom' ? "Bearer token or key..." : "fal_..."
                  }
                  value={aiVideoKey}
                  onChange={(e) => setAiVideoKey(e.target.value)}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                />
              </div>
            )}

            {aiVideoProvider === 'custom' && (
              <>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Endpoint URL</label>
                  <input
                    type="text"
                    placeholder="https://api.domain.com/v1/video/generate"
                    value={aiVideoCustomUrl}
                    onChange={(e) => setAiVideoCustomUrl(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Custom Headers (JSON)</label>
                  <textarea
                    value={aiVideoCustomHeaders}
                    onChange={(e) => setAiVideoCustomHeaders(e.target.value)}
                    className="textarea-input"
                    style={{ padding: '6px 10px', fontSize: '11px', minHeight: '60px', fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Payload Template (JSON)</label>
                  <textarea
                    value={aiVideoCustomPayload}
                    onChange={(e) => setAiVideoCustomPayload(e.target.value)}
                    className="textarea-input"
                    style={{ padding: '6px 10px', fontSize: '11px', minHeight: '80px', fontFamily: 'monospace' }}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Response Video URL path</label>
                  <input
                    type="text"
                    placeholder="video.url"
                    value={aiVideoCustomPath}
                    onChange={(e) => setAiVideoCustomPath(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  />
                </div>
              </>
            )}
            {/* AI Image Settings Section */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '12px 0 8px 0' }}></div>
            <label className="input-label" style={{ fontSize: '9px', color: 'var(--color-primary)', fontWeight: 'bold', letterSpacing: '0.5px' }}>AI Image Model Settings</label>
            
            <div className="form-group">
              <label className="input-label" style={{ fontSize: '10px' }}>AI Image Provider</label>
              <select
                value={aiImageProvider}
                onChange={(e) => setAiImageProvider(e.target.value)}
                className="select-input"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <option value="cloudflare">Cloudflare Workers AI</option>
                <option value="mock">Mock / Sandbox AI Image (No Keys)</option>
              </select>
            </div>

            {aiImageProvider === 'cloudflare' && (
              <>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Cloudflare Account ID</label>
                  <input
                    type="text"
                    placeholder="Enter Account ID..."
                    value={aiImageAccountId}
                    onChange={(e) => setAiImageAccountId(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Cloudflare API Token</label>
                  <input
                    type="password"
                    placeholder="cfut_..."
                    value={aiImageKey}
                    onChange={(e) => setAiImageKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="input-label" style={{ fontSize: '10px' }}>Cloudflare Image Model</label>
                  <select
                    value={aiImageModel}
                    onChange={(e) => setAiImageModel(e.target.value)}
                    className="select-input"
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  >
                    <option value="@cf/stabilityai/stable-diffusion-xl-base-1.0">Stable Diffusion XL Base 1.0</option>
                    <option value="@cf/black-forest-labs/flux-1-schnell">Flux 1 Schnell</option>
                    <option value="@cf/lykon/dreamshaper-8-lcm">Dreamshaper 8 LCM</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}

        <textarea 
          placeholder="What is your video about? Example: 'Top 3 cybersecurity rules for beginners' or paste your script..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="textarea-input"
          style={{ minHeight: '100px' }}
        />

        {/* Target Duration Selector */}
        <div className="form-group">
          <label className="input-label" style={{ fontSize: '10px' }}>Target Video Duration</label>
          <select
            value={targetDuration}
            onChange={(e) => setTargetDuration(e.target.value)}
            className="select-input"
            style={{ padding: '8px 12px', fontSize: '12.5px' }}
          >
            <option value="auto">Auto / Dynamic (estimate based on content)</option>
            <option value="30">30 seconds (Short story/reels)</option>
            <option value="45">45 seconds (Medium duration)</option>
            <option value="60">60 seconds (1 minute standard)</option>
            <option value="150">150 seconds (2.5 minutes long form)</option>
          </select>
        </div>

        {/* Preset selections */}
        <div className="presets-grid">
          {PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(p.prompt)}
              className="preset-card"
            >
              <span className="preset-card-icon">{p.icon}</span>
              <div className="preset-card-info">
                <h4>{p.name}</h4>
                <p>{p.prompt}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="glow-btn"
          style={{ marginTop: '8px', width: '100%' }}
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" /> Writing Storyboard...
            </>
          ) : (
            <>
              <Sparkles size={16} /> Generate Video Blueprint
            </>
          )}
        </button>
      </div>

      {/* Scenes storyboard Editor */}
      {scenes.length > 0 && (
        <div className="glass-panel flex-col gap-4" style={{ marginTop: '16px' }}>
          <div className="flex-row items-center justify-between">
            <h3 className="flex-row items-center gap-2" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              <FileText size={16} style={{ color: 'var(--color-primary)' }} /> Scene Storyboard
            </h3>
            
            {/* Profile Selector */}
            <select
              value={videoProfile}
              onChange={(e) => setVideoProfile(e.target.value)}
              className="select-input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '11px' }}
            >
              <option value="faceless">Faceless B-Roll</option>
              <option value="split-screen">Dialogue (Split-Screen)</option>
              <option value="guru">Guru (Talking Head)</option>
              <option value="tweet-showcase">Tweet Showcase</option>
            </select>
          </div>

          <div className="scenes-list">
            {scenes.map((scene, index) => (
              <div 
                key={scene.id} 
                className="scene-card"
              >
                <div className="scene-card-header">
                  <span>SCENE #{index + 1}</span>
                  <button 
                    onClick={() => deleteScene(scene.id)}
                    className="scene-card-delete-btn"
                    title="Delete Scene"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Subtitle Input */}
                <div className="form-group">
                  <div className="flex-row items-center justify-between">
                    <label className="input-label" style={{ fontSize: '10px' }}>Subtitle text</label>
                  </div>
                  <input
                    type="text"
                    value={scene.text}
                    onChange={(e) => handleSceneChange(scene.id, 'text', e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12.5px' }}
                  />
                </div>

                {/* Subtitle 2 Input */}
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <div className="flex-row items-center justify-between">
                    <label className="input-label" style={{ fontSize: '10px' }}>Second Subtitle text (optional)</label>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional second subtitle..."
                    value={scene.text2 || ""}
                    onChange={(e) => handleSceneChange(scene.id, 'text2', e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12.5px' }}
                  />
                </div>

                {/* Visual Source (Pexels vs AI Video vs AI Image) */}
                <div className="card-grid-2" style={{ marginTop: '8px', marginBottom: '4px' }}>
                  <div className="form-group">
                    <label className="input-label" style={{ fontSize: '10px' }}>Visual Source</label>
                    <select
                      value={scene.videoSource || 'pexels'}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleSceneChange(scene.id, 'videoSource', val);
                        if (val === 'ai-video' && !scene.promptForAiVideo) {
                          handleSceneChange(scene.id, 'promptForAiVideo', `A clean cinematic short clip showing ${scene.searchKeyword || scene.text || 'abstract art'}, 4k, realistic`);
                        } else if (val === 'ai-image' && !scene.promptForAiImage) {
                          handleSceneChange(scene.id, 'promptForAiImage', `A high quality professional picture of ${scene.searchKeyword || scene.text || 'abstract art'}, realistic, 8k resolution`);
                        }
                      }}
                      className="select-input"
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                    >
                      <option value="pexels">Stock Footage (Pexels)</option>
                      <option value="wikimedia">Wikimedia Commons</option>
                      <option value="ai-video">AI Video Generator</option>
                      <option value="ai-image">AI Image Generator</option>
                    </select>
                  </div>

                  {scene.videoSource === 'ai-video' && (
                    <div className="form-group">
                      <label className="input-label" style={{ fontSize: '10px' }}>AI Video Prompt</label>
                      <input
                        type="text"
                        value={scene.promptForAiVideo || ""}
                        onChange={(e) => handleSceneChange(scene.id, 'promptForAiVideo', e.target.value)}
                        placeholder="Describe what the AI video should generate..."
                        className="text-input"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      />
                    </div>
                  )}

                  {scene.videoSource === 'ai-image' && (
                    <div className="form-group">
                      <label className="input-label" style={{ fontSize: '10px' }}>AI Image Prompt</label>
                      <input
                        type="text"
                        value={scene.promptForAiImage || ""}
                        onChange={(e) => handleSceneChange(scene.id, 'promptForAiImage', e.target.value)}
                        placeholder="Describe what the AI image should generate..."
                        className="text-input"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Grid Inputs */}
                <div className="card-grid-3">
                  <div className="form-group">
                    <label className="input-label" style={{ fontSize: '9px' }}>Keywords</label>
                    <input
                      type="text"
                      value={scene.searchKeyword}
                      onChange={(e) => handleSceneChange(scene.id, 'searchKeyword', e.target.value)}
                      className="text-input"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="input-label" style={{ fontSize: '9px' }}>Duration (s)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.9"
                      max="3.0"
                      value={scene.duration}
                      onChange={(e) => handleSceneChange(scene.id, 'duration', parseFloat(e.target.value) || 0)}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value) || 3;
                        handleSceneChange(scene.id, 'duration', Math.max(0.9, Math.min(3.0, val)));
                      }}
                      className="text-input"
                      style={{ padding: '4px 8px', fontSize: '11px', borderColor: scene.duration > 3.0 || scene.duration < 0.9 ? '#ef4444' : undefined }}
                      title="Duration must be between 0.9 and 3.0 seconds"
                    />
                  </div>

                  {videoProfile === 'split-screen' ? (
                    <div className="form-group">
                      <label className="input-label" style={{ fontSize: '9px' }}>Speaker</label>
                      <select
                        value={scene.speaker}
                        onChange={(e) => handleSceneChange(scene.id, 'speaker', e.target.value)}
                        className="select-input"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                      >
                        <option value="A">Speaker A (Top)</option>
                        <option value="B">Speaker B (Bottom)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="input-label" style={{ fontSize: '9px' }}>Transition</label>
                      <select
                        value={scene.transition || 'none'}
                        onChange={(e) => handleSceneChange(scene.id, 'transition', e.target.value)}
                        className="select-input"
                        style={{ padding: '4px 8px', fontSize: '11.5px', color: 'var(--text-primary)' }}
                      >
                        <option value="none">Cut (None)</option>
                        <option value="cross-dissolve">Dissolve</option>
                        <option value="slide-left">Slide L</option>
                        <option value="slide-right">Slide R</option>
                        <option value="slide-up">Slide U</option>
                        <option value="zoom-fade">Zoom F</option>
                        <option value="wipe-left">Wipe L</option>
                        <option value="wipe-right">Wipe R</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Tweet Card Content fields if Profile is tweet-showcase */}
                {videoProfile === 'tweet-showcase' && scene.cardContent && (
                  <div className="card-grid-2" style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                    <div className="form-group">
                      <label className="input-label" style={{ fontSize: '9px' }}>Twitter Name</label>
                      <input
                        type="text"
                        value={scene.cardContent.name}
                        onChange={(e) => {
                          const updatedContent = { ...scene.cardContent, name: e.target.value };
                          handleSceneChange(scene.id, 'cardContent', updatedContent);
                        }}
                        className="text-input"
                        style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="input-label" style={{ fontSize: '9px' }}>Twitter Handle</label>
                      <input
                        type="text"
                        value={scene.cardContent.handle}
                        onChange={(e) => {
                          const updatedContent = { ...scene.cardContent, handle: e.target.value };
                          handleSceneChange(scene.id, 'cardContent', updatedContent);
                        }}
                        className="text-input"
                        style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addScene}
            className="dashed-add-btn"
          >
            <Plus size={14} /> Add Subtitle Block
          </button>
        </div>
      )}
    </div>
  );
}
