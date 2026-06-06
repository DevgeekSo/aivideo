/**
 * Wikipedia & Wikimedia Commons Media search client.
 * Queries both Wikipedia article images and Wikimedia Commons,
 * then merges and de-duplicates results into standardized project media objects.
 */

/**
 * Cleans a search query by stripping common descriptive prefixes/suffixes.
 * e.g. "photo of Albert Einstein" -> "Albert Einstein"
 */
function cleanQuery(query) {
  return query
    .replace(/^(photo|picture|portrait|drawing|image|clip|video|illustration)s?\s+of\s+/i, "")
    .replace(/\s+(photo|picture|portrait|drawing|image|clip|video|illustration)s?$/i, "")
    .trim();
}

const USER_AGENT = "AIShortsVideoGenerator/1.0 (contact@example.com)";

/**
 * Helper to perform fetch requests with the required User-Agent header
 * to prevent 429 rate limit blocks from Wikimedia APIs.
 */
async function fetchWiki(url) {
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT
    }
  });
}

/**
 * Cleans a Commons file title for display.
 * e.g. "File:Albert_Einstein_photo_1920.jpg" -> "Albert Einstein photo 1920"
 */
function cleanFileTitle(title) {
  if (!title) return "";
  return title
    .replace(/^(File|Category|Archive):/i, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]/g, " ");
}

/**
 * Filters out non-photo file titles (icons, logos, SVGs, audio, etc.)
 */
function isRelevantImageTitle(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  // Skip non-photo file types
  if (/\.(svg|pdf|ogg|ogv|webm|mp4|mid|flac|wav|djvu|tif|tiff)$/i.test(lower)) return false;
  // Skip commons utility images
  if (/(icon|logo|flag|commons[\-_]?logo|wiki[\-_]?logo|symbol|button|arrow|ambox|disambig|edit[\-_]?pencil|lock|padlock|question[\-_]?mark|red[\-_]?x|merge|split|nuvola|crystal|gnome|tango|notification)/i.test(lower)) return false;
  return true;
}

/**
 * Strips HTML tags and decodes common entities.
 */
function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds a descriptive caption from extmetadata (description, author, license).
 */
function getBetterDescription(info, fallback) {
  const meta = info.extmetadata;
  if (!meta) return fallback;

  let desc = "";
  if (meta.ImageDescription?.value) {
    desc = stripHtml(meta.ImageDescription.value);
  }
  
  if (desc.length > 150) {
    desc = desc.substring(0, 147) + "...";
  }

  const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : "";
  const license = meta.LicenseShortName?.value || "";

  let attribution = "";
  if (artist) {
    attribution += `by ${artist}`;
  }
  if (license) {
    attribution += attribution ? ` [${license}]` : `[${license}]`;
  }

  if (desc && attribution) {
    return `${desc} (${attribution})`;
  } else if (desc) {
    return desc;
  } else if (attribution) {
    return attribution;
  }
  return fallback;
}

/**
 * Fetches the list of media files embedded in a Wikipedia article page using the REST API.
 * This filters out background templates, icons, and returns the exact content images/videos.
 */
async function getWikipediaPageMediaTitles(articleTitle) {
  const cleanTitle = encodeURIComponent(articleTitle.replace(/\s+/g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${cleanTitle}`;
  try {
    const response = await fetchWiki(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.items) return [];

    return data.items
      .filter(item => item.type === "image" || item.type === "video")
      .map(item => ({
        title: item.title,
        leadImage: !!item.leadImage
      }))
      .filter(item => isRelevantImageTitle(item.title));
  } catch (e) {
    console.warn(`Failed to fetch media-list for ${articleTitle}:`, e);
    return [];
  }
}

/**
 * Fetches full image info from Wikipedia/Commons for a list of file titles.
 * Queries en.wikipedia.org to allow local fair-use/historical files and Commons files.
 * @param {string[]} fileTitles - Array of "File:XYZ.jpg" titles
 * @param {Object} metadataMap - Optional metadata mapping (isLead, parentArticleTitle)
 * @returns {Promise<Array>} Resolved media objects
 */
async function resolveCommonsFileInfo(fileTitles, metadataMap = {}) {
  if (!fileTitles || fileTitles.length === 0) return [];

  // MediaWiki API accepts up to 50 titles in a single query
  const titlesParam = fileTitles.join("|");
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titlesParam)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280&iiextmetadatalanguage=en&format=json&origin=*`;

  try {
    const response = await fetchWiki(url);
    if (!response.ok) return [];
    const data = await response.json();
    const pages = data.query?.pages || {};

    const resolvedMap = {};

    Object.values(pages)
      .filter(page => page.imageinfo && page.imageinfo[0])
      .forEach(page => {
        const info = page.imageinfo[0];
        const mimeType = info.mime || "";
        const isVideo = mimeType.startsWith("video/") || 
                        page.title.toLowerCase().endsWith(".webm") || 
                        page.title.toLowerCase().endsWith(".ogv") || 
                        page.title.toLowerCase().endsWith(".mp4");

        // Skip non-image/non-video MIME types that slipped through
        if (!mimeType.startsWith("image/") && !isVideo) return;

        const previewUrl = isVideo ? info.url : (info.thumburl || info.url);
        const fileKey = page.title.toLowerCase().replace(/_/g, " ");

        // Look up metadata (leadImage, parentArticleTitle)
        const metaInfo = metadataMap[page.title] || 
                         metadataMap[Object.keys(metadataMap).find(k => k.toLowerCase().replace(/_/g, " ") === fileKey)] || 
                         {};

        resolvedMap[fileKey] = {
          id: `wiki-article-${page.pageid || Math.random().toString(36).substring(2, 9)}`,
          title: cleanFileTitle(page.title),
          description: getBetterDescription(info, isVideo ? "Wikimedia Commons Video" : "Wikimedia Commons Image"),
          thumbnail: info.thumburl || info.url,
          videoUrl: previewUrl,
          width: info.width || 800,
          height: info.height || 600,
          duration: isVideo ? 12 : 5,
          isVertical: (info.height > info.width),
          source: "Wikipedia",
          mime: mimeType,
          isVideo: isVideo,
          pageUrl: info.descriptionurl || info.descriptionshorturl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          artist: info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value) : "",
          license: info.extmetadata?.LicenseShortName?.value || "",
          isLeadImage: !!metaInfo.isLead
        };
      });

    // Re-sort resolved items to match the input fileTitles order (maintaining relevance)
    return fileTitles
      .map(title => resolvedMap[title.toLowerCase().replace(/_/g, " ")])
      .filter(Boolean);
  } catch (e) {
    console.warn("Failed to resolve Commons file info:", e);
    return [];
  }
}

/**
 * Searches Wikipedia and Wikimedia Commons for media files matching the query.
 * 
 * Wikipedia Layer:
 *   1. Search query for related articles (gets page titles and lead pageimages)
 *   2. Queries the page/media-list REST API for the top 3 articles
 *   3. Collects and resolves embedded content images/videos
 * 
 * Commons Layer:
 *   4. Wikimedia Commons file search (with pagination support)
 * 
 * @param {string} query - The search term.
 * @param {Object} [continueParams=null] - MediaWiki continuation parameter object.
 * @param {boolean} [returnFullResponse=false] - If true, returns { results, continueParams }.
 * @returns {Promise<Array|Object>} List of media objects or full response structure.
 */
export async function searchWikimediaCommons(query, continueParams = null, returnFullResponse = false) {
  if (!query || !query.trim()) {
    return returnFullResponse ? { results: [], continueParams: null } : [];
  }

  const cleanedQuery = cleanQuery(query);

  // ===== LAYER 1: Wikipedia Article Images (only on first page) =====
  let wikipediaResults = [];
  if (!continueParams) {
    // 1A: Search query for related articles (gets page titles, descriptions, and lead pageimages)
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanedQuery)}&gsrnamespace=0&gsrlimit=5&prop=pageimages|description&piprop=name|original|thumbnail&pithumbsize=1000&format=json&origin=*`;

    try {
      const searchRes = await fetchWiki(searchUrl).then(r => r.ok ? r.json() : null).catch(() => null);
      const searchPages = searchRes?.query?.pages || {};
      const searchPagesList = Object.values(searchPages).filter(p => p.pageid > 0);

      const fileTitlesToResolve = [];
      const parentArticleMap = {}; // fileTitle -> parentArticleTitle
      const fileMetadataMap = {}; // fileTitle -> { parentArticleTitle, isLead }
      const fallbackResultsMap = {}; // pageid -> fallback media object

      const isArticleMatch = (title) => {
        if (!title) return false;
        const t = title.toLowerCase();
        const q = cleanedQuery.toLowerCase();
        return t === q || (t.includes(q) && q.length > 2) || (q.includes(t) && t.length > 3);
      };

      // Pre-queue the primary pageimages of matching articles to guarantee they resolve with isLead

      searchPagesList.forEach((page) => {
        if (page.pageimage) {
          const fileTitle = "File:" + page.pageimage;
          if (!fileTitlesToResolve.includes(fileTitle)) {
            fileTitlesToResolve.push(fileTitle);
            parentArticleMap[fileTitle] = page.title;
            fileMetadataMap[fileTitle] = {
              parentArticleTitle: page.title,
              isLead: isArticleMatch(page.title)
            };
          }
        }

        // Prepare backup fallback objects in case the secondary fetches (REST API or resolution) fail
        const imgUrl = page.original?.source || page.thumbnail?.source;
        if (imgUrl) {
          fallbackResultsMap[page.pageid] = {
            id: `wikipedia-${page.pageid}`,
            title: page.title,
            description: page.description || "Wikipedia Article",
            thumbnail: page.thumbnail?.source || imgUrl,
            videoUrl: imgUrl,
            width: page.original?.width || page.thumbnail?.width || 800,
            height: page.original?.height || page.thumbnail?.height || 600,
            duration: 5,
            isVertical: ((page.original?.height || page.thumbnail?.height || 0) > (page.original?.width || page.thumbnail?.width || 0)),
            source: "Wikipedia",
            mime: "image/jpeg",
            isVideo: false,
            pageUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
            artist: "",
            license: "",
            isLeadImage: isArticleMatch(page.title)
          };
        }
      });

      // Try exact title match just in case it doesn't appear in the search results
      let exactPageTitle = null;
      const exactUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(cleanedQuery)}&redirects=1&format=json&origin=*`;
      const exactRes = await fetchWiki(exactUrl).then(r => r.ok ? r.json() : null).catch(() => null);
      const exactPages = exactRes?.query?.pages || {};
      const exactPage = Object.values(exactPages).find(p => p.pageid > 0);
      if (exactPage) {
        exactPageTitle = exactPage.title;
      }

      // Collect unique article titles to query media-list for
      const articleTitles = [];
      if (exactPageTitle) {
        articleTitles.push(exactPageTitle);
      }
      searchPagesList.forEach(p => {
        if (!articleTitles.includes(p.title)) {
          articleTitles.push(p.title);
        }
      });

      // Limit to top 3 articles to keep it super fast
      const targetArticles = articleTitles.slice(0, 3);

      // Fetch media-lists in parallel
      const mediaTitlePromises = targetArticles.map(title => getWikipediaPageMediaTitles(title));
      const mediaTitleLists = await Promise.all(mediaTitlePromises);

      // Flatten and gather all file titles
      targetArticles.forEach((articleTitle, idx) => {
        const fileList = mediaTitleLists[idx] || [];
        fileList.forEach((fileItem, fIdx) => {
          const title = fileItem.title;
          if (title && !fileTitlesToResolve.includes(title)) {
            fileTitlesToResolve.push(title);
            parentArticleMap[title] = articleTitle;
            fileMetadataMap[title] = {
              parentArticleTitle: articleTitle,
              isLead: isArticleMatch(articleTitle) && (fileItem.leadImage || (fIdx === 0 && idx === 0))
            };
          }
        });
      });

      // Deduplicate file titles
      const uniqueFileTitles = [...new Set(fileTitlesToResolve)];

      // Resolve info from Wikipedia API in batch (max 45 to be safe)
      if (uniqueFileTitles.length > 0) {
        const resolvedItems = await resolveCommonsFileInfo(uniqueFileTitles.slice(0, 45), fileMetadataMap);
        
        // Map resolved items to their parent article and set source to "Wikipedia"
        for (const item of resolvedItems) {
          const fileKey = Object.keys(parentArticleMap).find(
            k => k.toLowerCase().replace(/_/g, " ") === `file:${item.title.toLowerCase().replace(/_/g, " ")}` ||
                 k.toLowerCase() === `file:${item.title.toLowerCase()}`
          );
          const parentTitle = fileKey ? parentArticleMap[fileKey] : null;
          
          item.source = "Wikipedia";
          if (parentTitle) {
            item.description = `From Wikipedia: ${parentTitle} - ${item.description}`;
          } else {
            item.description = `From Wikipedia - ${item.description}`;
          }
          wikipediaResults.push(item);
        }
      }

      // Fallback: If no items resolved, use the pre-fetched pageimages directly with correct lead metadata
      if (wikipediaResults.length === 0) {
        wikipediaResults = Object.values(fallbackResultsMap);
      }
    } catch (wikiErr) {
      console.warn("Wikipedia query failed, falling back to pageimages or Commons:", wikiErr);
    }
  }

  // ===== LAYER 2: Wikimedia Commons File Search =====
  const commonsSearchQuery = cleanedQuery + ' filetype:bitmap|video';
  let url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(commonsSearchQuery)}&gsrnamespace=6&gsrlimit=50&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280&iiextmetadatalanguage=en&format=json&origin=*`;

  if (continueParams) {
    if (continueParams.continue) {
      url += `&continue=${encodeURIComponent(continueParams.continue)}`;
    }
    if (continueParams.gsroffset) {
      url += `&gsroffset=${continueParams.gsroffset}`;
    }
  }

  try {
    const response = await fetchWiki(url);
    if (!response.ok) {
      throw new Error(`Wikimedia Commons API returned status ${response.status}`);
    }

    const data = await response.json();
    const pages = data.query?.pages || {};
    const nextContinue = data.continue || null;

    const commonsResults = Object.values(pages).map(page => {
      const info = page.imageinfo?.[0] || {};
      const mimeType = info.mime || "";
      const isVideo = mimeType.startsWith("video/") || 
                      page.title.toLowerCase().endsWith(".webm") || 
                      page.title.toLowerCase().endsWith(".ogv") || 
                      page.title.toLowerCase().endsWith(".mp4");

      const previewUrl = isVideo ? info.url : (info.thumburl || info.url);

      return {
        id: `wikimedia-${page.pageid}`,
        title: cleanFileTitle(page.title),
        description: getBetterDescription(info, isVideo ? "Wikimedia Commons Video" : "Wikimedia Commons Image"),
        thumbnail: info.thumburl || info.url || "",
        videoUrl: previewUrl || null,
        width: info.width || 800,
        height: info.height || 600,
        duration: isVideo ? 12 : 5,
        isVertical: (info.height > info.width),
        source: "Wikimedia Commons",
        mime: mimeType,
        isVideo: isVideo,
        pageUrl: info.descriptionurl || info.descriptionshorturl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        artist: info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value) : "",
        license: info.extmetadata?.LicenseShortName?.value || ""
      };
    }).filter(item => item.videoUrl);

    // ===== MERGE & DEDUPLICATE =====
    const merged = [...wikipediaResults, ...commonsResults];
    const seenUrls = new Set();
    const finalResults = merged.filter(item => {
      if (!item.videoUrl) return false;
      const urlStr = item.videoUrl.toLowerCase();
      if (seenUrls.has(urlStr)) return false;
      seenUrls.add(urlStr);
      return true;
    });

    // Sort: Prioritize Wikipedia Lead Images first, then Wikimedia Commons results, then general Wikipedia results. Sort by resolution within groups.
    finalResults.sort((a, b) => {
      const aLead = a.isLeadImage ? 1 : 0;
      const bLead = b.isLeadImage ? 1 : 0;
      if (aLead !== bLead) return bLead - aLead;

      const aCommons = a.source === 'Wikimedia Commons' ? 1 : 0;
      const bCommons = b.source === 'Wikimedia Commons' ? 1 : 0;
      if (aCommons !== bCommons) return bCommons - aCommons;

      const aSize = (a.width || 0) * (a.height || 0);
      const bSize = (b.width || 0) * (b.height || 0);
      return bSize - aSize;
    });

    if (returnFullResponse) {
      return { results: finalResults, continueParams: nextContinue };
    }
    return finalResults;
  } catch (e) {
    console.error("Wikimedia Commons query failed:", e);
    
    // Fallback: return Wikipedia results if they succeeded
    if (!continueParams && wikipediaResults.length > 0) {
      const seenUrls = new Set();
      const uniqueWikiResults = wikipediaResults.filter(item => {
        if (!item.videoUrl) return false;
        const urlStr = item.videoUrl.toLowerCase();
        if (seenUrls.has(urlStr)) return false;
        seenUrls.add(urlStr);
        return true;
      });

      // Sort Wikipedia-only fallback results too
      uniqueWikiResults.sort((a, b) => {
        const aLead = a.isLeadImage ? 1 : 0;
        const bLead = b.isLeadImage ? 1 : 0;
        if (aLead !== bLead) return bLead - aLead;
        
        const aSize = (a.width || 0) * (a.height || 0);
        const bSize = (b.width || 0) * (b.height || 0);
        return bSize - aSize;
      });

      return returnFullResponse ? { results: uniqueWikiResults, continueParams: null } : uniqueWikiResults;
    }
    return returnFullResponse ? { results: [], continueParams: null } : [];
  }
}
