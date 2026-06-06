import { searchWikimediaCommons } from '../src/utils/wikimediaApi.js';

async function test() {
  const query = "Albert Einstein";
  console.log("Searching for:", query);
  try {
    const results = await searchWikimediaCommons(query);
    console.log(`Found ${results.length} results.`);
    results.slice(0, 5).forEach((item, idx) => {
      console.log(`[${idx}] Source: ${item.source}, Title: ${item.title}, LeadImage: ${item.isLeadImage}, Vertical: ${item.isVertical}, Size: ${item.width}x${item.height}`);
    });
  } catch (err) {
    console.error(err);
  }
}

test();
