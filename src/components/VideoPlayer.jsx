import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, ShieldCheck } from 'lucide-react';
import { decodeAudio } from '../utils/speechEngine';

export default function VideoPlayer({
  videoProfile = 'faceless',
  scenes = [],
  voiceoverBuffer = null,
  bgmBuffer = null,
  bgmVolume = 0.15,
  voiceoverText = '',
  selectedVideos = {}, // mapping of scene.id -> videoUrl
  isPlaying = false,
  setIsPlaying = () => {},
  currentTime = 0,
  setCurrentTime = () => {},
  subtitleSettings = { focusColor: '#eab308', pulseHighlight: true },
  showSafeZone = false,
  sfxBuffers = {}
}) {
  const canvasRef = useRef(null);
  const hiddenVideoPool = useRef({}); // stores HTMLVideoElements for each scene
  const hiddenImagePool = useRef({}); // stores HTMLImageElements for each scene
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const audioSourceNodeRef = useRef(null);
  const bgmSourceNodeRef = useRef(null);
  const bgmGainNodeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sfxSourceNodesRef = useRef([]);
  
  // Track loaded elements to avoid flicker
  const [videoLoadedStates, setVideoLoadedStates] = useState({});
  const [imageLoadedStates, setImageLoadedStates] = useState({});
  const [timelineDuration, setTimelineDuration] = useState(10);

  // Sync timeline duration with the sum of scenes durations
  useEffect(() => {
    if (scenes.length > 0) {
      const total = scenes.reduce((sum, s) => sum + (s.duration || 3), 0);
      setTimelineDuration(total);
    }
  }, [scenes]);

  // Create video elements for each scene
  useEffect(() => {
    scenes.forEach(scene => {
      const videoUrl = selectedVideos[scene.id];
      if (videoUrl && scene.videoSource === 'ai-image') {
        if (!hiddenImagePool.current[scene.id]) {
          const img = new Image();
          img.src = videoUrl;
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            console.log(`Image loaded successfully for scene ${scene.id}: ${videoUrl}`);
            setImageLoadedStates(prev => ({ ...prev, [scene.id]: true }));
          };
          img.onerror = () => {
            console.warn(`Image load failed for scene ${scene.id} with crossOrigin, retrying without it...`);
            if (img.crossOrigin) {
              img.removeAttribute('crossorigin');
              img.src = videoUrl;
            }
          };
          hiddenImagePool.current[scene.id] = img;
        } else if (hiddenImagePool.current[scene.id].src !== videoUrl) {
          const img = hiddenImagePool.current[scene.id];
          img.crossOrigin = 'anonymous';
          img.src = videoUrl;
          setImageLoadedStates(prev => ({ ...prev, [scene.id]: false }));
          img.onload = () => {
            console.log(`Updated image loaded successfully for scene ${scene.id}: ${videoUrl}`);
            setImageLoadedStates(prev => ({ ...prev, [scene.id]: true }));
          };
          img.onerror = () => {
            console.warn(`Updated image load failed for scene ${scene.id} with crossOrigin, retrying without it...`);
            if (img.crossOrigin) {
              img.removeAttribute('crossorigin');
              img.src = videoUrl;
            }
          };
        }
      } else if (videoUrl && !hiddenVideoPool.current[scene.id]) {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        
        video.onloadeddata = () => {
          console.log(`Video loaded successfully for scene ${scene.id}: ${videoUrl}`);
          setVideoLoadedStates(prev => ({ ...prev, [scene.id]: true }));
        };

        video.onerror = (e) => {
          console.warn(`Video load failed for scene ${scene.id} with crossOrigin, retrying without it...`, e);
          if (video.crossOrigin) {
            video.removeAttribute('crossorigin');
            video.load();
          }
        };

        video.load();
        hiddenVideoPool.current[scene.id] = video;
      } else if (videoUrl && hiddenVideoPool.current[scene.id] && hiddenVideoPool.current[scene.id].src !== videoUrl) {
        // Source updated
        const video = hiddenVideoPool.current[scene.id];
        video.crossOrigin = 'anonymous';
        video.src = videoUrl;
        
        video.onloadeddata = () => {
          console.log(`Updated video loaded successfully for scene ${scene.id}: ${videoUrl}`);
          setVideoLoadedStates(prev => ({ ...prev, [scene.id]: true }));
        };

        video.onerror = (e) => {
          console.warn(`Updated video load failed for scene ${scene.id} with crossOrigin, retrying without it...`, e);
          if (video.crossOrigin) {
            video.removeAttribute('crossorigin');
            video.load();
          }
        };

        video.load();
        setVideoLoadedStates(prev => ({ ...prev, [scene.id]: false }));
      }
    });

    // Cleanup video tags not in active scenes
    return () => {
      const activeIds = scenes.map(s => s.id);
      Object.keys(hiddenVideoPool.current).forEach(id => {
        if (!activeIds.includes(id)) {
          hiddenVideoPool.current[id].pause();
          hiddenVideoPool.current[id].src = "";
          delete hiddenVideoPool.current[id];
        }
      });
      Object.keys(hiddenImagePool.current).forEach(id => {
        if (!activeIds.includes(id)) {
          hiddenImagePool.current[id].src = "";
          delete hiddenImagePool.current[id];
        }
      });
    };
  }, [scenes, selectedVideos]);

  // Handle Play/Pause and Audio setup
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      
      // Play audio nodes
      if (voiceoverBuffer || bgmBuffer) {
        playAudioBuffer();
      }
    } else {
      stopAudioBuffer();
    }

    return () => stopAudioBuffer();
  }, [isPlaying, voiceoverBuffer, bgmBuffer]);

  // Update BGM volume dynamically during playback
  useEffect(() => {
    if (bgmGainNodeRef.current && audioCtxRef.current) {
      bgmGainNodeRef.current.gain.setValueAtTime(bgmVolume, audioCtxRef.current.currentTime);
    }
  }, [bgmVolume]);

  // Web Audio playback helpers
  const playAudioBuffer = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      stopAudioBuffer();

      // Voiceover
      if (voiceoverBuffer) {
        const source = ctx.createBufferSource();
        source.buffer = voiceoverBuffer;
        source.connect(ctx.destination);
        source.start(0, currentTime);
        audioSourceNodeRef.current = source;
      }

      // Background Music (BGM)
      if (bgmBuffer) {
        const bgmSource = ctx.createBufferSource();
        bgmSource.buffer = bgmBuffer;
        bgmSource.loop = true;
        
        const bgmGain = ctx.createGain();
        bgmGain.gain.setValueAtTime(bgmVolume, ctx.currentTime);
        
        bgmSource.connect(bgmGain);
        bgmGain.connect(ctx.destination);
        
        const offset = bgmBuffer.duration > 0 ? currentTime % bgmBuffer.duration : 0;
        bgmSource.start(0, offset);
        
        bgmSourceNodeRef.current = bgmSource;
        bgmGainNodeRef.current = bgmGain;
      }

      // Sound Effects (SFX)
      scenes.forEach(scene => {
        if (scene.sfxUrl) {
          const sfxBuffer = sfxBuffers[scene.sfxUrl];
          if (sfxBuffer) {
            const sceneStart = scenes.slice(0, scenes.indexOf(scene)).reduce((sum, s) => sum + (s.duration || 3), 0);
            if (sceneStart >= currentTime) {
              const source = ctx.createBufferSource();
              source.buffer = sfxBuffer;
              source.connect(ctx.destination);
              source.start(ctx.currentTime + (sceneStart - currentTime));
              sfxSourceNodesRef.current.push(source);
            }
          }
        }
      });
    } catch (e) {
      console.error("Audio Context Playback error:", e);
    }
  };

  const stopAudioBuffer = () => {
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.stop();
      } catch (e) {}
      audioSourceNodeRef.current = null;
    }
    if (bgmSourceNodeRef.current) {
      try {
        bgmSourceNodeRef.current.stop();
      } catch (e) {}
      bgmSourceNodeRef.current = null;
    }
    bgmGainNodeRef.current = null;
    
    sfxSourceNodesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (e) {}
    });
    sfxSourceNodesRef.current = [];
  };

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Virtual resolution is 9:16 (540x960 for HD performance)
    const W = 540;
    const H = 960;
    canvas.width = W;
    canvas.height = H;

    const renderSceneContent = (ctx, targetScene, index, elapsed, pct, timestamp) => {
      if (!targetScene) return;
      if (videoProfile === 'split-screen') {
        renderSplitScreen(ctx, W, H, targetScene, elapsed, timestamp);
      } else if (videoProfile === 'faceless') {
        renderFaceless(ctx, W, H, targetScene, pct);
      } else if (videoProfile === 'guru') {
        renderGuru(ctx, W, H, targetScene, index, pct, timestamp);
      } else if (videoProfile === 'tweet-showcase') {
        renderTweetShowcase(ctx, W, H, targetScene, elapsed, timestamp);
      }
    };

    const render = (timestamp) => {
      // Manage playing clock if active
      if (isPlaying) {
        const delta = (timestamp - lastTimeRef.current) / 1000;
        lastTimeRef.current = timestamp;
        
        // Use raw delta for perfect wall-clock sync with audio.
        // Only skip if delta is invalid (negative) or absurdly large (tab was backgrounded > 500ms).
        if (delta > 0 && delta < 0.5) {
          setCurrentTime(prev => {
            const next = prev + delta;
            if (next >= timelineDuration) {
              setIsPlaying(false);
              stopAudioBuffer();
              return 0;
            }
            return next;
          });
        }
      }

      // Clear Canvas
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, W, H);

      // Find current scene
      let elapsed = 0;
      let currentScene = null;
      let activeIndex = 0;
      
      for (let i = 0; i < scenes.length; i++) {
        const s = scenes[i];
        if (currentTime >= elapsed && currentTime < elapsed + (s.duration || 3)) {
          currentScene = s;
          activeIndex = i;
          break;
        }
        elapsed += (s.duration || 3);
      }

      // If no scene found, use the last one
      if (!currentScene && scenes.length > 0) {
        currentScene = scenes[scenes.length - 1];
        activeIndex = scenes.length - 1;
      }

      const sceneStartOffset = scenes.slice(0, activeIndex).reduce((sum, s) => sum + (s.duration || 3), 0);
      const sceneElapsed = currentScene ? (currentTime - sceneStartOffset) : 0;
      const scenePct = currentScene ? (sceneElapsed / currentScene.duration) : 0;

      // Transition check
      const transitionDuration = 0.5; // 0.5 seconds transition
      const sceneTransition = currentScene ? (currentScene.transition || 'none') : 'none';
      const isTransitioning = activeIndex > 0 && sceneElapsed < transitionDuration && sceneTransition && sceneTransition !== 'none';
      const prevScene = isTransitioning ? scenes[activeIndex - 1] : null;
      const prevSceneDuration = prevScene ? (prevScene.duration || 3) : 0;
      const prevSceneElapsed = prevScene ? (prevSceneDuration - (transitionDuration - sceneElapsed)) : 0;
      const prevScenePct = prevScene ? (prevSceneElapsed / prevSceneDuration) : 0;

      // Sync HTMLVideoElements in the hidden pool with the playback state and clock
      scenes.forEach((s) => {
        const video = hiddenVideoPool.current[s.id];
        if (video) {
          const isCurrent = currentScene && s.id === currentScene.id;
          const isTransitionActive = isTransitioning && prevScene && s.id === prevScene.id;

          if (isCurrent || isTransitionActive) {
            // Active or transitioning scene's video
            if (isPlaying) {
              if (video.paused) {
                video.play().catch(err => console.warn("Video playback start failed:", err));
              }
            } else {
              // Paused state
              if (!video.paused) {
                video.pause();
              }
              const duration = video.duration || 3;
              const elapsedVal = isCurrent ? sceneElapsed : prevSceneElapsed;
              const targetVideoTime = isNaN(duration) ? 0 : (elapsedVal % duration);
              if (Math.abs(video.currentTime - targetVideoTime) > 0.1) {
                video.currentTime = targetVideoTime;
              }
            }
          } else {
            // Inactive scenes' videos should be paused to save resources
            if (!video.paused) {
              video.pause();
            }
          }
        }
      });

      // Draw background/content based on transition or normal render
      if (isTransitioning && prevScene) {
        const progress = sceneElapsed / transitionDuration; // 0 to 1
        
        if (sceneTransition === 'cross-dissolve') {
          // Draw previous scene fully
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          // Draw current scene with opacity
          ctx.save();
          ctx.globalAlpha = progress;
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
        } else if (sceneTransition === 'slide-left') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, H);
          ctx.clip();
          
          // Slide previous out left
          ctx.save();
          ctx.translate(-progress * W, 0);
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          ctx.restore();
          
          // Slide current in from right
          ctx.save();
          ctx.translate((1 - progress) * W, 0);
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
          ctx.restore();
        } else if (sceneTransition === 'slide-right') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, H);
          ctx.clip();
          
          // Slide previous out right
          ctx.save();
          ctx.translate(progress * W, 0);
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          ctx.restore();
          
          // Slide current in from left
          ctx.save();
          ctx.translate(-(1 - progress) * W, 0);
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
          ctx.restore();
        } else if (sceneTransition === 'slide-up') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, H);
          ctx.clip();
          
          // Slide previous out up
          ctx.save();
          ctx.translate(0, -progress * H);
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          ctx.restore();
          
          // Slide current in from bottom
          ctx.save();
          ctx.translate(0, (1 - progress) * H);
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
          ctx.restore();
        } else if (sceneTransition === 'zoom-fade') {
          // Draw previous scene zooming out and fading
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - progress);
          ctx.translate(W / 2, H / 2);
          ctx.scale(1 - progress * 0.15, 1 - progress * 0.15);
          ctx.translate(-W / 2, -H / 2);
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          ctx.restore();
          
          // Draw current scene zooming in and fading in
          ctx.save();
          ctx.globalAlpha = progress;
          ctx.translate(W / 2, H / 2);
          ctx.scale(0.85 + progress * 0.15, 0.85 + progress * 0.15);
          ctx.translate(-W / 2, -H / 2);
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
        } else if (sceneTransition === 'wipe-left') {
          // Previous scene full
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          // Current scene wiped from right to left
          ctx.save();
          ctx.beginPath();
          ctx.rect((1 - progress) * W, 0, progress * W, H);
          ctx.clip();
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
        } else if (sceneTransition === 'wipe-right') {
          // Previous scene full
          renderSceneContent(ctx, prevScene, activeIndex - 1, prevSceneElapsed, prevScenePct, timestamp);
          // Current scene wiped from left to right
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, progress * W, H);
          ctx.clip();
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
          ctx.restore();
        } else {
          renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
        }
      } else {
        // Standard draw
        renderSceneContent(ctx, currentScene, activeIndex, sceneElapsed, scenePct, timestamp);
      }

      // Draw Karaoke Subtitles (always centered, complying with safe zones)
      if (currentScene) {
        drawSubtitles(ctx, W, H, currentScene, currentTime);
      }

      // Draw Safe Zone lines if requested
      if (showSafeZone) {
        drawSafeZoneOverlays(ctx, W, H);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, currentTime, videoProfile, scenes, selectedVideos, subtitleSettings, showSafeZone, timelineDuration]);

  // PROFILE 1: SPLIT SCREEN DIALOGUE LAYOUT
  const renderSplitScreen = (ctx, W, H, scene, sceneElapsed, timestamp) => {
    const splitHeight = H / 2;
    const isSpeakerA = scene ? (scene.speaker === 'A') : true;

    // Draw background dividing line
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const isImage = scene?.videoSource === 'ai-image';
    const media = scene ? (isImage ? hiddenImagePool.current[scene.id] : hiddenVideoPool.current[scene.id]) : null;
    const isLoaded = scene ? (isImage ? imageLoadedStates[scene.id] : videoLoadedStates[scene.id]) : false;

    // Draw Subject A (Top Half)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, splitHeight);
    ctx.clip();
    
    if (isSpeakerA && media && isLoaded) {
      if (isImage) {
        drawCroppedImage(ctx, media, 0, 0, W, splitHeight);
      } else {
        drawCroppedVideo(ctx, media, 0, 0, W, splitHeight);
      }
    } else {
      drawAvatar(ctx, W / 2, splitHeight - 120, 'A', isSpeakerA, sceneElapsed, timestamp);
    }
    ctx.restore();

    // Draw Subject B (Bottom Half)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H / 2, W, splitHeight);
    ctx.clip();
    
    if (!isSpeakerA && media && isLoaded) {
      if (isImage) {
        drawCroppedImage(ctx, media, 0, H / 2, W, splitHeight);
      } else {
        drawCroppedVideo(ctx, media, 0, H / 2, W, splitHeight);
      }
    } else {
      drawAvatar(ctx, W / 2, H - 120, 'B', !isSpeakerA, sceneElapsed, timestamp);
    }
    ctx.restore();

    // Divider bar
    ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.fillRect(0, H / 2 - 3, W, 6);
  };

  // PROFILE 2: FACELESS ATMOSPHERIC PROFILE
  const renderFaceless = (ctx, W, H, scene, pct) => {
    const isImage = scene?.videoSource === 'ai-image';
    const media = scene ? (isImage ? hiddenImagePool.current[scene.id] : hiddenVideoPool.current[scene.id]) : null;
    const isLoaded = scene ? (isImage ? imageLoadedStates[scene.id] : videoLoadedStates[scene.id]) : false;

    if (media && isLoaded) {
      const scale = 1.0 + (pct * 0.05); // 105% slow-zoom panning
      
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);
      if (isImage) {
        drawCroppedImage(ctx, media, 0, 0, W, H);
      } else {
        drawCroppedVideo(ctx, media, 0, 0, W, H);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      
      const grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W);
      grad.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
      grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.05)');
      grad.addColorStop(1, '#060913');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      
      ctx.font = '500 16px Outfit';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(`[Faceless B-Roll: "${scene?.searchKeyword || 'atmospheric'}"]`, W / 2, H / 2);
    }
  };

  // PROFILE 3: SOLO GURU PROFILE
  const renderGuru = (ctx, W, H, scene, activeIndex, pct, timestamp) => {
    const isCloseUp = scene ? scene.isSentenceBreak : false;
    const baseScale = isCloseUp ? 1.15 : 1.0;
    
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(baseScale, baseScale);
    ctx.translate(-W / 2, -H / 2);

    const isImage = scene?.videoSource === 'ai-image';
    const media = scene ? (isImage ? hiddenImagePool.current[scene.id] : hiddenVideoPool.current[scene.id]) : null;
    const isLoaded = scene ? (isImage ? imageLoadedStates[scene.id] : videoLoadedStates[scene.id]) : false;

    if (media && isLoaded) {
      if (isImage) {
        drawCroppedImage(ctx, media, 0, 0, W, H);
      } else {
        drawCroppedVideo(ctx, media, 0, 0, W, H);
      }
    } else {
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, W, H);
      
      const grad = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 400);
      grad.addColorStop(0, 'rgba(168, 85, 247, 0.2)');
      grad.addColorStop(1, '#0b0f19');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      drawAvatar(ctx, W / 2, H / 2 + 100, 'GURU', true, pct * (scene?.duration || 3), timestamp);
    }
    ctx.restore();
  };

  // PROFILE 4: APP SCREEN / TWEET SHOWCASE
  const renderTweetShowcase = (ctx, W, H, scene, sceneElapsed, timestamp) => {
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);

    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#090d1f');
    bgGrad.addColorStop(0.5, '#1e1b4b');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    for (let i = 0; i < 3; i++) {
      const cx = W / 2 + Math.cos((timestamp + i * 5000) / 3000) * 120;
      const cy = H / 2 + Math.sin((timestamp + i * 5000) / 2500) * 200;
      ctx.beginPath();
      ctx.arc(cx, cy, 100 + i * 30, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!scene || !scene.cardContent) return;

    const cardW = W * 0.8;
    const cardH = 220;
    const cardX = (W - cardW) / 2;
    const cardY = H / 2 - cardH / 2;

    const slideDuration = 0.5; // 500ms slide-in
    let slideY = cardY;
    
    if (sceneElapsed < slideDuration) {
      const slidePct = sceneElapsed / slideDuration;
      slideY = H + 50 - (H + 50 - cardY) * slidePct;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;

    const radius = 20; // 16px to 24px corner metrics (we lock to 20px)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.roundRect(cardX, slideY, cardW, cardH, radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const content = scene.cardContent;
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px Outfit';
    ctx.textAlign = 'left';
    ctx.fillText(content.name || "App Showcase", cardX + 25, slideY + 45);

    ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
    ctx.font = '400 13px Inter';
    ctx.fillText(content.handle || "@app_demo", cardX + 25, slideY + 65);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 15px Inter';
    wrapText(ctx, content.body || "", cardX + 25, slideY + 105, cardW - 50, 24);
  };

  // SUBTITLE KARAOKE ENGINE
  const drawSubtitles = (ctx, W, H, scene, time) => {
    if (!scene || !scene.text) return;

    const safeW = W * 0.8; // 75% to 85% width constraint
    const subY = H * (subtitleSettings.verticalPos !== undefined ? subtitleSettings.verticalPos : 0.68); // avoids top 15% and bottom 25% interactive trays

    ctx.save();
    
    // Read style settings
    const fontFamily = subtitleSettings.fontFamily || 'Outfit';
    const fontSize = subtitleSettings.fontSize || 26;
    const textCase = subtitleSettings.textCase || 'uppercase';
    const textColor = subtitleSettings.textColor || '#ffffff';
    const strokeColor = subtitleSettings.strokeColor || '#000000';
    const strokeWidth = subtitleSettings.strokeWidth !== undefined ? subtitleSettings.strokeWidth : 4;
    const animationStyle = subtitleSettings.animationStyle || 'pulse';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = strokeWidth > 0 ? 0 : 8; // Outline reduces need for shadows
    ctx.shadowOffsetX = strokeWidth > 0 ? 0 : 2;
    ctx.shadowOffsetY = strokeWidth > 0 ? 0 : 2;

    const words = scene.words || [];
    let wordsToShow = [];
    if (scene.text2) {
      const words1 = words.filter(w => w.part === 1);
      const words2 = words.filter(w => w.part === 2);
      
      const firstSubtitleEnd = words1.length > 0 ? words1[words1.length - 1].end : scene.start;
      
      if (time < firstSubtitleEnd) {
        wordsToShow = words1;
      } else {
        wordsToShow = words2;
      }
    } else {
      wordsToShow = words;
    }

    if (wordsToShow.length === 0) {
      let rawText = scene.text;
      if (scene.text2) {
        const midPoint = scene.start + (scene.duration / 2);
        rawText = time < midPoint ? scene.text : scene.text2;
      }
      if (textCase === 'uppercase') {
        rawText = rawText.toUpperCase();
      }
      ctx.fillStyle = textColor;
      ctx.font = `800 ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      
      if (strokeWidth > 0 && strokeColor !== 'transparent' && strokeColor !== 'none') {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(rawText, W / 2, subY);
      }
      
      ctx.fillText(rawText, W / 2, subY);
      ctx.restore();
      return;
    }

    ctx.font = `800 ${fontSize}px ${fontFamily}`;
    const spacing = fontSize * 0.35;
    let totalW = 0;
    
    const processedWords = wordsToShow.map(w => {
      let raw = w.raw;
      if (textCase === 'uppercase') {
        raw = raw.toUpperCase();
      }
      const wWidth = ctx.measureText(raw).width;
      totalW += wWidth + spacing;
      return { ...w, raw, wWidth };
    });
    totalW -= spacing;

    let startX = (W - totalW) / 2;

    processedWords.forEach((w, idx) => {
      const isActive = time >= w.start && time <= w.end;
      
      ctx.save();
      
      if (isActive) {
        ctx.fillStyle = subtitleSettings.focusColor || '#eab308'; // Bright focus colors
        
        if (animationStyle === 'pulse' || animationStyle === 'bounce-pop') {
          ctx.translate(startX + w.wWidth / 2, subY - (fontSize * 0.4));
          if (animationStyle === 'pulse') {
            ctx.scale(1.15, 1.15); // 15% scale pulse
          } else if (animationStyle === 'bounce-pop') {
            ctx.translate(0, -6); // bounce up 6px
            ctx.rotate(-0.04); // rotate slightly left (-2 degrees)
            ctx.scale(1.15, 1.15);
          }
          ctx.translate(-(startX + w.wWidth / 2), -(subY - (fontSize * 0.4)));
        } else if (animationStyle === 'bg-box') {
          // Draw a background box behind active word
          ctx.save();
          ctx.fillStyle = subtitleSettings.bgBoxColor || 'rgba(0,0,0,0.75)';
          const padX = fontSize * 0.3;
          const padY = fontSize * 0.2;
          ctx.beginPath();
          ctx.roundRect(
            startX - padX, 
            subY - fontSize + (fontSize * 0.1) - padY, 
            w.wWidth + padX * 2, 
            fontSize + padY * 2, 
            6
          );
          ctx.fill();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = textColor;
      }

      ctx.font = `800 ${fontSize}px ${fontFamily}`;
      ctx.textAlign = 'left';

      if (strokeWidth > 0 && strokeColor !== 'transparent' && strokeColor !== 'none') {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(w.raw, startX, subY);
      }
      ctx.fillText(w.raw, startX, subY);
      
      ctx.restore();
      startX += w.wWidth + spacing;
    });

    ctx.restore();
  };

  const drawCroppedVideo = (ctx, video, rx, ry, rw, rh) => {
    try {
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      if (!vWidth || !vHeight) return;

      const vAspect = vWidth / vHeight;
      const rAspect = rw / rh;

      let sx, sy, sw, sh;
      if (vAspect > rAspect) {
        sh = vHeight;
        sw = sh * rAspect;
        sx = (vWidth - sw) / 2;
        sy = 0;
      } else {
        sw = vWidth;
        sh = sw / rAspect;
        sx = 0;
        sy = (vHeight - sh) / 2;
      }

      ctx.drawImage(video, sx, sy, sw, sh, rx, ry, rw, rh);
    } catch (e) {
      console.warn("Video drawing error", e);
    }
  };

  const drawCroppedImage = (ctx, img, rx, ry, rw, rh) => {
    try {
      const imgWidth = img.width;
      const imgHeight = img.height;
      if (!imgWidth || !imgHeight) return;

      const imgAspect = imgWidth / imgHeight;
      const rAspect = rw / rh;

      let sx, sy, sw, sh;
      if (imgAspect > rAspect) {
        sh = imgHeight;
        sw = sh * rAspect;
        sx = (imgWidth - sw) / 2;
        sy = 0;
      } else {
        sw = imgWidth;
        sh = sw / rAspect;
        sx = 0;
        sy = (imgHeight - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, rx, ry, rw, rh);
    } catch (e) {
      console.warn("Image drawing error", e);
    }
  };

  const drawSafeZoneOverlays = (ctx, W, H) => {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const topTrayY = H * 0.15;
    ctx.beginPath();
    ctx.moveTo(0, topTrayY);
    ctx.lineTo(W, topTrayY);
    ctx.stroke();

    const bottomTrayY = H * 0.75;
    ctx.beginPath();
    ctx.moveTo(0, bottomTrayY);
    ctx.lineTo(W, bottomTrayY);
    ctx.stroke();

    const horizW = W * 0.8;
    const horizX = (W - horizW) / 2;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.beginPath();
    ctx.rect(horizX, 0, horizW, H);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.75)';
    ctx.font = 'bold 10px Inter';
    ctx.fillText('TOP AVOIDANCE TRAY (15%)', 10, topTrayY - 8);
    ctx.fillText('BOTTOM AVOIDANCE TRAY (25%)', 10, bottomTrayY + 16);
    
    ctx.fillStyle = 'rgba(59, 130, 246, 0.75)';
    ctx.fillText('SAFE WIDTH (80%)', horizX + 10, H - 20);
  };

  const drawAvatar = (ctx, cx, cy, role, isSpeaking, sceneElapsed, timestamp) => {
    ctx.save();

    const breathOffset = Math.sin(timestamp / 500) * 3;
    const scaleBreath = 1.0 + Math.sin(timestamp / 500) * 0.006;
    ctx.translate(cx, cy + breathOffset);
    ctx.scale(scaleBreath, scaleBreath);

    const blinkCycle = timestamp % 4000;
    const isBlinking = blinkCycle > 3800;

    let skinColor = '#fed7aa';
    let hairColor = '#1e293b';
    let shirtColor = '#4f46e5';
    let avatarName = "Speaker A";

    if (role === 'B') {
      skinColor = '#fde047';
      hairColor = '#78350f';
      shirtColor = '#ec4899';
      avatarName = "Speaker B";
    } else if (role === 'GURU') {
      skinColor = '#fbcfe8';
      hairColor = '#0f172a';
      shirtColor = '#06b6d4';
      avatarName = "Solo Guru";
    }

    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.ellipse(0, 100, 75, 50, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skinColor;
    ctx.fillRect(-15, 30, 30, 30);

    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(0, -15, 46, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-46, -15, 10, 30);
    ctx.fillRect(36, -15, 10, 30);

    ctx.fillStyle = '#000000';
    if (isBlinking) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-20, -5);
      ctx.lineTo(-10, -5);
      ctx.moveTo(10, -5);
      ctx.lineTo(20, -5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-15, -5, 4, 0, Math.PI * 2);
      ctx.arc(15, -5, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f43f5e';
    if (isSpeaking) {
      const mouthScaleY = 3 + Math.abs(Math.sin(timestamp / 60)) * 12;
      ctx.beginPath();
      ctx.ellipse(0, 15, 8, mouthScaleY / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, 8, 8, 0, Math.PI);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.beginPath();
    ctx.roundRect(-45, -70, 90, 18, 5);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(avatarName, 0, -58);

    ctx.restore();
  };

  const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* 9:16 Casing Phone Mockup */}
      <div className="phone-mockup-wrapper">
        <div className="phone-mockup-notch"></div>
        <div className="phone-mockup-inner">
          <canvas ref={canvasRef} className="phone-canvas" />
        </div>
      </div>

      {/* Media Player controls panel */}
      <div className="player-controls-panel">
        <div className="player-controls-header">
          <span className="badge">
            {showSafeZone ? "Safe Zone Guides ON" : "Guides OFF"}
          </span>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            {currentTime.toFixed(1)}s / {timelineDuration.toFixed(1)}s
          </span>
        </div>

        {/* Timeline seeker */}
        <input 
          type="range" 
          min="0" 
          max={timelineDuration} 
          step="0.05"
          value={currentTime} 
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setCurrentTime(val);
            if (isPlaying && (voiceoverBuffer || bgmBuffer)) {
              playAudioBuffer();
            }
          }}
          className="player-controls-timeline-input"
        />

        {/* Buttons row */}
        <div className="player-controls-btns">
          <button 
            onClick={() => {
              setCurrentTime(0);
              if (isPlaying && (voiceoverBuffer || bgmBuffer)) {
                playAudioBuffer();
              }
            }}
            className="player-controls-sub-btn"
            title="Rewind"
          >
            <RotateCcw />
          </button>

          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="player-controls-play-btn"
          >
            {isPlaying ? <Pause fill="white" /> : <Play fill="white" style={{ transform: 'translateX(1px)' }} />}
          </button>

          <div style={{ width: '28px' }}></div>
        </div>
      </div>
    </div>
  );
}
