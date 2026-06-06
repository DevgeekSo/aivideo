import { estimateSubtitleTimestamps } from '../src/utils/speechEngine.js';

const mockScenes = [
  { id: '1', text: "Hello this is a test of subtitle timings.", text2: "We want to make sure it works." },
  { id: '2', text: "This is the second scene of our video generator.", text2: "" },
  { id: '3', text: "And finally the third scene is here.", text2: "Thank you." }
];

const totalDuration = 10.5; // seconds

console.log("Estimating timings for totalDuration:", totalDuration);
const updated = estimateSubtitleTimestamps(mockScenes, totalDuration);

updated.forEach((scene, sIdx) => {
  console.log(`\nScene ${sIdx + 1}: start=${scene.start.toFixed(2)}, end=${scene.end.toFixed(2)}, duration=${scene.duration.toFixed(2)}`);
  console.log("Words:");
  scene.words.forEach((w, wIdx) => {
    console.log(`  [${wIdx}] ${w.raw}: start=${w.start.toFixed(2)}, end=${w.end.toFixed(2)}`);
  });
});

const calculatedTotal = updated.reduce((sum, s) => sum + s.duration, 0);
console.log(`\nTotal estimated duration: ${calculatedTotal.toFixed(2)}s (Expected: ${totalDuration}s)`);
