/**
 * Cloudflare Workers AI Text-to-Image Generation API Client.
 * Uses `@cf/bytedance/stable-diffusion-xl-lightning` to generate images.
 */

export async function generateCloudflareImage(prompt, { accountId, apiToken }) {
  if (!accountId || !apiToken) {
    throw new Error("Missing Cloudflare Account ID or API Token. Please check your settings.");
  }

  const model = "@cf/bytedance/stable-diffusion-xl-lightning";
  // Call via Vite server proxy (/api/cloudflare) to bypass browser CORS policy
  const url = `/api/cloudflare/client/v4/accounts/${accountId}/ai/run/${model}`;

  console.log(`Cloudflare AI Image Request: prompt="${prompt}"`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: prompt
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let parsedError = {};
    try {
      parsedError = JSON.parse(errText);
    } catch (e) {}

    const errorMsg = parsedError.errors?.[0]?.message || errText;
    throw new Error(`Cloudflare AI Image Generation Failed: ${response.status} - ${errorMsg}`);
  }

  // Cloudflare image models return binary image data directly
  const buffer = await response.arrayBuffer();
  
  // Convert binary buffer to base64 data URL
  const binaryString = new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '');
  const base64 = btoa(binaryString);
  
  return `data:image/png;base64,${base64}`;
}
