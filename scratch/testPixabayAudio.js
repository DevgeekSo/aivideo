const API_KEY = '10002679-c3e378b14b193cae3f94d7e1b';

async function testPixabayAudio() {
  // Test if they have an /api/music/ or similar endpoint
  const urls = [
    `https://pixabay.com/api/music/?key=${API_KEY}&q=lofi`,
    `https://pixabay.com/api/soundeffects/?key=${API_KEY}&q=swoosh`,
    `https://pixabay.com/api/audio/?key=${API_KEY}&q=lofi`,
    `https://pixabay.com/api/?key=${API_KEY}&q=lofi&media_type=music`,
    `https://pixabay.com/api/?key=${API_KEY}&q=lofi&media_type=audio`,
  ];

  for (const url of urls) {
    try {
      console.log(`Testing URL: ${url}`);
      const response = await fetch(url);
      console.log(`Status: ${response.status} (${response.statusText})`);
      if (response.ok) {
        const text = await response.text();
        console.log(`Success! Response snippet: ${text.slice(0, 200)}`);
      } else {
        const text = await response.text();
        console.log(`Failed. Body: ${text.slice(0, 100)}`);
      }
    } catch (e) {
      console.error(`Error for ${url}:`, e.message);
    }
    console.log('----------------------------------------');
  }
}

testPixabayAudio();
