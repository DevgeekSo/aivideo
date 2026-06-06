import { searchStockVideos } from './pexelsApi';

/**
 * Initiates an AI image generation job on Cloudflare Workers AI or runs in Mock/Sandbox mode.
 * 
 * @param {string} prompt - The descriptive text prompt for the image.
 * @param {Object} options - API configurations.
 * @param {string} options.provider - 'cloudflare' | 'mock'
 * @param {string} options.apiKey - API Token for Cloudflare.
 * @param {string} options.accountId - Cloudflare Account ID.
 * @param {string} options.modelName - Cloudflare model name.
 * @param {Function} options.onStatusUpdate - Status updates listener callback: (statusMessage) => void
 * @param {Object} options.apiKeys - Global keys container to feed into fallback.
 * @returns {Promise<string>} The generated image URL (object URL or search fallback URL).
 */
export async function generateAiImage(prompt, options = {}) {
  const {
    provider = 'cloudflare',
    apiKey = '',
    accountId = '',
    modelName = '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    onStatusUpdate = () => {},
    apiKeys = {}
  } = options;

  onStatusUpdate("Initializing image generator...");
  console.log(`AI Image Request: provider="${provider}", model="${modelName}", prompt="${prompt}"`);

  if (provider === 'mock' || (!apiKey && provider !== 'mock')) {
    onStatusUpdate("Running Sandbox Image Generator...");
    await new Promise(r => setTimeout(r, 1500));
    
    // Fallback: search Pexels and return thumbnail of first video
    let searchQuery = "abstract art";
    const keywords = prompt.split(/\s+/).filter(w => w.length > 4).map(w => w.replace(/[^a-zA-Z]/g, ''));
    if (keywords.length > 0) {
      searchQuery = keywords.slice(0, 3).join(" ");
    }

    try {
      const clips = await searchStockVideos(searchQuery, apiKeys);
      if (clips && clips.length > 0) {
        onStatusUpdate("Completed!");
        return clips[0].thumbnail;
      }
    } catch (e) {
      console.warn("Mock Pexels query failed, using static default image", e);
    }
    
    onStatusUpdate("Completed!");
    return "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=600";
  }

  if (provider === 'cloudflare') {
    if (!accountId) {
      throw new Error("Cloudflare Account ID is missing. Please configure it under AI Settings.");
    }
    
    onStatusUpdate("Calling Cloudflare Workers AI...");
    
    const url = `/api/cloudflare/client/v4/accounts/${accountId}/ai/run/${modelName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      let errText = "";
      try {
        const errJson = await response.json();
        errText = errJson.errors?.[0]?.message || errJson.messages?.[0] || response.statusText;
      } catch (e) {
        errText = await response.text() || response.statusText;
      }
      throw new Error(`Cloudflare AI Image generation failed: ${errText}`);
    }

    onStatusUpdate("Retrieving generated image...");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    onStatusUpdate("Completed!");
    return objectUrl;
  }

  throw new Error(`Unsupported AI Image provider: ${provider}`);
}
