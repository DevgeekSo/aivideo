

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
    scenes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          text: { type: "STRING", description: "The subtitle phrase chunk. Keep it natural and readable, letting the length be determined by the context." },
          searchKeyword: { type: "STRING", description: "A highly visual search keyword for stock videos, e.g. 'relaxing stream', 'coding code on screen'." },
          duration: { type: "NUMBER", description: "Duration in seconds, between 3.0 and 4.5 seconds for faceless, or matching conversation speed (approx 1.2 to 2 seconds for dialogue)." },
          speaker: { type: "STRING", enum: ["A", "B"], description: "For split-screen dialogue, specify who speaks. Otherwise use A." },
          isSentenceBreak: { type: "BOOLEAN", description: "True if this completes a sentence, used to trigger visual camera cuts or speech gaps." },
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
        required: ["id", "text", "searchKeyword", "duration", "speaker", "isSentenceBreak"]
      }
    }
  },
  required: ["videoProfile", "title", "voiceoverText", "scenes"]
};

const systemInstructions = `You are a professional short-form video AI engine. 
Based on the user prompt, write a highly engaging 9:16 vertical video script.
You must return a valid JSON object matching the requested schema.

CRITICAL RULES:
1. Subtitles ('scenes' array) should be split into natural, readable phrase blocks.
2. Select one of the 4 production archetypes (split-screen, faceless, guru, tweet-showcase).
3. If split-screen (Dialogue Layout), write it as a back-and-forth conversation between Speaker A and Speaker B. Make speaker A have upper viewport, B have lower viewport.
4. If faceless, each clip duration in the scenes should be between 3.0 and 4.5 seconds.
5. If tweet-showcase, include the cardContent for the social card, like handle "@username", name "Display Name", and body text.
6. Provide highly relevant stock footage keywords in 'searchKeyword' for Pexels search. Use simple concrete terms like 'laptop code', 'forest pan', 'neon city', 'business handshake' instead of abstract concepts.`;

const prompt = "A motivational short vertical video about why coding is the superpower of the 21st century.";
const groqKey = process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY_HERE";

const groqSystemInstructions = `${systemInstructions}
    
IMPORTANT: You must return ONLY valid JSON matching this schema:
${JSON.stringify(responseSchema, null, 2)}
Do not output any markdown formatting, backticks, or other text outside the JSON object.`;

async function test() {
    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                { role: "system", content: groqSystemInstructions },
                { role: "user", content: `User request: ${prompt}\n\nPlease generate the video layout and subtitle breakdown.` }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });
        const text = await response.text();
        console.log("Raw response:", text);
        const data = JSON.parse(text);
        const content = JSON.parse(data.choices[0].message.content);
        console.log("Parsed successful!");
        console.log(JSON.stringify(content, null, 2));
    } catch (e) {
        console.error("Error", e);
    }
}
test();
