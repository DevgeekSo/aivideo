import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Film,
  Settings,
  Layers,
  Music,
  Type,
  Volume2,
  Video,
  FileText,
  Sliders,
  Play,
  RotateCcw
} from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import ScriptGenerator from './components/ScriptGenerator';
import VideoSelector from './components/VideoSelector';
import SubtitleEditor from './components/SubtitleEditor';
import AudioSettings from './components/AudioSettings';
import ExportPanel from './components/ExportPanel';
import { estimateSubtitleTimestamps } from './utils/speechEngine';
import { searchStockVideos } from './utils/pexelsApi';
import { generateAiVideo } from './utils/aiVideoApi';

export default function App() {
  // Active Sidebar Tab: 'script' | 'videos' | 'audio' | 'subtitles' | 'export'
  const [activeTab, setActiveTab] = useState('script');

  // Video and timeline states
  const [scenes, setScenes] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState({});
  const [videoProfile, setVideoProfile] = useState('faceless');
  const [scriptData, setScriptData] = useState(null);
  const [targetDuration, setTargetDuration] = useState('auto');

  const [voiceoverBuffer, setVoiceoverBuffer] = useState(null);
  const [voiceoverText, setVoiceoverText] = useState("");
  const [bgmBuffer, setBgmBuffer] = useState(null);
  const [bgmVolume, setBgmVolume] = useState(0.15);
  const [sfxBuffers, setSfxBuffers] = useState({});

  // Sync voiceover text dynamically with subtitles text & text2 in scenes
  useEffect(() => {
    if (scenes.length > 0) {
      const newText = scenes.map(s => s.text + (s.text2 ? " " + s.text2 : "")).join(" ");
      setVoiceoverText(prev => prev !== newText ? newText : prev);
    }
  }, [scenes]);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Subtitle custom settings
  const [subtitleSettings, setSubtitleSettings] = useState({
    focusColor: '#eab308', // Neon Yellow
    textColor: '#ffffff', // Standard text color
    pulseHighlight: true,
    fontFamily: 'Outfit',
    fontSize: 26,
    textCase: 'uppercase', // 'uppercase' | 'normal'
    strokeColor: '#000000',
    strokeWidth: 4,
    animationStyle: 'pulse', // 'pulse' | 'color' | 'bg-box' | 'bounce-pop'
    bgBoxColor: 'rgba(0, 0, 0, 0.75)',
    verticalPos: 0.68 // Y-offset coordinate (0.5 to 0.85)
  });
  const [showSafeZone, setShowSafeZone] = useState(false);

  // API credentials
  const [apiKeys, setApiKeys] = useState({
    geminiKey: localStorage.getItem('key_gemini') || import.meta.env.VITE_GEMINI_API_KEY || "",
    anthropicKey: localStorage.getItem('key_anthropic') || import.meta.env.VITE_ANTHROPIC_API_KEY || "",
    openrouterKey: localStorage.getItem('key_openrouter') || import.meta.env.VITE_OPENROUTER_API_KEY || "",
    pexelsKey: localStorage.getItem('key_pexels') || import.meta.env.VITE_PEXELS_API_KEY || "",
    pixabayKey: localStorage.getItem('key_pixabay') || import.meta.env.VITE_PIXABAY_API_KEY || "",
    gcloudKey: localStorage.getItem('key_gcloud') || import.meta.env.VITE_GCLOUD_API_KEY || "",
    elevenLabsKey: localStorage.getItem('key_elevenlabs') || import.meta.env.VITE_ELEVENLABS_API_KEY || "",
    didKey: localStorage.getItem('key_did') || import.meta.env.VITE_DID_API_KEY || "",
    jamendoKey: localStorage.getItem('key_jamendo') || "",
    freesoundKey: localStorage.getItem('key_freesound') || "",
    aiVideoProvider: localStorage.getItem('key_aivideo_provider') || 'mock',
    aiVideoKey: localStorage.getItem('key_aivideo_key') || '',
    aiVideoCustomUrl: localStorage.getItem('key_aivideo_custom_url') || '',
    aiVideoCustomHeaders: localStorage.getItem('key_aivideo_custom_headers') || '{\n  "Content-Type": "application/json"\n}',
    aiVideoCustomPayload: localStorage.getItem('key_aivideo_custom_payload') || '{\n  "prompt": "{{prompt}}",\n  "aspect_ratio": "9:16"\n}',
    aiVideoCustomPath: localStorage.getItem('key_aivideo_custom_path') || 'video.url'
  });

  // Background Auto-Pick states
  const [autoPicking, setAutoPicking] = useState(false);
  const [autoPickProgress, setAutoPickProgress] = useState("");
  const [autoPickError, setAutoPickError] = useState("");

  const handleAutoPickAllClips = async (targetScenes = scenes, keys = apiKeys) => {
    setAutoPicking(true);
    setAutoPickError("");
    setAutoPickProgress("Initializing Auto-Pick Engine...");

    const updatedVideos = {};

    try {
      for (let i = 0; i < targetScenes.length; i++) {
        const scene = targetScenes[i];
        
        let videoUrl = null;

        if (scene.videoSource === 'ai-video') {
          setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (AI Video): Submitting prompt...`);
          try {
            const prompt = scene.promptForAiVideo || `A beautiful video showing ${scene.searchKeyword}`;
            videoUrl = await generateAiVideo(prompt, {
              provider: keys.aiVideoProvider || 'mock',
              apiKey: keys.aiVideoKey || '',
              customUrl: keys.aiVideoCustomUrl || '',
              customHeaders: keys.aiVideoCustomHeaders || '{}',
              customPayload: keys.aiVideoCustomPayload || '{}',
              customPath: keys.aiVideoCustomPath || 'video.url',
              apiKeys: keys,
              onStatusUpdate: (status) => {
                setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (AI Video): ${status}`);
              }
            });
          } catch (aiErr) {
            console.error(`AI Video Gen failed for scene ${scene.id}, falling back to stock search:`, aiErr);
          }
        }

        // If we didn't generate a video (either because it is pexels, or because AI generation failed)
        if (!videoUrl) {
          setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (Stock): Matching "${scene.searchKeyword}"...`);
          // Fetch stock results
          const clips = await searchStockVideos(scene.searchKeyword, keys);

          if (clips && clips.length > 0) {
            // Select vertical-friendly clips
            let selectedClip = clips.find(c => c.isVertical);
            if (!selectedClip) {
              selectedClip = clips[0];
            }
            videoUrl = selectedClip.videoUrl;
          } else {
            // Backup query
            const backupClips = await searchStockVideos("abstract loop", keys);
            if (backupClips && backupClips.length > 0) {
              videoUrl = backupClips[0].videoUrl;
            }
          }
        }

        updatedVideos[scene.id] = videoUrl;

        // Incremental update so the UI updates live
        setSelectedVideos(prev => ({
          ...prev,
          [scene.id]: updatedVideos[scene.id]
        }));
      }

      setAutoPickProgress("All clips successfully picked and synced!");
      setTimeout(() => setAutoPickProgress(""), 3000);
    } catch (err) {
      setAutoPickError("Auto-pick process interrupted: " + err.message);
    } finally {
      setAutoPicking(false);
    }
  };

  // Auto-fetch recommended BGM and SFX from Jamendo and Freesound
  const handleAutoFetchAudio = async (scriptObj, currentScenes) => {
    const jamendoId = localStorage.getItem('key_jamendo') || "";
    const freesoundToken = localStorage.getItem('key_freesound') || "";

    // 1. Auto-Fetch BGM from Jamendo
    if (scriptObj.bgmSearchQuery) {
      console.log(`Auto-fetching BGM for query: "${scriptObj.bgmSearchQuery}"`);
      try {
        const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${jamendoId}&format=json&limit=5&search=${encodeURIComponent(scriptObj.bgmSearchQuery)}&include=musicinfo&audioformat=mp32`;
        const res = await fetch(url);
        if (res.ok) {
          const resData = await res.json();
          if (resData.results && resData.results.length > 0) {
            const track = resData.results[0];
            console.log(`AI selected BGM: "${track.name}" by ${track.artist_name}`);
            
            localStorage.setItem('key_selected_bgm_preset', `jamendo-${track.id}`);
            
            const audioRes = await fetch(track.audio);
            if (audioRes.ok) {
              const arrayBuffer = await audioRes.arrayBuffer();
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const buffer = await ctx.decodeAudioData(arrayBuffer);
              setBgmBuffer(buffer);
              console.log(`Successfully loaded and decoded AI BGM: "${track.name}"`);
            }
          }
        }
      } catch (e) {
        console.warn("Auto BGM loading failed:", e);
      }
    }

    // 2. Auto-Fetch SFX from Freesound
    if (freesoundToken && currentScenes && currentScenes.length > 0) {
      console.log("Auto-fetching SFX for scenes from Freesound...");
      let updatedScenesList = [...currentScenes];
      let sfxUpdated = false;

      for (let i = 0; i < updatedScenesList.length; i++) {
        const scene = updatedScenesList[i];
        if (scene.sfxSearchQuery) {
          console.log(`Auto-fetching SFX for Scene #${i + 1}: "${scene.sfxSearchQuery}"`);
          try {
            const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(scene.sfxSearchQuery)}&token=${freesoundToken}&fields=id,name,previews,duration,description`;
            const res = await fetch(url);
            if (res.ok) {
              const resData = await res.json();
              if (resData.results && resData.results.length > 0) {
                const sound = resData.results[0];
                const sfxUrl = sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'];
                
                if (sfxUrl) {
                  console.log(`AI selected SFX for Scene #${i + 1}: "${sound.name}"`);
                  const audioRes = await fetch(sfxUrl);
                  if (audioRes.ok) {
                    const arrayBuffer = await audioRes.arrayBuffer();
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const buffer = await ctx.decodeAudioData(arrayBuffer);

                    setSfxBuffers(prev => ({
                      ...prev,
                      [sfxUrl]: buffer
                    }));

                    updatedScenesList[i] = {
                      ...scene,
                      sfxUrl: sfxUrl,
                      sfxName: sound.name
                    };
                    sfxUpdated = true;
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`Auto SFX loading failed for Scene #${i + 1}:`, e);
          }
        }
      }

      if (sfxUpdated) {
        setScenes(updatedScenesList);
      }
    }
  };

  // Handle keys loaded/updated in the generator
  const handleScriptGenerated = (newScenes, keys, fullData) => {
    setApiKeys(prev => ({
      ...prev,
      ...keys
    }));

    let initialScenes = newScenes;
    // Compile script voiceover text if available
    if (newScenes.length > 0) {
      const fullText = newScenes.map(s => s.text + (s.text2 ? " " + s.text2 : "")).join(" ");
      setVoiceoverText(fullText);

      // Estimate initial timings based on average reading rate (2.3 words/sec)
      initialScenes = estimateSubtitleTimestamps(newScenes, fullText.split(/\s+/).length / 2.3, targetDuration);
      setScenes(initialScenes);
    }

    // Automatically transition to next workspace tab
    setActiveTab('videos');

    // Trigger auto-pick for these newly generated scenes using the new/updated keys
    if (initialScenes.length > 0) {
      handleAutoPickAllClips(initialScenes, keys);
    }

    // Auto-fetch recommended BGM and SFX from Jamendo and Freesound
    if (fullData && initialScenes.length > 0) {
      handleAutoFetchAudio(fullData, initialScenes);
    }
  };

  // Initialize default Jamendo & Freesound keys on mount if they aren't already set
  useEffect(() => {
    if (!localStorage.getItem('key_jamendo')) {
      localStorage.setItem('key_jamendo', "");
    }
    if (!localStorage.getItem('key_freesound')) {
      localStorage.setItem('key_freesound', "");
    }
  }, []);

  // Sync keys from localStorage periodically or when generator changes them
  useEffect(() => {
    const handleStorageChange = () => {
      setApiKeys({
        geminiKey: localStorage.getItem('key_gemini') || import.meta.env.VITE_GEMINI_API_KEY || "",
        anthropicKey: localStorage.getItem('key_anthropic') || import.meta.env.VITE_ANTHROPIC_API_KEY || "",
        openrouterKey: localStorage.getItem('key_openrouter') || import.meta.env.VITE_OPENROUTER_API_KEY || "",
        pexelsKey: localStorage.getItem('key_pexels') || import.meta.env.VITE_PEXELS_API_KEY || "",
        pixabayKey: localStorage.getItem('key_pixabay') || import.meta.env.VITE_PIXABAY_API_KEY || "",
        gcloudKey: localStorage.getItem('key_gcloud') || import.meta.env.VITE_GCLOUD_API_KEY || "",
        elevenLabsKey: localStorage.getItem('key_elevenlabs') || import.meta.env.VITE_ELEVENLABS_API_KEY || "",
        didKey: localStorage.getItem('key_did') || import.meta.env.VITE_DID_API_KEY || "",
        jamendoKey: localStorage.getItem('key_jamendo') || "",
        freesoundKey: localStorage.getItem('key_freesound') || "",
        aiVideoProvider: localStorage.getItem('key_aivideo_provider') || 'mock',
        aiVideoKey: localStorage.getItem('key_aivideo_key') || '',
        aiVideoCustomUrl: localStorage.getItem('key_aivideo_custom_url') || '',
        aiVideoCustomHeaders: localStorage.getItem('key_aivideo_custom_headers') || '{\n  "Content-Type": "application/json"\n}',
        aiVideoCustomPayload: localStorage.getItem('key_aivideo_custom_payload') || '{\n  "prompt": "{{prompt}}",\n  "aspect_ratio": "9:16"\n}',
        aiVideoCustomPath: localStorage.getItem('key_aivideo_custom_path') || 'video.url'
      });
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="app-header">
        <div className="header-logo-group">
          <div className="header-logo-icon">
            <Film />
          </div>
          <div className="header-title-group">
            <h1>AI Shorts Video</h1>
            <p>Genrate Shorts Reels and Tiktok Videos</p>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="app-main">

        {/* Left Side: Controls Panel / Form Sheets */}
        <section className="controls-sidebar">

          {/* Tab Selection Header */}
          <div className="tabs-container">
            <button
              onClick={() => setActiveTab('script')}
              className={`tab-btn ${activeTab === 'script' ? 'active' : ''}`}
            >
              <FileText /> <span>Script</span>
            </button>

            <button
              onClick={() => setActiveTab('videos')}
              className={`tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
            >
              <Video /> <span>Videos</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
            >
              <Volume2 /> <span>Voiceover</span>
            </button>

            <button
              onClick={() => setActiveTab('subtitles')}
              className={`tab-btn ${activeTab === 'subtitles' ? 'active' : ''}`}
            >
              <Type /> <span>Karaoke</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            >
              <Film /> <span>Export</span>
            </button>
          </div>

          {/* Active Tab Panel Sheet */}
          <div className="tab-content">
            {activeTab === 'script' && (
              <ScriptGenerator
                onScriptGenerated={handleScriptGenerated}
                scenes={scenes}
                setScenes={setScenes}
                videoProfile={videoProfile}
                setVideoProfile={setVideoProfile}
                scriptData={scriptData}
                setScriptData={setScriptData}
                targetDuration={targetDuration}
                setTargetDuration={setTargetDuration}
              />
            )}

            {activeTab === 'videos' && (
              <VideoSelector
                scenes={scenes}
                selectedVideos={selectedVideos}
                setSelectedVideos={setSelectedVideos}
                apiKeys={apiKeys}
                videoProfile={videoProfile}
                autoPicking={autoPicking}
                autoPickProgress={autoPickProgress}
                autoPickError={autoPickError}
                setAutoPickError={setAutoPickError}
                handleAutoPickAllClips={handleAutoPickAllClips}
                setScenes={setScenes}
              />
            )}

            {activeTab === 'audio' && (
              <AudioSettings
                scenes={scenes}
                setScenes={setScenes}
                voiceoverText={voiceoverText}
                voiceoverBuffer={voiceoverBuffer}
                setVoiceoverBuffer={setVoiceoverBuffer}
                bgmBuffer={bgmBuffer}
                setBgmBuffer={setBgmBuffer}
                bgmVolume={bgmVolume}
                setBgmVolume={setBgmVolume}
                apiKeys={apiKeys}
                targetDuration={targetDuration}
                sfxBuffers={sfxBuffers}
                setSfxBuffers={setSfxBuffers}
              />
            )}

            {activeTab === 'subtitles' && (
              <SubtitleEditor
                subtitleSettings={subtitleSettings}
                setSubtitleSettings={setSubtitleSettings}
                showSafeZone={showSafeZone}
                setShowSafeZone={setShowSafeZone}
                videoProfile={videoProfile}
              />
            )}

            {activeTab === 'export' && (
              <ExportPanel
                scenes={scenes}
                videoProfile={videoProfile}
                voiceoverBuffer={voiceoverBuffer}
                bgmBuffer={bgmBuffer}
                bgmVolume={bgmVolume}
                selectedVideos={selectedVideos}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                subtitleSettings={subtitleSettings}
                sfxBuffers={sfxBuffers}
              />
            )}
          </div>
        </section>

        {/* Right Side: Interactive Live 9:16 Preview Player */}
        <section className="preview-section">
          <VideoPlayer
            videoProfile={videoProfile}
            scenes={scenes}
            voiceoverBuffer={voiceoverBuffer}
            bgmBuffer={bgmBuffer}
            bgmVolume={bgmVolume}
            voiceoverText={voiceoverText}
            selectedVideos={selectedVideos}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            subtitleSettings={subtitleSettings}
            showSafeZone={showSafeZone}
            sfxBuffers={sfxBuffers}
          />
        </section>

      </main>

      {/* Footer bar */}
      <footer style={{
        backgroundColor: '#020617',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '12px',
        textAlign: 'center',
        fontSize: '10px',
        color: 'var(--text-muted)'
      }}>
        Short-Form Video Generator Engine. Render vertical content bypass-ready.
      </footer>
    </div>
  );
}
