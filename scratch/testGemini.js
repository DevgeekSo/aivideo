const apiKey = "";
const model = "gemini-2.0-flash";
const text = "Stock Integrations: Built editors for AI-prompt scripting (interfacing with Gemini API), Stock footage searches (Pexels / Pixabay API) featuring an Auto-Pick Engine, and a sequential speech synthesis stitcher (using Web Audio API). Canvas Stream Exporter (src/components/ExportPanel.jsx): Implemented a 100% white-label WebM/MP4 media compiler capturing visual transitions and ...";

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: text // Send the raw string directly!
  });

  const respText = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", respText);
}

run();
