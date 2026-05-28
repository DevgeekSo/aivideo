/**
 * Pexels and Pixabay stock video fetcher.
 * Handles API requests and selects vertical-friendly resolutions.
 */

// A curated collection of high-quality public vertical and landscape MP4 videos for Offline/Sandbox Mode
const FALLBACK_VIDEOS = {
  coding: [
    "https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c02cba73f6dd1e2334f59e9336d39695&profile_id=139&oauth2_token_id=57447761", // typing code
    "https://player.vimeo.com/external/435674703.sd.mp4?s=7b3400d3d5be77085b736b4458f3fb42cb8d67c5&profile_id=165&oauth2_token_id=57447761", // server room
    "https://player.vimeo.com/external/538571052.sd.mp4?s=d04e578c77f0a6d05becc5b597816cb150be989a&profile_id=165&oauth2_token_id=57447761"  // screen scrolling code
  ],
  nature: [
    "https://player.vimeo.com/external/409228945.sd.mp4?s=82c0fa02897fa1f21db597d3935dbcb55d8a9e04&profile_id=165&oauth2_token_id=57447761", // foggy mountains vertical
    "https://player.vimeo.com/external/459389137.sd.mp4?s=9108df049811f5d21a2eb7b172a5a54db68711ee&profile_id=165&oauth2_token_id=57447761", // forest drone
    "https://player.vimeo.com/external/482857485.sd.mp4?s=40428f5c357c32bf7e4d8fb87ebdbbf3df32d3f6&profile_id=165&oauth2_token_id=57447761"  // ocean waves
  ],
  abstract: [
    "https://player.vimeo.com/external/517618991.sd.mp4?s=225a073f001712a4df8344e6d321528659dcd87b&profile_id=165&oauth2_token_id=57447761", // glowing neon liquid
    "https://player.vimeo.com/external/554868079.sd.mp4?s=a6a81e9f196ebf4bdfcb82b99214777d13038676&profile_id=165&oauth2_token_id=57447761", // retro grid lines
    "https://player.vimeo.com/external/530278772.sd.mp4?s=900388cb56d400e9deee8f4bfecb1605f631d87e&profile_id=165&oauth2_token_id=57447761"  // fluid motion paint
  ],
  speaking: [
    "https://player.vimeo.com/external/430154247.sd.mp4?s=42d1f93f18e95079a4a7536d71b3e8964344bb14&profile_id=165&oauth2_token_id=57447761", // man speaking portrait
    "https://player.vimeo.com/external/430154316.sd.mp4?s=bd44d2d4838cc14e0e41775791a84f3ccb01b691&profile_id=165&oauth2_token_id=57447761", // woman speaking portrait
    "https://player.vimeo.com/external/485073400.sd.mp4?s=1f1b203c94833215d2a93322d7d8e20f4cfd76d4&profile_id=165&oauth2_token_id=57447761"  // developer explanation
  ]
};

// Default thumbnails for fallback videos
const FALLBACK_THUMBS = [
  "https://images.pexels.com/photos/546819/pexels-photo-546819.jpeg?auto=compress&cs=tinysrgb&w=300",
  "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=300",
  "https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=300"
];

/**
 * Searches stock videos across Pexels or Pixabay.
 * @param {string} query - The search keyword
 * @param {Object} options - API keys & configuration
 * @returns {Promise<Array>} List of videos containing mp4 URLs, thumbnails, and dimension markers
 */
export async function searchStockVideos(query, options = {}) {
  const { pexelsKey = "", pixabayKey = "" } = options;

  if (pexelsKey) {
    try {
      return await fetchPexelsVideos(query, pexelsKey);
    } catch (e) {
      console.warn("Pexels query failed, attempting Pixabay...", e);
    }
  }

  if (pixabayKey) {
    try {
      return await fetchPixabayVideos(query, pixabayKey);
    } catch (e) {
      console.warn("Pixabay query failed, using sandbox fallback...", e);
    }
  }

  // Fallback to local sandbox asset matches
  return getSandboxFallbackVideos(query);
}

/**
 * Fetch from Pexels API
 */
async function fetchPexelsVideos(query, apiKey) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=12&orientation=portrait`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Pexels error: status ${response.status}`);
  }

  const data = await response.json();
  
  return data.videos.map(video => {
    // Select best video file: prioritizes 1080p/720p vertical-oriented files
    const files = video.video_files || [];
    
    // Sort so vertical-friendly files (height > width) or HD files are picked
    const verticalFiles = files.filter(f => f.height > f.width && f.file_type === 'video/mp4');
    const chosenFile = verticalFiles.length > 0 
      ? selectBestResolution(verticalFiles) 
      : selectBestResolution(files.filter(f => f.file_type === 'video/mp4'));

    return {
      id: `pexels-${video.id}`,
      thumbnail: video.image,
      videoUrl: chosenFile ? chosenFile.link : null,
      width: video.width,
      height: video.height,
      duration: video.duration,
      isVertical: video.height > video.width,
      source: "Pexels"
    };
  }).filter(v => v.videoUrl && v.duration >= 0.9);
}

/**
 * Fetch from Pixabay API
 */
async function fetchPixabayVideos(query, apiKey) {
  const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=10`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pixabay error: status ${response.status}`);
  }

  const data = await response.json();
  
  return data.hits.map(hit => {
    // Pixabay provides large, medium, small, tiny video object
    const videos = hit.videos || {};
    // Select medium or small for efficient client-side buffer
    const videoData = videos.medium || videos.small || videos.large;

    return {
      id: `pixabay-${hit.id}`,
      thumbnail: `https://i.vimeocdn.com/video/${hit.picture_id}_295x166.jpg`,
      videoUrl: videoData ? videoData.url : null,
      width: videoData ? videoData.width : 1280,
      height: videoData ? videoData.height : 720,
      duration: hit.duration,
      isVertical: videoData ? (videoData.height > videoData.width) : false,
      source: "Pixabay"
    };
  }).filter(v => v.videoUrl && v.duration >= 0.9);
}

/**
 * Filter list of video files to find appropriate stream quality (720p/1080p)
 */
function selectBestResolution(files) {
  if (files.length === 0) return null;
  // Prefer HD/SD files around 720p (width/height around 720-1280) to avoid slow downloads
  const targetFiles = files.filter(f => {
    const dim = Math.min(f.width, f.height);
    return dim >= 480 && dim <= 1080;
  });

  if (targetFiles.length > 0) {
    // Sort descending by resolution and pick highest in range
    return targetFiles.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  }
  return files[0]; // fallback
}

/**
 * Map search queries to high-fidelity sandbox stock files
 */
function getSandboxFallbackVideos(query) {
  const q = query.toLowerCase();
  let category = "abstract";
  
  if (q.includes("code") || q.includes("develop") || q.includes("program") || q.includes("tech") || q.includes("keyboard") || q.includes("laptop")) {
    category = "coding";
  } else if (q.includes("nature") || q.includes("forest") || q.includes("ocean") || q.includes("mountain") || q.includes("sunset") || q.includes("river")) {
    category = "nature";
  } else if (q.includes("speak") || q.includes("man") || q.includes("woman") || q.includes("person") || q.includes("guru") || q.includes("face")) {
    category = "speaking";
  }

  const urls = FALLBACK_VIDEOS[category];
  
  return urls.map((url, idx) => ({
    id: `sandbox-${category}-${idx}`,
    thumbnail: FALLBACK_THUMBS[idx % FALLBACK_THUMBS.length],
    videoUrl: url,
    width: category === "nature" && idx === 0 ? 1080 : 1920,
    height: category === "nature" && idx === 0 ? 1920 : 1080,
    duration: 15,
    isVertical: (category === "nature" && idx === 0) || (category === "speaking" && idx < 2),
    source: "Sandbox (Offline)"
  }));
}
