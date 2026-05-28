export default async function handler(req, res) {
  // Safe parsing of query parameters (req.query can be empty depending on routing)
  let query = req.query || {};
  if (Object.keys(query).length === 0 && req.url && req.url.includes('?')) {
    const searchParams = new URLSearchParams(req.url.split('?')[1]);
    query = Object.fromEntries(searchParams.entries());
  }

  const queryString = new URLSearchParams(query).toString();
  const googleUrl = `https://translate.google.com/translate_tts?${queryString}`;

  try {
    const response = await fetch(googleUrl, {
      headers: {
        'Referer': 'https://translate.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).send(`Google TTS returned HTTP ${response.status}: ${errText.substring(0, 100)}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('audio')) {
      const text = await response.text();
      return res.status(400).send(`Google TTS returned non-audio response (${contentType}): ${text.substring(0, 150)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set appropriate headers and return the audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=86400'); // Cache for 24 hours to reduce API calls
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
