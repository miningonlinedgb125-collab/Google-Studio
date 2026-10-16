#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const runnerCode = fs.readFileSync(new URL("../scripts/noreen-kids-youtube-runner.mjs", import.meta.url), "utf8");

const isFemaleMatch = runnerCode.match(/function isFemaleCharacter[\s\S]*?\n\}/);
const prepareMatch = runnerCode.match(/function prepareTextForNaturalEgyptianTts[\s\S]*?\n\}/);
const normalizeMatch = runnerCode.match(/function normalizeEgyptianColloquial[\s\S]*?\n\}/);
const fushaPairsMatch = runnerCode.match(/const FUSHA_AND_GULF_TO_EGYPTIAN_PAIRS = [\s\S]*?\n\];/);

assert.ok(isFemaleMatch, "isFemaleCharacter exists in runner");
assert.ok(prepareMatch, "prepareTextForNaturalEgyptianTts exists in runner");

const testModuleCode = `
${fushaPairsMatch[0]}
${normalizeMatch[0]}
${isFemaleMatch[0]}
${prepareMatch[0]}

// Test 1: Female addressing female (Sidra & Butterfly)
const res1 = prepareTextForNaturalEgyptianTts("بص يا سدرة إنت شاطر يا بطل وشوف عملت إيه كده دلوقتي علشان أوي", "الفراشة الملونة", "سدرة الصغنونة");
assert.ok(res1.includes("بُصِّي يا سدرة"), "Should use بُصِّي for Sidra");
assert.ok(res1.includes("إِنتِي"), "Should use إِنتِي for Sidra");
assert.ok(res1.includes("يا بطلة"), "Should use يا بطلة for Sidra");
assert.ok(res1.includes("كِده"), "Should vocalize كِده");
assert.ok(res1.includes("دِلْوَأْتِي"), "Should vocalize دِلْوَأْتِي");
assert.ok(res1.includes("عَلَشَانْ") || res1.includes("عَشَانْ"), "Should vocalize علشان");
assert.ok(res1.includes("أَوِي"), "Should vocalize أوي");

// Test 2: Female addressing Butterfly
const res2 = prepareTextForNaturalEgyptianTts("تعال يا فراشة وشوف الفكرة دي وإنت يا فراشة شاطر", "سدرة الصغنونة", "الفراشة الملونة");
assert.ok(res2.includes("تَعَالِي يا فراشة"), "Should use تَعَالِي for Butterfly");
assert.ok(res2.includes("شُوفِي"), "Should use شُوفِي for Butterfly");
assert.ok(res2.includes("إِنتِي يا فراشة"), "Should use إِنتِي for Butterfly");
assert.ok(res2.includes("شاطرة") || res2.includes("شَاطْرَة"), "Should use شاطرة/شَاطْرَة for Butterfly");

// Test 3: Pure Egyptian preservation (no Fusha)
assert.ok(!res1.includes("هيا بنا"), "No Fusha هيا بنا");
assert.ok(!res1.includes("الآن"), "No Fusha الآن");
assert.ok(!res2.includes("انظري"), "No Fusha انظري");

console.log("PASS: gender-vocalization unit test (Sidra + Butterfly + Cairene dialect preservation)");
`;

eval(testModuleCode);
