const PEXELS_KEY = "";

async function testPexels() {
  const url = `https://api.pexels.com/videos/search?query=nature&per_page=3&orientation=portrait`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: PEXELS_KEY
      }
    });
    const data = await response.json();
    console.log("Pexels videos duration raw values:");
    if (data.videos) {
      data.videos.forEach(v => {
        console.log(`- Video ID: ${v.id}, Duration: ${v.duration} (type: ${typeof v.duration})`);
      });
    } else {
      console.log("No videos found", data);
    }
  } catch (e) {
    console.error("Pexels test error:", e);
  }
}

testPexels();
