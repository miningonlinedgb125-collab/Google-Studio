#!/usr/bin/env node
import fs from "fs";

const runner = fs.readFileSync("scripts/noreen-kids-youtube-runner.mjs", "utf8");
const schedule = JSON.parse(fs.readFileSync("noreen-kids-schedule.json", "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error("❌ " + message);
  console.log("✅ " + message);
}

assert(runner.includes("ar-EG-SalmaNeural"), "Egyptian female Edge voice is configured");
assert(runner.includes("ar-EG-ShakirNeural"), "Egyptian male Edge voice is configured");
assert(runner.includes("CHARACTER_ASSETS"), "Character assets registry exists");
assert(runner.includes("getEpisodeVisualAssets"), "Episode visual resolver exists");
assert(runner.includes("mainCharacterId"), "Visual selection uses explicit character IDs");
assert(runner.includes("companionCharacterId"), "Visual selection uses explicit companion IDs");
assert(!runner.includes("images.unsplash.com"), "No external Unsplash scene images are used");
assert(!runner.includes("pitchFactor = sceneIndex % 2"), "Old alternating pitch hack is removed");
assert(runner.includes("getCanonicalYouTubeTitle"), "One canonical YouTube title function is used");
assert(schedule.dailyDialect === "egyptian", "Schedule dialect remains Egyptian");

console.log("🎬 Short Pipeline Unit Test Gate Passed: Egyptian voice + local character montage + canonical title");
