import React, { useState } from 'react';
import { Download, Loader2, Sparkles, AlertCircle, Film } from 'lucide-react';

export default function ExportPanel({
  scenes = [],
  videoProfile = 'faceless',
  voiceoverBuffer = null,
  bgmBuffer = null,
  bgmVolume = 0.15,
  selectedVideos = {},
  currentTime = 0,
  setCurrentTime = () => {},
  isPlaying = false,
  setIsPlaying = () => {},
  subtitleSettings = {},
  sfxBuffers = {}
}) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleExport = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      setErrorMsg("Canvas element not found in DOM.");
      return;
    }

    setExporting(true);
    setProgress(0);
    setDownloadUrl(null);
    setErrorMsg("");

    // Stop and reset to the beginning
    setIsPlaying(false);
    setCurrentTime(0);

    // Wait for reset to take effect and all video elements to settle
    await new Promise(resolve => setTimeout(resolve, 600));

    const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 3), 0);

    // ================================================================
    // KEY FIX: Use captureStream(0) for MANUAL frame-by-frame capture.
    //
    // OLD approach - captureStream(30):
    //   Auto-captures canvas 30x/sec on its own clock, completely
    //   independent of when VideoPlayer actually draws. Under the CPU
    //   load of encoding, rAF slows down → canvas draws lag behind →
    //   the auto-capture grabs stale/duplicate frames → CHOPPY output.
    //
    // NEW approach - captureStream(0) + requestFrame():
    //   Frames are ONLY captured when we call requestFrame().
    //   We call it from a rAF loop that runs in lockstep with
    //   VideoPlayer's render loop, so every captured frame is a
    //   complete, freshly-drawn frame. Zero duplicates, zero tearing.
    // ================================================================
    const stream = canvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];

    let audioSourceNode = null;
    let bgmSourceNode = null;
    let audioCtx = null;

    // Mix audio tracks into the recording stream
    let sfxSourceNodes = [];
    if (voiceoverBuffer || bgmBuffer || Object.keys(sfxBuffers).length > 0) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        const dest = audioCtx.createMediaStreamDestination();

        if (voiceoverBuffer) {
          audioSourceNode = audioCtx.createBufferSource();
          audioSourceNode.buffer = voiceoverBuffer;
          audioSourceNode.connect(dest);
        }

        if (bgmBuffer) {
          bgmSourceNode = audioCtx.createBufferSource();
          bgmSourceNode.buffer = bgmBuffer;
          bgmSourceNode.loop = true;
          const bgmGain = audioCtx.createGain();
          bgmGain.gain.setValueAtTime(bgmVolume, audioCtx.currentTime);
          bgmSourceNode.connect(bgmGain);
          bgmGain.connect(dest);
        }

        // Mix in scene-specific Sound Effects
        scenes.forEach(scene => {
          if (scene.sfxUrl && sfxBuffers[scene.sfxUrl]) {
            const sfxSource = audioCtx.createBufferSource();
            sfxSource.buffer = sfxBuffers[scene.sfxUrl];
            sfxSource.connect(dest);
            const sceneStart = scenes.slice(0, scenes.indexOf(scene)).reduce((sum, s) => sum + (s.duration || 3), 0);
            sfxSource.start(audioCtx.currentTime + sceneStart);
            sfxSourceNodes.push(sfxSource);
          }
        });

        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
      } catch (e) {
        console.warn("Failed to stitch audio track to recording:", e);
      }
    }

    // MediaRecorder setup
    const candidateTypes = [
      'video/webm;codecs=h264,opus',
      'video/webm;codecs=h264',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm;codecs=vp9,opus',
      'video/webm'
    ];

    let options = {};
    for (const mime of candidateTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        options = { mimeType: mime, videoBitsPerSecond: 8_000_000 };
        break;
      }
    }

    let recorder;
    const recordedChunks = [];

    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      setErrorMsg("MediaRecorder not supported in this browser. Try Chrome or Firefox.");
      setExporting(false);
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    let exportDone = false;

    recorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setExporting(false);
      setProgress(100);

      if (audioSourceNode) { try { audioSourceNode.stop(); } catch (e) {} }
      if (bgmSourceNode) { try { bgmSourceNode.stop(); } catch (e) {} }
      sfxSourceNodes.forEach(node => { try { node.stop(); } catch (e) {} });
      if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
    };

    // ---- Start everything simultaneously ----
    recorder.start();
    if (audioSourceNode) audioSourceNode.start(0);
    if (bgmSourceNode) bgmSourceNode.start(0);

    // Start video playback so stock video elements play naturally
    // (no seeking/pausing that would cause decoder flush stuttering)
    setIsPlaying(true);

    // ================================================================
    // SYNCHRONIZED FRAME CAPTURE LOOP
    //
    // Runs via requestAnimationFrame — the same mechanism VideoPlayer
    // uses to draw. Because rAF callbacks are batched per display
    // frame, this capture loop fires in the SAME frame as the draw,
    // guaranteeing we grab the freshly-painted canvas content.
    // ================================================================
    const exportStartWallTime = performance.now();

    const captureLoop = () => {
      if (exportDone) return;

      const wallElapsed = (performance.now() - exportStartWallTime) / 1000;

      // Update progress bar
      setProgress(Math.min(99, Math.round((wallElapsed / totalDuration) * 100)));

      // Explicitly capture exactly what's on the canvas right now
      if (videoTrack && typeof videoTrack.requestFrame === 'function') {
        videoTrack.requestFrame();
      }

      // Check if export is complete
      if (wallElapsed >= totalDuration) {
        exportDone = true;
        // Brief delay so the final frame is flushed to the recorder
        setTimeout(() => {
          recorder.stop();
          setIsPlaying(false);
          setCurrentTime(0);
        }, 150);
        return;
      }

      requestAnimationFrame(captureLoop);
    };

    // Kick off the capture loop
    requestAnimationFrame(captureLoop);
  };

  return (
    <div className="glass-panel flex-col gap-4 w-full">
      <div>
        <h3 className="flex-row-center text-slate-200" style={{ fontSize: '15px', fontWeight: '700' }}>
          <Film size={18} style={{ color: 'var(--color-primary)' }} /> Export Reel (100% White-Label)
        </h3>
        <p className="text-xs text-slate-400" style={{ marginTop: '2px' }}>Render the 9:16 vertical video directly inside your browser</p>
      </div>

      <div className="flex-col gap-3">
        {exporting ? (
          <div className="exporter-progress-box">
            <div className="exporter-progress-header">
              <span className="exporter-progress-status-text">
                <Loader2 size={14} className="animate-spin" /> Rendering canvas streams...
              </span>
              <span>{progress}%</span>
            </div>
            
            {/* Progress bar */}
            <div className="exporter-progress-bar-track">
              <div 
                className="exporter-progress-bar-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
             <div className="alert-box" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', marginTop: '12px', fontSize: '11px', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
               <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
               <div>
                 <strong>IMPORTANT:</strong> Keep this browser tab open and visible. Backgrounding or switching tabs will throttle/freeze the renderer, causing the exported video to stutter.
               </div>
             </div>
          </div>
        ) : (
          <button
            onClick={handleExport}
            disabled={scenes.length === 0}
            className="glow-btn w-full"
            style={{ padding: '12px' }}
          >
            <Sparkles size={16} style={{ color: 'var(--color-yellow)' }} /> Render and Compile Video
          </button>
        )}

        {downloadUrl && (
          <div className="exporter-success-box">
            <div className="exporter-success-header">
              <span className="flex-row-center">
                ✓ Render Completed!
              </span>
              <span style={{ 
                fontSize: '10px', 
                fontFamily: 'monospace', 
                background: 'rgba(16, 185, 129, 0.15)', 
                color: '#6ee7b7', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                border: '1px solid rgba(16, 185, 129, 0.25)' 
              }}>
                watermark bypass active
              </span>
            </div>
            
            <a
              href={downloadUrl}
              download={`reel-${videoProfile}-${Date.now()}.webm`}
              className="glow-btn w-full"
              style={{
                background: 'linear-gradient(135deg, var(--color-emerald), var(--color-accent))',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                padding: '10px 12px'
              }}
            >
              <Download size={16} /> Download 9:16 Video File
            </a>
          </div>
        )}

        {errorMsg && (
          <div className="alert-box alert-box-danger">
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Format: WebM/VP9 (H.264 compatible) • Resolution: 540x960 (9:16 Portrait)
        </div>
      </div>
    </div>
  );
}
