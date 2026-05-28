/**
 * D-ID API Client Integration Utility.
 * Communicates with D-ID's /talks API endpoints using the local Vite server proxy (/api/did).
 */

export const DID_AVATAR_PRESETS = [
  {
    id: 'speaker_a_female',
    name: 'Emma (Speaker A)',
    role: 'A',
    gender: 'female',
    thumbnail: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&h=500&fit=crop',
    defaultVoice: 'en-US-JennyNeural'
  },
  {
    id: 'speaker_b_male',
    name: 'Marcus (Speaker B)',
    role: 'B',
    gender: 'male',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop',
    defaultVoice: 'en-US-GuyNeural'
  },
  {
    id: 'guru_male',
    name: 'Alan (Solo Guru M)',
    role: 'GURU',
    gender: 'male',
    thumbnail: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&h=500&fit=crop',
    defaultVoice: 'en-US-ChristopherNeural'
  },
  {
    id: 'guru_female',
    name: 'Sophia (Solo Guru F)',
    role: 'GURU',
    gender: 'female',
    thumbnail: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop',
    imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&h=500&fit=crop',
    defaultVoice: 'en-US-JennyNeural'
  }
];

export const DID_VOICE_PRESETS = [
  { id: 'en-US-JennyNeural', name: 'Jenny (Female - Clear)', provider: 'microsoft' },
  { id: 'en-US-GuyNeural', name: 'Guy (Male - Standard)', provider: 'microsoft' },
  { id: 'en-US-MichelleNeural', name: 'Michelle (Female - Warm)', provider: 'microsoft' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (Male - Professional)', provider: 'microsoft' },
  { id: 'en-US-BrandonNeural', name: 'Brandon (Male - Conversational)', provider: 'microsoft' }
];

export function getDidAuthHeader(didKey) {
  if (!didKey) return '';
  return 'Basic ' + btoa(didKey);
}

/**
 * Extracts the direct image URL if a Google Images Search link is provided.
 */
export function cleanImageUrl(url) {
  if (!url) return '';
  if (url.includes('google.com/imgres') || url.includes('imgurl=')) {
    try {
      // Handle standard queries or hashes containing params
      const cleanUrl = url.replace(/#/g, '?');
      const urlObj = new URL(cleanUrl);
      const imgUrl = urlObj.searchParams.get('imgurl');
      if (imgUrl) {
        return decodeURIComponent(imgUrl);
      }
    } catch (e) {
      console.warn("Failed to parse Google Image URL:", e);
    }
  }
  return url;
}

/**
 * Queries D-ID credit balance.
 */
export async function checkDidCredits(didKey) {
  const authHeader = getDidAuthHeader(didKey);
  if (!authHeader) throw new Error("Missing D-ID API Credentials.");

  const response = await fetch('/api/did/credits', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID Credits Request Failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.remaining ?? data.total ?? 0;
}

/**
 * Initiates an asynchronous D-ID Talk generation request.
 */
export async function createDidTalk(avatarUrl, text, voiceId, didKey) {
  const authHeader = getDidAuthHeader(didKey);
  if (!authHeader) throw new Error("Missing D-ID API Credentials.");

  const payload = {
    source_url: avatarUrl,
    script: {
      type: 'text',
      input: text,
      provider: {
        type: 'microsoft',
        voice_id: voiceId || 'en-US-JennyNeural'
      }
    },
    config: {
      fluent: false,
      pad_audio: 0.0,
      stitch: true
    }
  };

  const response = await fetch('/api/did/talks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID Generation Request Failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (!data.id) {
    throw new Error("D-ID response did not return a valid talk ID.");
  }

  return data.id;
}

/**
 * Retrieves the status of a specific D-ID talk.
 */
export async function getDidTalkStatus(talkId, didKey) {
  const authHeader = getDidAuthHeader(didKey);
  if (!authHeader) throw new Error("Missing D-ID API Credentials.");

  const response = await fetch(`/api/did/talks/${talkId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`D-ID Status Query Failed: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return {
    status: data.status, // "created", "started", "done", "error"
    resultUrl: data.result_url,
    error: data.error
  };
}
