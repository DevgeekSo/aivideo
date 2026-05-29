const email = "";
const apiKey = "";
const credentialString = `${email}:${apiKey}`;
const base64Credentials = Buffer.from(credentialString).toString('base64');

console.log("Stitching credentials...");
console.log("Raw credentials:", credentialString);
console.log("Base64 string:", base64Credentials);

async function testCredits() {
  try {
    const response = await fetch('https://api.d-id.com/credits', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${base64Credentials}`
      }
    });

    console.log("Response status:", response.status);
    if (response.ok) {
      const data = await response.json();
      console.log("Response body:", JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.log("Response error text:", text);
    }
  } catch (err) {
    console.error("Error calling D-ID API:", err);
  }
}

testCredits();
