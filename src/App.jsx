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
import { generateAiImage } from './utils/cloudflareImageApi';
import { searchWikimediaCommons } from './utils/wikimediaApi';

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
    aiVideoCustomPath: localStorage.getItem('key_aivideo_custom_path') || 'video.url',
    aiImageProvider: localStorage.getItem('key_aiimage_provider') || 'cloudflare',
    aiImageKey: localStorage.getItem('key_aiimage_key') || '',
    aiImageAccountId: localStorage.getItem('key_aiimage_account_id') || '',
    aiImageModel: localStorage.getItem('key_aiimage_model') || '@cf/stabilityai/stable-diffusion-xl-base-1.0'
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
        } else if (scene.videoSource === 'ai-image') {
          setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (AI Image): Generating image...`);
          try {
            const prompt = scene.promptForAiImage || `A beautiful picture showing ${scene.searchKeyword}`;
            videoUrl = await generateAiImage(prompt, {
              provider: keys.aiImageProvider || 'cloudflare',
              apiKey: keys.aiImageKey || '',
              accountId: keys.aiImageAccountId || '',
              modelName: keys.aiImageModel || '@cf/stabilityai/stable-diffusion-xl-base-1.0',
              apiKeys: keys,
              onStatusUpdate: (status) => {
                setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (AI Image): ${status}`);
              }
            });
          } catch (aiErr) {
            console.error(`AI Image Gen failed for scene ${scene.id}, falling back to stock search:`, aiErr);
          }
        } else if (scene.videoSource === 'wikimedia') {
          setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (Wikimedia): Searching "${scene.searchKeyword}"...`);
          try {
            const results = await searchWikimediaCommons(scene.searchKeyword);
            if (results && results.length > 0) {
              // Trust the API's sort order completely (which prioritizes lead images and resolution).
              const selectedClip = results[0];
              videoUrl = selectedClip.videoUrl;
              console.log(`[Auto-Pick] Scene ${i + 1} (${scene.searchKeyword}): Picked "${selectedClip.title}" from ${selectedClip.source} (${selectedClip.width}x${selectedClip.height})`);
            }
          } catch (wikiErr) {
            console.error(`Wikimedia search failed for scene ${scene.id}, falling back to stock search:`, wikiErr);
          }
        }

        // If we didn't generate or fetch a video/image (either because it is pexels, or because initial search failed)
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
            // Fallback 1: Try Wikimedia Commons search
            setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (Wikimedia Fallback): Searching "${scene.searchKeyword}"...`);
            try {
              const wikiResults = await searchWikimediaCommons(scene.searchKeyword);
              if (wikiResults && wikiResults.length > 0) {
                // Trust the API's sort order completely.
                const selectedClip = wikiResults[0];
                videoUrl = selectedClip.videoUrl;
                console.log(`[Auto-Pick Fallback] Scene ${i + 1} (${scene.searchKeyword}): Picked "${selectedClip.title}" from ${selectedClip.source} (${selectedClip.width}x${selectedClip.height})`);
              }
            } catch (wikiErr) {
              console.warn("Wikimedia fallback search failed", wikiErr);
            }

            if (!videoUrl) {
              // Fallback 2: Generate AI Image since stock and wikimedia returned nothing
              setAutoPickProgress(`Scene ${i + 1}/${targetScenes.length} (Stock Fallback): Generating AI Image for "${scene.searchKeyword}"...`);
              try {
                const prompt = `A high quality professional picture of ${scene.searchKeyword}, realistic, 8k resolution`;
                videoUrl = await generateAiImage(prompt, {
                  provider: keys.aiImageProvider || 'cloudflare',
                  apiKey: keys.aiImageKey || '',
                  accountId: keys.aiImageAccountId || '',
                  modelName: keys.aiImageModel || '@cf/stabilityai/stable-diffusion-xl-base-1.0',
                  apiKeys: keys
                });
              } catch (imgErr) {
                console.warn("Stock AI Image fallback failed, using abstract loop", imgErr);
                // Backup query
                const backupClips = await searchStockVideos("abstract loop", keys);
                if (backupClips && backupClips.length > 0) {
                  videoUrl = backupClips[0].videoUrl;
                }
              }
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

    // 1. Auto-Fetch BGM from Jamendo or local fallback
    if (scriptObj.bgmSearchQuery) {
      console.log(`Auto-fetching BGM for query: "${scriptObj.bgmSearchQuery}"`);
      let loaded = false;

      if (jamendoId) {
        try {
          const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${jamendoId}&format=json&limit=5&search=${encodeURIComponent(scriptObj.bgmSearchQuery)}&include=musicinfo&audioformat=mp32`;
          const res = await fetch(url);
          if (res.ok) {
            const resData = await res.json();
            if (resData.results && resData.results.length > 0) {
              const track = resData.results[0];
              console.log(`AI selected BGM from Jamendo: "${track.name}" by ${track.artist_name}`);
              
              localStorage.setItem('key_selected_bgm_preset', `jamendo-${track.id}`);
              
              const audioRes = await fetch(track.audio);
              if (audioRes.ok) {
                const arrayBuffer = await audioRes.arrayBuffer();
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const buffer = await ctx.decodeAudioData(arrayBuffer);
                setBgmBuffer(buffer);
                console.log(`Successfully loaded and decoded Jamendo BGM: "${track.name}"`);
                loaded = true;
              }
            }
          }
        } catch (e) {
          console.warn("Jamendo Auto BGM loading failed, using local presets:", e);
        }
      }

      // Local Presets Fallback if Jamendo not set up or failed
      if (!loaded) {
        const queryLower = scriptObj.bgmSearchQuery.toLowerCase();
        let filename = 'monume-lofi-chill-chill-509496.mp3'; // Default to Lofi Chill
        let presetId = 'lofi_chill';

        if (queryLower.includes('cinematic') || queryLower.includes('mystery') || queryLower.includes('suspense') || queryLower.includes('epic') || queryLower.includes('dark')) {
          filename = 'gajju_m-shadows-of-time-270262.mp3';
          presetId = 'shadows_of_time';
        } else if (queryLower.includes('inspiring') || queryLower.includes('spirit') || queryLower.includes('corporate') || queryLower.includes('motivational') || queryLower.includes('upbeat')) {
          filename = 'nastelbom-inspiring-inspiring-music-486987.mp3';
          presetId = 'inspiring_spirit';
        } else if (queryLower.includes('ambient') || queryLower.includes('calm') || queryLower.includes('peaceful') || queryLower.includes('relax')) {
          filename = 'paulyudin-ambient-relax-113444.mp3';
          presetId = 'ambient_relax';
        } else if (queryLower.includes('soft') || queryLower.includes('zen') || queryLower.includes('wellness') || queryLower.includes('nature')) {
          filename = 'freemusicforvideo-relax-relax-music-524068.mp3';
          presetId = 'relaxing_soundscape';
        }

        console.log(`Using local BGM fallback preset "${presetId}" for query: "${scriptObj.bgmSearchQuery}"`);
        try {
          const response = await fetch(`/bgm/${filename}`);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const buffer = await ctx.decodeAudioData(arrayBuffer);
            setBgmBuffer(buffer);
            localStorage.setItem('key_selected_bgm_preset', presetId);
            console.log(`Successfully loaded and decoded local BGM fallback: ${presetId}`);
          }
        } catch (e) {
          console.warn("Local fallback BGM loading failed:", e);
        }
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
        aiVideoCustomPath: localStorage.getItem('key_aivideo_custom_path') || 'video.url',
        aiImageProvider: localStorage.getItem('key_aiimage_provider') || 'cloudflare',
        aiImageKey: localStorage.getItem('key_aiimage_key') || '',
        aiImageAccountId: localStorage.getItem('key_aiimage_account_id') || '',
        aiImageModel: localStorage.getItem('key_aiimage_model') || '@cf/stabilityai/stable-diffusion-xl-base-1.0'
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
