/**
 * TTS Voiceover Engine and Subtitle Synchronizer.
 * Integrates Web Speech API, Google Translate TTS, and ElevenLabs.
 */

// Web Audio API Context (instantiated lazily)
let audioCtx = null;
let decodedAudioBuffers = [];

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export async function decodeAudio(ctx, arrayBuffer) {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  return new Promise((resolve, reject) => {
    try {
      ctx.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (error) => {
          console.error("decodeAudioData callback error:", error);
          reject(error || new Error("Failed to decode audio data"));
        }
      );
    } catch (e) {
      ctx.decodeAudioData(arrayBuffer)
        .then(resolve)
        .catch((err) => {
          console.error("decodeAudioData promise error:", err);
          reject(err);
        });
    }
  });
}

/**
 * Generates subtitle word-level timestamps based on text and duration.
 * @param {Array} scenes - Scenes with subtitle phrase strings
 * @param {number} totalDuration - Estimated or actual voiceover duration
 */
export function estimateSubtitleTimestamps(scenes, totalDuration, targetDuration = 'auto') {
  const totalWords = scenes.reduce((acc, scene) => {
    const count1 = (scene.text || "").split(/\s+/).filter(Boolean).length;
    const count2 = (scene.text2 || "").split(/\s+/).filter(Boolean).length;
    return acc + count1 + count2;
  }, 0);

  const timePerWord = totalDuration / Math.max(1, totalWords);

  let currentStart = 0;
  return scenes.map((scene) => {
    const words1 = (scene.text || "").split(/\s+/).filter(Boolean);
    const words2 = (scene.text2 || "").split(/\s+/).filter(Boolean);

    let duration1 = words1.length * timePerWord;
    let duration2 = words2.length * timePerWord;
    const speechDuration = duration1 + duration2;

    // Enforce 0.9s minimum and 3.0s maximum clip duration constraint
    const maxDuration = 3.0;
    const minDuration = 0.9;
    const sceneDuration = Math.max(minDuration, Math.min(maxDuration, speechDuration));

    // Scale subtitle word timings if clamped, preventing synchronization drift
    if (speechDuration > maxDuration && speechDuration > 0) {
      const scale = maxDuration / speechDuration;
      duration1 *= scale;
      duration2 *= scale;
    }

    const words = [];
    const sceneSpeechStart = currentStart;

    words1.forEach((word, idx) => {
      const wordDuration = words1.length > 0 ? duration1 / words1.length : 0;
      words.push({
        word: word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ""),
        raw: word,
        start: sceneSpeechStart + (idx * wordDuration),
        end: sceneSpeechStart + ((idx + 1) * wordDuration),
        part: 1,
        pulse: false
      });
    });

    words2.forEach((word, idx) => {
      const wordDuration = words2.length > 0 ? duration2 / words2.length : 0;
      words.push({
        word: word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ""),
        raw: word,
        start: sceneSpeechStart + duration1 + (idx * wordDuration),
        end: sceneSpeechStart + duration1 + ((idx + 1) * wordDuration),
        part: 2,
        pulse: false
      });
    });

    const sceneStart = currentStart;
    const sceneEnd = currentStart + sceneDuration;
    currentStart = sceneEnd;

    return {
      ...scene,
      start: sceneStart,
      end: sceneEnd,
      duration: sceneDuration,
      words: words
    };
  });
}

/**
 * Fetches stitched MP3 streams from Google Translate TTS.
 * Captures it into an AudioBuffer so it can be recorded in Canvas Export.
 * @param {string} text - Voiceover script
 * @returns {Promise<AudioBuffer>} Decoded Web Audio buffer
 */
export async function generateGoogleTTS(text) {
  const ctx = getAudioContext();

  // Split text into chunks of max 180 characters (Google TTS limit is 200)
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const chunks = [];

  let currentChunk = "";
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > 180) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Fetch audio buffers for each chunk
  const buffers = [];
  for (const chunk of chunks) {
    const googleUrl = `/api/tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const youdaoUrl = `/api/youdao?audio=${encodeURIComponent(chunk)}&type=2`;

    let decodedBuffer = null;

    // 1. Try Google TTS proxy first
    try {
      const response = await fetch(googleUrl);
      if (!response.ok) throw new Error(`Google HTTP ${response.status} ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      decodedBuffer = await decodeAudio(ctx, arrayBuffer);
    } catch (googleError) {
      console.warn("Google TTS failed, trying Youdao backup proxy...", googleError);

      // 2. Try Youdao TTS proxy as backup
      try {
        const response = await fetch(youdaoUrl);
        if (!response.ok) throw new Error(`Youdao HTTP ${response.status} ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        decodedBuffer = await decodeAudio(ctx, arrayBuffer);
      } catch (youdaoError) {
        throw new Error(`TTS synthesis failed.\nGoogle: ${googleError.message}\nYoudao: ${youdaoError.message}`);
      }
    }

    if (decodedBuffer) {
      buffers.push(decodedBuffer);
    }
  }

  if (buffers.length === 0) return null;

  // Stitch buffers together
  return stitchAudioBuffers(ctx, buffers);
}

/**
 * Call ElevenLabs API for high-end voice synthesis
 */
export async function generateElevenLabsTTS(text, apiKey, voiceId = "21m00Tcm4TlvDq8ikWAM") {
  const ctx = getAudioContext();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_monolingual_v2",
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs Error: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return await decodeAudio(ctx, arrayBuffer);
}

/**
 * Call Google Cloud Text-to-Speech API for Neural/Wavenet voices
 */
export async function generateGoogleCloudTTS(text, apiKey, voiceName = "en-US-Neural2-F") {
  const ctx = getAudioContext();
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: { text: text },
      voice: { languageCode: "en-US", name: voiceName },
      audioConfig: { audioEncoding: "MP3" }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Cloud TTS Error: ${errText}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("No audio content returned from Google Cloud TTS.");
  }

  // Decode base64 to binary ArrayBuffer
  const binaryString = atob(data.audioContent);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await decodeAudio(ctx, bytes.buffer);
}

/**
 * Call Gemini API for native, high-fidelity voice generation
 */
export async function generateGeminiTTS(text, apiKey, voiceName = "Puck") {
  const ctx = getAudioContext();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Read the following script EXACTLY as written, with no extra conversational talking or introduction. Script:\n${text}`
        }]
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Audio Generation Error: ${errText}`);
  }

  const data = await response.json();
  const audioPart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.startsWith("audio/")
  );

  if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
    throw new Error("No audio content was returned from the Gemini model.");
  }

  // Decode base64 to binary ArrayBuffer
  const binaryString = atob(audioPart.inlineData.data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await decodeAudio(ctx, bytes.buffer);
}

/**
 * Call OpenRouter API for text-to-speech voice generation
 */
export async function generateOpenRouterTTS(text, apiKey, voiceName = "alloy", modelName = "openai/gpt-audio-mini") {
  const ctx = getAudioContext();
  const url = "/api/openrouter/api/v1/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      modalities: ["text", "audio"],
      audio: {
        voice: voiceName,
        format: "mp3"
      },
      messages: [
        {
          role: "user",
          content: `Read the following script exactly as written, with no extra conversational talking or introduction:\n\n${text}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter TTS Error: ${errText}`);
  }

  const data = await response.json();
  const base64Data = data.choices?.[0]?.message?.audio?.data;
  
  if (!base64Data) {
    throw new Error("No audio content was returned from the OpenRouter model.");
  }

  // Decode base64 to binary ArrayBuffer
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await decodeAudio(ctx, bytes.buffer);
}


/**
 * Decode an uploaded audio file into an AudioBuffer
 */
export async function decodeUploadedAudio(file) {
  const ctx = getAudioContext();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const decoded = await decodeAudio(ctx, arrayBuffer);
        resolve(decoded);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Combines multiple AudioBuffers into a single buffer sequentially
 */
function stitchAudioBuffers(ctx, buffers) {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const sampleRate = buffers[0].sampleRate;

  const stitchedBuffer = ctx.createBuffer(
    buffers[0].numberOfChannels,
    totalLength,
    sampleRate
  );

  for (let channel = 0; channel < stitchedBuffer.numberOfChannels; channel++) {
    const channelData = stitchedBuffer.getChannelData(channel);
    let offset = 0;
    for (const buffer of buffers) {
      channelData.set(buffer.getChannelData(channel), offset);
      offset += buffer.length;
    }
  }

  return stitchedBuffer;
}
