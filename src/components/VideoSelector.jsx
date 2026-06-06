import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Loader2, 
  Sparkles, 
  AlertCircle, 
  Video, 
  CheckCircle2, 
  User, 
  Volume2, 
  Coins, 
  PlayCircle, 
  RefreshCw, 
  Image as ImageIcon 
} from 'lucide-react';
import { searchStockVideos } from '../utils/pexelsApi';
import { generateAiVideo } from '../utils/aiVideoApi';
import { generateAiImage } from '../utils/cloudflareImageApi';
import { searchWikimediaCommons } from '../utils/wikimediaApi';
import { 
  DID_AVATAR_PRESETS, 
  DID_VOICE_PRESETS, 
  checkDidCredits, 
  createDidTalk, 
  getDidTalkStatus,
  cleanImageUrl
} from '../utils/didApi';

export default function VideoSelector({
  scenes = [],
  selectedVideos = {},
  setSelectedVideos = () => {},
  apiKeys = {},
  videoProfile = 'faceless',
  autoPicking = false,
  autoPickProgress = "",
  autoPickError = "",
  setAutoPickError = () => {},
  handleAutoPickAllClips = null,
  setScenes = null
}) {
  const [activeSceneId, setActiveSceneId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Wikimedia pagination states
  const [wikimediaContinue, setWikimediaContinue] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Tab: 'stock' | 'avatar'
  const [videoSourceTab, setVideoSourceTab] = useState('stock');

  // D-ID Avatar states
  const [didCredits, setDidCredits] = useState(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [didKeyError, setDidKeyError] = useState("");
  
  const [avatarRoles, setAvatarRoles] = useState({
    A: 'speaker_a_female',
    B: 'speaker_b_male',
    GURU: 'guru_male'
  });
  const [customAvatarUrls, setCustomAvatarUrls] = useState({
    A: '',
    B: '',
    GURU: ''
  });
  const [voiceRoles, setVoiceRoles] = useState({
    A: 'en-US-JennyNeural',
    B: 'en-US-GuyNeural',
    GURU: 'en-US-ChristopherNeural'
  });

  const [generationStates, setGenerationStates] = useState({});
  const [globalGenerating, setGlobalGenerating] = useState(false);

  const didKey = apiKeys.didKey || localStorage.getItem('key_did') || "";

  // Select first scene by default when scenes load
  useEffect(() => {
    if (scenes.length > 0 && !activeSceneId) {
      setActiveSceneId(scenes[0].id);
    }
  }, [scenes, activeSceneId]);

  // Sync search input with active scene keyword
  useEffect(() => {
    if (activeSceneId) {
      const activeScene = scenes.find(s => s.id === activeSceneId);
      if (activeScene) {
        setSearchQuery(activeScene.searchKeyword);
        performSearch(activeScene.searchKeyword);
      }
    }
  }, [activeSceneId]);

  // Automatically default tab based on video profile and active scene source
  useEffect(() => {
    if (videoProfile === 'split-screen' || videoProfile === 'guru') {
      setVideoSourceTab('avatar');
    } else {
      const activeScene = scenes.find(s => s.id === activeSceneId);
      if (activeScene && activeScene.videoSource === 'ai-video') {
        setVideoSourceTab('ai-video');
      } else if (activeScene && activeScene.videoSource === 'ai-image') {
        setVideoSourceTab('ai-image');
      } else if (activeScene && activeScene.videoSource === 'wikimedia') {
        setVideoSourceTab('wikimedia');
      } else {
        setVideoSourceTab('stock');
      }
    }
  }, [videoProfile, activeSceneId, scenes]);

  // Fetch D-ID credits when key or tab changes
  useEffect(() => {
    if (videoSourceTab === 'avatar' && didKey) {
      handleCheckCredits();
    }
  }, [videoSourceTab, didKey]);

  const handleCheckCredits = async () => {
    if (!didKey) {
      setDidKeyError("D-ID credentials key is not configured.");
      return;
    }
    setLoadingCredits(true);
    setDidKeyError("");
    try {
      const remaining = await checkDidCredits(didKey);
      setDidCredits(remaining);
    } catch (e) {
      console.warn("Failed to check D-ID credits:", e);
      setDidKeyError("Could not retrieve credits. Check credentials.");
    } finally {
      setLoadingCredits(false);
    }
  };

  const performSearch = async (query) => {
    if (!query) return;
    setLoading(true);
    setErrorMsg("");
    setWikimediaContinue(null); // Clear previous pagination token
    try {
      if (videoSourceTab === 'stock') {
        const results = await searchStockVideos(query, apiKeys);
        setSearchResults(results);
      } else if (videoSourceTab === 'wikimedia') {
        const response = await searchWikimediaCommons(query, null, true);
        setSearchResults(response.results || []);
        setWikimediaContinue(response.continueParams || null);
      }
    } catch (e) {
      setErrorMsg("Failed to search assets: " + e.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMoreWikimedia = async () => {
    if (!searchQuery || !wikimediaContinue || loadingMore) return;
    setLoadingMore(true);
    setErrorMsg("");
    try {
      const response = await searchWikimediaCommons(searchQuery, wikimediaContinue, true);
      if (response.results && response.results.length > 0) {
        setSearchResults(prev => [...prev, ...response.results]);
      }
      setWikimediaContinue(response.continueParams || null);
    } catch (e) {
      setErrorMsg("Failed to load more assets: " + e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelectVideo = (sceneId, videoUrl) => {
    setSelectedVideos(prev => ({
      ...prev,
      [sceneId]: videoUrl
    }));
  };

  const onAutoPickClick = () => {
    if (handleAutoPickAllClips) {
      handleAutoPickAllClips(scenes, apiKeys);
    }
  };

  // Generate single D-ID avatar talk
  const handleGenerateAvatar = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    if (!didKey) {
      alert("Please configure your D-ID API Credentials key in settings first.");
      return;
    }

    let role = scene.speaker || 'A';
    if (videoProfile === 'guru') {
      role = 'GURU';
    }

    const presetId = avatarRoles[role];
    const preset = DID_AVATAR_PRESETS.find(p => p.id === presetId);
    const imageUrl = customAvatarUrls[role] || (preset ? preset.imageUrl : '');
    const cleanedImageUrl = cleanImageUrl(imageUrl);
    const voiceId = voiceRoles[role];

    if (!cleanedImageUrl) {
      alert(`Please choose a presenter face image for Speaker ${role}.`);
      return;
    }

    setGenerationStates(prev => ({
      ...prev,
      [sceneId]: { status: 'creating', progressText: 'Requesting D-ID rendering...', error: '' }
    }));

    try {
      const textToSpeak = scene.text + (scene.text2 ? " " + scene.text2 : "");
      console.log(`Initiating D-ID talk: "${textToSpeak}" using ${voiceId}`);
      
      const talkId = await createDidTalk(cleanedImageUrl, textToSpeak, voiceId, didKey);
      
      setGenerationStates(prev => ({
        ...prev,
        [sceneId]: { status: 'polling', progressText: 'Queued in D-ID renderer...', error: '' }
      }));

      // Poll status every 3 seconds
      const pollInterval = setInterval(async () => {
        try {
          const { status, resultUrl, error } = await getDidTalkStatus(talkId, didKey);
          
          if (status === 'done' && resultUrl) {
            clearInterval(pollInterval);
            handleSelectVideo(sceneId, resultUrl);
            setGenerationStates(prev => ({
              ...prev,
              [sceneId]: { status: 'done', progressText: 'Success!', error: '' }
            }));
            handleCheckCredits();
          } else if (status === 'error' || error) {
            clearInterval(pollInterval);
            setGenerationStates(prev => ({
              ...prev,
              [sceneId]: { status: 'error', progressText: 'Render failed', error: error?.message || error || 'D-ID failed to process.' }
            }));
          } else {
            setGenerationStates(prev => ({
              ...prev,
              [sceneId]: { status: 'polling', progressText: `Status: ${status}...`, error: '' }
            }));
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setGenerationStates(prev => ({
            ...prev,
            [sceneId]: { status: 'error', progressText: 'Status polling failed', error: pollErr.message }
          }));
        }
      }, 3000);

    } catch (e) {
      setGenerationStates(prev => ({
        ...prev,
        [sceneId]: { status: 'error', progressText: 'Request failed', error: e.message }
      }));
    }
  };

  // Generate talking avatars for all active scenes
  const handleGenerateAllAvatars = async () => {
    setGlobalGenerating(true);
    try {
      const promises = scenes.map(scene => handleGenerateAvatar(scene.id));
      await Promise.all(promises);
    } catch (e) {
      console.error("Global generation error:", e);
    } finally {
      setGlobalGenerating(false);
    }
  };

  // AI Video States
  const [aiVideoStates, setAiVideoStates] = useState({});

  const handleGenerateAiVideoScene = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setAiVideoStates(prev => ({
      ...prev,
      [sceneId]: { status: 'generating', text: 'Submitting request...', error: '' }
    }));

    try {
      const prompt = scene.promptForAiVideo || `A beautiful video showing ${scene.searchKeyword}`;
      const videoUrl = await generateAiVideo(prompt, {
        provider: apiKeys.aiVideoProvider || 'mock',
        apiKey: apiKeys.aiVideoKey || '',
        customUrl: apiKeys.aiVideoCustomUrl || '',
        customHeaders: apiKeys.aiVideoCustomHeaders || '{}',
        customPayload: apiKeys.aiVideoCustomPayload || '{}',
        customPath: apiKeys.aiVideoCustomPath || 'video.url',
        apiKeys: apiKeys,
        onStatusUpdate: (statusText) => {
          setAiVideoStates(prev => ({
            ...prev,
            [sceneId]: { status: 'generating', text: statusText, error: '' }
          }));
        }
      });

      handleSelectVideo(sceneId, videoUrl);
      setAiVideoStates(prev => ({
        ...prev,
        [sceneId]: { status: 'done', text: 'Success!', error: '' }
      }));
    } catch (err) {
      console.error("AI Video Generation failed:", err);
      setAiVideoStates(prev => ({
        ...prev,
        [sceneId]: { status: 'error', text: 'Failed', error: err.message }
      }));
    }
  };

  // AI Image States
  const [aiImageStates, setAiImageStates] = useState({});

  const handleGenerateAiImageScene = async (sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setAiImageStates(prev => ({
      ...prev,
      [sceneId]: { status: 'generating', text: 'Submitting request...', error: '' }
    }));

    try {
      const prompt = scene.promptForAiImage || `A beautiful picture showing ${scene.searchKeyword}`;
      const imageUrl = await generateAiImage(prompt, {
        provider: apiKeys.aiImageProvider || 'cloudflare',
        apiKey: apiKeys.aiImageKey || '',
        accountId: apiKeys.aiImageAccountId || '',
        modelName: apiKeys.aiImageModel || '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        apiKeys: apiKeys,
        onStatusUpdate: (statusText) => {
          setAiImageStates(prev => ({
            ...prev,
            [sceneId]: { status: 'generating', text: statusText, error: '' }
          }));
        }
      });

      handleSelectVideo(sceneId, imageUrl);
      setAiImageStates(prev => ({
        ...prev,
        [sceneId]: { status: 'done', text: 'Success!', error: '' }
      }));
    } catch (err) {
      console.error("AI Image Generation failed:", err);
      setAiImageStates(prev => ({
        ...prev,
        [sceneId]: { status: 'error', text: 'Failed', error: err.message }
      }));
    }
  };

  const activeScene = scenes.find(s => s.id === activeSceneId);
  const activeSceneRole = activeScene ? (videoProfile === 'guru' ? 'GURU' : (activeScene.speaker || 'A')) : 'A';

  return (
    <div className="glass-panel flex-col gap-4 w-full">
      {/* Header section */}
      <div className="flex-row items-center justify-between gap-3">
        <div>
          <h3 className="flex-row items-center gap-2" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            <Video size={16} style={{ color: 'var(--color-primary)' }} /> Visual Scene Assets
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Assign video clips or animate avatars for each storyboard node</p>
        </div>
      </div>

      {/* Dual Tab Bar */}
      <div className="flex-row gap-1" style={{ padding: '2px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
        <button
          onClick={() => setVideoSourceTab('stock')}
          className={`flex-row-center gap-2`}
          style={{
            flex: 1,
            padding: '8px 4px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: videoSourceTab === 'stock' ? 'var(--bg-darker)' : 'transparent',
            color: videoSourceTab === 'stock' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: videoSourceTab === 'stock' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Search size={12} /> Stock Clips
        </button>
        <button
          onClick={() => setVideoSourceTab('avatar')}
          className={`flex-row-center gap-2`}
          style={{
            flex: 1,
            padding: '8px 4px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: videoSourceTab === 'avatar' ? 'var(--bg-darker)' : 'transparent',
            color: videoSourceTab === 'avatar' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: videoSourceTab === 'avatar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Sparkles size={12} style={{ color: 'var(--color-primary)' }} /> Avatars
        </button>
        <button
          onClick={() => setVideoSourceTab('ai-video')}
          className={`flex-row-center gap-2`}
          style={{
            flex: 1,
            padding: '8px 4px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: videoSourceTab === 'ai-video' ? 'var(--bg-darker)' : 'transparent',
            color: videoSourceTab === 'ai-video' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: videoSourceTab === 'ai-video' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Video size={12} style={{ color: 'var(--color-accent)' }} /> AI Video
        </button>
        <button
          onClick={() => setVideoSourceTab('ai-image')}
          className={`flex-row-center gap-2`}
          style={{
            flex: 1,
            padding: '8px 4px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: videoSourceTab === 'ai-image' ? 'var(--bg-darker)' : 'transparent',
            color: videoSourceTab === 'ai-image' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: videoSourceTab === 'ai-image' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <ImageIcon size={12} style={{ color: 'var(--color-primary)' }} /> AI Image
        </button>
        <button
          onClick={() => setVideoSourceTab('wikimedia')}
          className={`flex-row-center gap-2`}
          style={{
            flex: 1,
            padding: '8px 4px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            background: videoSourceTab === 'wikimedia' ? 'var(--bg-darker)' : 'transparent',
            color: videoSourceTab === 'wikimedia' ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: videoSourceTab === 'wikimedia' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          <Search size={12} style={{ color: 'var(--color-emerald)' }} /> Wikimedia
        </button>
      </div>

      {/* Timeline nodes selector */}
      <div className="scene-thumbnail-strip">
        {scenes.map((scene, idx) => {
          const isSelected = selectedVideos[scene.id];
          const isActive = activeSceneId === scene.id;
          const isGenerating = generationStates[scene.id]?.status === 'creating' || generationStates[scene.id]?.status === 'polling';
          
          return (
            <button
              key={scene.id}
              onClick={() => setActiveSceneId(scene.id)}
              className={`scene-strip-node ${isActive ? 'active' : ''}`}
              style={{ width: '84px', position: 'relative' }}
            >
              <span className="scene-strip-node-tag">SCENE {idx + 1}</span>
              <span className="scene-strip-node-keyword" style={{ textTransform: 'capitalize' }}>
                {videoProfile === 'split-screen' ? `Speaker ${scene.speaker || 'A'}` : (videoProfile === 'guru' ? 'Guru' : scene.searchKeyword)}
              </span>
              <div className="scene-strip-node-status">
                {isGenerating ? (
                  <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                ) : isSelected ? (
                  <CheckCircle2 size={12} style={{ color: 'var(--color-emerald)' }} />
                ) : (
                  <div className="scene-strip-node-empty-dot"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* STOCK CLIPS TAB CONTENT */}
      {videoSourceTab === 'stock' && activeSceneId && (
        <div className="flex-col gap-3" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-row items-center justify-between gap-2">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Search query for stock clips
            </span>
            <button
              onClick={onAutoPickClick}
              disabled={autoPicking || scenes.length === 0}
              className="glow-btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600' }}
            >
              {autoPicking ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Auto-Picking...
                </>
              ) : (
                <>
                  <Sparkles size={11} style={{ color: 'var(--color-yellow)' }} /> Auto-Pick All
                </>
              )}
            </button>
          </div>

          <div className="flex-row items-center gap-2">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={14} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }} 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                placeholder="Search stock footage..."
                className="text-input"
                style={{ paddingLeft: '34px', paddingRight: '12px' }}
              />
            </div>
            <button
              onClick={() => performSearch(searchQuery)}
              className="glow-btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Find
            </button>
          </div>

          {autoPickProgress && (
            <div className="alert-box">
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span>{autoPickProgress}</span>
            </div>
          )}

          {(autoPickError || errorMsg) && (
            <div className="alert-box alert-box-danger">
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>{autoPickError || errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex-col items-center gap-2" style={{ padding: '32px 0', color: 'var(--text-muted)', justifyContent: 'center' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '12px' }}>Fetching HD stock footage clips...</span>
            </div>
          ) : (
            <div className="stock-grid">
              {searchResults.map((video) => {
                const isCurrentChoice = selectedVideos[activeSceneId] === video.videoUrl;
                
                return (
                  <div
                    key={video.id}
                    onClick={() => handleSelectVideo(activeSceneId, video.videoUrl)}
                    className={`stock-card ${isCurrentChoice ? 'active' : ''}`}
                  >
                    <img 
                      src={video.thumbnail} 
                      alt="Stock thumbnail" 
                      className="stock-card-img"
                    />

                    <div className="stock-card-overlay">
                      <div className="stock-card-top">
                        <span className="stock-card-badge">
                          {video.source}
                        </span>
                        {video.isVertical && (
                          <span className="stock-card-badge stock-card-badge-vertical">
                            9:16
                          </span>
                        )}
                      </div>
                      
                      <div className="stock-card-bottom">
                        <span className="stock-card-duration">
                          {video.duration}s
                        </span>
                        {isCurrentChoice && (
                          <span className="stock-card-select-icon">
                            <CheckCircle2 size={10} style={{ color: 'var(--bg-darker)' }} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', fontSize: '11px', color: 'var(--text-muted)', gridColumn: 'span 2' }}>
                  No stock videos found. Try search keywords like 'nature', 'technology', or 'talking'.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI VIDEO GENERATOR TAB CONTENT */}
      {videoSourceTab === 'ai-video' && activeScene && (
        <div className="flex-col gap-4" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-row items-center justify-between">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Configure and generate AI video clips for this scene
            </span>
            {selectedVideos[activeSceneId] && (
              <span style={{ fontSize: '10px', color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                <CheckCircle2 size={11} /> Clip Ready
              </span>
            )}
          </div>

          {/* Current AI Prompt configuration */}
          <div className="form-group">
            <label className="input-label" style={{ fontSize: '10px' }}>Text-to-Video Generation Prompt</label>
            <textarea
              value={activeScene.promptForAiVideo || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (setScenes) {
                  setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, promptForAiVideo: val } : s));
                }
              }}
              placeholder="A golden retriever wearing astronaut gear on the moon, looking around in awe, cinematic lighting..."
              className="textarea-input"
              style={{ minHeight: '80px', fontSize: '12.5px' }}
            />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tip: Be descriptive. Mention camera movements, lighting style, and high-quality keywords (e.g. "slow pan, cinematic lighting, 8k resolution").
            </span>
          </div>

          {/* Active scene generation status */}
          {aiVideoStates[activeSceneId] && (
            <div className="alert-box" style={{ background: aiVideoStates[activeSceneId].status === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(99, 102, 241, 0.05)', borderColor: aiVideoStates[activeSceneId].status === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {aiVideoStates[activeSceneId].status === 'generating' && (
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                  )}
                  <span className="text-xs font-bold uppercase" style={{ color: aiVideoStates[activeSceneId].status === 'error' ? 'var(--color-red)' : 'var(--text-primary)' }}>
                    {aiVideoStates[activeSceneId].status === 'error' ? 'Generation Error' : 'Status'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--text-secondary)' }}>
                  {aiVideoStates[activeSceneId].text}
                </p>
                {aiVideoStates[activeSceneId].error && (
                  <p style={{ fontSize: '10px', color: 'var(--color-red)', margin: 0, marginTop: '4px', background: 'rgba(239,68,68,0.08)', padding: '6px', borderRadius: '6px' }}>
                    {aiVideoStates[activeSceneId].error}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Generation Actions */}
          <div className="flex-col gap-2">
            <button
              onClick={() => handleGenerateAiVideoScene(activeSceneId)}
              disabled={aiVideoStates[activeSceneId]?.status === 'generating'}
              className="glow-btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Sparkles size={14} />
              <span>
                {selectedVideos[activeSceneId] ? "Regenerate AI Video Clip" : "Generate AI Video Clip"}
              </span>
            </button>
          </div>

          {/* Settings Context Warning */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Provider: <strong style={{ color: 'var(--color-accent)' }}>{apiKeys.aiVideoProvider === 'mock' ? 'Mock / Sandbox (No Keys)' : apiKeys.aiVideoProvider === 'fal-luma' ? 'Fal.ai Luma' : apiKeys.aiVideoProvider === 'fal-kling' ? 'Fal.ai Kling' : 'Custom Endpoint'}</strong>. Change this in Script &gt; AI Settings.
            </span>
          </div>

        </div>
      )}

      {/* AI IMAGE GENERATOR TAB CONTENT */}
      {videoSourceTab === 'ai-image' && activeScene && (
        <div className="flex-col gap-4" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-row items-center justify-between">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Configure and generate AI image clips for this scene
            </span>
            {selectedVideos[activeSceneId] && (
              <span style={{ fontSize: '10px', color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                <CheckCircle2 size={11} /> Image Ready
              </span>
            )}
          </div>

          {/* Current AI Prompt configuration */}
          <div className="form-group">
            <label className="input-label" style={{ fontSize: '10px' }}>Text-to-Image Generation Prompt</label>
            <textarea
              value={activeScene.promptForAiImage || ""}
              onChange={(e) => {
                const val = e.target.value;
                if (setScenes) {
                  setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, promptForAiImage: val } : s));
                }
              }}
              placeholder="A rare blue bird in a golden cage, professional studio photograph, dramatic lighting, 8k..."
              className="textarea-input"
              style={{ minHeight: '80px', fontSize: '12.5px' }}
            />
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Tip: Be descriptive. Mention visual style, camera angle, and artistic medium (e.g. "photorealistic, cinematic lighting, 8k").
            </span>
          </div>

          {/* Active scene generation status */}
          {aiImageStates[activeSceneId] && (
            <div className="alert-box" style={{ background: aiImageStates[activeSceneId].status === 'error' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(99, 102, 241, 0.05)', borderColor: aiImageStates[activeSceneId].status === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {aiImageStates[activeSceneId].status === 'generating' && (
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                  )}
                  <span className="text-xs font-bold uppercase" style={{ color: aiImageStates[activeSceneId].status === 'error' ? 'var(--color-red)' : 'var(--text-primary)' }}>
                    {aiImageStates[activeSceneId].status === 'error' ? 'Generation Error' : 'Status'}
                  </span>
                </div>
                <p style={{ fontSize: '12px', margin: 0, color: 'var(--text-secondary)' }}>
                  {aiImageStates[activeSceneId].text}
                </p>
                {aiImageStates[activeSceneId].error && (
                  <p style={{ fontSize: '10px', color: 'var(--color-red)', margin: 0, marginTop: '4px', background: 'rgba(239,68,68,0.08)', padding: '6px', borderRadius: '6px' }}>
                    {aiImageStates[activeSceneId].error}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Generation Actions */}
          <div className="flex-col gap-2">
            <button
              onClick={() => handleGenerateAiImageScene(activeSceneId)}
              disabled={aiImageStates[activeSceneId]?.status === 'generating'}
              className="glow-btn"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ImageIcon size={14} />
              <span>
                {selectedVideos[activeSceneId] ? "Regenerate AI Image" : "Generate AI Image"}
              </span>
            </button>
          </div>

          {/* Settings Context Warning */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.01)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              Provider: <strong style={{ color: 'var(--color-accent)' }}>{apiKeys.aiImageProvider === 'mock' ? 'Mock / Sandbox (No Keys)' : `Cloudflare Workers AI (${apiKeys.aiImageModel})`}</strong>. Change this in Script &gt; AI Settings.
            </span>
          </div>

        </div>
      )}

      {/* WIKIMEDIA COMMONS TAB CONTENT */}
      {videoSourceTab === 'wikimedia' && activeSceneId && (
        <div className="flex-col gap-3" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-row items-center justify-between gap-2">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Search query for Wikimedia Commons public domain assets
            </span>
          </div>

          <div className="flex-row items-center gap-2">
            <div style={{ position: 'relative', flex: 1 }}>
              <Search 
                size={14} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)',
                  pointerEvents: 'none'
                }} 
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && performSearch(searchQuery)}
                placeholder="Search Wikimedia Commons..."
                className="text-input"
                style={{ paddingLeft: '34px', paddingRight: '12px' }}
              />
            </div>
            <button
              onClick={() => performSearch(searchQuery)}
              className="glow-btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Find
            </button>
          </div>

          {errorMsg && (
            <div className="alert-box alert-box-danger">
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex-col items-center gap-2" style={{ padding: '32px 0', color: 'var(--text-muted)', justifyContent: 'center' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '12px' }}>Querying Wikimedia Commons database...</span>
            </div>
          ) : (
            <div className="stock-grid">
              {searchResults.map((video) => {
                const isCurrentChoice = selectedVideos[activeSceneId] === video.videoUrl;
                
                return (
                  <div
                    key={video.id}
                    onClick={() => handleSelectVideo(activeSceneId, video.videoUrl)}
                    className={`stock-card ${isCurrentChoice ? 'active' : ''}`}
                  >
                    <img 
                      src={video.thumbnail} 
                      alt="Wikimedia thumbnail" 
                      className="stock-card-img"
                      style={{ objectFit: 'contain', background: '#090d16' }}
                    />
                    {video.isVideo && (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.2)',
                        pointerEvents: 'none'
                      }}>
                        <div style={{
                          background: 'rgba(0,0,0,0.6)',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(255,255,255,0.4)'
                        }}>
                          <PlayCircle size={14} style={{ color: '#fff', marginLeft: '1px' }} />
                        </div>
                      </div>
                    )}

                    <div className="stock-card-overlay" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                      <div className="stock-card-top" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <span className="stock-card-badge" style={{ background: video.source === 'Wikipedia' ? 'var(--color-primary)' : 'rgba(0,0,0,0.6)' }}>
                            {video.source === 'Wikipedia' ? 'Wikipedia' : 'Commons'}
                          </span>
                          {video.isVideo && (
                            <span className="stock-card-badge stock-card-badge-vertical" style={{ background: 'var(--color-emerald)' }}>
                              Video
                            </span>
                          )}
                          {video.isVertical && (
                            <span className="stock-card-badge stock-card-badge-vertical">
                              9:16
                            </span>
                          )}
                        </div>
                        {isCurrentChoice && (
                          <span className="stock-card-select-icon" style={{ position: 'static', background: 'var(--color-emerald)', padding: '2px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px rgba(0,0,0,0.5)' }}>
                            <CheckCircle2 size={12} style={{ color: '#ffffff' }} />
                          </span>
                        )}
                      </div>
                      
                      <div className="stock-card-bottom" style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '2px',
                        width: '100%',
                        padding: '6px 8px',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                        borderBottomLeftRadius: '8px',
                        borderBottomRightRadius: '8px',
                        display: 'flex'
                      }}>
                        <div className="flex-row items-center justify-between" style={{ width: '100%' }}>
                          <span style={{ 
                            fontSize: '10.5px', 
                            color: '#ffffff', 
                            fontWeight: '600', 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden', 
                            whiteSpace: 'nowrap',
                            maxWidth: video.isVideo ? 'calc(100% - 35px)' : '100%'
                          }} title={video.title}>
                            {video.title || "Untitled"}
                          </span>
                          {video.isVideo && (
                            <span className="stock-card-duration" style={{ fontSize: '9px', padding: '1px 4px', background: 'rgba(0,0,0,0.4)', borderRadius: '4px' }}>
                              {video.duration}s
                            </span>
                          )}
                        </div>
                        {video.description && (
                          <span style={{ 
                            fontSize: '8.5px', 
                            color: 'rgba(255,255,255,0.7)', 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden', 
                            whiteSpace: 'nowrap',
                            width: '100%',
                            textAlign: 'left'
                          }} title={video.description}>
                            {video.description}
                          </span>
                        )}
                        {video.pageUrl && (
                          <a 
                            href={video.pageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: '8px',
                              color: 'var(--color-primary)',
                              textDecoration: 'none',
                              marginTop: '2px',
                              alignSelf: 'flex-start',
                              opacity: 0.8,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.opacity = '0.8';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            View Source ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', fontSize: '11px', color: 'var(--text-muted)', gridColumn: 'span 2' }}>
                  No Commons media found. Try search keywords like 'solar system', 'albert einstein', or 'world map'.
                </div>
              )}
            </div>
          )}

          {wikimediaContinue && searchResults.length > 0 && (
            <div className="flex-row-center" style={{ marginTop: '16px', marginBottom: '8px' }}>
              <button
                onClick={handleLoadMoreWikimedia}
                disabled={loadingMore}
                className="glow-btn-secondary"
                style={{
                  padding: '8px 24px',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: '150px',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} style={{ color: 'var(--color-emerald)' }} />
                    <span>Load More</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}


      {/* D-ID AI AVATAR TAB CONTENT */}
      {videoSourceTab === 'avatar' && (
        <div className="flex-col gap-4" style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          
          {/* Credits Bar */}
          <div className="flex-row items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex-row items-center gap-2">
              <Coins size={14} style={{ color: 'var(--color-primary)' }} />
              <span className="text-xs text-slate-300">D-ID Credits Remaining:</span>
              <span className="text-xs font-bold text-slate-100" style={{ fontFamily: 'monospace' }}>
                {loadingCredits ? <Loader2 size={12} className="animate-spin" /> : (didCredits !== null ? `${didCredits} credits` : 'Unchecked')}
              </span>
            </div>
            <button
              onClick={handleCheckCredits}
              disabled={loadingCredits}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Refresh credits"
            >
              <RefreshCw size={12} className={loadingCredits ? 'animate-spin' : ''} />
            </button>
          </div>

          {didKeyError && (
            <div className="alert-box alert-box-danger text-xs">
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span>{didKeyError}</span>
            </div>
          )}

          {/* Config Personas Settings card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <h4 style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
              AI Presenter Persona Settings
            </h4>

            {/* Persona selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: videoProfile === 'split-screen' ? '1fr 1fr' : '1fr', gap: '12px' }}>
              
              {/* Speaker A Configuration */}
              {(videoProfile === 'split-screen' || videoProfile === 'guru') && (
                <div className="flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    {videoProfile === 'split-screen' ? 'Speaker A (Top Half)' : 'Solo Guru'}
                  </span>
                  
                  {/* Preset Face Selector */}
                  <div className="flex-row gap-1">
                    {DID_AVATAR_PRESETS.filter(p => videoProfile === 'guru' ? p.role === 'GURU' : p.role === 'A').map(p => {
                      const isActive = avatarRoles[videoProfile === 'guru' ? 'GURU' : 'A'] === p.id && !customAvatarUrls[videoProfile === 'guru' ? 'GURU' : 'A'];
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            const speakerKey = videoProfile === 'guru' ? 'GURU' : 'A';
                            setAvatarRoles(prev => ({ ...prev, [speakerKey]: p.id }));
                            setCustomAvatarUrls(prev => ({ ...prev, [speakerKey]: '' }));
                            setVoiceRoles(prev => ({ ...prev, [speakerKey]: p.defaultVoice }));
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                            transition: 'all 0.2s',
                            opacity: isActive ? 1 : 0.6
                          }}
                          title={p.name}
                        >
                          <img src={p.thumbnail} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom URL Input toggle */}
                  <input
                    type="text"
                    placeholder="Or custom portrait image URL..."
                    value={customAvatarUrls[videoProfile === 'guru' ? 'GURU' : 'A']}
                    onChange={(e) => {
                      const speakerKey = videoProfile === 'guru' ? 'GURU' : 'A';
                      setCustomAvatarUrls(prev => ({ ...prev, [speakerKey]: e.target.value }));
                    }}
                    className="text-input"
                    style={{ fontSize: '10px', padding: '4px 8px' }}
                  />

                  {/* Voice Selector */}
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Neural Voice</label>
                    <select
                      value={voiceRoles[videoProfile === 'guru' ? 'GURU' : 'A']}
                      onChange={(e) => {
                        const speakerKey = videoProfile === 'guru' ? 'GURU' : 'A';
                        setVoiceRoles(prev => ({ ...prev, [speakerKey]: e.target.value }));
                      }}
                      className="select-input"
                      style={{ fontSize: '11px', padding: '4px 6px' }}
                    >
                      {DID_VOICE_PRESETS.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Speaker B Configuration (only split-screen) */}
              {videoProfile === 'split-screen' && (
                <div className="flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-300">Speaker B (Bottom Half)</span>
                  
                  {/* Preset Face Selector */}
                  <div className="flex-row gap-1">
                    {DID_AVATAR_PRESETS.filter(p => p.role === 'B').map(p => {
                      const isActive = avatarRoles.B === p.id && !customAvatarUrls.B;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setAvatarRoles(prev => ({ ...prev, B: p.id }));
                            setCustomAvatarUrls(prev => ({ ...prev, B: '' }));
                            setVoiceRoles(prev => ({ ...prev, B: p.defaultVoice }));
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                            transition: 'all 0.2s',
                            opacity: isActive ? 1 : 0.6
                          }}
                          title={p.name}
                        >
                          <img src={p.thumbnail} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom URL Input toggle */}
                  <input
                    type="text"
                    placeholder="Or custom portrait image URL..."
                    value={customAvatarUrls.B}
                    onChange={(e) => setCustomAvatarUrls(prev => ({ ...prev, B: e.target.value }))}
                    className="text-input"
                    style={{ fontSize: '10px', padding: '4px 8px' }}
                  />

                  {/* Voice Selector */}
                  <div className="flex-col gap-1">
                    <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Neural Voice</label>
                    <select
                      value={voiceRoles.B}
                      onChange={(e) => setVoiceRoles(prev => ({ ...prev, B: e.target.value }))}
                      className="select-input"
                      style={{ fontSize: '11px', padding: '4px 6px' }}
                    >
                      {DID_VOICE_PRESETS.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Active Scene Panel */}
          {activeScene && (
            <div className="flex-col gap-3" style={{ background: 'rgba(255,255,255,0.02)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex-row items-center justify-between">
                <span className="badge font-bold" style={{ textTransform: 'uppercase', fontSize: '10px' }}>
                  Active Scene: Speaker {activeSceneRole}
                </span>
                
                {selectedVideos[activeSceneId] && (
                  <span style={{ fontSize: '10px', color: 'var(--color-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={10} /> Video Ready
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Text to speak:</span>
                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
                  "{activeScene.text} {activeScene.text2 || ''}"
                </p>
              </div>

              {/* Status or Actions */}
              {generationStates[activeSceneId] ? (
                <div className="flex-col gap-2" style={{ marginTop: '4px' }}>
                  <div className="flex-row items-center gap-2">
                    {(generationStates[activeSceneId].status === 'creating' || generationStates[activeSceneId].status === 'polling') && (
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                    )}
                    <span className="text-xs font-semibold" style={{
                      color: generationStates[activeSceneId].status === 'error' ? 'var(--color-red)' : (generationStates[activeSceneId].status === 'done' ? 'var(--color-emerald)' : 'var(--text-primary)')
                    }}>
                      {generationStates[activeSceneId].progressText}
                    </span>
                  </div>
                  {generationStates[activeSceneId].error && (
                    <p style={{ fontSize: '10px', color: 'var(--color-red)', margin: 0, background: 'rgba(239, 68, 68, 0.05)', padding: '6px', borderRadius: '4px' }}>
                      Error: {generationStates[activeSceneId].error}
                    </p>
                  )}
                </div>
              ) : null}

              {/* Generation Button */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginTop: '6px' }}>
                <button
                  onClick={() => handleGenerateAvatar(activeSceneId)}
                  disabled={generationStates[activeSceneId]?.status === 'creating' || generationStates[activeSceneId]?.status === 'polling'}
                  className="glow-btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '36px' }}
                >
                  <Sparkles size={14} />
                  <span>
                    {selectedVideos[activeSceneId] ? 'Regenerate Talking Avatar' : 'Generate Talking Avatar'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* All Scenes Generation Panel */}
          {scenes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
              <button
                onClick={handleGenerateAllAvatars}
                disabled={globalGenerating}
                className="glow-btn-secondary"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '40px', background: 'rgba(99, 102, 241, 0.1)', border: '1.5px solid var(--color-primary)', color: '#ffffff' }}
              >
                {globalGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Rendering All Avatars...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle size={16} style={{ color: 'var(--color-primary)' }} />
                    <span>Generate All Avatars (Render Whole Script)</span>
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
