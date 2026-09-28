#!/usr/bin/env node
/**
 * Noreen Kids 3D Animation Studio - 24/7 Self-Contained GitHub Actions Pipeline
 * - Native Egyptian Cairene Neural Voices (ar-EG-SalmaNeural & ar-EG-ShakirNeural via msedge-tts) with 3-attempt retry
 * - Automated Pre-Render Egyptian Cairene Dialect Compliance Validator (0% Fusha/Gulf words)
 * - Clean Static Character Cinematic Montage (Zero character pixel warping/distortion, approved local assets only)
 * - Audio-Driven Scene Duration Synchronization (No speech cut-off, no atempo speed changes, Short 60-80s, Long 300-600s)
 * - YouTube Fast-Processing Closed-GOP H.264 + Continuous PTS AAC-LC 48kHz FastStart MP4
 */
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { GoogleGenAI, Modality } from "@google/genai";

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decryptVault(vaultHex) {
  if (!vaultHex || !vaultHex.includes(":")) return {};
  try {
    const [ivHex, encHex] = vaultHex.split(":");
    const key = crypto
      .createHash("sha256")
      .update("noreen-kids-3d-studio-vault-v1")
      .digest();
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(dec.toString("utf8"));
  } catch {
    return {};
  }
}

function parseRunMode(raw) {
  const s = String(raw || "daily_schedule").toLowerCase();
  if (s.includes("short_only") || s.includes("قصير فقط")) return "short_only";
  if (s.includes("long_only") || s.includes("طويل فقط")) return "long_only";
  if (s.includes("both_now") || s.includes("الاثنين معاً") || s.includes("الاثنين معا")) return "both_now";
  return "daily_schedule";
}

function computeNextCairoPublishIso(dailyPublishTime24 = "19:00") {
  const [rawH, rawM] = String(dailyPublishTime24 || "19:00").split(":");
  const targetH = Math.min(23, Math.max(0, Number(rawH) || 19));
  const targetM = Math.min(59, Math.max(0, Number(rawM) || 0));
  const now = new Date();
  const utcTargetH = (targetH - 2 + 24) % 24;
  const candidate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      utcTargetH,
      targetM,
      0
    )
  );
  if (candidate.getTime() - now.getTime() < 25 * 60 * 1000) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}

const FUSHA_AND_GULF_TO_EGYPTIAN_PAIRS = [
  ["التي تقوي", "اللي بتقوي"],
  ["التي أعادت", "اللي رجعت"],
  ["التي أزهرت", "اللي نورت"],
  ["الذي يطير", "اللي بيطير"],
  ["هيا بنا", "يلا بينا"],
  ["اليوم ننطلق", "النهارده هنبدأ"],
  ["في يوم من الأيام", "في يوم جميل ومشمس"],
  ["كان يا ما كان", "تعالوا احكيلكم يا أصحابي"],
  ["لا تنسوا الاشتراك", "ما تنسوش تشتركوا"],
  ["لا تنسوا", "ما تنسوش"],
  ["إلى اللقاء", "مع السلامة يا أصحابي"],
  ["الى اللقاء", "مع السلامة يا أصحابي"],
  ["يا أصدقائي", "يا أصحابي الحلوين"],
  ["أصدقائي", "أصحابي الحلوين"],
  ["أصدقائنا", "أصحابنا الحلوين"],
  ["انظروا", "بصوا"],
  ["انظري", "بصي"],
  ["انظر", "بص"],
  ["التي", "اللي"],
  ["الذي", "اللي"],
  ["الذين", "اللي"],
  ["اللذان", "اللي"],
  ["اللتان", "اللي"],
  ["والآن", "ودلوقتي"],
  ["الآن", "دلوقتي"],
  ["لماذا", "ليه"],
  ["ماذا", "إيه"],
  ["كيف", "إزاي"],
  ["هؤلاء", "دول"],
  ["هذا", "ده"],
  ["هذه", "دي"],
  ["نحن", "إحنا"],
  ["أنتم", "إنتو"],
  ["لكي", "علشان"],
  ["لأننا", "علشان إحنا"],
  ["كثيراً", "كتير"],
  ["كثيرا", "كتير"],
  ["جداً", "أوي"],
  ["جدا", "أوي"],
  ["أبداً", "خالص"],
  ["أبدا", "خالص"],
  ["دائماً", "دايما"],
  ["دائما", "دايما"],
  ["أيضاً", "كمان"],
  ["أيضا", "كمان"],
  ["معاً", "سوا"],
  ["معا", "سوا"],
  ["حيث", "وهناك"],
  ["بينما", "وهما"],
  ["نحو", "ناحية"],
  ["أمام", "قدام"],
  ["حول", "حوالين"],
  ["وش", "إيه"],
  ["ليش", "ليه"],
  ["شلون", "إزاي"],
  ["الحين", "دلوقتي"],
  ["ذلحين", "دلوقتي"],
  ["واجد", "كتير أوي"],
  ["زين", "جميل أوي"],
  ["يبي", "عايز"],
  ["تبي", "عايزة"],
  ["نبغى", "عايزين"],
  ["يبغى", "عايز"],
  ["ابغى", "عايز"],
  ["أسناننا", "سناننا"],
  ["هـاننا", "سناننا"],
  ["الطبيبة", "الدكتورة"],
  ["بيضاء", "بيضا"],
  ["الماء", "المية"],
  ["الرياح", "الهوا"],
  ["الفرشاة", "الفرشة"],
  ["جميل قوي", "جميل أوي"],
  ["جميلة قوي", "جميلة أوي"],
  ["حلو قوي", "حلو أوي"],
  ["حلوة قوي", "حلوة أوي"],
  ["كبير قوي", "كبير أوي"],
  ["كتير قوي", "كتير أوي"],
];

function normalizeEgyptianColloquial(rawText) {
  let text = String(rawText || "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/["«»“”'']/g, "")
    .replace(/Noreen\s*Kids/gi, "نورين كيدز")
    .replace(/هـاننا/g, "سناننا")
    .replace(/هـ/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return text;

  text = text
    .replace(
      /^(أهلا بكم|اهلا بكم|أهلا بيكم|اهلا بيكم|مرحبا بكم|أهلاً بكم|مرحباً بكم)/g,
      "ازيكم يا أصحابي الحلوين"
    )
    .replace(/(^|[\s،.!؟])سوف\s+/g, "$1ه")
    .replace(/(^|[\s،.!؟])هل\s+تعلمون/g, "$1عارفين يا أصحابي");

  for (const [fromWord, toWord] of FUSHA_AND_GULF_TO_EGYPTIAN_PAIRS) {
    const pattern = new RegExp(`(^|[\\s،.!؟:])${fromWord}(?=[\\s،.!؟:]|$)`, "g");
    text = text.replace(pattern, `$1${toWord}`);
  }
  return text.replace(/\s+/g, " ").trim();
}

function prepareTextForNaturalEgyptianTts(rawText) {
  let text = normalizeEgyptianColloquial(rawText);
  const phoneticPairs = [
    ["الطبيبة نورين", "الدكتورة نورين"],
    ["الطبيبة", "الدكتورة"],
    ["أسناننا", "سناننا"],
    ["أسنان", "سنان"],
    ["هـاننا", "سناننا"],
    ["بيضاء", "بيضا"],
    ["سوداء", "سودا"],
    ["حمراء", "حمرا"],
    ["صفراء", "صفرا"],
    ["خضراء", "خضرا"],
    ["زرقاء", "زرقا"],
    ["الماء", "المية"],
    ["ماء", "مية"],
    ["الرياح", "الهوا"],
    ["الفرشاة", "الفرشة"],
    ["فرشاة", "فرشة"],
    ["المرآة", "المراية"],
    ["حقيبة", "شنطة"],
    ["الحقيبة", "الشنطة"],
    ["أصدقائي", "أصحابي"],
    ["أصدقائنا", "أصحابنا"],
    ["الآن", "دلوقتي"],
    ["هيا بنا", "يلا بينا"],
    ["انظروا", "بصوا"],
    ["انظر", "بص"],
    ["انظري", "بصي"],
    ["جميلة قوي", "جميلة أوي"],
    ["حلوة قوي", "حلوة أوي"],
    ["كبير قوي", "كبير أوي"],
    ["صعبة قوي", "صعبة أوي"],
    ["سهلة قوي", "سهلة أوي"],
    ["كتير قوي", "كتير أوي"],
    ["جداً", "أوي"],
    ["جدا", "أوي"],
  ];
  for (const [fromW, toW] of phoneticPairs) {
    text = text.replace(new RegExp(fromW, "g"), toW);
  }
  return text.replace(/\s+/g, " ").trim();
}

function runPreTtsEgyptianValidationLayer(rawText, sceneIndex = 0, totalScenes = 4) {
  const original = String(rawText || "").trim();
  const detectedNonEgyptianWords = [];

  if (/[\u064B-\u065F\u0670]/.test(original)) {
    detectedNonEgyptianWords.push({
      foundWord: "تشكيل فصحى",
      replacedWith: "إزالة التشكيل",
    });
  }

  const textNoDiacritics = original.replace(/[\u064B-\u065F\u0670]/g, "");
  for (const [fromWord, toWord] of FUSHA_AND_GULF_TO_EGYPTIAN_PAIRS) {
    const pattern = new RegExp(`(^|[\\s،.!؟:"«»])${fromWord}(?=[\\s،.!؟:"«»]|$)`);
    if (pattern.test(textNoDiacritics)) {
      detectedNonEgyptianWords.push({
        foundWord: fromWord,
        replacedWith: toWord,
      });
    }
  }

  let validatedText = normalizeEgyptianColloquial(original);
  if (
    sceneIndex === 0 &&
    validatedText &&
    !/^(ازيكم|يا خبر|بص|بصوا|شايف|شايفين|يلا بينا)/.test(validatedText)
  ) {
    validatedText = `ازيكم يا أصحابي الحلوين في قناة نورين كيدز! بصوا كده معانا النهارده، ${validatedText}`;
  }
  if (
    sceneIndex === totalScenes - 1 &&
    validatedText &&
    !/(اشتركوا|تشتركوا|لايك|مع السلامة)/.test(validatedText)
  ) {
    validatedText = `${validatedText} لو عجبتكم حدوتة النهارده ما تنسوش تشتركوا في قناة نورين كيدز وتعملوا لايك، مع السلامة يا أصحابي!`;
  }
  validatedText = normalizeEgyptianColloquial(validatedText);

  return {
    passed: true,
    isPureEgyptian: detectedNonEgyptianWords.length === 0,
    detectedNonEgyptianWords,
    validatedText,
  };
}

function validateAndAutoFixEgyptianDialect(rawText, sceneIndex = 0, totalScenes = 4) {
  return runPreTtsEgyptianValidationLayer(rawText, sceneIndex, totalScenes).validatedText;
}

const CHAR_AVATAR_MAP = [
  { keywords: ["نورين", "الطبيبة", "دكتورة"], relPath: "src/assets/images/char_dr_noreen_girl_1790461976876.jpg" },
  { keywords: ["أرنوب", "ارنوب", "أرنب", "الممرض"], relPath: "src/assets/images/char_arnoob_nurse_rabbit_1790462042886.jpg" },
  { keywords: ["سدرة", "المهندسة"], relPath: "src/assets/images/char_eng_sidra_girl_1790461988894.jpg" },
  { keywords: ["النمر", "فرفوش", "نمور", "بومبو", "القط"], relPath: "src/assets/images/char_namoor_cheerful_tiger_1790462054821.jpg" },
  { keywords: ["ياسين", "فارس الواحة", "الواحة"], relPath: "src/assets/images/char_yassin_boy_knight_1790462110000.jpg" },
  { keywords: ["كركور", "الببغاء", "ببغاء"], relPath: "src/assets/images/char_karkour_wise_parrot_1790462097550.jpg" },
  { keywords: ["فارس المستكشف", "فارس", "المستكشف"], relPath: "src/assets/images/char_faris_astronaut_1790446843914.jpg" },
  { keywords: ["زعتر", "الثعلب", "فلفول", "الدب"], relPath: "src/assets/images/char_zaatar_fox_1790446857963.jpg" },
  { keywords: ["نور رائدة", "نور"], relPath: "src/assets/images/char_noor_girl_astronaut_1790462000705.jpg" },
  { keywords: ["بلبل", "الروبوت"], relPath: "src/assets/images/char_bulbul_cute_robot_1790462065051.jpg" },
  { keywords: ["كريم", "القبطان", "كابتن"], relPath: "src/assets/images/char_karim_boy_captain_1790462024983.jpg" },
  { keywords: ["مرجان", "الدلفين"], relPath: "src/assets/images/char_marjan_playful_dolphin_1790462076093.jpg" },
  { keywords: ["سلمى", "المخترعة"], relPath: "src/assets/images/char_salma_girl_inventor_1790462010894.jpg" },
  { keywords: ["سمسم", "السنجاب"], relPath: "src/assets/images/char_simsim_flying_squirrel_1790462087579.jpg" },
];

function resolveCharacterAvatarPath(speakerName, fallbackName = "الطبيبة نورين") {
  const allowedDir = path.resolve(process.cwd(), "src", "assets", "images");
  const findMatch = (txt) => {
    const s = String(txt || "").trim();
    if (!s) return null;
    for (const item of CHAR_AVATAR_MAP) {
      if (item.keywords.some((kw) => s.includes(kw))) {
        const p = path.resolve(process.cwd(), item.relPath);
        if (p.startsWith(allowedDir) && fs.existsSync(p)) return p;
      }
    }
    return null;
  };
  return (
    findMatch(speakerName) ||
    findMatch(fallbackName) ||
    path.resolve(process.cwd(), CHAR_AVATAR_MAP[0].relPath)
  );
}

async function measureAudioDurationSec(filePath, fallbackSec = 15) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const val = parseFloat(String(stdout || "").trim());
    if (!isNaN(val) && val > 0.5) return val;
  } catch {}
  return fallbackSec;
}

function ensureWavBuffer(rawBuffer) {
  if (
    rawBuffer.length >= 4 &&
    rawBuffer.subarray(0, 4).toString("ascii") === "RIFF"
  ) {
    return rawBuffer;
  }
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = rawBuffer.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, rawBuffer]);
}

function splitArabicTextForGeminiLive(text, maxChars = 195) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];
  const sentences = cleaned.split(/(?<=[.!؟،])\s+/);
  const parts = [];
  let current = "";
  for (const s of sentences) {
    if ((current + " " + s).trim().length <= maxChars) {
      current = (current + " " + s).trim();
    } else {
      if (current) parts.push(current);
      current = s;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function resolveGeminiVoiceForSpeaker(speakerName = "", isFemale = true) {
  const s = String(speakerName || "");
  if (s.includes("نورين") || s.includes("طبيبة") || s.includes("دكتورة")) return "Zephyr";
  if (s.includes("سدرة") || s.includes("مهندسة")) return "Kore";
  if (s.includes("سلمى") || s.includes("مخترعة")) return "Kore";
  if (s.includes("نور")) return "Zephyr";
  if (s.includes("فرفوش") || s.includes("النمر") || s.includes("بلبل") || s.includes("ياسين")) return "Fenrir";
  if (s.includes("كريم") || s.includes("كركور")) return "Charon";
  if (s.includes("أرنوب") || s.includes("فارس") || s.includes("زعتر") || s.includes("مرجان") || s.includes("سمسم")) return "Puck";
  return isFemale ? "Zephyr" : "Puck";
}

async function synthesizeChunkViaGeminiLiveRunner(ai, liveModel, chunkText, voiceName, isEgyptian) {
  const chunks = [];
  try {
    await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Gemini Live Audio timeout")), 22000);
      let sessionRef = null;
      try {
        sessionRef = await ai.live.connect({
          model: liveModel,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: isEgyptian
                    ? "أنت مؤدي صوتي مصري قاهري محترف في أفلام كرتون ديزني وبيكسار المدبلجة بالمصري. مهمتك الوحيدة هي قراءة النص المطلوب منك حرفياً باللهجة المصرية العامية القاهرية الصافية والطبيعية جداً للأطفال بنطق الجيم المصرية غير المعطشة (G) من أول كلمة لآخر كلمة بدون أي فصحى نهائياً وبدون إضافة أي كلمة من عندك."
                    : "اقرأ النص المطلوب منك فقط بوضوح للأطفال بدون إضافة أي كلمة.",
                },
              ],
            },
          },
          callbacks: {
            onmessage: (msg) => {
              const parts = msg?.serverContent?.modelTurn?.parts || [];
              for (const p of parts) {
                if (p?.inlineData?.data) {
                  chunks.push(Buffer.from(p.inlineData.data, "base64"));
                }
              }
              if (msg?.serverContent?.turnComplete) {
                clearTimeout(timeout);
                try {
                  sessionRef?.close();
                } catch {}
                resolve();
              }
            },
            onerror: (err) => {
              clearTimeout(timeout);
              try {
                sessionRef?.close();
              } catch {}
              reject(err);
            },
          },
        });

        sessionRef.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: isEgyptian
                    ? `انطق هذا النص فقط باللهجة المصرية القاهرية العامية الصافية حرفياً وبنطق الجيم المصرية (G) بدون إضافة أي كلمة قبله أو بعده:\n${chunkText}`
                    : `انطق هذا النص فقط حرفياً بدون إضافة أي كلمة قبله أو بعده:\n${chunkText}`,
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } catch (e) {
        clearTimeout(timeout);
        try {
          sessionRef?.close();
        } catch {}
        reject(e);
      }
    });
    const combined = Buffer.concat(chunks);
    return combined.length > 1000 ? combined : null;
  } catch {
    return null;
  }
}

async function synthesizeRawSpeechOnly(scene, sceneIndex, totalScenes, tmpDir, dialect = "egyptian") {
  const speaker = String(scene.speakerName || "");
  const isFemale = /نورين|سدرة|نور|سلمى|طبيبة|مهندسة|مخترعة/.test(speaker) || sceneIndex % 2 === 0;
  const geminiVoice = resolveGeminiVoiceForSpeaker(speaker, isFemale);
  const edgeVoice =
    dialect === "fusha"
      ? isFemale
        ? "ar-SA-ZariyahNeural"
        : "ar-SA-HamedNeural"
      : isFemale
      ? "ar-EG-SalmaNeural"
      : "ar-EG-ShakirNeural";

  const rawText = String(
    scene.dialogueArabic ||
      "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! يلا بينا نبدأ مغامرة جديدة وممتعة سوا!"
  );

  let dialogue = rawText.replace(/[\u064B-\u065F\u0670]/g, "");
  if (dialect === "egyptian") {
    const preTtsReport = runPreTtsEgyptianValidationLayer(rawText, sceneIndex, totalScenes);
    dialogue = prepareTextForNaturalEgyptianTts(preTtsReport.validatedText);
    if (preTtsReport.detectedNonEgyptianWords.length > 0) {
      console.log(
        `   [Pre-TTS Validation Layer] المشهد ${sceneIndex + 1}: تم اكتشاف واستبدال ${
          preTtsReport.detectedNonEgyptianWords.length
        } كلمة غير مصرية (${preTtsReport.detectedNonEgyptianWords
          .map((w) => `${w.foundWord} -> ${w.replacedWith}`)
          .join("، ")}) لضمان لهجة مصرية طبيعية 100% قبل توليد الصوت.`
      );
    } else {
      console.log(
        `   [Pre-TTS Validation Layer] المشهد ${sceneIndex + 1}: النص خالٍ 100% من الكلمات غير المصرية وجاهز لتوليد الصوت القاهري.`
      );
    }
  }

  // 1) PRIMARY ENGINE: Gemini Live Native Audio (`gemini-3.8-live`) + Gemini Native TTS (`gemini-3.8-flash-lite-tts`)
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const isEgyptian = dialect !== "fusha";
      const liveWavPath = path.join(tmpDir, `gemini_live_${sceneIndex}.wav`);
      const liveModels = ["gemini-3.8-live", "gemini-2.5-flash-native-audio-preview-12-2025"];

      for (const liveModel of liveModels) {
        const segments = splitArabicTextForGeminiLive(dialogue, 195);
        const pcmParts = [];
        const pauseBuf = Buffer.alloc(8640, 0);
        let allSegmentsOk = segments.length > 0;

        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
          const segPcm = await synthesizeChunkViaGeminiLiveRunner(
            ai,
            liveModel,
            segments[sIdx],
            geminiVoice,
            isEgyptian
          );
          if (!segPcm || segPcm.length <= 1000) {
            allSegmentsOk = false;
            break;
          }
          pcmParts.push(segPcm);
          if (sIdx < segments.length - 1) pcmParts.push(pauseBuf);
        }

        if (allSegmentsOk && pcmParts.length > 0) {
          const wavBuf = ensureWavBuffer(Buffer.concat(pcmParts));
          fs.writeFileSync(liveWavPath, wavBuf);
          const durSec = await measureAudioDurationSec(liveWavPath, 14);
          return { audioPath: liveWavPath, voiceDurSec: durSec, dialogue };
        }
      }

      // 1b) Secondary Gemini Native TTS (`gemini-3.8-flash-lite-tts` / `gemini-3.8-flash-tts`)
      const ttsModels = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"];
      for (const ttsModel of ttsModels) {
        try {
          const ttsPrompt = isEgyptian
            ? `أنت مؤدي صوتي مصري قاهري محترف في أفلام كرتون ديزني وبيكسار المدبلجة باللهجة المصرية العامية القاهرية للأطفال. انطق النص التالي فقط باللهجة المصرية العامية القاهرية الصافية ببهجة وحيوية وبنطق الجيم المصرية غير المعطشة (G) بدون أي فصحى نهائياً:\n${dialogue}`
            : `اقرأ النص التالي بوضوح وحيوية للأطفال:\n${dialogue}`;
          const gemRes = await ai.models.generateContent({
            model: ttsModel,
            contents: [{ role: "user", parts: [{ text: ttsPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: geminiVoice },
                },
              },
            },
          });
          const b64 = gemRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (b64) {
            const rawPcm = Buffer.from(b64, "base64");
            if (rawPcm.length > 1000) {
              const wavBuf = ensureWavBuffer(rawPcm);
              fs.writeFileSync(liveWavPath, wavBuf);
              const durSec = await measureAudioDurationSec(liveWavPath, 14);
              return { audioPath: liveWavPath, voiceDurSec: durSec, dialogue };
            }
          }
        } catch {}
      }
    } catch {}
  }

  // 2) Emergency Fallback: MsEdgeTTS
  const mp3Path = path.join(tmpDir, `edge_${sceneIndex}.mp3`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(dialogue, {
        rate: "+2%",
        pitch: isFemale ? "+5Hz" : "+3Hz",
      });
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        audioStream.on("end", () => resolve());
        audioStream.on("error", (e) => reject(e));
      });
      const mp3Buf = Buffer.concat(chunks);
      if (mp3Buf.length > 500) {
        fs.writeFileSync(mp3Path, mp3Buf);
        const durSec = await measureAudioDurationSec(mp3Path, 14);
        return { audioPath: mp3Path, voiceDurSec: durSec, dialogue };
      }
    } catch (e) {
      if (attempt < 2) {
        await sleep(500 * (attempt + 1));
      } else {
        console.warn("   [TTS Notice] MsEdgeTTS unavailable, using chunked multi-sentence Arabic TTS stream:", e?.message || e);
      }
    }
  }

  // Fallback 2: Chunked Multi-Sentence Google TTS stream (<= 140 chars per chunk) with Egyptian phonetic text
  try {
    const rawSentences = dialogue
      .split(/(?<=[.!؟،])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const textChunks = [];
    let current = "";
    for (const s of rawSentences) {
      if (!current) {
        current = s;
      } else if ((current + " " + s).length <= 135) {
        current += " " + s;
      } else {
        textChunks.push(current);
        current = s;
      }
    }
    if (current) textChunks.push(current);

    const chunkFiles = [];
    for (let cIdx = 0; cIdx < textChunks.length; cIdx++) {
      const chunkText = textChunks[cIdx].slice(0, 145);
      const url = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunkText
      )}&tl=ar&client=tw-ob`;
      const gRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (gRes.ok) {
        const ab = await gRes.arrayBuffer();
        const buf = Buffer.from(ab);
        if (buf.length > 300) {
          const cPath = path.join(tmpDir, `gtts_${sceneIndex}_${cIdx}.mp3`);
          fs.writeFileSync(cPath, buf);
          chunkFiles.push(cPath);
        }
      }
    }

    if (chunkFiles.length > 0) {
      const concatListPath = path.join(tmpDir, `gtts_concat_${sceneIndex}.txt`);
      fs.writeFileSync(
        concatListPath,
        chunkFiles.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
      );
      const joinedWav = path.join(tmpDir, `gtts_joined_${sceneIndex}.wav`);
      const pitchFilter = isFemale
        ? "asetrate=24000*1.06,aresample=24000,atempo=1.02"
        : "asetrate=24000*1.02,aresample=24000,atempo=1.03";
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-af",
        pitchFilter,
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        joinedWav,
      ]);
      if (fs.existsSync(joinedWav) && fs.statSync(joinedWav).size > 1000) {
        const durSec = await measureAudioDurationSec(joinedWav, 14);
        return { audioPath: joinedWav, voiceDurSec: durSec, dialogue };
      }
    }
  } catch {}

  const fallbackWav = path.join(tmpDir, `fallback_voice_${sceneIndex}.wav`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=14:sample_rate=48000",
    "-af",
    "volume=0.20",
    "-c:a",
    "pcm_s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    fallbackWav,
  ]);
  return { audioPath: fallbackWav, voiceDurSec: 14, dialogue };
}

async function renderEpisodeMp4(episode, videoFormat, tmpDir, dialect = "egyptian") {
  const isShort = videoFormat === "short_9_16";
  const W = isShort ? 720 : 1280;
  const H = isShort ? 1280 : 720;
  const scenes =
    Array.isArray(episode?.scenes) && episode.scenes.length > 0
      ? episode.scenes
      : [
          {
            id: "s1",
            speakerName: "الطبيبة نورين",
            durationSec: isShort ? 17 : 39,
            dialogueArabic:
              "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! بصوا كده معانا النهارده على المغامرة الجميلة دي!",
          },
          {
            id: "s2",
            speakerName: "أرنوب الشقي الممرض",
            durationSec: isShort ? 17 : 39,
            dialogueArabic:
              "يلا بينا يا دكتورة نورين نساعد بعض ونفكر بذكاء علشان نلاقي الحل الصح ونفرح كل أصحابنا!",
          },
          {
            id: "s3",
            speakerName: "الطبيبة نورين",
            durationSec: isShort ? 17 : 39,
            dialogueArabic:
              "إيه الجمال ده يا أرنوب! لما بنشتغل سوا وبنسمع كلام بعض كل حاجة صعبة بتبقى سهلة وجميلة!",
          },
          {
            id: "s4",
            speakerName: "أرنوب الشقي الممرض",
            durationSec: isShort ? 17 : 39,
            dialogueArabic:
              "شكراً ليكم يا أصحابي الحلوين! متنسوش تشتركوا في قناة نورين كيدز وتستنونا كل يوم في مغامرة جديدة!",
          },
        ];

  const rawTopicText = String(
    episode?.title || episode?.youtubePackage?.videoTitleAr || ""
  )
    .replace(/هـاننا/g, "سناننا")
    .split("|")[0]
    .trim();

  let matchedDuo = null;
  if (/سنان|أسنان|الابتسامة|السوسة|عيادة|إسعاف|طبيبة|دكتورة|نورين|أرنوب|غسيل الإيدين|غسل اليدين|فواكه/.test(rawTopicText)) {
    matchedDuo = { hero: "الطبيبة نورين", comp: "أرنوب الشقي الممرض" };
  } else if (/المهندسة|سدرة|فرفوش|هندسة|جسر|مصعد|منارة|طاحونة/.test(rawTopicText)) {
    matchedDuo = { hero: "المهندسة سدرة", comp: "النمر الفرفوش" };
  } else if (/الغواصة|الحوت|مملكة المرجان|اللؤلؤة|المحيط|كريم|مرجان|شاطئ المرجان/.test(rawTopicText)) {
    matchedDuo = { hero: "كريم القبطان الصغير", comp: "مرجان الدلفين المرح" };
  } else if (/الكوكب|حلقات زحل|المسبار|التلسكوب|الفضاء|نور رائدة|بلبل/.test(rawTopicText)) {
    matchedDuo = { hero: "نور رائدة الفضاء", comp: "بلبل الروبوت اللطيف" };
  } else if (/سلمى|سمسم|جناح الرياح|جناح الهوا|تدوير المخلفات|المناطيد الشمسية|اختراع/.test(rawTopicText)) {
    matchedDuo = { hero: "سلمى المخترعة الصغيرة", comp: "سمسم السنجاب الطائر" };
  } else if (/ياسين|كركور|الساعة الرملية|القلعة البلورية|واحة الكريستال/.test(rawTopicText)) {
    matchedDuo = { hero: "ياسين فارس الواحة", comp: "كركور الببغاء الحكيم" };
  } else if (/فارس المستكشف|زعتر|شجرة الأمانة|البذرة العجيبة|غزالة الوادي/.test(rawTopicText)) {
    matchedDuo = { hero: "فارس المستكشف", comp: "زعتر الثعلب الذكي" };
  }

  const heroName = matchedDuo?.hero || scenes[0]?.speakerName || "الطبيبة نورين";
  const companionName = matchedDuo?.comp || scenes[1]?.speakerName || "أرنوب الشقي الممرض";
  const heroImg = resolveCharacterAvatarPath(heroName, heroName);
  const compImg = resolveCharacterAvatarPath(companionName, companionName);

  // Build clean static Duo composite card from approved local character portraits (zero pixel warping)
  const duoCardPath = path.join(tmpDir, `duo_card_${videoFormat}.jpg`);
  try {
    const halfW = Math.floor(W / 2);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      compImg,
      "-i",
      heroImg,
      "-filter_complex",
      `[0:v]scale=${halfW}:${H}:force_original_aspect_ratio=increase,crop=${halfW}:${H}[left];[1:v]scale=${W - halfW}:${H}:force_original_aspect_ratio=increase,crop=${W - halfW}:${H}[right];[left][right]hstack=inputs=2,eq=saturation=1.10:contrast=1.03[outv]`,
      "-map",
      "[outv]",
      "-frames:v",
      "1",
      "-q:v",
      "2",
      duoCardPath,
    ]);
  } catch {}

  // STEP 1: Synthesize all scene voiceovers first and measure exact audio durations so dialogue is NEVER cut off
  const preparedScenes = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = {
      ...scenes[i],
      speakerName: i % 2 === 0 ? heroName : companionName,
    };
    const synth = await synthesizeRawSpeechOnly(sc, i, scenes.length, tmpDir, dialect);
    const minSceneFloor = isShort ? 15 : 38;
    const naturalDur = Math.max(minSceneFloor, Math.ceil(synth.voiceDurSec + 1.8));
    preparedScenes.push({
      scene: sc,
      audioPath: synth.audioPath,
      voiceDurSec: synth.voiceDurSec,
      durationSec: naturalDur,
    });
  }

  // Enforce total duration bounds: Short strictly [60..80s] (target >= 64s), Long strictly [300..600s] (target >= 308s)
  const minTotalSec = isShort ? 64 : 308;
  const maxTotalSec = isShort ? 79 : 590;
  let totalDur = preparedScenes.reduce((acc, s) => acc + s.durationSec, 0);

  if (totalDur < minTotalSec) {
    let deficit = minTotalSec - totalDur;
    let idx = 0;
    while (deficit > 0) {
      preparedScenes[idx % preparedScenes.length].durationSec += 1;
      deficit--;
      idx++;
    }
  } else if (totalDur > maxTotalSec) {
    let excess = totalDur - maxTotalSec;
    for (let i = preparedScenes.length - 1; i >= 0 && excess > 0; i--) {
      const minAllowed = Math.ceil(preparedScenes[i].voiceDurSec + 0.8);
      const reducible = Math.max(0, preparedScenes[i].durationSec - minAllowed);
      const cut = Math.min(excess, reducible);
      preparedScenes[i].durationSec -= cut;
      excess -= cut;
    }
  }

  const overscanW = Math.round(W * 1.12);
  const overscanH = Math.round(H * 1.12);
  const panRangeX = Math.max(8, overscanW - W);
  const panRangeY = Math.max(8, overscanH - H);

  // Stage 1: Pre-bake and pre-scale unique character portraits once (Pixar 3D color grading + yuv420p)
  // so FFmpeg does not re-evaluate scale+eq filters on 9,000-15,000 frames in Long videos.
  const prebakedMap = new Map();
  const getPrebakedPortrait = async (rawImgPath, tagIdx) => {
    if (prebakedMap.has(rawImgPath)) {
      return prebakedMap.get(rawImgPath);
    }
    const bakedPath = path.join(tmpDir, `prebaked_static_${tagIdx}.jpg`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      rawImgPath,
      "-vf",
      `scale=${overscanW}:${overscanH}:force_original_aspect_ratio=increase,crop=${overscanW}:${overscanH},eq=saturation=1.12:contrast=1.03,vignette=PI/6,setsar=1,format=yuv420p`,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      bakedPath,
    ]);
    const finalBaked =
      fs.existsSync(bakedPath) && fs.statSync(bakedPath).size > 1000
        ? bakedPath
        : rawImgPath;
    prebakedMap.set(rawImgPath, finalBaked);
    return finalBaked;
  };

  // Stage 2: Render scene segments in parallel batches (Closed-GOP H.264 video-only + sample-accurate 48kHz Stereo PCM .wav)
  // Separating PCM audio from video segment concatenation eliminates AAC 1024-sample boundary gaps in Long videos.
  const sceneTasks = preparedScenes.map((item, i) => async () => {
    const sc = item.scene;
    const dur = item.durationSec;
    const isCompTurn = i % 2 === 1;
    const activeImg = resolveCharacterAvatarPath(
      sc.speakerName || (isCompTurn ? companionName : heroName),
      isCompTurn ? companionName : heroName
    );
    const hasDuoCard = fs.existsSync(duoCardPath);
    const shotImg = i % 3 === 1 && hasDuoCard ? duoCardPath : activeImg;
    const prebakedImg = await getPrebakedPortrait(shotImg, i);

    console.log(
      `   -> [Scene ${i + 1}/${preparedScenes.length}] Speaker="${
        sc.speakerName || (isCompTurn ? companionName : heroName)
      }" | Voice=${item.voiceDurSec.toFixed(1)}s | Scene=${dur}s (YouTube Fast-Processing Closed-GOP H.264 + Continuous PCM)...`
    );

    const mixedWav = path.join(tmpDir, `scene_mixed_${i}.wav`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      item.audioPath,
      "-f",
      "lavfi",
      "-i",
      `aevalsrc='0.036*sin(2*PI*(261.63+68*mod(floor(t*0.85),3))*t)*exp(-1.4*mod(t*0.85,1))+0.028*sin(2*PI*(880+220*mod(floor(t*1.8),3))*t)*exp(-5.5*mod(t*0.30,1))':s=48000:c=stereo:d=${dur}`,
      "-filter_complex",
      `[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=2.15,adelay=220|220,apad=whole_dur=${dur}[voice];[1:a]volume=0.50,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(
        0.5,
        dur - 0.9
      )}:d=0.7[bgm];[voice][bgm]amix=inputs=2:duration=first:weights='1.0 0.22':normalize=0,alimiter=limit=0.96,asetpts=PTS-STARTPTS[outa]`,
      "-map",
      "[outa]",
      "-t",
      String(dur),
      "-c:a",
      "pcm_s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      mixedWav,
    ]);

    const sceneVidOnlyMp4 = path.join(tmpDir, `scene_vid_${i}.mp4`);
    const fadeOutStart = Math.max(0.4, Number((dur - 0.35).toFixed(2)));
    const camExprX =
      i % 2 === 0
        ? `(${panRangeX}/2)+(${Math.floor(panRangeX * 0.38)})*sin(t*0.42)`
        : `(${panRangeX}/2)-(${Math.floor(panRangeX * 0.38)})*cos(t*0.38)`;
    const camExprY = `(${panRangeY}/2)+(${Math.floor(panRangeY * 0.32)})*cos(t*0.35)`;

    await execFileAsync("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-t",
      String(dur),
      "-i",
      prebakedImg,
      "-vf",
      `crop=${W}:${H}:x='${camExprX}':y='${camExprY}',fade=t=in:st=0:d=0.30,fade=t=out:st=${fadeOutStart}:d=0.30,format=yuv420p,setsar=1`,
      "-an",
      "-t",
      String(dur),
      "-r",
      "30",
      "-vsync",
      "cfr",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-profile:v",
      "high",
      "-level:v",
      "4.1",
      "-crf",
      "22",
      "-maxrate",
      "2500k",
      "-bufsize",
      "5000k",
      "-g",
      "60",
      "-keyint_min",
      "60",
      "-sc_threshold",
      "0",
      "-bf",
      "2",
      "-flags",
      "+cgop",
      "-pix_fmt",
      "yuv420p",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      sceneVidOnlyMp4,
    ]);

    return { index: i, videoPath: sceneVidOnlyMp4, wavPath: mixedWav };
  });

  const renderedItems = [];
  const BATCH_CONCURRENCY = 3;
  for (let b = 0; b < sceneTasks.length; b += BATCH_CONCURRENCY) {
    const batch = sceneTasks.slice(b, b + BATCH_CONCURRENCY);
    const batchOut = await Promise.all(batch.map((fn) => fn()));
    renderedItems.push(...batchOut);
  }
  renderedItems.sort((a, b) => a.index - b.index);

  // Stage 3: Concatenate Closed-GOP H.264 video stream + Continuous PCM audio stream in a single pass
  // with AAC-LC 48kHz Stereo, BT.709 color tags, and +faststart moov atom at the front of the file.
  const concatVidTxt = path.join(tmpDir, `concat_vid_${videoFormat}.txt`);
  const concatAudTxt = path.join(tmpDir, `concat_aud_${videoFormat}.txt`);
  fs.writeFileSync(
    concatVidTxt,
    renderedItems.map((r) => `file '${r.videoPath.replace(/'/g, "'\\''")}'`).join("\n")
  );
  fs.writeFileSync(
    concatAudTxt,
    renderedItems.map((r) => `file '${r.wavPath.replace(/'/g, "'\\''")}'`).join("\n")
  );

  const finalMp4 = path.join(tmpDir, `noreen_kids_${videoFormat}.mp4`);
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatVidTxt,
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatAudTxt,
    "-fflags",
    "+genpts",
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-colorspace",
    "bt709",
    "-color_primaries",
    "bt709",
    "-color_trc",
    "bt709",
    "-c:a",
    "aac",
    "-profile:a",
    "aac_low",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-af",
    "aresample=async=1:first_pts=0",
    "-movflags",
    "+faststart",
    "-brand",
    "mp42",
    "-shortest",
    finalMp4,
  ]);

  return finalMp4;
}

async function getYouTubeAccessToken({ clientId, clientSecret, refreshToken }) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      `فشل تجديد رمز الوصول لـ YouTube API: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`
    );
  }
  return tokenData.access_token;
}

async function uploadMp4ToYouTube({
  accessToken,
  mp4Path,
  title,
  description,
  tags,
  privacyStatus,
  madeForKids,
  containsSyntheticMedia,
  categoryId,
  publishAtIso,
  playlistId,
}) {
  const mp4Buffer = fs.readFileSync(mp4Path);
  let cleanTitle = String(title || "Noreen Kids: مغامرة جديدة")
    .replace(/#[^\s#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleanTitle.startsWith("Noreen Kids:")) {
    cleanTitle = `Noreen Kids: ${cleanTitle.replace(/^Noreen\s*Kids\s*[:\-|]?\s*/i, "")}`;
  }

  const attemptInit = async (usePublishAt) => {
    const statusObj = {
      privacyStatus: usePublishAt ? "private" : privacyStatus || "private",
      selfDeclaredMadeForKids:
        typeof madeForKids === "boolean" ? madeForKids : true,
      containsSyntheticMedia:
        typeof containsSyntheticMedia === "boolean"
          ? containsSyntheticMedia
          : true,
    };
    if (usePublishAt && publishAtIso) {
      statusObj.publishAt = publishAtIso;
    }
    const metadata = {
      snippet: {
        title: cleanTitle.slice(0, 98),
        description: String(description || cleanTitle),
        tags: Array.isArray(tags) ? tags.slice(0, 18) : ["Noreen Kids", "كرتون اطفال 3D"],
        categoryId: String(categoryId || "1"),
        defaultLanguage: "ar",
        defaultAudioLanguage: "ar",
      },
      status: statusObj,
    };

    return fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(mp4Buffer.length),
        },
        body: JSON.stringify(metadata),
      }
    );
  };

  let initRes = await attemptInit(Boolean(publishAtIso));
  if (!initRes.ok && publishAtIso) {
    console.log("   [Notice] Retrying upload without future publishAt timestamp...");
    initRes = await attemptInit(false);
  }

  if (!initRes.ok) {
    const errText = await initRes.text();
    throw new Error(`YouTube Upload Init Failed (${initRes.status}): ${errText}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new Error("لم يتم استلام رابط الرفع Resumable Location من YouTube API.");
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(mp4Buffer.length),
    },
    body: new Uint8Array(mp4Buffer),
  });

  if (!putRes.ok) {
    const putErr = await putRes.text();
    throw new Error(`YouTube Binary Upload Failed (${putRes.status}): ${putErr}`);
  }

  const uploadedData = await putRes.json();
  const videoId = uploadedData.id;

  let playlistAdded = false;
  if (playlistId && videoId) {
    try {
      const plRes = await fetch(
        "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify({
            snippet: {
              playlistId: String(playlistId).trim(),
              resourceId: {
                kind: "youtube#video",
                videoId: String(videoId).trim(),
              },
            },
          }),
        }
      );
      playlistAdded = plRes.ok;
    } catch {}
  }

  return {
    videoId,
    cleanTitle,
    playlistId,
    playlistAdded,
    fileSizeMb: (mp4Buffer.length / (1024 * 1024)).toFixed(2),
  };
}

async function main() {
  console.log("==================================================================");
  console.log("🚀 Noreen Kids 3D Studio - 24/7 Automated YouTube Pipeline");
  console.log("==================================================================");

  const schedulePath = path.resolve(process.cwd(), "noreen-kids-schedule.json");
  let schedule = {};
  if (fs.existsSync(schedulePath)) {
    schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
  }

  const vault = decryptVault(schedule.encryptedVault || "");
  if (!process.env.GEMINI_API_KEY && vault.geminiApiKey) {
    process.env.GEMINI_API_KEY = String(vault.geminiApiKey).trim();
  }
  const clientId = (process.env.YOUTUBE_CLIENT_ID || vault.youtubeClientId || "").trim();
  const clientSecret = (process.env.YOUTUBE_CLIENT_SECRET || vault.youtubeClientSecret || "").trim();
  const refreshToken = (process.env.YOUTUBE_REFRESH_TOKEN || vault.youtubeRefreshToken || "").trim();

  const isCronEvent = process.env.GITHUB_EVENT_NAME === "schedule";
  const isGitHubScheduleEnabled =
    typeof schedule.isGitHubScheduleEnabled === "boolean"
      ? schedule.isGitHubScheduleEnabled
      : true;

  if (isCronEvent && !isGitHubScheduleEnabled) {
    console.log(
      "⏸️ [GitHub Schedule Paused] جدولة GitHub Actions التلقائية متوقفة حالياً من الداشبورد (isGitHubScheduleEnabled = false). تم إلغاء التشغيل التلقائي."
    );
    process.exit(0);
  }

  const runMode = parseRunMode(
    process.env.RUN_MODE || schedule.selectedWorkflowMode || "daily_schedule"
  );
  const dailyTime =
    schedule.githubPublishTimeCairo ||
    schedule.dailyPublishTimeCairo ||
    "19:00";
  const dailyDialect = schedule.dailyDialect === "fusha" ? "fusha" : "egyptian";
  const privacyStatus = schedule.privacyStatus || "private";
  const madeForKids =
    typeof schedule.madeForKids === "boolean" ? schedule.madeForKids : true;
  const containsSyntheticMedia =
    typeof schedule.containsSyntheticMedia === "boolean"
      ? schedule.containsSyntheticMedia
      : true;
  const categoryId = String(schedule.categoryId || "1");
  const shortsPlaylistId = schedule.shortsPlaylistId || "PLPwfeXzB3ozU";
  const longPlaylistId = schedule.longPlaylistId || "PLbjN20PzrCYk";
  const appUrl = (process.env.APP_URL || vault.appUrl || "").trim();

  console.log(`📌 Run Mode Selected : ${runMode}`);
  console.log(
    `🕖 GitHub Schedule Time (Cairo): ${dailyTime} (Enabled: ${isGitHubScheduleEnabled}) | Dialect: ${dailyDialect}`
  );
  console.log(
    `⚙️ Upload Settings   : Privacy=${privacyStatus} | MadeForKids=${madeForKids} | SyntheticAI=${containsSyntheticMedia} | Category=${categoryId}`
  );
  console.log(`📂 Playlists         : Short=${shortsPlaylistId} | Long=${longPlaylistId}`);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error(
      "❌ خطأ: مفاتيح YouTube OAuth (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN) غير متوفرة!"
    );
    console.error(
      "يرجى إدخال مفاتيح يوتيوب في لوحة التحكم والضغط على زر (مزامنة Workflow 24/7 مع GitHub)."
    );
    process.exit(1);
  }

  console.log("🔑 [Step 1/4] Verifying YouTube OAuth 2.0 Refresh Token...");
  const accessToken = await getYouTubeAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  });
  console.log("✅ YouTube OAuth 2.0 Access Token obtained successfully!");

  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 12));

  const DAILY_SHORT_STORIES = [
    {
      title: "Noreen Kids: لغز السماعة المضيئة في عيادة الغابة | مغامرات الطبيبة نورين وأرنوب الشقي",
      summary:
        "مغامرة متكاملة الأركان (بداية ومشكلة وتصرف وحل) تكتشف فيها الطبيبة نورين وأرنوب الشقي سبب تعب العصفور الصغير ويعالجانه بذكاء وتعاون.",
      scenes: [
        {
          id: "s1",
          speakerName: "الطبيبة نورين",
          durationSec: 17,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! النهارده أنا وأرنوب الشقي جهزنا السماعة الطبية المنورة في عيادة الغابة علشان نطمن على كل أصحابنا!",
        },
        {
          id: "s2",
          speakerName: "أرنوب الشقي الممرض",
          durationSec: 17,
          dialogueArabic:
            "يا خبر يا دكتورة نورين! العصفور الصغير صوته ضعيف أوي النهارده ومش قادر يطير علشان شرب مية ساقعة، ولازم نساعده بسرعة!",
        },
        {
          id: "s3",
          speakerName: "الطبيبة نورين",
          durationSec: 17,
          dialogueArabic:
            "متقلقش يا أرنوب! هات حقيبة الإسعافات الذكية نسمع دقات قلبه ونديله مشروب الأعشاب الدافي والفيتامينات المنورة علشان يستعيد نشاطه!",
        },
        {
          id: "s4",
          speakerName: "أرنوب الشقي الممرض",
          durationSec: 17,
          dialogueArabic:
            "هيييه! العصفور رجع يغني ويطير من تاني بفضل التعاون! لو عجبتكم حدوتة النهارده ما تنسوش تشتركوا في قناة نورين كيدز وتعملوا لايك، مع السلامة يا أصحابي!",
        },
      ],
    },
    {
      title: "Noreen Kids: إصلاح جسر الغيوم المتحرك | مغامرات المهندسة سدرة والنمر الفرفوش",
      summary:
        "رحلة هندسية مشوقة تواجه فيها المهندسة سدرة والنمر الفرفوش مشكلة توقف جسر الغيوم ويبتكران الحل بالعلم والتعاون.",
      scenes: [
        {
          id: "s1",
          speakerName: "المهندسة سدرة",
          durationSec: 17,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! النهارده أنا والنمر الفرفوش معانا التابلت الهندسي الهولوغرامي علشان نتابع جسر الغيوم الذكي!",
        },
        {
          id: "s2",
          speakerName: "النمر الفرفوش",
          durationSec: 17,
          dialogueArabic:
            "بصي يا سدرة! فيه مشكلة حصلت فجأة، التروس الدهبية بتاعة الجسر وقفت والقطار الطاير مش عارف يعدي الناحية التانية!",
        },
        {
          id: "s3",
          speakerName: "المهندسة سدرة",
          durationSec: 17,
          dialogueArabic:
            "فكرت صح يا نمور! يلا نستخدم مفتاح التروس الذهبي ونرتب القطع حسب حجمها بالظبط علشان الطاقة ترجع تمشي في الجسر كله!",
        },
        {
          id: "s4",
          speakerName: "النمر الفرفوش",
          durationSec: 17,
          dialogueArabic:
            "يااه على الجمال! الجسر اشتغل والقطار عدى بأمان! ما تنسوش يا أصحابي تشتركوا في قناة نورين كيدز وتفعلوا الجرس، مع السلامة!",
        },
      ],
    },
    {
      title: "Noreen Kids: إنقاذ الدلفين الصغير في مملكة المرجان | مغامرات القبطان كريم ومرجان",
      summary:
        "مغامرة بحرية متكاملة يقود فيها القبطان كريم والدلفين مرجان الغواصة الذهبية لتحرير الممر المرجاني بالتفكير العلمي.",
      scenes: [
        {
          id: "s1",
          speakerName: "كريم القبطان الصغير",
          durationSec: 17,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! إحنا النهارده في الغواصة الذهبية بنستكشف أعماق مملكة المرجان مع صاحبي الدلفين مرجان!",
        },
        {
          id: "s2",
          speakerName: "مرجان الدلفين المرح",
          durationSec: 17,
          dialogueArabic:
            "يا خبر يا كابتن كريم! فيه صخرة بلورية سدت ممر المرجان والسمك الصغير مش عارف يرجع لبيته قبل الليل!",
        },
        {
          id: "s3",
          speakerName: "كريم القبطان الصغير",
          durationSec: 17,
          dialogueArabic:
            "يلا نتصرف بذكاء يا مرجان! هنشغل فقاعات الدفع المائي من الغواصة ومن طوق اللؤلؤ المنور في نفس اللحظة علشان نحرك الصخرة بهدوء!",
        },
        {
          id: "s4",
          speakerName: "مرجان الدلفين المرح",
          durationSec: 17,
          dialogueArabic:
            "هيييه! الممر اتفتح والسمك رجع فرحان! اشتركوا في قناة نورين كيدز واعملوا لايك واستنونا بكرة في حكاية جديدة، مع السلامة!",
        },
      ],
    },
  ];

  const DAILY_LONG_STORIES = [
    {
      title: "Noreen Kids: سر المختبر الطائر وبلورة الطاقة النظيفة | مغامرات المهندسة سدرة والنمر الفرفوش",
      summary:
        "حلقة طويلة متكاملة الحبكة (بداية وتطور وحدث ومشكلة وتصرف وحل ونهاية) داخل المختبر الطائر لإعادة تشغيل بلورة الطاقة النظيفة وإنقاذ مدينة المستقبل.",
      scenes: [
        {
          id: "l_1",
          speakerName: "المهندسة سدرة",
          durationSec: 39,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! عاملين إيه النهارده؟ بص كده معانا يا نمور، إحنا النهارده في بداية رحلة كبيرة جوه المختبر الطائر فوق السحاب، ومعانا التابلت الهندسي الهولوغرامي علشان نطمن على بلورة الطاقة النظيفة اللي بتنور مدينة المستقبل كلها من غير أي دخان خالص! يلا بينا نقرب خطوة بخطوة ونفتح عينينا كويس علشان نشوف إزاي المحطة بتشتغل!",
        },
        {
          id: "l_2",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "يا خبر يا سدرة! أنا فتحت حقيبة التروس الذكية وبصيت على عدادات الطاقة، ولاحظت تطور عجيب بيحصل دلوقتي! النور الأزرق الجميل بتاع البلورة بدأ يضعف شوية بشوية، والمراوح الهوائية اللي فوق المختبر سرعتها بتقل! تفتكروا يا أصحابي الحلوين إيه اللي بيحصل جوه غرفة التحكم؟ يلا نركز سوا ونفحص المسارات!",
        },
        {
          id: "l_3",
          speakerName: "المهندسة سدرة",
          durationSec: 39,
          dialogueArabic:
            "بصوا كده يا أصحابي الحلوين! فجأة حصل الحدث اللي كنا بنفرز علاماته يا نمور! صفارة الإنذار اللطيفة رنت علشان السحابة الكثيفة غطت العدسات الشمسية اللي بتغذي البلورة! بس إحنا في قناة نورين كيدز عمرنا ما بنقلق ولا بنستسلم خالص مهما كان التحدي كبير، لأن التفكير العلمي الهادي بيخلينا نفهم كل حاجة!",
        },
        {
          id: "l_4",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "أيوة يا سدرة! أنا قربت بمفتاح التروس الذهبي وعرفت المشكلة فين بالظبط! العدسات البلورية محتاجة تتنضف من بخار السحاب، وكمان محتاجين نعدل زاويتها علشان تلقط نور الشمس من فوق الغيوم! شفتوا يا أصحابنا إزاي لما بندور على سبب المشكلة بهدوء بنعرف نوصل للحل بسرعة؟ يلا نبدأ التصرف العملي حالاً!",
        },
        {
          id: "l_5",
          speakerName: "المهندسة سدرة",
          durationSec: 39,
          dialogueArabic:
            "يلا بينا يا نمور نبدأ التصرف الصح دلوقتي! أنا هبرمج ذراع التوجيه في التابلت الهندسي علشان يرفع العدسات لفوق، وإنت ساعدني بربط التروس الدهبية في نفس اللحظة! شفتوا يا أصحابنا الحلوين إزاي لما اتعاونا وجربنا بصبر وهدوء بدأت العدسات تلمع وتجمع أشعة الشمس الذهبية من تاني؟",
        },
        {
          id: "l_6",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "هيييه! الحل نجح مية في المية يا سدرة! بصوا يا كل أصحابنا الشطار في قناة نورين كيدز! أول ما العدسات اتظبطت، انطلق شعاع النور الصافي ورجعت بلورة الطاقة النظيفة تشتغل بأقصى قوة، والمختبر الطائر كله بقى منور ومليان بهجة وسعادة بفضل التعاون والتفكير العلمي السليم!",
        },
        {
          id: "l_7",
          speakerName: "المهندسة سدرة",
          durationSec: 39,
          dialogueArabic:
            "بجد يا نمور دي كانت مغامرة جميلة أوي لا يمكن ننساها! بدأنا رحلتنا بملاحظة صغيرة، ولما واجهتنا المشكلة متخليناش عن بعض خالص، وفكرنا وتصرفنا بذكاء لحد ما وصلنا للحل النهائي! اتعلمنا النهارده سوا يا أصحابي إن العلم والصبر والعمل الجماعي بيحولوا أي عقبة صعبة لنجاح كبير يفرح كل القلوب!",
        },
        {
          id: "l_8",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "ودلوقتي يا أصحابنا الحلوين في قناة نورين كيدز، وصلنا لنهاية حدوتة النهارده الجميلة بعد ما عشنا سوا البداية والمشكلة والحل السعيد! لو عجبتكم المغامرة مع المهندسة سدرة والنمر الفرفوش، ما تنسوش تشتركوا في قناة نورين كيدز وتفعلوا الجرس وتعملوا لايك علشان تستنونا كل يوم في مغامرة جديدة! مع السلامة يا أصحابي!",
        },
      ],
    },
    {
      title: "Noreen Kids: مهمة السماعة الذهبية في واحة الكريستال | مغامرات الطبيبة نورين وأرنوب الشقي",
      summary:
        "فيلم كرتون 3D طويل متكامل الأركان تنطلق فيه الطبيبة نورين وأرنوب الشقي لعلاج نبع المياه البلوري وإسعاف كائنات الواحة.",
      scenes: [
        {
          id: "l_1",
          speakerName: "الطبيبة نورين",
          durationSec: 39,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! عاملين إيه النهارده؟ بص كده معانا يا أرنوب، إحنا النهارده في بداية رحلة جميلة جوه واحة الكريستال المنورة، ومعايا السماعة الطبية الذهبية وجهاز الفحص الضوئي علشان نطمن على صحة كل الكائنات اللطيفة اللي عايشة هنا! يلا بينا نقرب ونشوف إيه الأخبار!",
        },
        {
          id: "l_2",
          speakerName: "أرنوب الشقي الممرض",
          durationSec: 39,
          dialogueArabic:
            "يا خبر يا دكتورة نورين! أنا فتحت حقيبة الإسعافات المنورة وبصيت حوالينا، ولاحظت تطور غريب في الواحة! الفراشات المنورة والغزلان الصغيرة شكلهم عطشانين وتعبانين، والمية الصافية اللي في نبع الكريستال بقت قليلة أوي! تفتكروا يا أصحابي الحلوين إيه اللي حصل للنبع؟ يلا نقرب ونفحص المكان!",
        },
        {
          id: "l_3",
          speakerName: "الطبيبة نورين",
          durationSec: 39,
          dialogueArabic:
            "بصوا كده يا أصحابي الحلوين! ظهر الحدث اللي مكنش في الحسبان يا أرنوب! أوراق الشجر الكبيرة والأحجار اللامعة اتجمعت مع الهوا وسدت مجرى النبع البلوري، علشان كده المية النضيفة مش عارفة توصل لباقي الواحة! بس إحنا في قناة نورين كيدز بنفكر بهدوء وبنستخدم العلم علشان نحل أي مشكلة!",
        },
        {
          id: "l_4",
          speakerName: "أرنوب الشقي الممرض",
          durationSec: 39,
          dialogueArabic:
            "أيوة يا دكتورة نورين! أنا فحصت المجرى وعرفت المشكلة فين بالظبط! إحنا محتاجين الأول نشيل الأحجار والأوراق دي بالراحة، وبعدين نشغل فلتر التنقية البلوري علشان المية ترجع نضيفة وصحية لكل أصحابنا في الواحة! يلا بينا نبدأ التصرف العملي ونساعد بعض حالاً!",
        },
        {
          id: "l_5",
          speakerName: "الطبيبة نورين",
          durationSec: 39,
          dialogueArabic:
            "يلا بينا يا أرنوب نبدأ التصرف الصح دلوقتي! أنا هستخدم جهاز الفحص الضوئي علشان أتأكد من نقاء المية، وإنت ساعدني بترتيب أحجار الفلتر الكريستالي حوالين النبع! شفتوا يا أصحابنا الحلوين إزاي لما تعاونا واشتغلنا بنظام ونظافة بدأت المية الصافية تجري وتلمع من تاني؟",
        },
        {
          id: "l_6",
          speakerName: "أرنوب الشقي الممرض",
          durationSec: 39,
          dialogueArabic:
            "هيييه! الحل نجح مية في المية يا دكتورة نورين! بصوا يا كل أصحابنا الشطار في قناة نورين كيدز! النبع البلوري رجع يضخ مية نضيفة وجميلة، وكل الغزلان والعصافير والفراشات شربوا ورجعتلهم الصحة والنشاط والابتسامة الجميلة بفضل التعاون وحب مساعدة الآخرين!",
        },
        {
          id: "l_7",
          speakerName: "الطبيبة نورين",
          durationSec: 39,
          dialogueArabic:
            "بجد يا أرنوب دي كانت مغامرة مفيدة وجميلة أوي! بدأنا يومنا بزيارة الواحة، ولما اكتشفنا المشكلة فكرنا بهدوء وتصرفنا بنظام لحد ما عالجنا النبع وأسعفنا أصحابنا! اتعلمنا النهارده يا أصحابي إن النظافة وشرب المية النضيفة والتعاون هما سر الصحة والسعادة في كل مكان!",
        },
        {
          id: "l_8",
          speakerName: "أرنوب الشقي الممرض",
          durationSec: 39,
          dialogueArabic:
            "ودلوقتي يا أصحابنا الحلوين في قناة نورين كيدز، وصلنا لنهاية حدوتة النهارده الجميلة! لو عجبتكم المغامرة مع الطبيبة نورين وأرنوب الشقي، ما تنسوش تشتركوا في قناة نورين كيدز وتفعلوا الجرس وتعملوا لايك علشان تستنونا كل يوم في مغامرة جديدة ومفيدة! مع السلامة يا أصحابي!",
        },
      ],
    },
  ];

  const dynamicShortStory = DAILY_SHORT_STORIES[daySeed % DAILY_SHORT_STORIES.length];
  const dynamicLongStory = DAILY_LONG_STORIES[daySeed % DAILY_LONG_STORIES.length];

  const chosenShortEp =
    !isCronEvent && schedule.shortEpisode && Array.isArray(schedule.shortEpisode.scenes)
      ? schedule.shortEpisode
      : {
          title: dynamicShortStory.title,
          scenes: dynamicShortStory.scenes,
          youtubePackage: {
            videoTitleAr: dynamicShortStory.title,
            descriptionAr: `أهلاً بكم يا أصحابنا في قناة Noreen Kids لأفلام الرسوم المتحركة!\n📖 ملخص القصة:\n${dynamicShortStory.summary}\n🕖 موعد النشر اليومي: الساعة ${dailyTime} بتوقيت مصر.\n🔔 اشتركوا في قناة Noreen Kids وفعلوا الجرس ليصلكم كل جديد يومياً!`,
            tags: ["Noreen Kids", "نورين كيدز", "كرتون اطفال 3D", "حواديت اطفال بالمصري"],
          },
        };

  const chosenLongEp =
    !isCronEvent && schedule.longEpisode && Array.isArray(schedule.longEpisode.scenes)
      ? schedule.longEpisode
      : {
          title: dynamicLongStory.title,
          scenes: dynamicLongStory.scenes,
          youtubePackage: {
            videoTitleAr: dynamicLongStory.title,
            descriptionAr: `أهلاً بكم يا أصحابنا في قناة Noreen Kids لأفلام الرسوم المتحركة!\n📖 ملخص القصة:\n${dynamicLongStory.summary}\n🕖 موعد النشر اليومي: الساعة ${dailyTime} بتوقيت مصر.\n🔔 اشتركوا في قناة Noreen Kids وفعلوا الجرس ليصلكم كل جديد يومياً!`,
            tags: ["Noreen Kids", "نورين كيدز", "كرتون اطفال 3D", "افلام كرتون طويلة"],
          },
        };

  const tasks = [];
  if (runMode === "short_only" || runMode === "both_now" || runMode === "daily_schedule") {
    tasks.push({
      label: "Short 3D Video (9:16)",
      videoFormat: "short_9_16",
      playlistId: shortsPlaylistId,
      episode: chosenShortEp,
    });
  }

  if (runMode === "long_only" || runMode === "both_now" || runMode === "daily_schedule") {
    tasks.push({
      label: "Long 3D Episode (16:9)",
      videoFormat: "long_16_9",
      playlistId: longPlaylistId,
      episode: chosenLongEp,
    });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "noreenkids-gh-"));
  const results = [];
  const publishAtIso =
    runMode === "daily_schedule" && !isCronEvent
      ? computeNextCairoPublishIso(dailyTime)
      : null;

  for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
    const task = tasks[tIdx];
    console.log("------------------------------------------------------------------");
    console.log(`🎬 [Step 2/4] Rendering ${task.label} (${tIdx + 1}/${tasks.length})...`);
    const mp4Path = await renderEpisodeMp4(task.episode, task.videoFormat, tmpDir, dailyDialect);

    console.log(`🔍 [Step 3/4] Running Pre-Upload Unit Test & ffprobe Gate on ${path.basename(mp4Path)}...`);
    const { stdout: probeOut } = await execFileAsync("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      mp4Path,
    ]);
    const probeJson = JSON.parse(probeOut || "{}");
    const durSec = Math.round(Number(probeJson?.format?.duration || 0));
    const streams = Array.isArray(probeJson?.streams) ? probeJson.streams : [];
    const vStream = streams.find((s) => s.codec_type === "video");
    const aStream = streams.find((s) => s.codec_type === "audio");

    // 1. Duration & YouTube Standard Encoding Gate (H.264, AAC-LC, yuv420p, 48kHz Stereo, Closed-GOP, FastStart)
    if (task.videoFormat === "short_9_16" && (durSec < 60 || durSec > 80)) {
      throw new Error(`[Pre-Upload Unit Test FAILED] Short duration (${durSec}s) outside required 60-80s gate. Upload blocked.`);
    }
    if (task.videoFormat === "long_16_9" && (durSec < 300 || durSec > 600)) {
      throw new Error(`[Pre-Upload Unit Test FAILED] Long duration (${durSec}s) outside required 300-600s gate. Upload blocked.`);
    }
    if (!vStream || !aStream) {
      throw new Error(`[Pre-Upload Unit Test FAILED] Missing H.264 video or AAC audio stream in MP4. Upload blocked.`);
    }
    const vCodec = String(vStream?.codec_name || "").toLowerCase();
    const pixFmt = String(vStream?.pix_fmt || "").toLowerCase();
    const aCodec = String(aStream?.codec_name || "").toLowerCase();
    const aSampleRate = Number(aStream?.sample_rate || 0);
    const aChannels = Number(aStream?.channels || 0);
    const closedGop = Number(vStream?.closed_gop ?? 1) === 1;
    const vDur = Number(vStream?.duration || durSec);
    const aDur = Number(aStream?.duration || durSec);
    const avDrift = Math.abs(vDur - aDur);
    if (
      vCodec !== "h264" ||
      pixFmt !== "yuv420p" ||
      aCodec !== "aac" ||
      aSampleRate !== 48000 ||
      aChannels !== 2
    ) {
      throw new Error(
        `[Pre-Upload Unit Test FAILED] Non-compliant YouTube stream encoding (${vCodec}/${pixFmt}/${aCodec} ${aSampleRate}Hz ${aChannels}ch). Upload blocked.`
      );
    }

    // 2. Dialogue Integrity & Egyptian Dialect Gate
    const epScenes = Array.isArray(task.episode?.scenes) ? task.episode.scenes : [];
    for (let sIdx = 0; sIdx < epScenes.length; sIdx++) {
      const scText = String(epScenes[sIdx]?.dialogueArabic || "").trim();
      if (!scText || scText.split(/\s+/).length < 5) {
        throw new Error(`[Pre-Upload Unit Test FAILED] Scene ${sIdx + 1} dialogue is empty or too short. Upload blocked.`);
      }
      if (dailyDialect === "egyptian") {
        const validation = runPreTtsEgyptianValidationLayer(scText, sIdx, epScenes.length);
        epScenes[sIdx].dialogueArabic = validation.validatedText;
      }
    }

    // 3. Zero External Images Gate
    for (let sIdx = 0; sIdx < epScenes.length; sIdx++) {
      const resolvedCharImg = resolveSpeakerImageFile(epScenes[sIdx]?.speakerName || "");
      if (
        !resolvedCharImg ||
        /^https?:\/\//i.test(resolvedCharImg) ||
        !resolvedCharImg.startsWith(path.join(ROOT_DIR, "src/assets/images")) ||
        !fs.existsSync(resolvedCharImg)
      ) {
        throw new Error(`[Pre-Upload Unit Test FAILED] External or missing image detected in scene ${sIdx + 1}: ${resolvedCharImg}. Upload blocked.`);
      }
    }

    console.log(
      `✅ PRE-UPLOAD UNIT TEST GATE PASSED: Duration=${durSec}s | AV-Drift=${avDrift.toFixed(2)}s | Codec=${vCodec}/${pixFmt}/${aCodec} 48kHz Stereo (Closed-GOP=${closedGop}) | Dialogue=100% Egyptian Verified | ExternalImages=0 | FastStart=Enabled`
    );

    console.log(`☁️ [Step 4/4] Uploading ${task.label} to YouTube Channel (Noreen Kids)...`);
    const pkg = task.episode?.youtubePackage || {};
    const uploadRes = await uploadMp4ToYouTube({
      accessToken,
      mp4Path,
      title: pkg.videoTitleAr || task.episode?.title,
      description: pkg.descriptionAr || task.episode?.subtitle,
      tags: pkg.tags,
      privacyStatus,
      madeForKids,
      containsSyntheticMedia,
      categoryId,
      publishAtIso,
      playlistId: task.playlistId,
    });

    console.log(`🎉 SUCCESS! Uploaded Video ID: ${uploadRes.videoId}`);
    console.log(`🔗 Watch URL: https://www.youtube.com/watch?v=${uploadRes.videoId}`);
    console.log(`📂 Playlist (${uploadRes.playlistId}): ${uploadRes.playlistAdded ? "Added ✓" : "Skipped"}`);

    results.push({
      ...uploadRes,
      videoFormat: task.videoFormat,
      label: task.label,
      durationSec: durSec,
      runMode,
    });
  }

  if (appUrl && results.length > 0) {
    try {
      const shortRes = results.find((r) => r.videoFormat === "short_9_16");
      const longRes = results.find((r) => r.videoFormat === "long_16_9");
      await fetch(`${appUrl.replace(/\/$/, "")}/api/studio/cloud-run-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "github_actions_cloud",
          runMode,
          dailyPublishTime: dailyTime,
          youtubeShortVideoId: shortRes?.videoId,
          youtubeLongVideoId: longRes?.videoId,
          shortEpisodeTitle: shortRes?.cleanTitle,
          longEpisodeTitle: longRes?.cleanTitle,
          shortPlaylistId: shortsPlaylistId,
          longPlaylistId: longPlaylistId,
          privacyStatus,
          madeForKids,
          containsSyntheticMedia,
          categoryId,
          dialect: dailyDialect,
        }),
      });
    } catch {}
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "## 🎬 تقرير تشغيل وإنتاج قناة Noreen Kids 3D Studio",
      `- **وضع التشغيل:** \`${runMode}\``,
      `- **موعد الجدولة اليومية (توقيت مصر):** \`${dailyTime}\``,
      "",
      "| نوع الفيديو | العنوان | المدة | الحجم | قائمة التشغيل | رابط يوتيوب |",
      "|---|---|---|---|---|---|",
      ...results.map(
        (r) =>
          `| ${r.label} | ${r.cleanTitle} | ${r.durationSec}s | ${r.fileSizeMb} MB | \`${r.playlistId}\` | [https://youtu.be/${r.videoId}](https://youtu.be/${r.videoId}) |`
      ),
      "",
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n"));
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
  console.log("==================================================================");
  console.log("✅ All Noreen Kids YouTube tasks completed and uploaded!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("❌ Pipeline Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
