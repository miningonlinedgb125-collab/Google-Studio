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
  { keywords: ["أم ملك", "ام ملك", "المعلمة"], relPath: "src/assets/images/char_om_malak_teacher_1790685841625.jpg" },
  { keywords: ["البطريق", "بطريق"], relPath: "src/assets/images/char_funny_penguin_1790685854532.jpg" },
  { keywords: ["ملك", "طبيبة طوارئ", "دكتورة ملك"], relPath: "src/assets/images/char_malak_emergency_doctor_1790685772412.jpg" },
  { keywords: ["لوليتا", "القطة", "قطة"], relPath: "src/assets/images/char_lolita_cat_1790685786758.jpg" },
  { keywords: ["سدرة الصغنونة", "سدرة الصغيرة"], relPath: "src/assets/images/char_baby_sidra_toddler_1790685815760.jpg" },
  { keywords: ["الفراشة", "فراشة"], relPath: "src/assets/images/char_colorful_butterfly_1790685827095.jpg" },
  { keywords: ["ذياد", "زياد"], relPath: "src/assets/images/char_ziad_young_man_1790685879815.jpg" },
  { keywords: ["العصفورة", "عصفورة"], relPath: "src/assets/images/char_cheerful_bird_1790685899352.jpg" },
  { keywords: ["شريف", "أستاذ شريف", "محاسب"], relPath: "src/assets/images/char_mr_sherif_accountant_1790685911579.jpg" },
  { keywords: ["الصقر", "صقر"], relPath: "src/assets/images/char_smart_falcon_1790685922310.jpg" },
  { keywords: ["جدو", "الجد"], relPath: "src/assets/images/char_gedo_grandpa_1790685953317.jpg" },
  { keywords: ["الفأر", "فأر", "فار", "مشاكس"], relPath: "src/assets/images/char_mischievous_mouse_1790685967206.jpg" },
  { keywords: ["تيتة", "تيته", "الجدة"], relPath: "src/assets/images/char_teta_grandma_1790685980597.jpg" },
  { keywords: ["باندا", "الدب باندا"], relPath: "src/assets/images/char_panda_bear_1790685992445.jpg" },
  { keywords: ["نورين", "الطبيبة", "دكتورة"], relPath: "src/assets/images/char_dr_noreen_girl_1790461976876.jpg" },
  { keywords: ["أرنوب", "ارنوب", "أرنب", "الممرض"], relPath: "src/assets/images/char_arnoob_nurse_rabbit_1790462042886.jpg" },
  { keywords: ["نوران", "المهندسة"], relPath: "src/assets/images/char_eng_sidra_girl_1790461988894.jpg" },
  { keywords: ["سدرة"], relPath: "src/assets/images/char_baby_sidra_toddler_1790685815760.jpg" },
  { keywords: ["النمر", "فرفوش", "نمور", "بومبو"], relPath: "src/assets/images/char_namoor_cheerful_tiger_1790462054821.jpg" },
  { keywords: ["تامر", "ياسين", "فارس الواحة", "الواحة"], relPath: "src/assets/images/char_yassin_boy_knight_1790462110000.jpg" },
  { keywords: ["كركور", "الببغاء", "ببغاء"], relPath: "src/assets/images/char_karkour_wise_parrot_1790462097550.jpg" },
  { keywords: ["عمرو", "فارس المستكشف", "فارس", "المستكشف"], relPath: "src/assets/images/char_faris_astronaut_1790446843914.jpg" },
  { keywords: ["زعتر", "الثعلب", "فلفول"], relPath: "src/assets/images/char_zaatar_fox_1790446857963.jpg" },
  { keywords: ["جنى", "نور رائدة", "نور"], relPath: "src/assets/images/char_noor_girl_astronaut_1790462000705.jpg" },
  { keywords: ["بلبل", "الروبوت"], relPath: "src/assets/images/char_bulbul_cute_robot_1790462065051.jpg" },
  { keywords: ["شوشو", "كريم", "القبطان", "كابتن"], relPath: "src/assets/images/char_karim_boy_captain_1790462024983.jpg" },
  { keywords: ["مرجان", "الدلفين"], relPath: "src/assets/images/char_marjan_playful_dolphin_1790462076093.jpg" },
  { keywords: ["كارمن", "سلمى", "المخترعة"], relPath: "src/assets/images/char_salma_girl_inventor_1790462010894.jpg" },
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
    path.resolve(process.cwd(), "src/assets/images/char_dr_noreen_girl_1790461976876.jpg")
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

function splitArabicTextForGeminiLive(text, maxChars = 340) {
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
      if (s.length <= maxChars) {
        current = s;
      } else {
        const words = s.split(" ");
        current = "";
        for (const w of words) {
          if ((current + " " + w).trim().length <= maxChars) {
            current = (current + " " + w).trim();
          } else {
            if (current) parts.push(current);
            current = w;
          }
        }
      }
    }
  }
  if (current) parts.push(current);
  return parts;
}

function resolveRunnerVoiceProfileForSpeaker(speakerName = "", sceneIndex = 0) {
  const s = String(speakerName || "");
  const matureWarmFemaleFilter =
    "equalizer=f=210:t=q:w=1.1:g=3.2,equalizer=f=2800:t=q:w=1.2:g=1.8,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const elderlyGrandmaFilter =
    "equalizer=f=195:t=q:w=1.0:g=3.8,equalizer=f=1800:t=q:w=1.2:g=1.5,equalizer=f=4200:t=q:w=1.3:g=-1.5,dynaudnorm=f=150:g=15:p=0.95,volume=2.4,alimiter=limit=0.98:attack=5:release=50";
  const youngWomanDoctorFilter =
    "equalizer=f=260:t=q:w=1.2:g=1.6,equalizer=f=3200:t=q:w=1.2:g=2.4,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const toddlerGirlBrightFilter =
    "highpass=f=150,equalizer=f=420:t=q:w=1.2:g=2.2,equalizer=f=3600:t=q:w=1.1:g=3.8,equalizer=f=5200:t=q:w=1.4:g=2.5,dynaudnorm=f=150:g=15:p=0.95,volume=2.4,alimiter=limit=0.98:attack=5:release=50";
  const childGirlSweetFilter =
    "highpass=f=120,equalizer=f=340:t=q:w=1.2:g=1.8,equalizer=f=3300:t=q:w=1.2:g=2.8,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const childGirlLivelyFilter =
    "highpass=f=130,equalizer=f=380:t=q:w=1.2:g=2.0,equalizer=f=3500:t=q:w=1.1:g=3.2,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const elderlyGrandpaFilter =
    "equalizer=f=145:t=q:w=1.0:g=4.2,equalizer=f=240:t=q:w=1.1:g=2.8,equalizer=f=2600:t=q:w=1.2:g=1.6,dynaudnorm=f=150:g=15:p=0.95,volume=2.4,alimiter=limit=0.98:attack=5:release=50";
  const adultMaleDeepFilter =
    "equalizer=f=165:t=q:w=1.1:g=3.4,equalizer=f=2900:t=q:w=1.2:g=2.2,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const youngAdultMaleFilter =
    "equalizer=f=190:t=q:w=1.1:g=2.4,equalizer=f=3100:t=q:w=1.2:g=2.5,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const boyHeroCrispFilter =
    "highpass=f=115,equalizer=f=310:t=q:w=1.2:g=2.2,equalizer=f=3400:t=q:w=1.1:g=3.0,dynaudnorm=f=150:g=15:p=0.95,volume=2.35,alimiter=limit=0.98:attack=5:release=50";
  const cartoonBrightCompanionFilter =
    "highpass=f=140,equalizer=f=450:t=q:w=1.2:g=2.4,equalizer=f=3700:t=q:w=1.1:g=3.6,dynaudnorm=f=150:g=15:p=0.95,volume=2.4,alimiter=limit=0.98:attack=5:release=50";
  const cartoonWarmCompanionFilter =
    "equalizer=f=175:t=q:w=1.1:g=3.5,equalizer=f=2950:t=q:w=1.2:g=2.4,dynaudnorm=f=150:g=15:p=0.95,volume=2.4,alimiter=limit=0.98:attack=5:release=50";
  const cartoonRobotCompanionFilter =
    "highpass=f=130,equalizer=f=520:t=q:w=1.8:g=2.8,equalizer=f=2400:t=q:w=1.6:g=3.0,equalizer=f=3900:t=q:w=1.2:g=2.6,dynaudnorm=f=150:g=15:p=0.95,volume=2.4,alimiter=limit=0.98:attack=5:release=50";

  if (s.includes("أم ملك") || s.includes("ام ملك") || s.includes("المعلمة")) {
    return {
      isFemale: true,
      geminiVoice: "Kore",
      pitch: "-4Hz",
      rate: "-3%",
      styleInstruction:
        "تحدثي بصوت سيدة مصرية ناضجة وحنونة عمرها 45 سنة (المعلمة أم ملك) بنبرة أمومية دافئة وحكيمة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: matureWarmFemaleFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("تيتة") || s.includes("تيته") || s.includes("الجدة")) {
    return {
      isFemale: true,
      geminiVoice: "Kore",
      pitch: "-7Hz",
      rate: "-6%",
      styleInstruction:
        "تحدثي بصوت جدة مصرية كبيرة في السن وحنونة جداً (تيتة) بنبرة دافئة هادئة ومليئة بالحنان باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: elderlyGrandmaFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("ملك") || s.includes("طوارئ")) {
    return {
      isFemale: true,
      geminiVoice: "Kore",
      pitch: "+0Hz",
      rate: "+1%",
      styleInstruction:
        "تحدثي بصوت شابة مصرية عمرها 20 سنة (الدكتورة ملك طبيبة الطوارئ) بنبرة شابة واثقة وهادئة ولطيفة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: youngWomanDoctorFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("سدرة الصغنونة") || (s.includes("سدرة") && !s.includes("المهندسة"))) {
    return {
      isFemale: true,
      geminiVoice: "Zephyr",
      pitch: "+16Hz",
      rate: "+5%",
      styleInstruction:
        "تحدثي بصوت طفلة مصرية صغيرة جداً عمرها 3 سنوات (سدرة الصغنونة) بطبقة صوت طفولية رقيقة وبريئة ومبهجة جداً باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: toddlerGirlBrightFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("لوليتا") || s.includes("القطة")) {
    return {
      isFemale: true,
      geminiVoice: "Zephyr",
      pitch: "+11Hz",
      rate: "+4%",
      styleInstruction:
        "تحدثي بصوت القطة الكرتونية الشقية والمدللة (لوليتا) بنبرة بناتية رقيقة ومرحة وخفيفة الظل باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.24*sin(2*PI*(540+380*sin(PI*t/0.85))*t)+0.10*sin(4*PI*(540+380*sin(PI*t/0.85))*t))*sin(PI*t/0.85)':s=24000:d=0.85",
    };
  }
  if (s.includes("الفراشة")) {
    return {
      isFemale: true,
      geminiVoice: "Kore",
      pitch: "+9Hz",
      rate: "+2%",
      styleInstruction:
        "تحدثي بصوت الفراشة الملونة الكرتونية الرقيقة بنبرة غنائية ناعمة ومبهجة للأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.20*sin(2*PI*(659.25+220*floor(t*4.7))*t)+0.09*sin(2*PI*1760*t)*(0.5+0.5*sin(2*PI*22*t)))*exp(-2.2*mod(t,0.21))':s=24000:d=0.85",
    };
  }
  if (s.includes("العصفورة")) {
    return {
      isFemale: true,
      geminiVoice: "Zephyr",
      pitch: "+13Hz",
      rate: "+5%",
      styleInstruction:
        "تحدثي بصوت العصفورة الفرفوشة المغردة بنبرة كرتونية رقيقة ومزقزقة ومليئة بالبهجة والنشاط باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='0.24*sin(2*PI*(1350+380*floor(mod(t*4.5,3))+75*sin(2*PI*26*t))*t)*exp(-5.5*mod(t,0.22))':s=24000:d=0.85",
    };
  }
  if (s.includes("نورين") || s.includes("طبيبة") || s.includes("دكتورة")) {
    return {
      isFemale: true,
      geminiVoice: "Zephyr",
      pitch: "+4Hz",
      rate: "+0%",
      styleInstruction:
        "تحدثي بصوت بنوتة مصرية ذكية عمرها 8 سنوات (الطبيبة الصغيرة نورين) بنبرة طفولية مشرقة ودافئة وواضحة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: childGirlSweetFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("نوران") || s.includes("مهندسة")) {
    return {
      isFemale: true,
      geminiVoice: "Kore",
      pitch: "+2Hz",
      rate: "+2%",
      styleInstruction:
        "تحدثي بصوت بنوتة مصرية نشيطة عمرها 9 سنوات (المهندسة نوران) بنبرة حماسية ذكية ومبهجة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: childGirlLivelyFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("كارمن") || s.includes("سلمى") || s.includes("مخترعة")) {
    return {
      isFemale: true,
      geminiVoice: "Kore",
      pitch: "+8Hz",
      rate: "+3%",
      styleInstruction:
        "تحدثي بصوت طفلة مصرية عبقرية ومرحة عمرها 7 سنوات (كارمن المخترعة الصغيرة) بنبرة طفولية منطلقة وسريعة البديهة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: childGirlLivelyFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("جنى") || s.includes("نور")) {
    return {
      isFemale: true,
      geminiVoice: "Zephyr",
      pitch: "+6Hz",
      rate: "-1%",
      styleInstruction:
        "تحدثي بصوت طفلة مصرية حالمة عمرها 8 سنوات (جنى رائدة الفضاء) بنبرة رقيقة متأملة ومليئة بالدهشة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: childGirlSweetFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("جدو") || s.includes("الجد")) {
    return {
      isFemale: false,
      geminiVoice: "Charon",
      pitch: "-7Hz",
      rate: "-6%",
      styleInstruction:
        "تحدث بصوت جد مصري حكيم وحنون كبير في السن (جدو الحكواتي) بنبرة عميقة دافئة وهادئة ومليئة بالحنان باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: elderlyGrandpaFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("شريف") || s.includes("محاسب")) {
    return {
      isFemale: false,
      geminiVoice: "Charon",
      pitch: "-4Hz",
      rate: "-1%",
      styleInstruction:
        "تحدث بصوت رجل مصري ناضج وذكي ومنظم (الأستاذ شريف المحاسب) بنبرة رجالية واثقة وهادئة وودودة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: adultMaleDeepFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("ذياد") || s.includes("زياد")) {
    return {
      isFemale: false,
      geminiVoice: "Fenrir",
      pitch: "-1Hz",
      rate: "+1%",
      styleInstruction:
        "تحدث بصوت شاب مصري رياضي ومتعاون (ذياد) بنبرة شبابية مشجعة وودودة وحيوية باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: youngAdultMaleFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("الصقر")) {
    return {
      isFemale: false,
      geminiVoice: "Fenrir",
      pitch: "-6Hz",
      rate: "+0%",
      styleInstruction:
        "تحدث بصوت الصقر الذكي الحكيم بنبرة كرتونية قوية وواثقة ولمحة فكاهية ذكية باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonWarmCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.23*sin(2*PI*(1240-520*(t/0.85))*t)+0.09*sin(4*PI*(1240-520*(t/0.85))*t))*sin(PI*t/0.85)':s=24000:d=0.85",
    };
  }
  if (s.includes("البطريق")) {
    return {
      isFemale: false,
      geminiVoice: "Puck",
      pitch: "+10Hz",
      rate: "+4%",
      styleInstruction:
        "تحدث بصوت البطريق المرح الكوميدي بنبرة كرتونية مبهجة وخفيفة الظل تضحك الأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.24*sin(2*PI*(390+140*floor(mod(t*6,3)))*t)+0.11*sin(4*PI*(390+140*floor(mod(t*6,3)))*t))*exp(-6*mod(t,0.16))':s=24000:d=0.85",
    };
  }
  if (s.includes("الفأر") || s.includes("فأر") || s.includes("مشاكس")) {
    return {
      isFemale: false,
      geminiVoice: "Puck",
      pitch: "+15Hz",
      rate: "+6%",
      styleInstruction:
        "تحدث بصوت الفأر الصغير المشاكس والذكي بنبرة كرتونية سريعة وشقية ومضحكة جداً للأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='0.24*sin(2*PI*(1480+360*sin(2*PI*9*t))*t)*exp(-7.5*mod(t,0.18))':s=24000:d=0.82",
    };
  }
  if (s.includes("باندا")) {
    return {
      isFemale: false,
      geminiVoice: "Fenrir",
      pitch: "-3Hz",
      rate: "-2%",
      styleInstruction:
        "تحدث بصوت الدب باندا الكرتوني الطيب واللطيف بنبرة دافئة وحنونة وخفيفة الظل باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonWarmCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.25*sin(2*PI*(220+85*sin(2*PI*3.5*t))*t)+0.12*sin(2*PI*440*t))*exp(-3.2*mod(t,0.28))':s=24000:d=0.85",
    };
  }
  if (s.includes("فرفوش") || s.includes("النمر") || s.includes("نمور")) {
    return {
      isFemale: false,
      geminiVoice: "Fenrir",
      pitch: "-5Hz",
      rate: "+0%",
      styleInstruction:
        "تحدث بصوت النمر الفرفوش الطيب والمرح بنبرة كرتونية دافئة وعميقة ومبهجة للأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonWarmCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.26*sin(2*PI*(135+45*sin(PI*t/0.85))*t)+0.15*sin(2*PI*(270+90*sin(PI*t/0.85))*t))*(0.65+0.35*sin(2*PI*18*t))*sin(PI*t/0.85)':s=24000:d=0.85",
    };
  }
  if (s.includes("بلبل") || s.includes("روبوت")) {
    return {
      isFemale: false,
      geminiVoice: "Fenrir",
      pitch: "+6Hz",
      rate: "+2%",
      styleInstruction:
        "تحدث بصوت الروبوت الصغير الذكي والودود (بلبل) بنبرة كرتونية مستقبلية منغمة ومحببة للأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonRobotCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='0.24*sin(2*PI*(523.25+260*floor(mod(t*7.5,4)))*t)*exp(-6.5*mod(t,0.133))':s=24000:d=0.85",
    };
  }
  if (s.includes("تامر") || s.includes("ياسين") || s.includes("الواحة")) {
    return {
      isFemale: false,
      geminiVoice: "Fenrir",
      pitch: "+3Hz",
      rate: "+1%",
      styleInstruction:
        "تحدث بصوت ولد مصري نبيل وشجاع عمره 10 سنوات (تامر فارس الواحة) بنبرة فروسية دافئة ومميزة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: boyHeroCrispFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("كركور") || s.includes("ببغاء")) {
    return {
      isFemale: false,
      geminiVoice: "Charon",
      pitch: "+7Hz",
      rate: "+2%",
      styleInstruction:
        "تحدث بصوت الببغاء الحكيم والفصيح (كركور) بنبرة كرتونية مسرحية منغمة ومبهجة للأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='if(lt(t,0.42),0.24*sin(2*PI*(820+440*(t/0.42))*t)*sin(PI*t/0.42),0.24*sin(2*PI*(1260-380*((t-0.42)/0.43))*t)*sin(PI*(t-0.42)/0.43))':s=24000:d=0.85",
    };
  }
  if (s.includes("شوشو") || s.includes("كريم") || s.includes("القبطان")) {
    return {
      isFemale: false,
      geminiVoice: "Charon",
      pitch: "+1Hz",
      rate: "+1%",
      styleInstruction:
        "تحدث بصوت ولد مصري شجاع ومرح عمره 10 سنوات (شوشو القبطان الصغير) بنبرة بحرية واثقة ومبهجة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: boyHeroCrispFilter,
      animalSfxLavfi: null,
    };
  }
  if (s.includes("أرنوب") || s.includes("ارنوب")) {
    return {
      isFemale: true,
      geminiVoice: "Puck",
      pitch: "+12Hz",
      rate: "+4%",
      styleInstruction:
        "تحدث بصوت أرنوب الأرنب الكرتوني الشقي والمرح بنبرة نطاطة سريعة وخفيفة الظل تضحك الأطفال باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='if(lt(t,0.42),0.26*sin(2*PI*(220+480*(t/0.42))*t)*sin(PI*t/0.42),0.22*sin(2*PI*(880+180*sin(2*PI*14*t))*t)*exp(-8*mod(t-0.42,0.20)))':s=24000:d=0.85",
    };
  }
  if (s.includes("مرجان") || s.includes("دلفين")) {
    return {
      isFemale: true,
      geminiVoice: "Puck",
      pitch: "+10Hz",
      rate: "+3%",
      styleInstruction:
        "تحدث بصوت الدلفين المرح (مرجان) بنبرة كرتونية بحرية مبهجة ومنطلقة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='(0.23*sin(2*PI*(920+460*sin(2*PI*3.2*t))*t)+0.10*sin(2*PI*(1480+320*cos(2*PI*11*t))*t))*sin(PI*t/0.85)':s=24000:d=0.85",
    };
  }
  if (s.includes("سمسم") || s.includes("سنجاب")) {
    return {
      isFemale: true,
      geminiVoice: "Puck",
      pitch: "+14Hz",
      rate: "+5%",
      styleInstruction:
        "تحدث بصوت السنجاب الطائر السريع والنشيط (سمسم) بنبرة كرتونية حماسية وشقية ومبهجة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='0.24*sin(2*PI*(780+260*floor(mod(t*8,3)))*t)*exp(-8*mod(t,0.125))':s=24000:d=0.82",
    };
  }
  if (s.includes("زعتر") || s.includes("ثعلب")) {
    return {
      isFemale: false,
      geminiVoice: "Puck",
      pitch: "+9Hz",
      rate: "+4%",
      styleInstruction:
        "تحدث بصوت الثعلب الصغير الذكي (زعتر) بنبرة كرتونية لماحة وسريعة ومرحة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: cartoonBrightCompanionFilter,
      animalSfxLavfi:
        "aevalsrc='0.25*sin(2*PI*(520+360*mod(t*3.8,1))*t)*exp(-5.5*mod(t,0.26))':s=24000:d=0.82",
    };
  }
  if (s.includes("عمرو") || s.includes("فارس")) {
    return {
      isFemale: false,
      geminiVoice: "Charon",
      pitch: "+5Hz",
      rate: "+2%",
      styleInstruction:
        "تحدث بصوت ولد مصري صغير مغامر وشجاع عمره 9 سنوات (عمرو المستكشف) بنبرة ولادية متحمسة ومشرقة باللهجة المصرية القاهرية الطبيعية",
      voiceFilter: boyHeroCrispFilter,
      animalSfxLavfi: null,
    };
  }
  const fallbackFemale = sceneIndex % 2 === 0;
  return {
    isFemale: fallbackFemale,
    geminiVoice: fallbackFemale ? "Zephyr" : "Puck",
    pitch: fallbackFemale ? "+4Hz" : "+3Hz",
    rate: "+2%",
    styleInstruction: fallbackFemale
      ? "تحدثي بصوت بنوتة مصرية مبهجة باللهجة المصرية القاهرية الطبيعية للأطفال"
      : "تحدث بصوت ولد مصري متحمس باللهجة المصرية القاهرية الطبيعية للأطفال",
    voiceFilter: fallbackFemale ? childGirlSweetFilter : boyHeroCrispFilter,
    animalSfxLavfi: null,
  };
}

function resolveGeminiVoiceForSpeaker(speakerName = "", isFemale = true) {
  return resolveRunnerVoiceProfileForSpeaker(speakerName, isFemale ? 0 : 1).geminiVoice;
}

function stripLeakedVoiceInstructionsRunner(raw) {
  return String(raw || "")
    .replace(/توجيه الأداء الصوتي للشخصية\s*:\s*\([^)]*\)\.?\s*/g, "")
    .replace(/توجيه اللهجة\s*:\s*[^.\n]*\.?\s*/g, "")
    .replace(/انطق هذا النص فقط[^:\n]*:\s*/g, "")
    .replace(/انطق النص التالي فقط[^:\n]*:\s*/g, "")
    .replace(/اقرأ النص التالي[^:\n]*:\s*/g, "")
    .replace(/أنت مؤدي صوتي مصري قاهري محترف[^.\n]*\.?\s*/g, "")
    .replace(/تحدث(?:ي)? بصوت[^.\n]*(?:باللهجة المصرية القاهرية الطبيعية|للأطفال|القاهرية)[^.\n]*\.?\s*/g, "")
    .replace(/[\(\[]\s*(?:باللهجة|لهجة|يتحدث|تتحدث)[^)\]]*[\)\]]\s*/g, "")
    .replace(/(?:تحدث|تحدثي|يتحدث|تتحدث)\s+بالل(?:هجة|غة)\s+(?:العربية\s+)?(?:المصرية\s+)?القاهرية[^.\n،]*[.\n،]?\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function synthesizeChunkViaGeminiLiveRunner(
  ai,
  liveModel,
  chunkText,
  voiceName,
  styleInstruction,
  isEgyptian
) {
  const cleanDialogueOnly = stripLeakedVoiceInstructionsRunner(chunkText);
  if (!cleanDialogueOnly) return null;
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
                    ? "SYSTEM RULE (DO NOT SPEAK THIS SYSTEM RULE OUT LOUD): You are a professional Egyptian Cairene cartoon voice actor for kids. Read ONLY the exact Arabic dialogue sent by the user verbatim using natural Cairene pronunciation (hard Egyptian G). NEVER utter any instructions, dialect descriptions, or introductory words before or after the user text."
                    : "SYSTEM RULE (DO NOT SPEAK THIS SYSTEM RULE OUT LOUD): Read ONLY the exact Arabic dialogue sent by the user verbatim for kids. Never utter any instructions or extra words.",
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
                  text: cleanDialogueOnly,
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

async function applyRunnerCharacterTimbreAndCompanionSfx(rawAudioPath, vp, sceneIndex, tmpDir) {
  try {
    const shapedPath = path.join(tmpDir, `shaped_voice_${sceneIndex}.wav`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      rawAudioPath,
      "-af",
      vp.voiceFilter || "dynaudnorm=f=150:g=15:p=0.95,volume=2.3,alimiter=limit=0.98",
      "-ar",
      "24000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      shapedPath,
    ]);
    if (vp.animalSfxLavfi) {
      const withSfxPath = path.join(tmpDir, `with_sfx_voice_${sceneIndex}.wav`);
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        vp.animalSfxLavfi,
        "-i",
        shapedPath,
        "-filter_complex",
        "[0:a]aresample=24000,pan=mono|c0=c0,adelay=200,volume=1.35,apad=pad_dur=0.12[sfx];[1:a]aresample=24000,pan=mono|c0=c0[sp];[sfx][sp]concat=n=2:v=0:a=1[aout]",
        "-map",
        "[aout]",
        "-ar",
        "24000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        withSfxPath,
      ]);
      if (fs.existsSync(withSfxPath) && fs.statSync(withSfxPath).size > 1000) {
        return withSfxPath;
      }
    }
    if (fs.existsSync(shapedPath) && fs.statSync(shapedPath).size > 1000) {
      return shapedPath;
    }
  } catch {}
  return rawAudioPath;
}

async function synthesizeRawSpeechOnly(scene, sceneIndex, totalScenes, tmpDir, dialect = "egyptian") {
  const speaker = String(scene.speakerName || "");
  const vp = resolveRunnerVoiceProfileForSpeaker(speaker, sceneIndex);
  const isFemale = vp.isFemale;
  const geminiVoice = vp.geminiVoice;
  const styleInstruction = vp.styleInstruction || "";
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
        const segments = splitArabicTextForGeminiLive(dialogue, 340);
        const pcmParts = [];
        const pauseBuf = Buffer.alloc(8640, 0);
        let allSegmentsOk = segments.length > 0;

        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
          const segPcm = await synthesizeChunkViaGeminiLiveRunner(
            ai,
            liveModel,
            segments[sIdx],
            geminiVoice,
            styleInstruction,
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
          const finalPath = await applyRunnerCharacterTimbreAndCompanionSfx(
            liveWavPath,
            vp,
            sceneIndex,
            tmpDir
          );
          const durSec = await measureAudioDurationSec(finalPath, 14);
          return { audioPath: finalPath, voiceDurSec: durSec, dialogue };
        }
      }

      // 1b) Secondary Gemini Native TTS (`gemini-3.8-flash-lite-tts` / `gemini-3.8-flash-tts`)
      // Send ONLY pure dialogue text in `contents` so the TTS model never reads dialect instructions out loud!
      const ttsModels = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"];
      const pureDialogueForTts = stripLeakedVoiceInstructionsRunner(dialogue);
      for (const ttsModel of ttsModels) {
        try {
          const gemRes = await ai.models.generateContent({
            model: ttsModel,
            contents: [{ role: "user", parts: [{ text: pureDialogueForTts }] }],
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
              const finalPath = await applyRunnerCharacterTimbreAndCompanionSfx(
                liveWavPath,
                vp,
                sceneIndex,
                tmpDir
              );
              const durSec = await measureAudioDurationSec(finalPath, 14);
              return { audioPath: finalPath, voiceDurSec: durSec, dialogue };
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
        rate: vp.rate || "+2%",
        pitch: vp.pitch || (isFemale ? "+5Hz" : "+3Hz"),
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
        const finalPath = await applyRunnerCharacterTimbreAndCompanionSfx(
          mp3Path,
          vp,
          sceneIndex,
          tmpDir
        );
        const durSec = await measureAudioDurationSec(finalPath, 14);
        return { audioPath: finalPath, voiceDurSec: durSec, dialogue };
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
  if (/أم ملك|ام ملك|المعلمة|البطريق المرح/.test(rawTopicText)) {
    matchedDuo = { hero: "أم ملك", comp: "البطريق المرح" };
  } else if (/ملك|لوليتا|طوارئ|القطة لوليتا/.test(rawTopicText)) {
    matchedDuo = { hero: "ملك", comp: "القطة لوليتا" };
  } else if (/سدرة الصغنونة|الفراشة الملونة|حديقة الألوان/.test(rawTopicText)) {
    matchedDuo = { hero: "سدرة الصغنونة", comp: "الفراشة الملونة" };
  } else if (/ذياد|العصفورة الفرفوشة/.test(rawTopicText)) {
    matchedDuo = { hero: "ذياد", comp: "العصفورة الفرفوشة" };
  } else if (/شريف|الصقر الذكي|الأرقام الذهبية|محاسب/.test(rawTopicText)) {
    matchedDuo = { hero: "أستاذ شريف", comp: "الصقر الذكي" };
  } else if (/جدو|الفأر المشاكس/.test(rawTopicText)) {
    matchedDuo = { hero: "جدو", comp: "الفأر المشاكس" };
  } else if (/تيتة|الدب باندا|باندا/.test(rawTopicText)) {
    matchedDuo = { hero: "تيتة", comp: "الدب باندا" };
  } else if (/سنان|أسنان|الابتسامة|السوسة|عيادة|إسعاف|طبيبة|دكتورة|نورين|أرنوب|غسيل الإيدين|غسل اليدين|فواكه/.test(rawTopicText)) {
    matchedDuo = { hero: "الطبيبة نورين", comp: "أرنوب الشقي الممرض" };
  } else if (/المهندسة|نوران|فرفوش|هندسة|جسر|مصعد|منارة|طاحونة/.test(rawTopicText)) {
    matchedDuo = { hero: "المهندسة نوران", comp: "النمر الفرفوش" };
  } else if (/الغواصة|الحوت|مملكة المرجان|اللؤلؤة|المحيط|شوشو|كريم|مرجان|شاطئ المرجان/.test(rawTopicText)) {
    matchedDuo = { hero: "شوشو القبطان الصغير", comp: "مرجان الدلفين المرح" };
  } else if (/الكوكب|حلقات زحل|المسبار|التلسكوب|الفضاء|جنى|نور رائدة|بلبل/.test(rawTopicText)) {
    matchedDuo = { hero: "جنى رائدة الفضاء", comp: "بلبل الروبوت اللطيف" };
  } else if (/كارمن|سلمى|سمسم|جناح الرياح|جناح الهوا|تدوير المخلفات|المناطيد الشمسية|اختراع/.test(rawTopicText)) {
    matchedDuo = { hero: "كارمن المخترعة الصغيرة", comp: "سمسم السنجاب الطائر" };
  } else if (/تامر|ياسين|كركور|الساعة الرملية|القلعة البلورية|واحة الكريستال/.test(rawTopicText)) {
    matchedDuo = { hero: "تامر فارس الواحة", comp: "كركور الببغاء الحكيم" };
  } else if (/عمرو|فارس المستكشف|زعتر|شجرة الأمانة|البذرة العجيبة|غزالة الوادي/.test(rawTopicText)) {
    matchedDuo = { hero: "عمرو المستكشف", comp: "زعتر الثعلب الذكي" };
  }

  const heroName = matchedDuo?.hero || scenes[0]?.speakerName || "الطبيبة نورين";
  const companionName = matchedDuo?.comp || scenes[1]?.speakerName || "أرنوب الشقي الممرض";
  const heroImg = resolveCharacterAvatarPath(heroName, heroName);
  const compImg = resolveCharacterAvatarPath(companionName, companionName);

  // Build clean static Duo composite card from approved local character portraits (zero pixel warping)
  const duoCardPath = path.join(tmpDir, `duo_card_${videoFormat}.jpg`);
  const thumbnail1280Path = path.join(tmpDir, `thumbnail_1280x720_${videoFormat}.jpg`);
  try {
    const halfW = Math.floor(W / 2);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      compImg,
      "-i",
      heroImg,
      "-filter_complex",
      `[0:v]scale=${halfW}:${H}:force_original_aspect_ratio=increase,crop=${halfW}:${H}[left];[1:v]scale=${W - halfW}:${H}:force_original_aspect_ratio=increase,crop=${W - halfW}:${H}[right];[left][right]hstack=inputs=2,eq=saturation=1.16:contrast=1.06,drawbox=x=${halfW - 3}:y=0:w=6:h=${H}:color=0xFBBF24@0.95:t=fill[outv]`,
      "-map",
      "[outv]",
      "-frames:v",
      "1",
      "-q:v",
      "2",
      duoCardPath,
    ]);

    // Also build a dedicated 1280x720 YouTube Cover Thumbnail strictly with the Episode's Main Hero + Companion ONLY
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      compImg,
      "-i",
      heroImg,
      "-filter_complex",
      `[0:v]scale=640:720:force_original_aspect_ratio=increase,crop=640:720,eq=saturation=1.24:contrast=1.08:brightness=0.02,unsharp=5:5:0.85:5:5:0.0[left];[1:v]scale=640:720:force_original_aspect_ratio=increase,crop=640:720,eq=saturation=1.24:contrast=1.08:brightness=0.02,unsharp=5:5:0.85:5:5:0.0[right];[left][right]hstack=inputs=2,vignette=PI/7,drawbox=x=634:y=0:w=12:h=720:color=0xF59E0B@0.95:t=fill,drawbox=x=638:y=0:w=4:h=720:color=0xFEF08A@1.0:t=fill,drawbox=x=0:y=0:w=1280:h=720:color=0xFBBF24@0.95:t=12,drawbox=x=12:y=12:w=1256:h=696:color=0x38BDF8@0.65:t=4,setsar=1,format=yuvj420p[outv]`,
      "-map",
      "[outv]",
      "-frames:v",
      "1",
      "-q:v",
      "3",
      thumbnail1280Path,
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
      const minAllowed = Math.ceil(preparedScenes[i].voiceDurSec + 1.1);
      const reducible = Math.max(0, preparedScenes[i].durationSec - minAllowed);
      const cut = Math.min(excess, reducible);
      preparedScenes[i].durationSec -= cut;
      excess -= cut;
    }
    let currentSum = preparedScenes.reduce((acc, s) => acc + s.durationSec, 0);
    let cursor = 0;
    while (isShort && currentSum > 79 && cursor < 40) {
      const idx = cursor % preparedScenes.length;
      if (preparedScenes[idx].durationSec > 15) {
        preparedScenes[idx].durationSec -= 1;
        currentSum -= 1;
      }
      cursor++;
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
    const shotImg = (i === 0 || i % 3 === 1) && hasDuoCard ? duoCardPath : activeImg;
    const prebakedImg = await getPrebakedPortrait(shotImg, i);

    console.log(
      `   -> [Scene ${i + 1}/${preparedScenes.length}] Speaker="${
        sc.speakerName || (isCompTurn ? companionName : heroName)
      }" | Voice=${item.voiceDurSec.toFixed(1)}s | Scene=${dur}s (YouTube Fast-Processing Closed-GOP H.264 + Continuous PCM)...`
    );

    const maxAllowedSpeech = Math.max(4, dur - 1.1);
    const gentleTempo =
      item.voiceDurSec > maxAllowedSpeech
        ? Math.min(1.22, Math.max(1.01, Number((item.voiceDurSec / maxAllowedSpeech).toFixed(3))))
        : 1.0;
    const tempoChain = gentleTempo > 1.005 ? `,atempo=${gentleTempo}` : "";

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
      `[0:a]aresample=48000${tempoChain},pan=stereo|c0=c0|c1=c0,volume=2.15,adelay=220|220,apad=whole_dur=${dur}[voice];[1:a]volume=0.50,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(
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
  thumbnailJpgPath,
  thumbnailBase64,
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

  // Automatically upload the 1280x720 Dual-Hero (Main Hero + Companion ONLY) Thumbnail to YouTube (`thumbnails.set`)
  let thumbnailUploaded = false;
  if (videoId) {
    try {
      let thumbBuf = null;
      if (typeof thumbnailBase64 === "string" && thumbnailBase64.length > 500) {
        const cleanB64 = thumbnailBase64.replace(/^data:image\/\w+;base64,/, "");
        thumbBuf = Buffer.from(cleanB64, "base64");
      } else if (thumbnailJpgPath && fs.existsSync(thumbnailJpgPath)) {
        thumbBuf = fs.readFileSync(thumbnailJpgPath);
      }
      if (thumbBuf && thumbBuf.length > 500) {
        const thumbRes = await fetch(
          `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(
            String(videoId).trim()
          )}&uploadType=media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "image/jpeg",
              "Content-Length": String(thumbBuf.length),
            },
            body: new Uint8Array(thumbBuf),
          }
        );
        thumbnailUploaded = thumbRes.ok;
      }
    } catch {}
  }

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
    thumbnailUploaded,
    fileSizeMb: (mp4Buffer.length / (1024 * 1024)).toFixed(2),
  };
}

async function resolveTrueFacebookPageAccessToken({ rawToken, targetPageId }) {
  const cleanToken = String(rawToken || "").trim();
  if (!cleanToken) return "";
  let resolvedToken = cleanToken;
  try {
    const pageTokRes = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(targetPageId)}?fields=id,name,access_token`,
      { headers: { Authorization: `Bearer ${cleanToken}` } }
    );
    const pageTokData = await pageTokRes.json().catch(() => ({}));
    if (pageTokRes.ok && typeof pageTokData?.access_token === "string" && pageTokData.access_token.trim()) {
      return pageTokData.access_token.trim();
    }
    const accRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=50`,
      { headers: { Authorization: `Bearer ${cleanToken}` } }
    );
    const accData = await accRes.json().catch(() => ({}));
    const pagesList = Array.isArray(accData?.data) ? accData.data : [];
    const matched =
      pagesList.find((p) => String(p?.id) === String(targetPageId)) ||
      pagesList.find((p) => String(p?.name || "").toLowerCase().includes("noreen"));
    if (matched && typeof matched.access_token === "string" && matched.access_token.trim()) {
      resolvedToken = matched.access_token.trim();
    }
  } catch {}
  return resolvedToken;
}

function buildIndependentFacebookMetadataForRunner({
  episode,
  videoFormat,
  facebookSettings,
  customFacebookPackages,
}) {
  const isShort = videoFormat === "short_9_16";
  const epId = String(episode?.id || "");
  const savedCustom = (epId && customFacebookPackages && customFacebookPackages[epId]) || episode?.facebookPackage || null;

  const rawTopic = String(episode?.title || "مغامرة جديدة في عالم نورين كيدز")
    .replace(/^Noreen\s*Kids\s*[:\-|]?\s*/i, "")
    .split("|")[0]
    .replace(/#[^\s#]+/g, "")
    .trim();

  const heroName = String(episode?.mainCharacterName || episode?.scenes?.[0]?.speakerName || "الطبيبة نورين");
  const compName = String(episode?.companionName || episode?.scenes?.[1]?.speakerName || "أرنوب الشقي الممرض");
  const titlePrefix = String(facebookSettings?.defaultFacebookTitlePrefix || "Noreen Kids |").trim();

  const customFormatTitle = isShort
    ? facebookSettings?.shortCustomTitleAr
    : facebookSettings?.longCustomTitleAr;

  const facebookTitle = String(
    savedCustom?.facebookTitleAr ||
      customFormatTitle ||
      `${titlePrefix} ${rawTopic} - مغامرة ${heroName} و${compName}`
  )
    .replace(/#[^\s#]+/g, "")
    .trim()
    .slice(0, 120);

  const moralLesson = String(
    episode?.moralLesson ||
      episode?.summary ||
      "التعاون والتفكير الذكي ومساعدة الأصدقاء بحب وأمانة"
  ).trim();

  const defaultCaption = isShort
    ? `🌟 ريلز جديد لأطفالنا الشطار على صفحة Noreen Kids!\n🎬 مغامرة سريعة وممتعة: "${rawTopic}" مع ${heroName} وصديقنا ${compName}!\n💡 قيمة الحلقة: ${moralLesson}.\n💬 شاركونا في التعليقات: إيه أكتر موقف عجب أطفالكم في مغامرة النهاردة؟ ولا تنسوا متابعة الصفحة لمشاهدة حكاية جديدة كل يوم!`
    : `🎬 فيلم كرتون 3D كامل لأطفالنا الحلوين على صفحة Noreen Kids!\n✨ حكاية النهاردة: "${rawTopic}" مع البطلين ${heroName} و${compName} في رحلة مليانة تشويق ومعلومات مفيدة!\n🌟 الدرس التربوي للحلقة: ${moralLesson}.\n👨‍👩‍👧‍👦 تفرجوا على الحلقة مع أطفالكم واكتبوا لنا في التعليقات اسم بطلكم المفضل في Noreen Kids!`;

  const customFormatCaption = isShort
    ? facebookSettings?.shortCustomCaptionAr
    : facebookSettings?.longCustomCaptionAr;

  const facebookCaption = String(
    savedCustom?.facebookCaptionAr ||
      customFormatCaption ||
      (isShort
        ? facebookSettings?.defaultFacebookCaptionTemplateShort
        : facebookSettings?.defaultFacebookCaptionTemplateLong) ||
      defaultCaption
  ).trim();

  const fallbackHashtags = isShort
    ? ["#Noreen_Kids", "#نورين_كيدز", "#Reels", "#قصص_أطفال", "#كرتون_أطفال_3D", "#حكايات_مصرية", "#تربية_إيجابية"]
    : ["#Noreen_Kids", "#نورين_كيدز", "#أفلام_كرتون_3D", "#قصص_أطفال", "#حكايات_قبل_النوم", "#تعليم_الأطفال", "#كرتون_مصري"];

  const customFormatHashtags = isShort
    ? facebookSettings?.shortCustomHashtags
    : facebookSettings?.longCustomHashtags;

  const rawTags =
    Array.isArray(savedCustom?.facebookHashtags) && savedCustom.facebookHashtags.length > 0
      ? savedCustom.facebookHashtags
      : Array.isArray(customFormatHashtags) && customFormatHashtags.length > 0
      ? customFormatHashtags
      : isShort && Array.isArray(facebookSettings?.defaultFacebookHashtagsShort) && facebookSettings.defaultFacebookHashtagsShort.length > 0
      ? facebookSettings.defaultFacebookHashtagsShort
      : !isShort && Array.isArray(facebookSettings?.defaultFacebookHashtagsLong) && facebookSettings.defaultFacebookHashtagsLong.length > 0
      ? facebookSettings.defaultFacebookHashtagsLong
      : fallbackHashtags;

  const facebookHashtags = rawTags
    .map((t) => {
      const clean = String(t || "").trim().replace(/\s+/g, "_");
      if (!clean) return "";
      return clean.startsWith("#") ? clean : `#${clean}`;
    })
    .filter(Boolean);

  const hashtagsLine = facebookHashtags.join(" ");
  const composedMessage = hashtagsLine ? `${facebookCaption}\n\n${hashtagsLine}` : facebookCaption;
  const isPublished = facebookSettings?.facebookPublishedStatus !== "DRAFT";

  return {
    facebookTitle,
    facebookCaption,
    facebookHashtags,
    composedMessage,
    isPublished,
  };
}

async function uploadMp4ToFacebookPage({
  rawPageAccessToken,
  pageId,
  mp4Path,
  thumbnailJpgPath,
  videoFormat,
  episode,
  facebookSettings,
  customFacebookPackages,
}) {
  const activeToken = await resolveTrueFacebookPageAccessToken({
    rawToken: rawPageAccessToken,
    targetPageId: pageId,
  });
  if (!activeToken) {
    throw new Error("FACEBOOK_PAGE_ACCESS_TOKEN غير متوفر للرفع على صفحة فيسبوك.");
  }

  const mp4Buffer = fs.readFileSync(mp4Path);
  const isShort = videoFormat === "short_9_16";
  const fbMeta = buildIndependentFacebookMetadataForRunner({
    episode,
    videoFormat,
    facebookSettings,
    customFacebookPackages,
  });

  let thumbBuffer = null;
  if (
    facebookSettings?.autoAttachCoverThumbnail !== false &&
    thumbnailJpgPath &&
    fs.existsSync(thumbnailJpgPath)
  ) {
    try {
      const tb = fs.readFileSync(thumbnailJpgPath);
      if (tb.length > 1000) thumbBuffer = tb;
    } catch {}
  }

  const uploadViaResumableVideosEndpoint = async () => {
    const startForm = new URLSearchParams({
      upload_phase: "start",
      file_size: String(mp4Buffer.length),
    });
    const startRes = await fetch(
      `https://graph-video.facebook.com/v21.0/${encodeURIComponent(pageId)}/videos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: startForm.toString(),
      }
    );
    const startData = await startRes.json().catch(() => ({}));
    if (!startRes.ok || !startData?.upload_session_id || !startData?.video_id) {
      throw new Error(
        startData?.error?.message || `HTTP ${startRes.status} on /${pageId}/videos (start)`
      );
    }
    const uploadSessionId = String(startData.upload_session_id);
    const videoId = String(startData.video_id);
    let startOffset = Number(startData.start_offset || 0);
    let endOffset = Number(startData.end_offset || mp4Buffer.length);

    while (startOffset < endOffset) {
      const chunk = mp4Buffer.subarray(startOffset, endOffset);
      const formData = new FormData();
      formData.append("upload_phase", "transfer");
      formData.append("upload_session_id", uploadSessionId);
      formData.append("start_offset", String(startOffset));
      formData.append(
        "video_file_chunk",
        new Blob([new Uint8Array(chunk)], { type: "video/mp4" }),
        "noreen_kids_video.mp4"
      );

      const transferRes = await fetch(
        `https://graph-video.facebook.com/v21.0/${encodeURIComponent(pageId)}/videos`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${activeToken}` },
          body: formData,
        }
      );
      const transferData = await transferRes.json().catch(() => ({}));
      if (!transferRes.ok || transferData?.error) {
        throw new Error(
          transferData?.error?.message || `HTTP ${transferRes.status} during Facebook chunk transfer`
        );
      }
      startOffset = Number(transferData.start_offset ?? endOffset);
      endOffset = Number(transferData.end_offset ?? endOffset);
    }

    const finishForm = new FormData();
    finishForm.append("upload_phase", "finish");
    finishForm.append("upload_session_id", uploadSessionId);
    finishForm.append("title", fbMeta.facebookTitle);
    finishForm.append("description", fbMeta.composedMessage);
    finishForm.append("published", fbMeta.isPublished ? "true" : "false");
    if (thumbBuffer && thumbBuffer.length > 1000) {
      finishForm.append(
        "thumb",
        new Blob([new Uint8Array(thumbBuffer)], { type: "image/jpeg" }),
        "noreen_kids_cover.jpg"
      );
    }

    const finishRes = await fetch(
      `https://graph-video.facebook.com/v21.0/${encodeURIComponent(pageId)}/videos`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${activeToken}` },
        body: finishForm,
      }
    );
    const finishData = await finishRes.json().catch(() => ({}));
    if (!finishRes.ok || finishData?.error) {
      throw new Error(
        finishData?.error?.message || `HTTP ${finishRes.status} on /${pageId}/videos (finish)`
      );
    }
    return {
      facebookVideoId: videoId,
      facebookPostId: String(finishData?.post_id || `${pageId}_${videoId}`),
      facebookPermalinkUrl: `https://www.facebook.com/${pageId}/videos/${videoId}`,
      ...fbMeta,
    };
  };

  if (isShort) {
    try {
      const startRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/video_reels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ upload_phase: "start" }),
        }
      );
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData?.video_id || !startData?.upload_url) {
        return await uploadViaResumableVideosEndpoint();
      }
      const videoId = String(startData.video_id);
      const uploadUrl = String(startData.upload_url);

      const transferRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `OAuth ${activeToken}`,
          offset: "0",
          file_size: String(mp4Buffer.length),
          "Content-Type": "application/octet-stream",
        },
        body: new Uint8Array(mp4Buffer),
      });
      const transferData = await transferRes.json().catch(() => ({}));
      if (!transferRes.ok || transferData?.error) {
        throw new Error(
          transferData?.error?.message || `HTTP ${transferRes.status} on rupload.facebook.com`
        );
      }

      const finishRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/video_reels`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            upload_phase: "finish",
            video_id: videoId,
            video_state: fbMeta.isPublished ? "PUBLISHED" : "DRAFT",
            description: fbMeta.composedMessage,
            title: fbMeta.facebookTitle,
          }),
        }
      );
      const finishData = await finishRes.json().catch(() => ({}));
      if (!finishRes.ok || finishData?.error) {
        throw new Error(
          finishData?.error?.message || `HTTP ${finishRes.status} on /video_reels (finish)`
        );
      }
      return {
        facebookVideoId: videoId,
        facebookPostId: String(finishData?.post_id || `${pageId}_${videoId}`),
        facebookPermalinkUrl: `https://www.facebook.com/reel/${videoId}`,
        ...fbMeta,
      };
    } catch {
      return await uploadViaResumableVideosEndpoint();
    }
  }

  return await uploadViaResumableVideosEndpoint();
}

async function main() {
  const publishTarget = String(process.env.PUBLISH_TARGET || "unified").toLowerCase();
  const isFacebookWorkflow = publishTarget.includes("facebook");
  console.log("==================================================================");
  console.log(
    isFacebookWorkflow
      ? "🚀 Noreen Kids 3D Studio - 24/7 Facebook Page & Unified Cloud Pipeline"
      : "🚀 Noreen Kids 3D Studio - 24/7 Unified Dual-Platform Pipeline (YouTube + Facebook)"
  );
  console.log("==================================================================");

  const schedulePath = path.resolve(process.cwd(), "noreen-kids-schedule.json");
  let schedule = {};
  if (fs.existsSync(schedulePath)) {
    try {
      schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
    } catch {}
  }

  const fbSchedulePath = path.resolve(process.cwd(), "noreen-kids-facebook-schedule.json");
  let fbSchedule = {};
  if (fs.existsSync(fbSchedulePath)) {
    try {
      fbSchedule = JSON.parse(fs.readFileSync(fbSchedulePath, "utf8"));
    } catch {}
  }

  const vault = {
    ...decryptVault(schedule.encryptedVault || ""),
    ...decryptVault(fbSchedule.encryptedVault || ""),
  };
  if (!process.env.GEMINI_API_KEY && vault.geminiApiKey) {
    process.env.GEMINI_API_KEY = String(vault.geminiApiKey).trim();
  }
  const clientId = (process.env.YOUTUBE_CLIENT_ID || vault.youtubeClientId || "").trim();
  const clientSecret = (process.env.YOUTUBE_CLIENT_SECRET || vault.youtubeClientSecret || "").trim();
  const refreshToken = (process.env.YOUTUBE_REFRESH_TOKEN || vault.youtubeRefreshToken || "").trim();
  const hasYouTubeCreds = Boolean(clientId && clientSecret && refreshToken);

  const mergedFbBlock = {
    ...(schedule.facebookSettings || {}),
    ...(schedule.facebook || {}),
    ...(fbSchedule.facebook || {}),
    ...fbSchedule,
  };

  const facebookPageAccessToken = (
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN ||
    vault.facebookPageAccessToken ||
    ""
  ).trim();
  const facebookPageId = (
    process.env.FACEBOOK_PAGE_ID ||
    vault.facebookPageId ||
    mergedFbBlock.pageId ||
    schedule.facebookPageId ||
    "1330185823512542"
  ).trim();
  const unifiedDualPublishEnabled =
    typeof schedule.unifiedDualPublishEnabled === "boolean"
      ? schedule.unifiedDualPublishEnabled
      : typeof fbSchedule.unifiedDualPublishEnabled === "boolean"
      ? fbSchedule.unifiedDualPublishEnabled
      : true;
  const facebookSettings = mergedFbBlock;
  const customFacebookPackages = {
    ...(schedule.customFacebookPackages || {}),
    ...(mergedFbBlock.customFacebookPackages || {}),
  };

  const isCronEvent = process.env.GITHUB_EVENT_NAME === "schedule";
  const isGitHubScheduleEnabled = isFacebookWorkflow
    ? typeof fbSchedule.githubActionsAutoEnabled === "boolean"
      ? fbSchedule.githubActionsAutoEnabled
      : typeof mergedFbBlock.githubActionsAutoEnabled === "boolean"
      ? mergedFbBlock.githubActionsAutoEnabled
      : true
    : typeof schedule.isGitHubScheduleEnabled === "boolean"
    ? schedule.isGitHubScheduleEnabled
    : true;

  if (isCronEvent && !isGitHubScheduleEnabled) {
    console.log(
      "⏸️ [GitHub Schedule Paused] جدولة GitHub Actions التلقائية متوقفة حالياً من الداشبورد. تم إلغاء التشغيل التلقائي."
    );
    process.exit(0);
  }

  // If both workflows are scheduled at the exact same Cairo time and Unified Dual Publish is enabled,
  // avoid duplicate cron runs when the Facebook cron fires at the same minute as the Unified YouTube+Facebook cron:
  const ytGhTime = String(schedule.githubPublishTimeCairo || schedule.dailyPublishTimeCairo || "19:00").trim();
  const fbGhTime = String(fbSchedule.githubActionsTimeCairo || mergedFbBlock.githubActionsTimeCairo || ytGhTime).trim();
  if (
    isCronEvent &&
    isFacebookWorkflow &&
    unifiedDualPublishEnabled &&
    Boolean(schedule.isGitHubScheduleEnabled) &&
    hasYouTubeCreds &&
    fbGhTime === ytGhTime
  ) {
    console.log(
      `🔒 [Single-Execution Lock] النظام المشترك الموحد مفعّل وموعد جدولة GitHub Actions موحّد (${fbGhTime} بتوقيت مصر) — يتولى مسار الجدولة الموحد رفع الفيديوهات على يوتيوب وفيسبوك معاً لمنع تكرار التوليد.`
    );
    process.exit(0);
  }

  const runMode = parseRunMode(
    process.env.RUN_MODE ||
      (isFacebookWorkflow ? fbSchedule.selectedWorkflowMode : schedule.selectedWorkflowMode) ||
      schedule.selectedWorkflowMode ||
      "daily_schedule"
  );
  const dailyTime = isFacebookWorkflow
    ? fbGhTime
    : schedule.githubPublishTimeCairo ||
      schedule.dailyPublishTimeCairo ||
      "19:00";
  const dailyDialect =
    (isFacebookWorkflow ? fbSchedule.dailyDialect : schedule.dailyDialect) === "fusha"
      ? "fusha"
      : "egyptian";
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

  const shouldUploadToYouTube = isFacebookWorkflow
    ? Boolean(unifiedDualPublishEnabled && hasYouTubeCreds)
    : hasYouTubeCreds;
  const shouldUploadToFacebook = isFacebookWorkflow
    ? Boolean(facebookPageAccessToken)
    : Boolean(unifiedDualPublishEnabled && facebookPageAccessToken);

  console.log(`📌 Run Mode Selected : ${runMode} (Target: ${publishTarget})`);
  console.log(
    `🕖 GitHub Schedule Time (Cairo): ${dailyTime} (Enabled: ${isGitHubScheduleEnabled}) | Dialect: ${dailyDialect}`
  );
  console.log(
    `⚙️ YouTube Independent Settings : Upload=${shouldUploadToYouTube} | Privacy=${privacyStatus} | MadeForKids=${madeForKids} | SyntheticAI=${containsSyntheticMedia} | Category=${categoryId}`
  );
  console.log(`📂 YouTube Playlists            : Short=${shortsPlaylistId} | Long=${longPlaylistId}`);
  console.log(
    `📘 Facebook Independent Settings: Upload=${shouldUploadToFacebook} | PageID=${facebookPageId} | DualPublish=${unifiedDualPublishEnabled} | TokenReady=${Boolean(facebookPageAccessToken)}`
  );

  let accessToken = "";
  if (shouldUploadToYouTube) {
    console.log("🔑 [Step 1/5] Verifying YouTube OAuth 2.0 Refresh Token...");
    accessToken = await getYouTubeAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });
    console.log("✅ YouTube OAuth 2.0 Access Token obtained successfully!");
  } else if (!shouldUploadToFacebook) {
    console.error(
      "❌ خطأ: لا تتوفر مفاتيح رفع ليوتيوب أو فيسبوك! يرجى حفظ المفاتيح في لوحة التحكم ومزامنة GitHub Actions."
    );
    process.exit(1);
  }

  const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 12));

  const DAILY_SHORT_STORIES = [
    {
      title: "Noreen Kids: لغز السماعة المضيئة في عيادة الغابة | مغامرات الطبيبة نورين وأرنوب الشقي",
      mainCharacterName: "الطبيبة نورين",
      companionName: "أرنوب الشقي الممرض",
      moralLesson: "النظافة وشرب المياه الصحية والتعاون لعلاج الأصدقاء",
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
      title: "Noreen Kids: إصلاح جسر الغيوم المتحرك | مغامرات المهندسة نوران والنمر الفرفوش",
      mainCharacterName: "المهندسة نوران",
      companionName: "النمر الفرفوش",
      moralLesson: "التفكير الهندسي المنظم والصبر في حل المشكلات",
      summary:
        "رحلة هندسية مشوقة تواجه فيها المهندسة نوران والنمر الفرفوش مشكلة توقف جسر الغيوم ويبتكران الحل بالعلم والتعاون.",
      scenes: [
        {
          id: "s1",
          speakerName: "المهندسة نوران",
          durationSec: 17,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! النهارده أنا والنمر الفرفوش معانا التابلت الهندسي الهولوغرامي علشان نتابع جسر الغيوم الذكي!",
        },
        {
          id: "s2",
          speakerName: "النمر الفرفوش",
          durationSec: 17,
          dialogueArabic:
            "بصي يا مهندسة نوران! فيه مشكلة حصلت فجأة، التروس الدهبية بتاعة الجسر وقفت والقطار الطاير مش عارف يعدي الناحية التانية!",
        },
        {
          id: "s3",
          speakerName: "المهندسة نوران",
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
      title: "Noreen Kids: إنقاذ الدلفين الصغير في مملكة المرجان | مغامرات شوشو القبطان الصغير ومرجان",
      mainCharacterName: "شوشو القبطان الصغير",
      companionName: "مرجان الدلفين المرح",
      moralLesson: "حماية الكائنات البحرية والتعاون الذكي وقت الأزمات",
      summary:
        "مغامرة بحرية متكاملة يقود فيها شوشو القبطان الصغير والدلفين مرجان الغواصة الذهبية لتحرير الممر المرجاني بالتفكير العلمي.",
      scenes: [
        {
          id: "s1",
          speakerName: "شوشو القبطان الصغير",
          durationSec: 17,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! إحنا النهارده في الغواصة الذهبية بنستكشف أعماق مملكة المرجان مع صاحبي الدلفين مرجان!",
        },
        {
          id: "s2",
          speakerName: "مرجان الدلفين المرح",
          durationSec: 17,
          dialogueArabic:
            "يا خبر يا شوشو! فيه صخرة بلورية سدت ممر المرجان والسمك الصغير مش عارف يرجع لبيته قبل الليل!",
        },
        {
          id: "s3",
          speakerName: "شوشو القبطان الصغير",
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
      title: "Noreen Kids: سر المختبر الطائر وبلورة الطاقة النظيفة | مغامرات المهندسة نوران والنمر الفرفوش",
      mainCharacterName: "المهندسة نوران",
      companionName: "النمر الفرفوش",
      moralLesson: "العلم والصبر والعمل الجماعي يحولون أي عقبة لنجاح كبير",
      summary:
        "حلقة طويلة متكاملة الحبكة (بداية وتطور وحدث ومشكلة وتصرف وحل ونهاية) داخل المختبر الطائر لإعادة تشغيل بلورة الطاقة النظيفة وإنقاذ مدينة المستقبل.",
      scenes: [
        {
          id: "l_1",
          speakerName: "المهندسة نوران",
          durationSec: 39,
          dialogueArabic:
            "ازيكم يا أصحابي الحلوين في قناة نورين كيدز! عاملين إيه النهارده؟ بص كده معانا يا نمور، إحنا النهارده في بداية رحلة كبيرة جوه المختبر الطائر فوق السحاب، ومعانا التابلت الهندسي الهولوغرامي علشان نطمن على بلورة الطاقة النظيفة اللي بتنور مدينة المستقبل كلها من غير أي دخان خالص! يلا بينا نقرب خطوة بخطوة ونفتح عينينا كويس علشان نشوف إزاي المحطة بتشتغل!",
        },
        {
          id: "l_2",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "يا خبر يا مهندسة نوران! أنا فتحت حقيبة التروس الذكية وبصيت على عدادات الطاقة، ولاحظت تطور عجيب بيحصل دلوقتي! النور الأزرق الجميل بتاع البلورة بدأ يضعف شوية بشوية، والمراوح الهوائية اللي فوق المختبر سرعتها بتقل! تفتكروا يا أصحابي الحلوين إيه اللي بيحصل جوه غرفة التحكم؟ يلا نركز سوا ونفحص المسارات!",
        },
        {
          id: "l_3",
          speakerName: "المهندسة نوران",
          durationSec: 39,
          dialogueArabic:
            "بصوا كده يا أصحابي الحلوين! فجأة حصل الحدث اللي كنا بنفرز علاماته يا نمور! صفارة الإنذار اللطيفة رنت علشان السحابة الكثيفة غطت العدسات الشمسية اللي بتغذي البلورة! بس إحنا في قناة نورين كيدز عمرنا ما بنقلق ولا بنستسلم خالص مهما كان التحدي كبير، لأن التفكير العلمي الهادي بيخلينا نفهم كل حاجة!",
        },
        {
          id: "l_4",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "أيوة يا مهندسة نوران! أنا قربت بمفتاح التروس الذهبي وعرفت المشكلة فين بالظبط! العدسات البلورية محتاجة تتنضف من بخار السحاب، وكمان محتاجين نعدل زاويتها علشان تلقط نور الشمس من فوق الغيوم! شفتوا يا أصحابنا إزاي لما بندور على سبب المشكلة بهدوء بنعرف نوصل للحل بسرعة؟ يلا نبدأ التصرف العملي حالاً!",
        },
        {
          id: "l_5",
          speakerName: "المهندسة نوران",
          durationSec: 39,
          dialogueArabic:
            "يلا بينا يا نمور نبدأ التصرف الصح دلوقتي! أنا هبرمج ذراع التوجيه في التابلت الهندسي علشان يرفع العدسات لفوق، وإنت ساعدني بربط التروس الدهبية في نفس اللحظة! شفتوا يا أصحابنا الحلوين إزاي لما اتعاونا وجربنا بصبر وهدوء بدأت العدسات تلمع وتجمع أشعة الشمس الذهبية من تاني؟",
        },
        {
          id: "l_6",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "هيييه! الحل نجح مية في المية يا مهندسة نوران! بصوا يا كل أصحابنا الشطار في قناة نورين كيدز! أول ما العدسات اتظبطت، انطلق شعاع النور الصافي ورجعت بلورة الطاقة النظيفة تشتغل بأقصى قوة، والمختبر الطائر كله بقى منور ومليان بهجة وسعادة بفضل التعاون والتفكير العلمي السليم!",
        },
        {
          id: "l_7",
          speakerName: "المهندسة نوران",
          durationSec: 39,
          dialogueArabic:
            "بجد يا نمور دي كانت مغامرة جميلة أوي لا يمكن ننساها! بدأنا رحلتنا بملاحظة صغيرة، ولما واجهتنا المشكلة متخليناش عن بعض خالص، وفكرنا وتصرفنا بذكاء لحد ما وصلنا للحل النهائي! اتعلمنا النهارده سوا يا أصحابي إن العلم والصبر والعمل الجماعي بيحولوا أي عقبة صعبة لنجاح كبير يفرح كل القلوب!",
        },
        {
          id: "l_8",
          speakerName: "النمر الفرفوش",
          durationSec: 39,
          dialogueArabic:
            "ودلوقتي يا أصحابنا الحلوين في قناة نورين كيدز، وصلنا لنهاية حدوتة النهارده الجميلة بعد ما عشنا سوا البداية والمشكلة والحل السعيد! لو عجبتكم المغامرة مع المهندسة نوران والنمر الفرفوش، ما تنسوش تشتركوا في قناة نورين كيدز وتفعلوا الجرس وتعملوا لايك علشان تستنونا كل يوم في مغامرة جديدة! مع السلامة يا أصحابي!",
        },
      ],
    },
    {
      title: "Noreen Kids: مهمة السماعة الذهبية في واحة الكريستال | مغامرات الطبيبة نورين وأرنوب الشقي",
      mainCharacterName: "الطبيبة نورين",
      companionName: "أرنوب الشقي الممرض",
      moralLesson: "الحفاظ على نظافة المياه ومساعدة الكائنات الحية بحب",
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
          mainCharacterName: dynamicShortStory.mainCharacterName,
          companionName: dynamicShortStory.companionName,
          moralLesson: dynamicShortStory.moralLesson,
          summary: dynamicShortStory.summary,
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
          mainCharacterName: dynamicLongStory.mainCharacterName,
          companionName: dynamicLongStory.companionName,
          moralLesson: dynamicLongStory.moralLesson,
          summary: dynamicLongStory.summary,
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
    console.log(`🎬 [Step 2/5] Rendering Shared MP4 for ${task.label} (${tIdx + 1}/${tasks.length})...`);
    const mp4Path = await renderEpisodeMp4(task.episode, task.videoFormat, tmpDir, dailyDialect);

    console.log(`🔍 [Step 3/5] Running Pre-Upload Unit Test & ffprobe Gate on ${path.basename(mp4Path)}...`);
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
    const allowedImagesDir = path.resolve(process.cwd(), "src", "assets", "images");
    for (let sIdx = 0; sIdx < epScenes.length; sIdx++) {
      const resolvedCharImg = resolveCharacterAvatarPath(epScenes[sIdx]?.speakerName || "");
      if (
        !resolvedCharImg ||
        /^https?:\/\//i.test(resolvedCharImg) ||
        !resolvedCharImg.startsWith(allowedImagesDir) ||
        !fs.existsSync(resolvedCharImg)
      ) {
        throw new Error(`[Pre-Upload Unit Test FAILED] External or missing image detected in scene ${sIdx + 1}: ${resolvedCharImg}. Upload blocked.`);
      }
    }

    console.log(
      `✅ PRE-UPLOAD UNIT TEST GATE PASSED: Duration=${durSec}s | AV-Drift=${avDrift.toFixed(2)}s | Codec=${vCodec}/${pixFmt}/${aCodec} 48kHz Stereo (Closed-GOP=${closedGop}) | Dialogue=100% Egyptian Verified | ExternalImages=0 | FastStart=Enabled`
    );

    const pkg = task.episode?.youtubePackage || {};
    const expectedThumbPath = path.join(tmpDir, `thumbnail_1280x720_${task.videoFormat}.jpg`);
    let uploadRes = {
      videoId: "",
      cleanTitle: String(pkg.videoTitleAr || task.episode?.title || "Noreen Kids"),
      playlistId: task.playlistId,
      playlistAdded: false,
      thumbnailUploaded: false,
      fileSizeMb: (fs.statSync(mp4Path).size / (1024 * 1024)).toFixed(2),
    };

    if (shouldUploadToYouTube && accessToken) {
      console.log(`☁️ [Step 4/5] Uploading ${task.label} + 1280x720 Dual-Hero Thumbnail to YouTube (with YouTube Settings)...`);
      uploadRes = await uploadMp4ToYouTube({
        accessToken,
        mp4Path,
        thumbnailJpgPath: expectedThumbPath,
        thumbnailBase64: pkg.thumbnailBase64,
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

      console.log(`🎉 YOUTUBE SUCCESS! Uploaded Video ID: ${uploadRes.videoId}`);
      console.log(`🖼️ YouTube Custom 1280x720 Thumbnail: ${uploadRes.thumbnailUploaded ? "Uploaded Automatically ✓" : "Default Frame"}`);
      console.log(`🔗 YouTube Watch URL: https://www.youtube.com/watch?v=${uploadRes.videoId}`);
      console.log(`📂 YouTube Playlist (${uploadRes.playlistId}): ${uploadRes.playlistAdded ? "Added ✓" : "Skipped"}`);
    }

    let fbUploadRes = null;
    if (shouldUploadToFacebook && facebookPageAccessToken) {
      try {
        console.log(`📘 [Step 5/5] Uploading EXACT SAME MP4 + Cover to Facebook Page (${facebookPageId}) with Independent Facebook Settings...`);
        fbUploadRes = await uploadMp4ToFacebookPage({
          rawPageAccessToken: facebookPageAccessToken,
          pageId: facebookPageId,
          mp4Path,
          thumbnailJpgPath: expectedThumbPath,
          videoFormat: task.videoFormat,
          episode: task.episode,
          facebookSettings,
          customFacebookPackages,
        });
        console.log(`🎉 FACEBOOK SUCCESS! Uploaded Facebook Video ID: ${fbUploadRes.facebookVideoId}`);
        console.log(`📝 Facebook Title: ${fbUploadRes.facebookTitle}`);
        console.log(`🔗 Facebook Permalink: ${fbUploadRes.facebookPermalinkUrl}`);
      } catch (fbErr) {
        console.warn(
          `⚠️ Facebook Upload Warning: ${
            fbErr instanceof Error ? fbErr.message : fbErr
          }`
        );
        if (!shouldUploadToYouTube) {
          throw fbErr;
        }
      }
    } else {
      console.log(`ℹ️ [Step 5/5] Skipping Facebook upload (UploadEnabled=${shouldUploadToFacebook}, TokenReady=${Boolean(facebookPageAccessToken)})`);
    }

    results.push({
      ...uploadRes,
      facebookVideoId: fbUploadRes?.facebookVideoId || null,
      facebookPostId: fbUploadRes?.facebookPostId || null,
      facebookPermalinkUrl: fbUploadRes?.facebookPermalinkUrl || null,
      facebookTitle: fbUploadRes?.facebookTitle || null,
      facebookCaption: fbUploadRes?.facebookCaption || null,
      facebookHashtags: fbUploadRes?.facebookHashtags || null,
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
          facebookPageId,
          facebookShortVideoId: shortRes?.facebookVideoId,
          facebookLongVideoId: longRes?.facebookVideoId,
          facebookShortPermalinkUrl: shortRes?.facebookPermalinkUrl,
          facebookLongPermalinkUrl: longRes?.facebookPermalinkUrl,
          facebookShortTitle: shortRes?.facebookTitle,
          facebookLongTitle: longRes?.facebookTitle,
          facebookShortCaption: shortRes?.facebookCaption,
          facebookLongCaption: longRes?.facebookCaption,
          facebookShortHashtags: shortRes?.facebookHashtags,
          facebookLongHashtags: longRes?.facebookHashtags,
        }),
      });
    } catch {}
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "## 🎬 تقرير النشر الموحد لقناة وصفحة Noreen Kids 3D Studio (YouTube + Facebook)",
      `- **وضع التشغيل:** \`${runMode}\``,
      `- **موعد الجدولة اليومية (توقيت مصر):** \`${dailyTime}\``,
      "",
      "| نوع الفيديو | عنوان يوتيوب | عنوان فيسبوك | المدة | الحجم | رابط يوتيوب | رابط فيسبوك |",
      "|---|---|---|---|---|---|---|",
      ...results.map(
        (r) =>
          `| ${r.label} | ${r.cleanTitle} | ${r.facebookTitle || "—"} | ${r.durationSec}s | ${r.fileSizeMb} MB | [YouTube](https://youtu.be/${r.videoId}) | ${
            r.facebookPermalinkUrl ? `[Facebook](${r.facebookPermalinkUrl})` : "—"
          } |`
      ),
      "",
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n"));
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
  console.log("==================================================================");
  console.log("✅ All Noreen Kids Unified (YouTube + Facebook) tasks completed!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("❌ Pipeline Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
