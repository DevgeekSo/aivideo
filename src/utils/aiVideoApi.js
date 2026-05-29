/**
 * AI Video Generation API Client.
 * Integrates with Fal.ai (Luma, Kling, Hunyuan, Mochi 1, Minimax, SVD),
 * Replicate (Luma, Hunyuan, Minimax, SVD), Custom API endpoints,
 * or runs a beautiful Sandbox Mock generator with progress polling simulation.
 */

import { searchStockVideos } from './pexelsApi';

// Registries for supported model mappings
const FAL_MODELS = {
  'fal-luma': 'fal-ai/luma-dream-machine',
  'fal-kling': 'fal-ai/kling-video/v1/standard/text-to-video',
  'fal-hunyuan': 'fal-ai/hunyuan-video',
  'fal-mochi': 'fal-ai/mochi-1-preview',
  'fal-minimax': 'fal-ai/minimax/video-01',
  'fal-svd': 'fal-ai/fast-svd'
};

const REPLICATE_MODELS = {
  'replicate-luma': 'luma/dream-machine',
  'replicate-hunyuan': 'tencent/hunyuan-video',
  'replicate-minimax': 'minimax/video-01',
  'replicate-svd': 'stability-ai/stable-video-diffusion'
};

/**
 * Utility to extract a nested value from a JSON object using dot notation (e.g. "result.video.url")
 */
function getValueByPath(obj, path) {
  if (!path) return null;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

/**
 * Helper to pause execution
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initiates an AI video generation job and polls for status updates until a result URL is obtained.
 * 
 * @param {string} prompt - The descriptive text prompt for the video clip.
 * @param {Object} options - API configurations.
 * @param {string} options.provider - 'mock' | 'fal-luma' | 'fal-kling' | 'fal-hunyuan' | 'fal-mochi' | 'fal-minimax' | 'fal-svd' | 'replicate-luma' | 'replicate-hunyuan' | 'replicate-minimax' | 'replicate-svd' | 'custom'
 * @param {string} options.apiKey - API Key for selected provider.
 * @param {string} options.customUrl - Custom API endpoint URL.
 * @param {string} options.customHeaders - Custom API JSON headers.
 * @param {string} options.customPayload - Custom API JSON request body payload template.
 * @param {string} options.customPath - Dot-notation key path to video URL in the custom API response.
 * @param {Function} options.onStatusUpdate - Status updates listener callback: (statusMessage) => void
 * @param {Object} options.apiKeys - Global keys container to feed into the Pexels fallback if needed.
 * @returns {Promise<string>} The generated video file URL.
 */
export async function generateAiVideo(prompt, options = {}) {
  const {
    provider = 'mock',
    apiKey = '',
    customUrl = '',
    customHeaders = '{}',
    customPayload = '{}',
    customPath = 'video.url',
    onStatusUpdate = () => {},
    apiKeys = {}
  } = options;

  onStatusUpdate("Initializing generator...");
  console.log(`AI Video Request: provider="${provider}", prompt="${prompt}"`);

  if (provider === 'mock' || !apiKey && provider !== 'custom') {
    return await runMockGeneration(prompt, apiKeys, onStatusUpdate);
  }

  // Check if provider is a Fal.ai model
  if (FAL_MODELS[provider]) {
    const modelPath = FAL_MODELS[provider];
    return await runFalVideo(prompt, modelPath, apiKey, onStatusUpdate);
  }

  // Check if provider is a Replicate model
  if (REPLICATE_MODELS[provider]) {
    const modelName = REPLICATE_MODELS[provider];
    return await runReplicateVideo(prompt, modelName, apiKey, onStatusUpdate);
  }

  if (provider === 'custom') {
    return await runCustomApi(prompt, customUrl, customHeaders, customPayload, customPath, apiKey, onStatusUpdate);
  }

  throw new Error(`Unsupported AI Video provider: ${provider}`);
}

/**
 * Mock video generator that runs offline.
 * It simulates a realistic AI generation pipeline (e.g. submitting, queue wait, rendering)
 * and retrieves a stock video representing the prompt as the visual payload.
 */
async function runMockGeneration(prompt, apiKeys, onStatusUpdate) {
  onStatusUpdate("Submitting request to model...");
  await delay(1200);

  onStatusUpdate("In Queue: Position #3...");
  await delay(1000);

  onStatusUpdate("Rendering scene frames (25%)...");
  await delay(1000);

  onStatusUpdate("Rendering scene frames (70%)...");
  await delay(1000);

  onStatusUpdate("Compiling MP4 container (90%)...");
  
  // Extract search keywords from prompt to fetch thematic Pexels loops
  let searchQuery = "abstract art";
  const cleanPrompt = prompt.toLowerCase();
  
  const keywords = prompt.split(/\s+/).filter(w => w.length > 4).map(w => w.replace(/[^a-zA-Z]/g, ''));
  if (keywords.length > 0) {
    searchQuery = keywords.slice(0, 3).join(" ");
  }

  try {
    const clips = await searchStockVideos(searchQuery, apiKeys);
    await delay(800);
    
    if (clips && clips.length > 0) {
      const vertical = clips.find(c => c.isVertical) || clips[0];
      onStatusUpdate("Completed!");
      return vertical.videoUrl;
    }
  } catch (e) {
    console.warn("Mock Pexels query failed, using static default clip", e);
  }

  onStatusUpdate("Completed!");
  return "https://player.vimeo.com/external/517618991.sd.mp4?s=225a073f001712a4df8344e6d321528659dcd87b&profile_id=165&oauth2_token_id=57447761"; // Neon liquid loop
}

/**
 * Generic Fal.ai submission and polling implementation
 */
async function runFalVideo(prompt, modelPath, apiKey, onStatusUpdate) {
  onStatusUpdate(`Submitting to Fal.ai (${modelPath.split('/').pop()})...`);
  
  const response = await fetch(`https://queue.fal.run/${modelPath}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt,
      aspect_ratio: "9:16"
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Fal.ai submission failed (${response.status}): ${errText}`);
  }

  const job = await response.json();
  const requestId = job.request_id;
  const statusUrl = job.status_url || `https://queue.fal.run/${modelPath}/requests/${requestId}`;

  if (!requestId) {
    throw new Error("No request_id returned by Fal.ai API.");
  }

  return await pollFalJob(statusUrl, apiKey, onStatusUpdate);
}

/**
 * Shared polling client for Fal.ai queue requests
 */
async function pollFalJob(statusUrl, apiKey, onStatusUpdate) {
  let attempts = 0;
  const maxAttempts = 60; // 3 minutes total (3s * 60)

  while (attempts < maxAttempts) {
    attempts++;
    onStatusUpdate(`Polling Fal queue (attempt ${attempts})...`);

    const res = await fetch(statusUrl, {
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      console.warn("Fal status poll returned error status:", res.status);
      await delay(3000);
      continue;
    }

    const checkData = await res.json();
    const status = checkData.status || "IN_QUEUE";

    console.log(`Fal job status: requestId=${checkData.request_id || ''}, status=${status}`);

    if (status === "COMPLETED") {
      onStatusUpdate("Completed!");
      const videoUrl = checkData.video?.url || (checkData.outputs && checkData.outputs[0]?.url) || null;
      if (!videoUrl) {
        throw new Error("Fal.ai job completed but no video URL was returned in output.");
      }
      return videoUrl;
    } else if (status === "FAILED") {
      throw new Error(`Fal.ai video generation failed: ${checkData.error || "Unknown error"}`);
    } else {
      const queuePos = checkData.queue_position !== undefined ? ` (Pos: ${checkData.queue_position})` : '';
      onStatusUpdate(`Generating: ${status}${queuePos}`);
      await delay(3000);
    }
  }

  throw new Error("Video generation request timed out after 3 minutes.");
}

/**
 * Generic Replicate video generation and polling implementation
 * Proxies calls through Vite server to avoid CORS issues (/api/replicate)
 */
async function runReplicateVideo(prompt, modelName, apiKey, onStatusUpdate) {
  onStatusUpdate(`Submitting to Replicate (${modelName.split('/').pop()})...`);

  // We call the proxied Replicate endpoint
  const response = await fetch("/api/replicate/v1/predictions", {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: modelName,
      input: {
        prompt: prompt,
        aspect_ratio: "9:16"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Replicate submission failed (${response.status}): ${errText}`);
  }

  const prediction = await response.json();
  const predictionId = prediction.id;

  if (!predictionId) {
    throw new Error("Replicate response did not return a valid prediction ID.");
  }

  return await pollReplicateJob(predictionId, apiKey, onStatusUpdate);
}

/**
 * Polling client for Replicate predictions
 */
async function pollReplicateJob(predictionId, apiKey, onStatusUpdate) {
  let attempts = 0;
  const maxAttempts = 60; // 4 minutes total (4s * 60)

  while (attempts < maxAttempts) {
    attempts++;
    onStatusUpdate(`Polling Replicate (attempt ${attempts})...`);

    // Fetch the proxied prediction status URL
    const res = await fetch(`/api/replicate/v1/predictions/${predictionId}`, {
      headers: {
        "Authorization": `Token ${apiKey}`,
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      console.warn("Replicate poll returned error status:", res.status);
      await delay(4000);
      continue;
    }

    const checkData = await res.json();
    const status = checkData.status; // "starting" | "processing" | "succeeded" | "failed" | "canceled"

    console.log(`Replicate job status: id=${predictionId}, status=${status}`);

    if (status === "succeeded") {
      onStatusUpdate("Completed!");
      const output = checkData.output;
      // Replicate outputs can be arrays of strings or direct strings
      const videoUrl = Array.isArray(output) ? output[0] : output;
      if (!videoUrl || typeof videoUrl !== 'string') {
        throw new Error("Replicate succeeded but did not return a valid video URL string.");
      }
      return videoUrl;
    } else if (status === "failed") {
      throw new Error(`Replicate generation failed: ${checkData.error || "Unknown prediction error"}`);
    } else if (status === "canceled") {
      throw new Error("Replicate generation was canceled.");
    } else {
      // starting or processing
      onStatusUpdate(`Generating: ${status}`);
      await delay(4000);
    }
  }

  throw new Error("Replicate generation request timed out.");
}

/**
 * General custom endpoint API handler
 */
async function runCustomApi(prompt, url, headersStr, payloadStr, resPath, apiKey, onStatusUpdate) {
  if (!url) throw new Error("Custom Video Generator Endpoint URL is empty.");
  
  onStatusUpdate("Invoking Custom Video Endpoint...");

  let headers = {};
  try {
    headers = JSON.parse(headersStr);
  } catch (e) {
    throw new Error(`Invalid Headers JSON config: ${e.message}`);
  }

  if (apiKey) {
    if (!headers["Authorization"] && !headers["authorization"]) {
      headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
    }
  }

  const compiledPayload = payloadStr.replace(/\{\{prompt\}\}/g, JSON.stringify(prompt).slice(1, -1));
  let bodyPayload;
  try {
    bodyPayload = JSON.parse(compiledPayload);
  } catch(e) {
    throw new Error(`Invalid Payload Template JSON config: ${e.message}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(bodyPayload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Custom API returned status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  
  const resolvedUrl = getValueByPath(data, resPath);
  if (resolvedUrl && typeof resolvedUrl === 'string' && resolvedUrl.startsWith('http')) {
    onStatusUpdate("Completed!");
    return resolvedUrl;
  }

  const jobId = data.id || data.job_id || data.request_id;
  if (!jobId) {
    throw new Error(`Could not find video URL at keypath "${resPath}" in response: ${JSON.stringify(data)}`);
  }

  onStatusUpdate("Polling Custom Job Status...");
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    attempts++;
    onStatusUpdate(`Custom Polling (attempt ${attempts})...`);
    await delay(4000);

    const pollUrl = url.includes('?') ? `${url}&id=${jobId}` : `${url}/${jobId}`;
    
    const checkRes = await fetch(pollUrl, {
      method: "GET",
      headers: headers
    });

    if (checkRes.ok) {
      const checkData = await checkRes.json();
      const statusVideo = getValueByPath(checkData, resPath);
      if (statusVideo && typeof statusVideo === 'string' && statusVideo.startsWith('http')) {
        onStatusUpdate("Completed!");
        return statusVideo;
      }
      
      const currentStatus = checkData.status || checkData.state;
      if (currentStatus === "failed" || currentStatus === "error") {
        throw new Error(`Custom generation failed: ${checkData.error || "Model error"}`);
      }
      onStatusUpdate(`Status: ${currentStatus || "processing"}`);
    }
  }

  throw new Error("Custom video generation request timed out.");
}
