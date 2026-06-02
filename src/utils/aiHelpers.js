/**
 * AI script writing and keyword extraction module.
 * Integrates with the Gemini API or runs locally in sandbox mode.
 */

// Schema definition for the Gemini response
const responseSchema = {
  type: "OBJECT",
  properties: {
    videoProfile: {
      type: "STRING",
      enum: ["split-screen", "faceless", "guru", "tweet-showcase"],
      description: "The visual style profile that best fits this content."
    },
    title: { type: "STRING" },
    voiceoverText: { type: "STRING", description: "The complete read-aloud voiceover script." },
    bgmSearchQuery: {
      type: "STRING",
      description: "Search keyword/genre query for background music (BGM), e.g. 'lofi hip hop beat', 'ambient space piano', 'cinematic strings suspense'."
    },
    scenes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          text: { type: "STRING", description: "The subtitle phrase chunk. Keep it natural and readable, letting the length be determined by the context." },
          text2: { type: "STRING", description: "Optional second subtitle phrase chunk to display consecutively in the same video clip." },
          searchKeyword: { type: "STRING", description: "A highly visual search keyword for stock videos, e.g. 'relaxing stream', 'coding code on screen'." },
          videoSource: {
            type: "STRING",
            enum: ["pexels", "ai-video", "ai-image"],
            description: "Specify whether to fetch this scene's background from stock (pexels), generate it with AI Video (ai-video), or generate it with AI Image (ai-image). Choose 'ai-image' only if the scene represents a still concept, illustration, graphic, diagram, emblem, logo, or specific visual that works better as a high-quality still image instead of a moving video. Choose 'ai-video' for moving custom scenes."
          },
          promptForAiVideo: {
            type: "STRING",
            description: "If videoSource is 'ai-video', write a highly descriptive visual prompt for the AI video generator, e.g. 'A futuristic 3D keyboard hovering in space with neon electric currents discharging from keys, cinematic lighting, 8k'. If videoSource is not 'ai-video', keep this empty."
          },
          promptForAiImage: {
            type: "STRING",
            description: "If videoSource is 'ai-image', write a highly descriptive visual prompt for the AI image generator, e.g. 'A futuristic 3D keyboard hovering in space with neon electric currents, digital art, high detail, 8k'. If videoSource is not 'ai-image', keep this empty."
          },
          sfxSearchQuery: {
            type: "STRING",
            description: "Optional sound effect search query to trigger at the start of this scene, e.g. 'whoosh transition', 'camera click', 'mouse click', 'glass shatter'. Keep it empty if no sound effect is needed."
          },
          duration: { type: "NUMBER", description: "Duration in seconds, between 3.0 and 4.5 seconds for faceless, or matching conversation speed (approx 1.2 to 2 seconds for dialogue)." },
          speaker: { type: "STRING", enum: ["A", "B"], description: "For split-screen dialogue, specify who speaks. Otherwise use A." },
          isSentenceBreak: { type: "BOOLEAN", description: "True if this completes a sentence, used to trigger visual camera cuts or speech gaps." },
          transition: {
            type: "STRING",
            enum: ["none", "cross-dissolve", "slide-left", "slide-right", "slide-up", "zoom-fade", "wipe-left", "wipe-right"],
            description: "The transition effect to enter this scene. Default to 'none' or use creative transitions like 'cross-dissolve', 'slide-left', 'zoom-fade'."
          },
          cardContent: {
            type: "OBJECT",
            properties: {
              handle: { type: "STRING" },
              name: { type: "STRING" },
              body: { type: "STRING" }
            },
            description: "Required if videoProfile is tweet-showcase. The contents of the social media card."
          }
        },
        required: ["id", "text", "searchKeyword", "videoSource", "duration", "speaker", "isSentenceBreak", "transition"]
      }
    }
  },
  required: ["videoProfile", "title", "voiceoverText", "bgmSearchQuery", "scenes"]
};

/**
 * Calls Gemini, Claude, or Groq API to generate the video script structure.
 * @param {string} prompt - User input prompt
 * @param {string} apiKey - Optional API key for the chosen provider
 * @param {string} targetDuration - Target duration instructions
 * @param {string} provider - Selected AI service provider ('gemini' | 'anthropic' | 'groq' | 'offline')
 * @returns {Promise<Object>} Structured script object
 */
export async function generateVideoScript(prompt, apiKey = '', targetDuration = 'auto', provider = 'gemini') {
  if (provider === 'offline' || !apiKey) {
    console.log("Offline mode selected or no API key provided. Using Offline Sandbox Generator.");
    return generateOfflineScript(prompt, targetDuration);
  }

  let durationInstructions = "";
  if (targetDuration && targetDuration !== 'auto') {
    const sec = parseFloat(targetDuration);
    const wordsCount = Math.round(sec * 2.3); // average speaking rate of 2.3 words/sec
    durationInstructions = `\n7. The generated video must have a total duration of EXACTLY or very close to ${sec} seconds.
Your voiceoverText script MUST contain approximately ${wordsCount} words in total.
The sum of the 'duration' values of all scenes in your 'scenes' array MUST equal exactly or very close to ${sec} seconds.
Each scene MUST have a duration of 1.5 to 3.0 seconds at max (average 2.2 seconds). To achieve ${sec} seconds, you will need to generate around ${Math.round(sec / 2.2)} scenes in your 'scenes' array (e.g. if target is 45s, generate ~20 scenes; if 60s, generate ~27 scenes).`;
  } else {
    durationInstructions = `\n7. Default duration is approximately 30 seconds. Each scene 'duration' must be between 1.5 and 3.0 seconds, summing up to the overall video duration.`;
  }

  const systemInstructions = `You are a professional short-form video AI engine. 
Based on the user prompt, write a highly engaging 9:16 vertical video script.
You must return a valid JSON object matching the requested schema.

CRITICAL RULES:
1. Subtitles ('scenes' array) should be split into natural, readable phrase blocks. You can provide 'text' (first subtitle) and optionally 'text2' (second subtitle) in the same scene to show them consecutively in the same video clip. This is useful for keeping the same background clip active for a longer duration.
2. Select one of the 4 production archetypes (split-screen, faceless, guru, tweet-showcase).
3. If split-screen (Dialogue Layout), write it as a back-and-forth conversation between Speaker A and Speaker B. Make speaker A have upper viewport, B have lower viewport.
4. If faceless, each clip duration in the scenes should be between 1.5 and 3.0 seconds (3.0 seconds max).
5. If tweet-showcase, include the cardContent for the social card, like handle "@username", name "Display Name", and body text.
6. Provide highly relevant stock footage keywords in 'searchKeyword' for Pexels search. Use simple concrete terms like 'laptop code', 'forest pan', 'neon city', 'business handshake' instead of abstract concepts.${durationInstructions}
7. Assign a transition effect to scenes ('transition' property). Use 'none' (Cut) as default, but use 'cross-dissolve', 'slide-left', or 'zoom-fade' occasionally to make transitions dynamic.
8. Specify a relevant search query for background music in 'bgmSearchQuery' to match the theme of the video.
9. If appropriate, specify relevant sound effect queries (e.g. 'whoosh', 'bell ring', 'mouse click') for specific scenes in 'sfxSearchQuery' to highlight camera cuts, transitions, or text pop-ups.
10. Classify each scene's 'videoSource' as 'pexels', 'ai-video', or 'ai-image'. Choose 'ai-image' only when a still conceptual visual, diagram, emblem, logo, or high-detail illustration makes more sense or works better than a moving video background (e.g. 'a glowing key floating in blue cybernetic code', 'an emblem depicting an absolute zero icon'). If using 'ai-image', supply a detailed text-to-image prompt in 'promptForAiImage'. Choose 'ai-video' for custom action scenes, and 'pexels' for standard realistic B-roll (typing on laptop, walking down a street).`;

  const callModel = async (modelName) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `User request: ${prompt}\n\nPlease generate the video layout and subtitle breakdown.`
          }]
        }],
        systemInstruction: {
          parts: [{
            text: systemInstructions
          }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    return JSON.parse(resultText);
  };

  const callGroqFallback = async (groqKey) => {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    
    // Add strict JSON formatting instructions for Groq
    const groqSystemInstructions = `${systemInstructions}
    
IMPORTANT: You must return ONLY valid JSON matching this schema:
${JSON.stringify(responseSchema, null, 2)}
Do not output any markdown formatting, backticks, or other text outside the JSON object.`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // High-quality Llama 3 model
        messages: [
          { role: "system", content: groqSystemInstructions },
          { role: "user", content: `User request: ${prompt}\n\nPlease generate the video layout and subtitle breakdown.` }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  };

  const callClaudeModel = async (claudeKey) => {
    const url = "/api/anthropic/v1/messages";
    const claudeSystemInstructions = `${systemInstructions}
    
IMPORTANT: You must return ONLY valid JSON matching this schema:
${JSON.stringify(responseSchema, null, 2)}
Do not output any markdown formatting, backticks, or other text outside the JSON object. The response must start with '{' and end with '}'.`;

    const tryModel = async (modelName) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": claudeKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 4000,
          temperature: 0.7,
          system: claudeSystemInstructions,
          messages: [
            { role: "user", content: `User request: ${prompt}\n\nPlease generate the video layout and subtitle breakdown.` }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError = {};
        try {
          parsedError = JSON.parse(errorText);
        } catch(e) {}
        
        if (response.status === 404 || parsedError.error?.type === "not_found_error") {
          throw new Error(`MODEL_NOT_FOUND: ${modelName}`);
        }
        throw new Error(`Claude API returned status ${response.status}: ${errorText}`);
      }

      return await response.json();
    };

    const modelCandidates = [
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "claude-3-7-sonnet-latest",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet-latest",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-5-haiku-latest",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-latest",
      "claude-3-opus-20240229"
    ];

    let data = null;
    let lastError = null;

    for (const modelName of modelCandidates) {
      try {
        console.log(`Trying Anthropic model: ${modelName}...`);
        data = await tryModel(modelName);
        console.log(`Successfully generated using: ${modelName}`);
        break; // Success!
      } catch (err) {
        lastError = err;
        if (err.message && err.message.startsWith("MODEL_NOT_FOUND")) {
          console.warn(`Model not found: ${modelName}. Trying next candidate...`);
          continue;
        }
        // If it is another type of error (auth, rate limits, bad payload), throw it immediately
        throw err;
      }
    }

    if (!data) {
      throw lastError || new Error("All Anthropic Claude model candidates failed to load.");
    }

    let resultText = data.content[0].text.trim();
    
    // Strip markdown formatting if Claude wrapped it in ```json ... ```
    if (resultText.startsWith("```json")) {
      resultText = resultText.substring(7);
    } else if (resultText.startsWith("```")) {
      resultText = resultText.substring(3);
    }
    if (resultText.endsWith("```")) {
      resultText = resultText.substring(0, resultText.length - 3);
    }
    resultText = resultText.trim();
    
    return JSON.parse(resultText);
  };

  if (provider === 'anthropic') {
    try {
      console.log("Attempting Anthropic Claude API generation with claude-3-5-sonnet...");
      return await callClaudeModel(apiKey);
    } catch (error) {
      console.error("Claude generation failed:", error);
      throw error;
    }
  }

  if (provider === 'groq') {
    try {
      console.log("Attempting Groq API generation...");
      return await callGroqFallback(apiKey);
    } catch (error) {
      console.error("Groq generation failed:", error);
      throw error;
    }
  }

  // Default to Gemini (with fallback)
  try {
    console.log("Attempting Gemini API generation with gemini-2.5-flash...");
    return await callModel("gemini-2.5-flash");
  } catch (error) {
    console.warn("gemini-2.5-flash failed or busy. Retrying with gemini-1.5-flash...", error);
    try {
      return await callModel("gemini-1.5-flash");
    } catch (fallbackError) {
      console.warn("Gemini API Error (both models failed). Attempting Groq fallback...");
      try {
        const groqKey = import.meta.env.VITE_GROQ_API_KEY || "YOUR_GROQ_API_KEY_HERE";
        return await callGroqFallback(groqKey);
      } catch (groqError) {
        console.error("All AI APIs failed (Gemini & Groq), falling back to Offline Generator:", groqError);
        return generateOfflineScript(prompt, targetDuration);
      }
    }
  }
}

/**
 * Fallback offline generator for sandbox testing.
 */
function generateOfflineScript(prompt, targetDuration) {
  const p = prompt.toLowerCase();
  let script;
  
  // Rule-based selector to match templates
  if (p.includes('tweet') || p.includes('post') || p.includes('showcase') || p.includes('slide')) {
    script = getTweetTemplate(prompt);
  } else if (p.includes('dialogue') || p.includes('podcast') || p.includes('split') || p.includes('avatar') || p.includes('conversation')) {
    script = getDialogueTemplate(prompt);
  } else if (p.includes('guru') || p.includes('talking') || p.includes('monologue') || p.includes('tip')) {
    script = getGuruTemplate(prompt);
  } else {
    // Default to Faceless Atmospheric
    script = getFacelessTemplate(prompt);
  }

  return adjustOfflineScriptToDuration(script, targetDuration);
}

function adjustOfflineScriptToDuration(script, targetDuration) {
  if (!targetDuration || targetDuration === 'auto') return script;
  const targetSec = parseFloat(targetDuration);
  const currentSec = script.scenes.reduce((sum, s) => sum + s.duration, 0);
  
  if (Math.abs(currentSec - targetSec) < 0.5) return script;
  
  let newScenes = [];
  let elapsed = 0;
  let idx = 0;
  
  while (elapsed < targetSec) {
    const originalScene = script.scenes[idx % script.scenes.length];
    const duration = originalScene.duration;
    const sceneDuration = (elapsed + duration > targetSec) ? (targetSec - elapsed) : duration;
    
    // If the remaining time is too tiny, append it to the last scene
    if (sceneDuration < 1.0 && newScenes.length > 0) {
      newScenes[newScenes.length - 1].duration += sceneDuration;
      break;
    }
    
    newScenes.push({
      ...originalScene,
      id: `${originalScene.id}-dup-${newScenes.length}`,
      text: originalScene.text + (idx >= script.scenes.length ? ` (${Math.floor(idx / script.scenes.length) + 1})` : ""),
      duration: sceneDuration
    });
    
    elapsed += sceneDuration;
    idx++;
  }
  
  script.scenes = newScenes;
  script.voiceoverText = newScenes.map(s => s.text).join(" ");
  return script;
}

function getFacelessTemplate(userPrompt) {
  return {
    videoProfile: "faceless",
    title: "Offline Faceless Script",
    bgmSearchQuery: "cyberpunk electronic",
    voiceoverText: "Automated video creation is here. Changing everything. You type a prompt. The AI extracts keywords. Stock clips load instantly. Your video is ready.",
    scenes: [
      { id: "f1", text: "Automated video", text2: "creation is here.", searchKeyword: "cyberpunk coding", duration: 2.5, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "f2", text: "Changing", text2: "everything.", searchKeyword: "laptop matrix", duration: 2.8, speaker: "A", isSentenceBreak: false, transition: "cross-dissolve", videoSource: "pexels", promptForAiVideo: "" },
      { id: "f3", text: "You type", text2: "a prompt.", searchKeyword: "hands typing keyboard", sfxSearchQuery: "keyboard typing", duration: 2.5, speaker: "A", isSentenceBreak: false, transition: "slide-left", videoSource: "pexels", promptForAiVideo: "" },
      { id: "f4", text: "The AI", text2: "extracts keywords.", searchKeyword: "futuristic tech", duration: 2.8, speaker: "A", isSentenceBreak: false, transition: "wipe-right", videoSource: "pexels", promptForAiVideo: "" },
      { id: "f5", text: "Stock clips", text2: "load instantly.", searchKeyword: "loading bar glow", sfxSearchQuery: "whoosh transition", duration: 3.0, speaker: "A", isSentenceBreak: true, transition: "zoom-fade", videoSource: "ai-video", promptForAiVideo: "A glowing futuristic 3D loading bar with neon blue particles flying around in slow motion, cinematic 8k" },
      { id: "f6", text: "Your video", text2: "is ready.", searchKeyword: "sunset drones", duration: 3.0, speaker: "A", isSentenceBreak: true, transition: "cross-dissolve", videoSource: "pexels", promptForAiVideo: "" }
    ]
  };
}

function getDialogueTemplate(userPrompt) {
  return {
    videoProfile: "split-screen",
    title: "Offline Split Dialogue",
    bgmSearchQuery: "smooth jazz lofi",
    voiceoverText: "Hey did you see the new AI video tool? No what is it? It writes engaging scripts, searches stock clips fast, and makes vertical videos. That sounds crazy wild, let me try it!",
    scenes: [
      { id: "d1", text: "Hey did you", text2: "see the", searchKeyword: "man smiling", duration: 1.5, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d2", text: "new AI", text2: "video tool?", searchKeyword: "man talking portrait", sfxSearchQuery: "pop", duration: 1.8, speaker: "A", isSentenceBreak: true, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d3", text: "No, what", text2: "is it?", searchKeyword: "woman curious", duration: 1.2, speaker: "B", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d4", text: "It writes", text2: "engaging scripts,", searchKeyword: "man explaining", duration: 1.6, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d5", text: "searches stock", text2: "clips fast,", searchKeyword: "man smiling portrait", sfxSearchQuery: "whoosh", duration: 1.8, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d6", text: "and makes", text2: "vertical videos.", searchKeyword: "man talking", duration: 1.6, speaker: "A", isSentenceBreak: true, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d7", text: "That sounds", text2: "crazy wild,", searchKeyword: "woman smiling", duration: 1.5, speaker: "B", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "d8", text: "let me", text2: "try it!", searchKeyword: "woman excited portrait", sfxSearchQuery: "bell ring", duration: 1.8, speaker: "B", isSentenceBreak: true, transition: "none", videoSource: "ai-video", promptForAiVideo: "A developer screen with neon sparks flying out as clean code compiles successfully, cinematic, high detail" }
    ]
  };
}

function getGuruTemplate(userPrompt) {
  return {
    videoProfile: "guru",
    title: "Offline Guru Advice",
    bgmSearchQuery: "inspiring motivational ambient",
    voiceoverText: "Here is the best advice for engineers. Focus on building real products. Don't get stuck in tutorial hell. Build projects people use, and publish code.",
    scenes: [
      { id: "g1", text: "Here is the", text2: "best advice", searchKeyword: "developer portrait", duration: 1.4, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "g2", text: "for engineers.", text2: "Focus on", searchKeyword: "programmer speaking", sfxSearchQuery: "whoosh", duration: 1.8, speaker: "A", isSentenceBreak: true, transition: "cross-dissolve", videoSource: "pexels", promptForAiVideo: "" },
      { id: "g3", text: "building real", text2: "products.", searchKeyword: "office desk laptop", duration: 1.6, speaker: "A", isSentenceBreak: true, transition: "zoom-fade", videoSource: "pexels", promptForAiVideo: "" },
      { id: "g4", text: "Don't get stuck", text2: "in tutorial hell.", searchKeyword: "stressed developer", sfxSearchQuery: "camera click", duration: 1.5, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "ai-video", promptForAiVideo: "A computer monitor turning into a giant fiery vortex sucking in books and code blocks, surreal 3D animation" },
      { id: "g5", text: "Build projects", text2: "people use,", searchKeyword: "happy coder", duration: 1.5, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "" },
      { id: "g6", text: "and publish code.", text2: "Good luck!", searchKeyword: "github page glow", sfxSearchQuery: "bell ring", duration: 2.0, speaker: "A", isSentenceBreak: true, transition: "cross-dissolve", videoSource: "pexels", promptForAiVideo: "" }
    ]
  };
}

function getTweetTemplate(userPrompt) {
  return {
    videoProfile: "tweet-showcase",
    title: "Offline Tweet Showcase",
    bgmSearchQuery: "retro synthwave",
    voiceoverText: "I have a confession. I spent three hours debugging today. The issue? A single misplaced semicolon. Software engineering is eighty percent debugging and twenty percent writing bugs.",
    scenes: [
      { 
        id: "t1", text: "I have a", text2: "confession.", searchKeyword: "abstract liquid motion", sfxSearchQuery: "mouse click", duration: 2.0, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "",
        cardContent: { handle: "@programmer_life", name: "Dev Confessions", body: "I spent 3 hours debugging today. The issue? A single misplaced semicolon." }
      },
      { 
        id: "t2", text: "I spent", text2: "three hours", searchKeyword: "colorful energy lines", duration: 1.8, speaker: "A", isSentenceBreak: false, transition: "none", videoSource: "pexels", promptForAiVideo: "",
        cardContent: { handle: "@programmer_life", name: "Dev Confessions", body: "The issue? A single misplaced semicolon." }
      },
      { 
        id: "t3", text: "debugging today.", text2: "The issue?", searchKeyword: "colorful energy lines", sfxSearchQuery: "whoosh", duration: 2.1, speaker: "A", isSentenceBreak: true, transition: "zoom-fade", videoSource: "pexels", promptForAiVideo: "",
        cardContent: { handle: "@programmer_life", name: "Dev Confessions", body: "The issue? A single misplaced semicolon." }
      },
      { 
        id: "t4", text: "A single", text2: "misplaced semicolon.", searchKeyword: "digital background grid", sfxSearchQuery: "error beep", duration: 2.2, speaker: "A", isSentenceBreak: true, transition: "slide-left", videoSource: "ai-video", promptForAiVideo: "A giant metallic 3D semicolon glowing red in a dark void, with binary code raining down around it",
        cardContent: { handle: "@programmer_life", name: "Dev Confessions", body: "Software engineering is 80% debugging and 20% writing bugs." }
      }
    ]
  };
}
