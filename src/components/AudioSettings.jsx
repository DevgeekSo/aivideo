import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Upload, Loader2, Music, Check, Settings, Play, Pause, Square, Sparkles, Sliders } from 'lucide-react';
import { generateGoogleTTS, generateGoogleCloudTTS, generateElevenLabsTTS, generateGeminiTTS, generateOpenRouterTTS, decodeUploadedAudio, decodeAudio, estimateSubtitleTimestamps } from '../utils/speechEngine';

// Generates a soothing ambient loop synthetically in the browser without network dependencies or CORS.
function generateSyntheticAmbient(type, duration = 60, sampleRate = 44100) {
  const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, sampleRate * duration, sampleRate);
  
  // Base frequencies for minor/major chords
  const lofiProgression = [
    [110.00, 130.81, 164.81, 196.00], // Am7 (A2, C3, E3, G3)
    [146.83, 174.61, 220.00, 261.63], // Dm7 (D2, F3, A3, C4)
    [196.00, 246.94, 293.66, 349.23], // G7 (G2, B3, D4, F4)
    [130.81, 164.81, 196.00, 246.94]  // Cmaj7 (C2, E3, G3, B3)
  ];

  const cinematicProgression = [
    [65.41, 98.00, 130.81, 196.00], // C drone + fifths
    [65.41, 98.00, 130.81, 196.00],
    [73.42, 110.00, 146.83, 220.00], // D drone
    [73.42, 110.00, 146.83, 220.00]
  ];

  const techProgression = [
    [110.00, 164.81, 220.00, 329.63], // A minor base
    [130.81, 196.00, 261.63, 392.00], // C major base
    [146.83, 220.00, 293.66, 440.00], // D major base
    [164.81, 246.94, 329.63, 493.88]  // E minor base
  ];

  let progression = lofiProgression;
  if (type === 'cinematic') progression = cinematicProgression;
  if (type === 'tech') progression = techProgression;

  const chordDuration = 5.0; // seconds per chord
  const numChords = Math.ceil(duration / chordDuration);

  for (let i = 0; i < numChords; i++) {
    const startTime = i * chordDuration;
    const chord = progression[i % progression.length];

    chord.forEach((freq, noteIdx) => {
      // Create oscillator
      const osc = offlineCtx.createOscillator();
      if (type === 'tech') {
        osc.type = noteIdx === 0 ? 'triangle' : 'sawtooth';
      } else if (type === 'cinematic') {
        osc.type = 'sine';
      } else {
        osc.type = 'triangle';
      }
      
      osc.frequency.setValueAtTime(freq, startTime);
      
      // Detune drone/tech chords for rich sound
      if (type === 'cinematic' || type === 'tech') {
        osc.detune.setValueAtTime(noteIdx * 4 - 6, startTime);
        osc.detune.linearRampToValueAtTime(noteIdx * 4 + 6, startTime + chordDuration);
      }

      // Filter to cut off harsh frequencies
      const filter = offlineCtx.createBiquadFilter();
      filter.type = 'lowpass';
      if (type === 'tech') {
        filter.Q.setValueAtTime(3, startTime);
        filter.frequency.setValueAtTime(150, startTime);
        filter.frequency.exponentialRampToValueAtTime(1000, startTime + 1.2);
        filter.frequency.exponentialRampToValueAtTime(150, startTime + chordDuration);
      } else if (type === 'cinematic') {
        filter.frequency.setValueAtTime(250, startTime);
      } else {
        // Lofi warmth pitch flutter
        filter.frequency.setValueAtTime(450, startTime);
        osc.frequency.linearRampToValueAtTime(freq * 1.004, startTime + chordDuration * 0.5);
        osc.frequency.linearRampToValueAtTime(freq * 0.996, startTime + chordDuration);
      }

      // Gain Node with ADSR envelope
      const gain = offlineCtx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      
      if (type === 'tech') {
        // Pulsing tech envelope
        for (let p = 0; p < chordDuration; p += 0.5) {
          const pulseStart = startTime + p;
          gain.gain.setValueAtTime(0, pulseStart);
          gain.gain.linearRampToValueAtTime(0.06, pulseStart + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, pulseStart + 0.4);
        }
      } else {
        // Smooth ambient pad envelope
        gain.gain.linearRampToValueAtTime(0.06, startTime + 1.2);
        gain.gain.setValueAtTime(0.06, startTime + chordDuration - 1.2);
        gain.gain.linearRampToValueAtTime(0, startTime + chordDuration);
      }

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(offlineCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + chordDuration);
    });
  }

  return offlineCtx.startRendering();
}

export const BGM_TRACKS = [
  {
    id: 'shadows_of_time',
    name: 'Shadows of Time',
    filename: 'gajju_m-shadows-of-time-270262.mp3',
    genre: 'Cinematic / Mysterious',
    icon: '🌌'
  },
  {
    id: 'lofi_chill',
    name: 'Lofi Chill',
    filename: 'monume-lofi-chill-chill-509496.mp3',
    genre: 'Relaxing / Lo-Fi Beats',
    icon: '🎧'
  },
  {
    id: 'inspiring_spirit',
    name: 'Inspiring Spirit',
    filename: 'nastelbom-inspiring-inspiring-music-486987.mp3',
    genre: 'Uplifting / Corporate',
    icon: '⚡'
  },
  {
    id: 'ambient_relax',
    name: 'Ambient Relax',
    filename: 'paulyudin-ambient-relax-113444.mp3',
    genre: 'Calm / Ambient',
    icon: '🍃'
  },
  {
    id: 'relaxing_soundscape',
    name: 'Relaxing Soundscape',
    filename: 'freemusicforvideo-relax-relax-music-524068.mp3',
    genre: 'Soft / Zen / Wellness',
    icon: '🌸'
  }
];

export default function AudioSettings({
  scenes = [],
  setScenes = () => {},
  voiceoverText = "",
  voiceoverBuffer = null,
  setVoiceoverBuffer = () => {},
  bgmBuffer = null,
  setBgmBuffer = () => {},
  bgmVolume = 0.15,
  setBgmVolume = () => {},
  apiKeys = {},
  targetDuration = 'auto',
  sfxBuffers = {},
  setSfxBuffers = () => {}
}) {
  const [loading, setLoading] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState("");
  const [audioSource, setAudioSource] = useState("google"); // 'google' | 'gcloud' | 'elevenlabs' | 'upload' | 'browser' | 'openrouter'
  const [gcloudVoice, setGcloudVoice] = useState("en-US-Neural2-F");
  const [gcloudKey, setGcloudKey] = useState(() => localStorage.getItem('key_gcloud') || "");
  const [elevenLabsVoice, setElevenLabsVoice] = useState("21m00Tcm4TlvDq8ikWAM"); // Default to Rachel
  const [elevenLabsKey, setElevenLabsKey] = useState(() => localStorage.getItem('key_elevenlabs') || import.meta.env.VITE_ELEVENLABS_API_KEY || "");
  const [geminiVoice, setGeminiVoice] = useState("Puck");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('key_gemini') || import.meta.env.VITE_GEMINI_API_KEY || "");
  const [openrouterKey, setOpenrouterKey] = useState(() => localStorage.getItem('key_openrouter') || import.meta.env.VITE_OPENROUTER_API_KEY || "");
  const [openrouterVoiceModel, setOpenrouterVoiceModel] = useState("openai/gpt-audio-mini");
  const [openrouterVoiceCharacter, setOpenrouterVoiceCharacter] = useState("alloy");
  const [bgmPrompt, setBgmPrompt] = useState("");
  const [didKey, setDidKey] = useState(() => localStorage.getItem('key_did') || import.meta.env.VITE_DID_API_KEY || "");
  const [selectedBgmPreset, setSelectedBgmPreset] = useState("none");
  const [isPlayingBgm, setIsPlayingBgm] = useState(false);
  const [previewingTrackId, setPreviewingTrackId] = useState(null);

  // Jamendo & Freesound Integration States
  const [jamendoKey, setJamendoKey] = useState(() => localStorage.getItem('key_jamendo') || "");
  const [freesoundKey, setFreesoundKey] = useState(() => localStorage.getItem('key_freesound') || "");
  const [bgmSearchMode, setBgmSearchMode] = useState("presets"); // 'presets' | 'jamendo'
  const [jamendoQuery, setJamendoQuery] = useState("");
  const [jamendoResults, setJamendoResults] = useState([]);
  const [searchingJamendo, setSearchingJamendo] = useState(false);

  const [freesoundQuery, setFreesoundQuery] = useState("");
  const [freesoundResults, setFreesoundResults] = useState([]);
  const [searchingFreesound, setSearchingFreesound] = useState(false);
  const [activeSfxSceneIds, setActiveSfxSceneIds] = useState({});
  
  const fileInputRef = useRef(null);
  const bgmFileInputRef = useRef(null);
  const bgmSourceRef = useRef(null);
  const previewAudioRef = useRef(null);

  // Load available speech synthesis voices for local fallback
  useEffect(() => {
    const loadVoices = () => {
      const syn = window.speechSynthesis;
      if (syn) {
        const available = syn.getVoices();
        setVoices(available.filter(v => v.lang.startsWith('en')));
        if (available.length > 0 && !selectedVoiceName) {
          const defaultVoice = available.find(v => v.default && v.lang.startsWith('en')) || available[0];
          setSelectedVoiceName(defaultVoice.name);
        }
      }
    };
    
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceName]);

  // Clean up BGM preview on unmount
  useEffect(() => {
    return () => {
      if (bgmSourceRef.current) {
        try {
          bgmSourceRef.current.source.stop();
          bgmSourceRef.current.ctx.close();
        } catch (e) {}
      }
      if (previewAudioRef.current) {
        try {
          previewAudioRef.current.pause();
        } catch (e) {}
      }
    };
  }, []);

  // Sync preview volume with mixer volume
  useEffect(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = bgmVolume;
    }
  }, [bgmVolume]);

  // Update loop preview volume in real-time if slider changes while playing
  useEffect(() => {
    if (isPlayingBgm && bgmSourceRef.current?.gainNode) {
      bgmSourceRef.current.gainNode.gain.setValueAtTime(bgmVolume, bgmSourceRef.current.ctx.currentTime);
    }
  }, [bgmVolume, isPlayingBgm]);

  useEffect(() => {
    localStorage.setItem('key_gcloud', gcloudKey);
    window.dispatchEvent(new Event('storage'));
  }, [gcloudKey]);

  useEffect(() => {
    localStorage.setItem('key_elevenlabs', elevenLabsKey);
    window.dispatchEvent(new Event('storage'));
  }, [elevenLabsKey]);

  useEffect(() => {
    localStorage.setItem('key_gemini', geminiKey);
    window.dispatchEvent(new Event('storage'));
  }, [geminiKey]);

  useEffect(() => {
    localStorage.setItem('key_openrouter', openrouterKey);
    window.dispatchEvent(new Event('storage'));
  }, [openrouterKey]);

  useEffect(() => {
    localStorage.setItem('key_did', didKey);
    window.dispatchEvent(new Event('storage'));
  }, [didKey]);

  useEffect(() => {
    localStorage.setItem('key_jamendo', jamendoKey);
    window.dispatchEvent(new Event('storage'));
  }, [jamendoKey]);

  useEffect(() => {
    localStorage.setItem('key_freesound', freesoundKey);
    window.dispatchEvent(new Event('storage'));
  }, [freesoundKey]);

  // Automatically recalculate subtitle timestamps when scenes or voiceover text changes
  const recalculateTimestamps = (duration) => {
    const updatedScenes = estimateSubtitleTimestamps(scenes, duration, targetDuration);
    setScenes(updatedScenes);
  };

  const handleGenerateGoogleTTS = async () => {
    if (!voiceoverText) return;
    setLoading(true);
    try {
      const buffer = await generateGoogleTTS(voiceoverText);
      if (buffer) {
        setVoiceoverBuffer(buffer);
        recalculateTimestamps(buffer.duration);
        setAudioSource("google");
        alert("Google TTS Voiceover successfully synthesized and loaded!");
      } else {
        throw new Error("No audio buffer was returned from the synthesis engine.");
      }
    } catch (e) {
      alert(`TTS Synthesis Alert:\n${e.message}\n\nFalling back to browser SpeechSynthesis speaker.`);
      setAudioSource("browser");
      const wordCount = voiceoverText.split(/\s+/).length;
      const estimatedDuration = (wordCount / 2.3);
      recalculateTimestamps(estimatedDuration);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateElevenLabsTTS = async () => {
    if (!voiceoverText) return;
    if (!elevenLabsKey) {
      alert("Please enter your ElevenLabs API key first.");
      return;
    }
    setLoading(true);
    try {
      const buffer = await generateElevenLabsTTS(voiceoverText, elevenLabsKey, elevenLabsVoice);
      setVoiceoverBuffer(buffer);
      recalculateTimestamps(buffer.duration);
      setAudioSource("elevenlabs");
      alert("ElevenLabs Voiceover successfully generated!");
    } catch (e) {
      alert("ElevenLabs synthesis error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGCloudTTS = async () => {
    if (!voiceoverText) return;
    if (!gcloudKey) {
      alert("Please enter your Google Cloud API key first.");
      return;
    }
    setLoading(true);
    try {
      const buffer = await generateGoogleCloudTTS(voiceoverText, gcloudKey, gcloudVoice);
      setVoiceoverBuffer(buffer);
      recalculateTimestamps(buffer.duration);
      setAudioSource("gcloud");
      alert("Google Cloud Neural TTS Voiceover successfully generated!");
    } catch (e) {
      alert("Google Cloud TTS synthesis error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGeminiTTS = async () => {
    if (!voiceoverText) return;
    if (!geminiKey) {
      alert("Please enter your Gemini API key first.");
      return;
    }
    setLoading(true);
    try {
      const buffer = await generateGeminiTTS(voiceoverText, geminiKey, geminiVoice);
      setVoiceoverBuffer(buffer);
      recalculateTimestamps(buffer.duration);
      setAudioSource("gemini");
      alert("Gemini Voiceover successfully generated!");
    } catch (e) {
      alert("Gemini voice synthesis error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOpenRouterTTS = async () => {
    if (!voiceoverText) return;
    if (!openrouterKey) {
      alert("Please enter your OpenRouter API key first.");
      return;
    }
    setLoading(true);
    try {
      const buffer = await generateOpenRouterTTS(
        voiceoverText,
        openrouterKey,
        openrouterVoiceCharacter,
        openrouterVoiceModel
      );
      setVoiceoverBuffer(buffer);
      recalculateTimestamps(buffer.duration);
      setAudioSource("openrouter");
      alert("OpenRouter Voiceover successfully generated!");
    } catch (e) {
      alert("OpenRouter voice synthesis error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLyriaBgm = async () => {
    if (!bgmPrompt) return;
    if (!openrouterKey) {
      alert("Please enter your OpenRouter API key first.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/openrouter/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openrouterKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/lyria-3-pro-preview",
          messages: [
            {
              role: "user",
              content: `Generate a 30-second background music instrumental track for a video. Style: ${bgmPrompt}`
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter Lyria Error: ${errText}`);
      }

      const data = await response.json();
      
      let audioUrl = "";
      if (data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        const urlMatch = content.match(/https?:\/\/[^\s\)]+\.(mp3|wav|ogg)/i);
        if (urlMatch) {
          audioUrl = urlMatch[0];
        }
      }
      
      if (!audioUrl && data.choices?.[0]?.message?.audio?.data) {
        audioUrl = `data:audio/mp3;base64,${data.choices[0].message.audio.data}`;
      }

      if (!audioUrl) {
        throw new Error("Could not find generated audio URL in the OpenRouter response.");
      }

      const audioResponse = await fetch(audioUrl);
      const arrayBuffer = await audioResponse.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await decodeAudio(ctx, arrayBuffer);
      
      setBgmBuffer(buffer);
      setSelectedBgmPreset("openrouter-lyria");
      alert("AI Background Music successfully generated and loaded!");
    } catch (err) {
      alert("AI BGM generation error: " + err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const buffer = await decodeUploadedAudio(file);
      setVoiceoverBuffer(buffer);
      recalculateTimestamps(buffer.duration);
      setAudioSource("upload");
      alert(`Voiceover file "${file.name}" loaded successfully (${buffer.duration.toFixed(1)}s)`);
    } catch (err) {
      alert("Error decoding audio file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBgmPreset = async (preset) => {
    // Stop any active previews
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingTrackId(null);
    }
    // If playing, stop it first
    if (isPlayingBgm) {
      stopBgmPreview();
    }
    
    setSelectedBgmPreset(preset);
    if (preset === 'none') {
      setBgmBuffer(null);
      return;
    }
    
    setLoading(true);
    try {
      const buffer = await generateSyntheticAmbient(preset, 60);
      setBgmBuffer(buffer);
    } catch (err) {
      alert("Error generating ambient audio: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBgmTrack = async (track) => {
    // Stop any active previews
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingTrackId(null);
    }
    
    if (isPlayingBgm) {
      stopBgmPreview();
    }
    
    setSelectedBgmPreset(track.id);
    setLoading(true);
    try {
      const response = await fetch(`/bgm/${track.filename}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch file`);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await decodeAudio(ctx, arrayBuffer);
      setBgmBuffer(buffer);
    } catch (err) {
      alert("Error loading BGM track: " + err.message);
      setBgmBuffer(null);
      setSelectedBgmPreset("none");
    } finally {
      setLoading(false);
    }
  };

  const togglePreviewTrack = (track) => {
    togglePreviewAudioUrl(`/bgm/${track.filename}`, track.id);
  };

  const togglePreviewAudioUrl = (url, id) => {
    if (previewingTrackId === id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingTrackId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      if (isPlayingBgm) {
        stopBgmPreview();
      }
      
      const audio = new Audio(url);
      audio.loop = !String(id).startsWith('freesound-');
      audio.volume = bgmVolume;
      audio.play().catch(err => console.error("Preview play failed", err));
      previewAudioRef.current = audio;
      setPreviewingTrackId(id);

      audio.onended = () => {
        setPreviewingTrackId(null);
      };
    }
  };

  const handleSearchJamendo = async () => {
    if (!jamendoQuery.trim()) return;
    setSearchingJamendo(true);
    try {
      const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${jamendoKey}&format=json&limit=10&search=${encodeURIComponent(jamendoQuery)}&include=musicinfo&audioformat=mp32`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch tracks`);
      const data = await res.json();
      if (data.results) {
        setJamendoResults(data.results);
      } else {
        setJamendoResults([]);
      }
    } catch (e) {
      alert("Jamendo search error: " + e.message);
    } finally {
      setSearchingJamendo(false);
    }
  };

  const handleSelectJamendoTrack = async (track) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingTrackId(null);
    }
    if (isPlayingBgm) {
      stopBgmPreview();
    }
    setSelectedBgmPreset(`jamendo-${track.id}`);
    setLoading(true);
    try {
      const response = await fetch(track.audio);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch audio stream`);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await decodeAudio(ctx, arrayBuffer);
      setBgmBuffer(buffer);
      alert(`Jamendo background music "${track.name}" loaded successfully!`);
    } catch (err) {
      alert("Error loading Jamendo BGM: " + err.message);
      setBgmBuffer(null);
      setSelectedBgmPreset("none");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchFreesound = async () => {
    if (!freesoundQuery.trim()) return;
    if (!freesoundKey) {
      alert("Please enter a Freesound API Token first.");
      return;
    }
    setSearchingFreesound(true);
    try {
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(freesoundQuery)}&token=${freesoundKey}&fields=id,name,previews,duration,description`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sound effects`);
      const data = await res.json();
      if (data.results) {
        setFreesoundResults(data.results);
      } else {
        setFreesoundResults([]);
      }
    } catch (e) {
      alert("Freesound search error: " + e.message);
    } finally {
      setSearchingFreesound(false);
    }
  };

  const handleAssignSfx = async (sound, sceneId) => {
    if (!sceneId) return;
    const sfxUrl = sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'];
    if (!sfxUrl) {
      alert("No preview audio file available for this sound effect.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(sfxUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch sound effect`);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await decodeAudio(ctx, arrayBuffer);
      
      setSfxBuffers(prev => ({
        ...prev,
        [sfxUrl]: buffer
      }));

      const updatedScenes = scenes.map(s => {
        if (s.id === sceneId) {
          return {
            ...s,
            sfxUrl: sfxUrl,
            sfxName: sound.name
          };
        }
        return s;
      });
      setScenes(updatedScenes);
      alert(`Sound effect "${sound.name}" assigned successfully!`);
    } catch (err) {
      alert("Failed to decode and assign sound effect: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSfx = (sceneId) => {
    const updatedScenes = scenes.map(s => {
      if (s.id === sceneId) {
        const copy = { ...s };
        delete copy.sfxUrl;
        delete copy.sfxName;
        return copy;
      }
      return s;
    });
    setScenes(updatedScenes);
  };

  const handleClearBgm = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingTrackId(null);
    }
    if (isPlayingBgm) {
      stopBgmPreview();
    }
    setSelectedBgmPreset("none");
    setBgmBuffer(null);
  };

  const handleBgmUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Stop any active previews
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewingTrackId(null);
    }

    if (isPlayingBgm) {
      stopBgmPreview();
    }

    setLoading(true);
    try {
      const buffer = await decodeUploadedAudio(file);
      setBgmBuffer(buffer);
      setSelectedBgmPreset("upload");
      alert(`Background music "${file.name}" loaded successfully (${buffer.duration.toFixed(1)}s)`);
    } catch (err) {
      alert("Error decoding background music file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayBgm = () => {
    if (isPlayingBgm) {
      stopBgmPreview();
    } else {
      playBgmPreview();
    }
  };

  const playBgmPreview = () => {
    if (!bgmBuffer) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createBufferSource();
      source.buffer = bgmBuffer;
      source.loop = true;
      
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(bgmVolume, ctx.currentTime);
      
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      source.start(0);
      bgmSourceRef.current = { source, ctx, gainNode };
      setIsPlayingBgm(true);
    } catch (e) {
      console.error("Failed to start BGM preview", e);
    }
  };

  const stopBgmPreview = () => {
    if (bgmSourceRef.current) {
      try {
        bgmSourceRef.current.source.stop();
        bgmSourceRef.current.ctx.close();
      } catch (e) {}
      bgmSourceRef.current = null;
    }
    setIsPlayingBgm(false);
  };

  return (
    <div className="glass-panel flex-col gap-5 w-full">
      {/* Title Header */}
      <div>
        <h3 className="flex-row-center text-slate-200" style={{ fontSize: '15px', fontWeight: '700' }}>
          <Volume2 size={18} style={{ color: 'var(--color-primary)' }} /> Voiceover & Audio Settings
        </h3>
        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Synthesize speech or upload custom sound tracks</p>
      </div>

      <div className="flex-col gap-4">
        {/* Source selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={() => {
              setAudioSource("openrouter");
            }}
            className={`selector-btn ${audioSource === 'openrouter' ? 'active' : ''}`}
          >
            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
            <span>OpenRouter Voice</span>
          </button>

          <button
            onClick={() => {
              setAudioSource("google");
              handleGenerateGoogleTTS();
            }}
            className={`selector-btn ${audioSource === 'google' ? 'active' : ''}`}
          >
            <Sparkles size={14} />
            <span>Translate Voice (Free)</span>
          </button>

          <button
            onClick={() => {
              setAudioSource("gemini");
            }}
            className={`selector-btn ${audioSource === 'gemini' ? 'active' : ''}`}
          >
            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
            <span>Gemini Voice (AI Studio)</span>
          </button>

          <button
            onClick={() => {
              setAudioSource("elevenlabs");
            }}
            className={`selector-btn ${audioSource === 'elevenlabs' ? 'active' : ''}`}
          >
            <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
            <span>ElevenLabs Voice</span>
          </button>

          <button
            onClick={() => {
              setAudioSource("gcloud");
            }}
            className={`selector-btn ${audioSource === 'gcloud' ? 'active' : ''}`}
          >
            <Sparkles size={14} style={{ color: 'var(--color-secondary)' }} />
            <span>Cloud Neural (Free Tier)</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`selector-btn ${audioSource === 'upload' ? 'active' : ''}`}
          >
            <Upload size={14} />
            <span>Upload MP3</span>
          </button>

          <button
            onClick={() => {
              setAudioSource("browser");
              const wordCount = voiceoverText.split(/\s+/).length;
              recalculateTimestamps(wordCount / 2.3);
            }}
            className={`selector-btn ${audioSource === 'browser' ? 'active' : ''}`}
          >
            <Settings size={14} />
            <span>Local Speaker</span>
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          accept="audio/*"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Action Panel */}
        {loading ? (
          <div className="flex-row-center" style={{ justifyContent: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
            <span className="text-xs">Processing audio tracks...</span>
          </div>
        ) : (
          <div className="flex-col gap-2">
            {audioSource === 'google' && (
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <span className="text-xs text-slate-400">Google TTS stitches direct sentence streams locally. Ready to synthesize.</span>
                <button
                  onClick={handleGenerateGoogleTTS}
                  disabled={!voiceoverText}
                  className="glow-btn"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Generate Voice Track
                </button>
              </div>
            )}

            {audioSource === 'elevenlabs' && (
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <span className="text-xs text-slate-400">Generate hyper-realistic voices using ElevenLabs' industry-leading AI models.</span>
                
                {/* API Key Input */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ElevenLabs API Key</label>
                  <input
                    type="password"
                    placeholder="sk_..."
                    value={elevenLabsKey}
                    onChange={(e) => setElevenLabsKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>

                {/* Voice Selection Dropdown */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Voice Actor</label>
                  <select
                    value={elevenLabsVoice}
                    onChange={(e) => setElevenLabsVoice(e.target.value)}
                    className="select-input"
                    style={{ fontSize: '12px', padding: '6px 10px', width: '100%' }}
                  >
                    <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Female - Narrator/Warm)</option>
                    <option value="29vD33N1CtxCmqQRPOHJ">Drew (Male - News/Conversational)</option>
                    <option value="2E2wdCwGlms7DcUMj552">Clyde (Male - Deep/Authority)</option>
                    <option value="piYnaEigF3G45vlZ2Rxo">Nicole (Female - Energetic/Bright)</option>
                    <option value="5Q0t7uMc3gAagzNSxZNs">Paul (Male - Announcer/Grounded)</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateElevenLabsTTS}
                  disabled={!voiceoverText || !elevenLabsKey}
                  className="glow-btn"
                  style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px', width: '100%' }}
                >
                  Generate ElevenLabs Voice
                </button>
              </div>
            )}

            {audioSource === 'gcloud' && (
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <span className="text-xs text-slate-400">Generate studio-quality voiceovers using Google's Neural2 or Wavenet speech engines.</span>
                
                {/* API Key Input */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Google Cloud API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={gcloudKey}
                    onChange={(e) => setGcloudKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>

                {/* Voice Selection Dropdown */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Premium Neural Voice</label>
                  <select
                    value={gcloudVoice}
                    onChange={(e) => setGcloudVoice(e.target.value)}
                    className="select-input"
                    style={{ fontSize: '12px', padding: '6px 10px', width: '100%' }}
                  >
                    <option value="en-US-Neural2-F">en-US-Neural2-F (Female - Energetic/Clear)</option>
                    <option value="en-US-Neural2-J">en-US-Neural2-J (Male - Warm/Natural)</option>
                    <option value="en-US-Journey-F">en-US-Journey-F (Female - Professional Narrative)</option>
                    <option value="en-US-Journey-D">en-US-Journey-D (Male - Conversational Narrative)</option>
                    <option value="en-US-Wavenet-D">en-US-Wavenet-D (Male - Warm Studio)</option>
                    <option value="en-US-Wavenet-F">en-US-Wavenet-F (Female - Clear Studio)</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateGCloudTTS}
                  disabled={!voiceoverText || !gcloudKey}
                  className="glow-btn"
                  style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px', width: '100%' }}
                >
                  Generate Neural Voice
                </button>
              </div>
            )}

            {audioSource === 'gemini' && (
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <span className="text-xs text-slate-400">Generate expressive voices natively from Gemini 2.0/2.5 Flash.</span>
                
                {/* API Key Input */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Gemini API Key</label>
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>

                {/* Voice Selection Dropdown */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Gemini Voice Actor</label>
                  <select
                    value={geminiVoice}
                    onChange={(e) => setGeminiVoice(e.target.value)}
                    className="select-input"
                    style={{ fontSize: '12px', padding: '6px 10px', width: '100%' }}
                  >
                    <option value="Puck">Puck (Male - Energetic/Crisp)</option>
                    <option value="Aoede">Aoede (Female - Warm/Narrator)</option>
                    <option value="Charon">Charon (Male - Deep/Narrative)</option>
                    <option value="Fenrir">Fenrir (Male - Conversational)</option>
                    <option value="Kore">Kore (Female - Bright/Clear)</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateGeminiTTS}
                  disabled={!voiceoverText || !geminiKey}
                  className="glow-btn"
                  style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px', width: '100%' }}
                >
                  Generate Gemini Voice
                </button>
              </div>
            )}

            {audioSource === 'openrouter' && (
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <span className="text-xs text-slate-400">Generate high-fidelity voiceovers using OpenRouter's OpenAI-compatible speech endpoint.</span>
                
                {/* API Key Input */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>OpenRouter API Key</label>
                  <input
                    type="password"
                    placeholder="sk-or-..."
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>

                {/* Voice Selection Dropdown */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Voice Model</label>
                  <select
                    value={openrouterVoiceModel}
                    onChange={(e) => setOpenrouterVoiceModel(e.target.value)}
                    className="select-input"
                    style={{ fontSize: '12px', padding: '6px 10px', width: '100%' }}
                  >
                    <option value="openai/gpt-audio-mini">openai/gpt-audio-mini (GPT Audio Mini - Fast)</option>
                    <option value="openai/gpt-audio">openai/gpt-audio (GPT Audio - High Quality)</option>
                    <option value="openai/gpt-4o-audio-preview">openai/gpt-4o-audio-preview (GPT-4o Audio Preview)</option>
                  </select>
                </div>

                {/* Voice Character Selection Dropdown */}
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Voice Character</label>
                  <select
                    value={openrouterVoiceCharacter}
                    onChange={(e) => setOpenrouterVoiceCharacter(e.target.value)}
                    className="select-input"
                    style={{ fontSize: '12px', padding: '6px 10px', width: '100%' }}
                  >
                    <option value="alloy">Alloy (Neutral, balanced)</option>
                    <option value="echo">Echo (Warm, athletic)</option>
                    <option value="fable">Fable (Creative, dramatic)</option>
                    <option value="onyx">Onyx (Deep, professional)</option>
                    <option value="nova">Nova (Bright, energetic)</option>
                    <option value="shimmer">Shimmer (Professional, warm)</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerateOpenRouterTTS}
                  disabled={!voiceoverText || !openrouterKey}
                  className="glow-btn"
                  style={{ padding: '6px 12px', fontSize: '12px', marginTop: '4px', width: '100%' }}
                >
                  Generate OpenRouter Voice
                </button>
              </div>
            )}

            {audioSource === 'upload' && (
              <div className="settings-row-item">
                <div className="flex-row-center">
                  <Music size={16} style={{ color: 'var(--color-primary)' }} />
                  <div className="flex-col">
                    <span className="text-xs font-semibold text-slate-200">
                      {voiceoverBuffer ? "Custom Audio Loaded" : "No file selected"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {voiceoverBuffer ? `${voiceoverBuffer.duration.toFixed(1)}s total duration` : "Upload mp3 or wav voiceover"}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="glow-btn glow-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  Change File
                </button>
              </div>
            )}

            {audioSource === 'browser' && (
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                <span className="text-xs text-slate-400">SpeechSynthesis utters words in real-time. Select preferred speaker:</span>
                <select
                  value={selectedVoiceName}
                  onChange={e => setSelectedVoiceName(e.target.value)}
                  className="select-input"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  {voices.map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                  {voices.length === 0 && <option>Standard Browser Voice</option>}
                </select>
              </div>
            )}

            {/* D-ID API Credentials (Collapsible) */}
            <details style={{ marginTop: '12px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px', background: 'rgba(255,255,255,0.01)' }}>
              <summary className="text-xs text-slate-300 hover:text-slate-100 font-semibold" style={{ outline: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🔑 D-ID Avatar API Credentials</span>
              </summary>
              <div className="flex-col gap-2" style={{ marginTop: '8px', cursor: 'default' }} onClick={e => e.stopPropagation()}>
                <span className="text-[10px] text-slate-400">Required for generating Talking AI head videos (podcast/guru styles).</span>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <input
                    type="password"
                    placeholder="base64_email:api_key"
                    value={didKey}
                    onChange={(e) => setDidKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>
              </div>
            </details>

            {/* Jamendo & Freesound Credentials (Collapsible) */}
            <details style={{ marginTop: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px', background: 'rgba(255,255,255,0.01)' }}>
              <summary className="text-xs text-slate-300 hover:text-slate-100 font-semibold" style={{ outline: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🎵 Jamendo & Freesound API Credentials</span>
              </summary>
              <div className="flex-col gap-3" style={{ marginTop: '8px', cursor: 'default' }} onClick={e => e.stopPropagation()}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Jamendo Client ID</label>
                  <input
                    type="text"
                    placeholder="709fa152"
                    value={jamendoKey}
                    onChange={(e) => setJamendoKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginTop: '6px' }}>
                  <label className="input-label" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Freesound API Token</label>
                  <input
                    type="password"
                    placeholder="Freesound Token..."
                    value={freesoundKey}
                    onChange={(e) => setFreesoundKey(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
                  />
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Audio Waveform preview */}
        {voiceoverBuffer && (
          <div className="flex-col gap-1" style={{ marginTop: '4px' }}>
            <span className="input-label" style={{ fontSize: '9px' }}>Voiceover Track Activity</span>
            <div className="waveform-container">
              {[...Array(24)].map((_, i) => {
                const randomHeight = 4 + Math.floor(Math.random() * 16);
                return (
                  <div
                    key={i}
                    className="w-1"
                    style={{
                      height: `${randomHeight}px`,
                      width: '2px',
                      backgroundColor: 'var(--color-primary)',
                      borderRadius: '4px',
                      opacity: 0.4 + (i % 3) * 0.2
                    }}
                  ></div>
                );
              })}
            </div>
          </div>
        )}

        {/* -------------------- BACKGROUND MUSIC (BGM) SECTION -------------------- */}
        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

        <div>
          <h3 className="flex-row-center text-slate-200" style={{ fontSize: '14px', fontWeight: '700' }}>
            <Music size={16} style={{ color: 'var(--color-secondary)' }} /> Background Music (BGM)
          </h3>
          <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Mix custom loops or search Jamendo BGM catalog</p>
        </div>

        {/* Tab Selection for BGM */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '4px', gap: '12px', marginTop: '4px' }}>
          <button
            onClick={() => setBgmSearchMode("presets")}
            style={{
              background: 'none',
              border: 'none',
              color: bgmSearchMode === 'presets' ? 'var(--color-secondary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '4px 8px',
              borderBottom: bgmSearchMode === 'presets' ? '2px solid var(--color-secondary)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Presets & Uploads
          </button>
          <button
            onClick={() => setBgmSearchMode("jamendo")}
            style={{
              background: 'none',
              border: 'none',
              color: bgmSearchMode === 'jamendo' ? 'var(--color-secondary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '4px 8px',
              borderBottom: bgmSearchMode === 'jamendo' ? '2px solid var(--color-secondary)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            Jamendo BGM Search
          </button>
        </div>

        <div className="flex-col gap-3">
          {bgmSearchMode === 'presets' ? (
            <>
              {/* OpenRouter Lyria BGM Generator */}
              <div className="glass-panel flex-col gap-2" style={{ border: '1px solid rgba(255,255,255,0.06)', padding: '12px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', marginBottom: '4px' }}>
                <span className="text-xs font-semibold text-slate-300 flex-row items-center gap-1">
                  <Sparkles size={13} style={{ color: 'var(--color-secondary)' }} /> Generate AI BGM (OpenRouter Lyria)
                </span>
                <span className="text-[10px] text-slate-500">Create full-length high-fidelity background music from a style prompt using Google Lyria.</span>
                
                <div className="flex-row items-center gap-2" style={{ marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="e.g. upbeat lofi chill beat with piano chords"
                    value={bgmPrompt}
                    onChange={(e) => setBgmPrompt(e.target.value)}
                    className="text-input"
                    style={{ padding: '6px 10px', fontSize: '12px', flex: 1 }}
                  />
                  <button
                    onClick={handleGenerateLyriaBgm}
                    disabled={!bgmPrompt.trim() || !openrouterKey || loading}
                    className="glow-btn"
                    style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0, height: '32px' }}
                  >
                    {loading ? "Generating..." : "Generate Music"}
                  </button>
                </div>
              </div>

              {/* BGM Options Grid */}
              <div className="presets-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }}>
                {BGM_TRACKS.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => handleSelectBgmTrack(track)}
                    className={`preset-card ${selectedBgmPreset === track.id ? 'active' : ''}`}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '12px',
                      background: selectedBgmPreset === track.id ? 'rgba(99, 102, 241, 0.12)' : 'rgba(9, 13, 22, 0.4)',
                      border: `1.5px solid ${selectedBgmPreset === track.id ? 'var(--color-primary)' : 'rgba(255, 255, 255, 0.05)'}`,
                      boxShadow: selectedBgmPreset === track.id ? '0 0 10px rgba(99, 102, 241, 0.2)' : 'none',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '18px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.03)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {track.icon}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.name}
                        </h4>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '1px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.genre}
                        </p>
                      </div>
                    </div>
                    
                    {/* Play/Pause Preview Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreviewTrack(track);
                      }}
                      style={{
                        background: previewingTrackId === track.id ? 'var(--color-secondary)' : 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#ffffff',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                        marginLeft: '8px'
                      }}
                      className="preview-btn"
                      title={previewingTrackId === track.id ? "Pause Preview" : "Play Preview"}
                    >
                      {previewingTrackId === track.id ? <Pause size={10} /> : <Play size={10} />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Row: Custom MP3 Upload and Clear button */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => bgmFileInputRef.current?.click()}
                  className={`selector-btn ${selectedBgmPreset === 'upload' ? 'active' : ''}`}
                  style={{ padding: '8px', fontSize: '11px', display: 'flex', flexDirection: 'row', gap: '6px', height: '36px' }}
                >
                  <Upload size={13} />
                  <span>Upload Custom MP3</span>
                </button>
                <button
                  onClick={handleClearBgm}
                  className="selector-btn glow-btn-danger"
                  style={{ padding: '8px', fontSize: '11px', display: 'flex', flexDirection: 'row', gap: '6px', height: '36px', opacity: bgmBuffer ? 1 : 0.5 }}
                  disabled={!bgmBuffer}
                >
                  <span>❌ Remove BGM</span>
                </button>
              </div>

              {/* Collapsible Legacy Synthetic Pads */}
              <details style={{ marginTop: '8px', cursor: 'pointer' }}>
                <summary className="text-[11px] text-slate-500 hover:text-slate-300" style={{ fontWeight: '600', padding: '4px 0', outline: 'none' }}>
                  ⚡ Synthesized Ambient Pads (Legacy)
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
                  <button
                    onClick={() => handleSelectBgmPreset('lofi')}
                    className={`selector-btn ${selectedBgmPreset === 'lofi' ? 'active' : ''}`}
                    style={{ padding: '6px', fontSize: '10px' }}
                  >
                    <span>Lofi Pad</span>
                  </button>
                  <button
                    onClick={() => handleSelectBgmPreset('cinematic')}
                    className={`selector-btn ${selectedBgmPreset === 'cinematic' ? 'active' : ''}`}
                    style={{ padding: '6px', fontSize: '10px' }}
                  >
                    <span>Cinematic Pad</span>
                  </button>
                  <button
                    onClick={() => handleSelectBgmPreset('tech')}
                    className={`selector-btn ${selectedBgmPreset === 'tech' ? 'active' : ''}`}
                    style={{ padding: '6px', fontSize: '10px' }}
                  >
                    <span>Tech Pad</span>
                  </button>
                </div>
              </details>
            </>
          ) : (
            <div className="flex-col gap-2">
              <span className="text-[10px] text-slate-500">Query Jamendo's vast catalog of Creative Commons music.</span>
              <div className="flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Search BGM (e.g. cinematic piano, techno)..."
                  value={jamendoQuery}
                  onChange={(e) => setJamendoQuery(e.target.value)}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '12px', flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchJamendo();
                  }}
                />
                <button
                  onClick={handleSearchJamendo}
                  disabled={searchingJamendo || !jamendoQuery.trim()}
                  className="glow-btn"
                  style={{ padding: '6px 12px', fontSize: '11px', height: '32px' }}
                >
                  {searchingJamendo ? "Searching..." : "Search"}
                </button>
              </div>

              {/* Jamendo Results list */}
              {jamendoResults.length > 0 && (
                <div className="flex-col gap-2" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px', background: 'rgba(0,0,0,0.2)' }}>
                  {jamendoResults.map((track) => (
                    <div
                      key={track.id}
                      className="flex-row items-center justify-between"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: selectedBgmPreset === `jamendo-${track.id}` ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      <div className="flex-row items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                        <img 
                          src={track.image || 'https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=50'} 
                          alt="Cover" 
                          style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }} 
                        />
                        <div className="flex-col" style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {track.name}
                          </span>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {track.artist_name} • {(track.duration / 60).toFixed(1)}m
                          </span>
                        </div>
                      </div>

                      <div className="flex-row items-center gap-2">
                        {/* Preview button */}
                        <button
                          onClick={() => togglePreviewAudioUrl(track.audio, `jamendo-${track.id}`)}
                          className="preview-btn"
                          style={{
                            background: previewingTrackId === `jamendo-${track.id}` ? 'var(--color-secondary)' : 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          {previewingTrackId === `jamendo-${track.id}` ? <Pause size={10} /> : <Play size={10} />}
                        </button>

                        {/* Select BGM button */}
                        <button
                          onClick={() => handleSelectJamendoTrack(track)}
                          className="glow-btn"
                          style={{ padding: '4px 8px', fontSize: '9.5px', height: '24px' }}
                        >
                          {selectedBgmPreset === `jamendo-${track.id}` ? "Selected" : "Select"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {jamendoResults.length === 0 && !searchingJamendo && (
                <span className="text-[10px] text-slate-500 text-center py-2">No Jamendo search results. Try a keyword above.</span>
              )}
            </div>
          )}

          <input
            type="file"
            accept="audio/*"
            ref={bgmFileInputRef}
            onChange={handleBgmUpload}
            className="hidden"
          />

          {/* Volume and Play Controls */}
          {bgmBuffer && (
            <div className="flex-col gap-2" style={{ marginTop: '8px' }}>
              <div className="settings-row-item">
                <div className="flex-col" style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                  <span className="text-xs font-semibold text-slate-200" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {(() => {
                      const activeTrack = BGM_TRACKS.find(t => t.id === selectedBgmPreset);
                      return activeTrack ? `"${activeTrack.name}" Track Loaded` : (selectedBgmPreset === 'upload' ? 'Custom BGM Loaded' : (selectedBgmPreset === 'openrouter-lyria' ? 'OpenRouter AI BGM Loaded' : `${selectedBgmPreset.toUpperCase()} Preset Loaded`));
                    })()}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {bgmBuffer.duration.toFixed(1)}s loop duration
                  </span>
                </div>

                <button
                  onClick={togglePlayBgm}
                  className={`glow-btn ${isPlayingBgm ? 'glow-btn-danger' : 'glow-btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '11px', flexShrink: 0 }}
                >
                  {isPlayingBgm ? <Square size={12} style={{ marginRight: '4px' }} /> : <Play size={12} style={{ marginRight: '4px' }} />}
                  {isPlayingBgm ? 'Stop Test' : 'Play Test'}
                </button>
              </div>

              {/* BGM Volume Gain Slider */}
              <div className="settings-row-item">
                <div className="flex-col">
                  <span className="input-label" style={{ fontSize: '9px' }}>BGM Mixer Volume</span>
                  <span className="text-[10px] text-slate-500">Suggested: 10% - 20%</span>
                </div>
                <div className="flex-row items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="player-controls-timeline-input"
                    style={{ width: '120px' }}
                  />
                  <span className="text-xs font-mono text-slate-300 w-8 text-right" style={{ display: 'inline-block' }}>
                    {Math.round(bgmVolume * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {!bgmBuffer && (
            <div className="settings-row-item" style={{ justifyContent: 'center', padding: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              <span className="text-xs text-center">No background music active. Select a track or upload a loop.</span>
            </div>
          )}
        {/* -------------------- SOUND EFFECTS (SFX) SECTION -------------------- */}
        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '16px 0' }} />

        <div>
          <h3 className="flex-row-center text-slate-200" style={{ fontSize: '14px', fontWeight: '700' }}>
            <Volume2 size={16} style={{ color: 'var(--color-primary)' }} /> Sound Effects (SFX)
          </h3>
          <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Search Freesound.org catalog and trigger audio cues on scene transitions</p>
        </div>

        <div className="flex-col gap-3">
          <div className="flex-col gap-2">
            <span className="text-[10px] text-slate-500">Query Freesound's community database of royalty-free sound effects.</span>
            
            {/* Search Input */}
            <div className="flex-row items-center gap-2">
              <input
                type="text"
                placeholder="Search SFX (e.g. woosh, boom, click)..."
                value={freesoundQuery}
                onChange={(e) => setFreesoundQuery(e.target.value)}
                className="text-input"
                style={{ padding: '6px 10px', fontSize: '12px', flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchFreesound();
                }}
              />
              <button
                onClick={handleSearchFreesound}
                disabled={searchingFreesound || !freesoundQuery.trim()}
                className="glow-btn"
                style={{ padding: '6px 12px', fontSize: '11px', height: '32px' }}
                title={!freesoundKey ? "Enter Freesound token in settings below first" : "Search sound effects"}
              >
                {searchingFreesound ? "Searching..." : "Search"}
              </button>
            </div>

            {!freesoundKey && (
              <span style={{ fontSize: '9.5px', color: '#f87171' }}>⚠️ Enter your Freesound API Token in the credentials section below to enable SFX search.</span>
            )}

            {/* Freesound Results list */}
            {freesoundResults.length > 0 && (
              <div className="flex-col gap-2" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '6px', background: 'rgba(0,0,0,0.2)' }}>
                {freesoundResults.map((sound) => {
                  const sfxUrl = sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'];
                  const selectedSceneId = activeSfxSceneIds[sound.id] || (scenes[0]?.id || "");
                  
                  return (
                    <div
                      key={sound.id}
                      className="flex-col gap-2"
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        borderBottom: '1px solid rgba(255,255,255,0.03)'
                      }}
                    >
                      <div className="flex-row items-center justify-between" style={{ width: '100%' }}>
                        <div className="flex-col" style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {sound.name}
                          </span>
                          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                            Duration: {sound.duration.toFixed(1)}s
                          </span>
                        </div>

                        <div className="flex-row items-center gap-2">
                          {/* Preview button */}
                          <button
                            onClick={() => {
                              if (sfxUrl) togglePreviewAudioUrl(sfxUrl, `freesound-${sound.id}`);
                            }}
                            className="preview-btn"
                            style={{
                              background: previewingTrackId === `freesound-${sound.id}` ? 'var(--color-secondary)' : 'rgba(255,255,255,0.05)',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              cursor: 'pointer'
                            }}
                          >
                            {previewingTrackId === `freesound-${sound.id}` ? <Pause size={10} /> : <Play size={10} />}
                          </button>
                        </div>
                      </div>

                      {/* Scene Assignment dropdown */}
                      <div className="flex-row items-center gap-2" style={{ width: '100%' }}>
                        <select
                          value={selectedSceneId}
                          onChange={(e) => setActiveSfxSceneIds(prev => ({ ...prev, [sound.id]: e.target.value }))}
                          className="select-input"
                          style={{ padding: '3px 6px', fontSize: '10px', height: '22px', flex: 1 }}
                        >
                          {scenes.map((s, idx) => (
                            <option key={s.id} value={s.id}>{`Scene #${idx + 1} ("${(s.text || "").slice(0, 15)}...")`}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssignSfx(sound, selectedSceneId)}
                          className="glow-btn"
                          style={{ padding: '2px 8px', fontSize: '10px', height: '22px' }}
                        >
                          Assign SFX
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assigned SFX list */}
          {scenes.some(s => s.sfxUrl) && (
            <div className="flex-col gap-2" style={{ marginTop: '4px' }}>
              <span className="input-label" style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: '600' }}>Active Scene Sound Effects</span>
              <div className="flex-col gap-1.5">
                {scenes.map((scene, idx) => {
                  if (!scene.sfxUrl) return null;
                  return (
                    <div
                      key={scene.id}
                      className="flex-row items-center justify-between"
                      style={{
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '8px'
                      }}
                    >
                      <div className="flex-col" style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Scene #{idx + 1} SFX</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '500', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          🔊 {scene.sfxName}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveSfx(scene.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          fontSize: '9.5px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
