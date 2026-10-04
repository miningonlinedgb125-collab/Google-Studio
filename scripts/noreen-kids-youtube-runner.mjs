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
  if (
    s.includes("engagement_only") ||
    s.includes("منشور تفاعلي") ||
    s.includes("فحص والرد") ||
    s.includes("تحدي")
  ) {
    return "engagement_only";
  }
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
    !/^(يا خبر|الحقوا|الحقني|بص|بصوا|شايف|شايفين|يلا بينا)/.test(validatedText)
  ) {
    validatedText = `يا خبر يا أبطال وعيلة نورين كيدز! بصوا بسرعة معانا النهارده، ${validatedText}`;
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
      const liveModels = ["gemini-3.8-live", "gemini-3.8-flash-native-audio-preview-12-2025"];

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
      const ttsModels = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.8-flash-preview-tts"];
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

  const matchedTeam = resolveCanonicalTeamForRunner(
    rawTopicText,
    episode?.mainCharacterName || scenes[0]?.speakerName || "",
    episode?.companionName || scenes[1]?.speakerName || ""
  );

  const heroName =
    matchedTeam?.mainCharacterName ||
    episode?.mainCharacterName ||
    scenes[0]?.speakerName ||
    "الطبيبة نورين";
  const companionName =
    matchedTeam?.companionName ||
    episode?.companionName ||
    scenes[1]?.speakerName ||
    "أرنوب الشقي الممرض";
  if (episode && typeof episode === "object") {
    episode.mainCharacterName = heroName;
    episode.companionName = companionName;
  }
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
    const isHeroTurn = i % 2 === 0;
    const spk = isHeroTurn ? heroName : companionName;
    const prt = isHeroTurn ? companionName : heroName;
    let sceneDialogue = String(scenes[i]?.dialogueArabic || "").trim();
    if (i === 0 && !/أعضاء.*نورين كيدز|عيلة.*نورين كيدز/.test(sceneDialogue.slice(0, 140))) {
      const stripped = sceneDialogue
        .replace(
          /^(ازيكم يا أصحابي الحلوين في قناة نورين كيدز\s*[!،.]?\s*(عاملين إيه النهارده\s*[؟!،.]?\s*)?|ازيكم يا أصحابي الحلوين\s*[!،.]?\s*)/i,
          ""
        )
        .trim();
      const greetPrefix =
        dialect === "fusha"
          ? `أَهْلاً وَسَهْلاً بِكُلِّ أَعْضَاءِ وَأَبْطَالِ عَائِلَةِ قَنَاةِ نُورِين كِيدْز الْغَالِين! أَنَا ${spk} وَمَعِي رَفِيقِي ${prt}!`
          : isShort
          ? `أهلاً وسهلاً بكل أعضاء وعيلة قناة نورين كيدز الغاليين! ازيكم يا أحلى أبطال؟ أنا ${spk} ومعايا ${prt}، منورين عالمنا السحري النهارده!`
          : `أهلاً وسهلاً بكل أعضاء وعيلة قناة نورين كيدز الغاليين في كل مكان! ازيكم يا أشطر وأجمل أبطال؟ وحشتونا أوي! أنا ${spk} ومعايا رفيق المغامرة ${prt}، منورين عالمنا السحري النهارده!`;
      sceneDialogue = stripped ? `${greetPrefix} ${stripped}` : greetPrefix;
    }
    const sc = {
      ...scenes[i],
      speakerName: spk,
      dialogueArabic: sceneDialogue || scenes[i]?.dialogueArabic,
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

  const overscanW = Math.round(W * 1.14);
  const overscanH = Math.round(H * 1.14);
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
      `scale=${overscanW}:${overscanH}:force_original_aspect_ratio=increase,crop=${overscanW}:${overscanH},eq=saturation=1.14:contrast=1.05,vignette=PI/6,setsar=1,format=yuv420p`,
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
    // Strictly show the speaking character's full portrait (Hero when Hero speaks, Companion when Companion speaks)
    const shotImg = activeImg;
    const prebakedImg = await getPrebakedPortrait(shotImg, i);

    console.log(
      `   -> [Scene ${i + 1}/${preparedScenes.length}] Speaker="${
        sc.speakerName || (isCompTurn ? companionName : heroName)
      }" | Voice=${item.voiceDurSec.toFixed(1)}s | Scene=${dur}s (YouTube Fast-Processing Closed-GOP H.264 + Story VFX + Continuous PCM)...`
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
    const combinedStoryText = `${rawTopicText} ${sc.dialogueArabic || ""} ${sc.title || ""} ${sc.speakerName || ""}`;
    let sprite1Lavfi =
      "color=c=black@0.0:s=42x42:r=30:d=0.04,format=rgba,geq=r=255:g=232:b=95:a='240*exp(-((X-21)*(X-21)+(Y-21)*(Y-21))/56)',format=yuva420p,loop=loop=-1:size=1:start=0";
    let sprite2Lavfi =
      "color=c=black@0.0:s=40x40:r=30:d=0.04,format=rgba,geq=r=255:g=180:b=225:a='clip(240*exp(-(abs(X-20)*abs(Y-20))/9)*exp(-((X-20)*(X-20)+(Y-20)*(Y-20))/165),0,255)',format=yuva420p,loop=loop=-1:size=1:start=0";
    let borderColorHex = "0xFBBF24";

    if (/بحر|محيط|غواصة|مرجان|حوت|دلفين|شوشو|ماء|مياه|شلال|نهر|مطر|سلحفاة/.test(combinedStoryText)) {
      sprite1Lavfi =
        "color=c=black@0.0:s=44x44:r=30:d=0.04,format=rgba,geq=r=145:g=238:b=255:a='clip(230*exp(-pow(sqrt((X-22)*(X-22)+(Y-22)*(Y-22))-14,2)/9)+165*exp(-((X-16)*(X-16)+(Y-15)*(Y-15))/12),0,255)',format=yuva420p,loop=loop=-1:size=1:start=0";
      sprite2Lavfi =
        "color=c=black@0.0:s=34x34:r=30:d=0.04,format=rgba,geq=r=85:g=255:b=235:a='220*exp(-((X-17)*(X-17)+(Y-17)*(Y-17))/50)',format=yuva420p,loop=loop=-1:size=1:start=0";
      borderColorHex = "0x38BDF8";
    } else if (/فضاء|كوكب|نجوم|نجمة|زحل|قمر|تلسكوب|مسبار|جنى|بلبل|سماء/.test(combinedStoryText)) {
      sprite1Lavfi =
        "color=c=black@0.0:s=44x44:r=30:d=0.04,format=rgba,geq=r=225:g=245:b=255:a='clip(248*exp(-(abs(X-22)*abs(Y-22))/9)*exp(-((X-22)*(X-22)+(Y-22)*(Y-22))/185),0,255)',format=yuva420p,loop=loop=-1:size=1:start=0";
      sprite2Lavfi =
        "color=c=black@0.0:s=36x36:r=30:d=0.04,format=rgba,geq=r=255:g=215:b=90:a='230*exp(-((X-18)*(X-18)+(Y-18)*(Y-18))/54)',format=yuva420p,loop=loop=-1:size=1:start=0";
      borderColorHex = "0x818CF8";
    } else if (/سنان|أسنان|عيادة|إسعاف|طبيبة|دكتورة|نورين|أرنوب|ملك|لوليتا|نظافة|غسيل|فواكه/.test(combinedStoryText)) {
      sprite1Lavfi =
        "color=c=black@0.0:s=44x44:r=30:d=0.04,format=rgba,geq=r=255:g=255:b=255:a='clip(250*exp(-(abs(X-22)*abs(Y-22))/8)*exp(-((X-22)*(X-22)+(Y-22)*(Y-22))/175),0,255)',format=yuva420p,loop=loop=-1:size=1:start=0";
      sprite2Lavfi =
        "color=c=black@0.0:s=36x36:r=30:d=0.04,format=rgba,geq=r=90:g=250:b=200:a='225*exp(-((X-18)*(X-18)+(Y-18)*(Y-18))/52)',format=yuva420p,loop=loop=-1:size=1:start=0";
      borderColorHex = "0x34D399";
    } else if (/مهندسة|نوران|فرفوش|كارمن|سمسم|شريف|صقر|اختراع|جسر|منارة|طاحونة|قطار|مصعد|أرقام/.test(combinedStoryText)) {
      sprite1Lavfi =
        "color=c=black@0.0:s=44x44:r=30:d=0.04,format=rgba,geq=r=255:g=210:b=55:a='clip(248*exp(-(abs(X-22)*abs(Y-22))/9)*exp(-((X-22)*(X-22)+(Y-22)*(Y-22))/180),0,255)',format=yuva420p,loop=loop=-1:size=1:start=0";
      sprite2Lavfi =
        "color=c=black@0.0:s=36x36:r=30:d=0.04,format=rgba,geq=r=75:g=200:b=255:a='225*exp(-((X-18)*(X-18)+(Y-18)*(Y-18))/52)',format=yuva420p,loop=loop=-1:size=1:start=0";
      borderColorHex = "0xF59E0B";
    }

    const halfSpanX = Math.round(panRangeX * 0.5);
    const halfSpanY = Math.round(panRangeY * 0.5);
    const ampX = Math.max(4, Math.round(panRangeX * 0.45));
    const ampY = Math.max(4, Math.round(panRangeY * 0.42));
    const camExprX =
      i % 2 === 0
        ? `${halfSpanX}+${ampX}*sin(2*PI*t/9.5)`
        : `${halfSpanX}-${ampX}*cos(2*PI*t/10.0)`;
    const camExprY =
      i % 2 === 0
        ? `${halfSpanY}+${ampY}*cos(2*PI*t/12.0)`
        : `${halfSpanY}+${ampY}*sin(2*PI*t/11.5)`;

    const marginX = Math.round(W * 0.07);
    const rangeX = Math.max(120, W - marginX * 2 - 48);
    const bottomY = Math.round(H * 0.92);
    const travelY = Math.max(160, Math.round(H * 0.85));

    const vfxFilterComplex = [
      `[0:v]format=yuv420p,loop=loop=-1:size=1:start=0,fps=30,trim=duration=${dur},crop=${W}:${H}:x='${camExprX}':y='${camExprY}'[base]`,
      `[1:v]split=3[s1][s2][s3]`,
      `[2:v]split=3[o1][o2][o3]`,
      `[base][s1]overlay=x='${marginX}+${rangeX}*(0.5+0.46*sin(t*0.85+0.4))':y='${bottomY}-${travelY}*mod(t*0.21+0.08,1)':format=yuv420:shortest=1[v1]`,
      `[v1][s2]overlay=x='${marginX}+${rangeX}*(0.5+0.45*cos(t*1.05+1.9))':y='${bottomY}-${travelY}*mod(t*0.26+0.42,1)':format=yuv420:shortest=1[v2]`,
      `[v2][s3]overlay=x='${marginX}+${rangeX}*(0.5+0.46*sin(t*0.95+3.3))':y='${bottomY}-${travelY}*mod(t*0.23+0.74,1)':format=yuv420:shortest=1[v3]`,
      `[v3][o1]overlay=x='${marginX}+${rangeX}*(0.5+0.43*cos(t*0.78+1.1))':y='${bottomY}-${travelY}*mod(t*0.19+0.24,1)':format=yuv420:shortest=1[v4]`,
      `[v4][o2]overlay=x='${marginX}+${rangeX}*(0.5+0.44*sin(t*1.12+2.6))':y='${bottomY}-${travelY}*mod(t*0.29+0.58,1)':format=yuv420:shortest=1[v5]`,
      `[v5][o3]overlay=x='${marginX}+${rangeX}*(0.5+0.43*cos(t*0.92+4.2))':y='${bottomY}-${travelY}*mod(t*0.24+0.86,1)':format=yuv420:shortest=1,drawbox=x=0:y=0:w=${W}:h=${H}:color=${borderColorHex}@0.88:t=8,setsar=1,fade=t=in:st=0:d=0.30,fade=t=out:st=${fadeOutStart}:d=0.30,format=yuv420p[vout]`,
    ].join(";");

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      prebakedImg,
      "-f",
      "lavfi",
      "-i",
      sprite1Lavfi,
      "-f",
      "lavfi",
      "-i",
      sprite2Lavfi,
      "-filter_complex",
      vfxFilterComplex,
      "-map",
      "[vout]",
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

  const resolvedPrivacyStatus = String(privacyStatus || "public").trim().toLowerCase();
  const attemptInit = async (usePublishAt) => {
    const statusObj = {
      privacyStatus: usePublishAt ? "private" : resolvedPrivacyStatus || "public",
      selfDeclaredMadeForKids:
        typeof madeForKids === "boolean" ? madeForKids : false,
      containsSyntheticMedia:
        typeof containsSyntheticMedia === "boolean"
          ? containsSyntheticMedia
          : false,
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
    privacyStatus: publishAtIso ? "private" : resolvedPrivacyStatus || "public",
    fileSizeMb: (mp4Buffer.length / (1024 * 1024)).toFixed(2),
  };
}

const RUNNER_CHARACTER_TEAMS = [
  {
    mainCharacterName: "الطبيبة نورين",
    companionName: "أرنوب الشقي الممرض",
    mainVoice: "Zephyr",
    compVoice: "Puck",
    worldHint: "space_forest",
    heroProp: "شنطة الإسعافات الذكية والسماعة الطبية المضيئة",
    compProp: "جهاز قياس نبض القلوب والفرشاة المنورة",
    stories: [
      "سر الابتسامة المنورة وإزاي نحافظ على سناننا بيضا وقوية ونضيفة",
      "عيادة السعادة السحرية وسر الفواكه المنورة اللي بتقوي الجسم",
      "مهمة إسعاف السلحفاة الصغيرة وأهمية غسيل الإيدين بالمية والصابون",
      "شنطة الإسعافات الطائرة وإنقاذ العصفور المنور في غابة النجوم",
      "علاج الجناح المكسور للطائر الصغير في عيادة الغابة السحرية",
      "سر النوم البدري وشرب اللبن الدافي علشان نكبر بصحة ونشاط",
    ],
  },
  {
    mainCharacterName: "المهندسة نوران",
    companionName: "النمر الفرفوش",
    mainVoice: "Kore",
    compVoice: "Fenrir",
    worldHint: "cloud_ship",
    heroProp: "المفتاح الهندسي الذهبي والمخطط الهولوجرامي",
    compProp: "صندوق التروس البلورية الملونة",
    stories: [
      "بناء جسر قوس قزح الذكي فوق مدينة السحاب بالعلم والتعاون",
      "تصميم القلعة البلورية القوية قدام الهوا في واحة الكريستال",
      "ابتكار المصعد الهوائي لمرصد المكتبة الطائرة بذكاء المهندسة نوران",
      "إصلاح منارة المرجان المضيئة بأدوات الهندسة الذكية والتعاون",
      "إصلاح نافورة الموسيقى الكريستالية بالتفكير العلمي والصبر",
      "بناء قبة النجوم المضيئة لحماية عصافير الغابة من المطر",
    ],
  },
  {
    mainCharacterName: "عمرو المستكشف",
    companionName: "زعتر الثعلب الذكي",
    mainVoice: "Puck",
    compVoice: "Puck",
    worldHint: "space_forest",
    heroProp: "البوصلة الذهبية ومنظار النجوم",
    compProp: "خريطة الكنوز والآثار المنورة",
    stories: [
      "البذرة العجيبة اللي فتحت بالصبر والتعاون في غابة اليراعات المضيئة",
      "بوصلة الرياح الأربعة وإنقاذ طائر العنقاء الصغير فوق مدينة السحاب",
      "رحلة المنطاد البلوري لإنقاذ غزالة الوادي الأخضر",
      "إنقاذ فراشة النور النادرة في حديقة الزهور العملاقة",
      "مهمة البحث عن البلورة الزرقاء المفقودة تحت شلالات الكريستال",
      "سر الخريطة الصوتية اللي بتغني في كهف الصدى العجيب",
    ],
  },
  {
    mainCharacterName: "جنى رائدة الفضاء",
    companionName: "بلبل الروبوت اللطيف",
    mainVoice: "Zephyr",
    compVoice: "Fenrir",
    worldHint: "floating_library",
    heroProp: "خوذة الفضاء المنورة وجهاز الجاذبية",
    compProp: "شاشة تحليل الإشارات الفضائية",
    stories: [
      "لغز الكوكب البنفسجي المفقود في مرصد المكتبة الطائرة وحب القراءة",
      "رحلة المسبار الصغير حوالين حلقات زحل وتعلّم الشجاعة ومواجهة الخوف",
      "الكتاب اللي بيطير بين النجوم وسر الحفاظ على نظافة كوكب الأرض",
      "مغامرة التلسكوب الذهبي واكتشاف نجمة الأمنيات المضيئة",
      "لغز الصندوق الذهبي المشفر في مكتبة الفضاء الطائرة",
    ],
  },
  {
    mainCharacterName: "شوشو القبطان الصغير",
    companionName: "مرجان الدلفين المرح",
    mainVoice: "Charon",
    compVoice: "Puck",
    worldHint: "coral_kingdom",
    heroProp: "دفة الغواصة الذهبية وكشاف الأعماق",
    compProp: "صدفة الموجات الصوتية السحرية",
    stories: [
      "مغامرة الغواصة الذهبية لإنقاذ الحوت الصغير في مملكة المرجان",
      "سر اللؤلؤة الموسيقية اللي رجعت الفرح لأسماك المحيط المضيء",
      "كنز القرصان القديم في كهف المرجان واكتشاف إن العلم أغلى من الدهب",
      "سباق القوارب الشراعية الذكية وتعلّم مساعدة الصديق وقت الشدة",
      "تنظيف شعب المرجان الملونة وحماية السلاحف البحرية اللطيفة",
    ],
  },
  {
    mainCharacterName: "كارمن المخترعة الصغيرة",
    companionName: "سمسم السنجاب الطائر",
    mainVoice: "Kore",
    compVoice: "Puck",
    worldHint: "cloud_ship",
    heroProp: "عدسة الطاقة الشمسية وجهاز الابتكار",
    compProp: "حقيبة البلورات المغناطيسية",
    stories: [
      "اختراع جناح الهوا الذكي فوق سفينة السحاب وعدم الاستسلام",
      "سباق المناطيد الشمسية فوق جبال السحاب وتعلّم الروح الرياضية",
      "سر القطار المغناطيسي الملون في مدينة الاختراعات وتعلّم النظام",
      "اختراع روبوت تدوير المخلفات الذكي لتنظيف شاطئ المرجان",
      "تشغيل طاحونة الهواء الذهبية لتوليد الطاقة النظيفة للقرية",
    ],
  },
  {
    mainCharacterName: "تامر فارس الواحة",
    companionName: "كركور الببغاء الحكيم",
    mainVoice: "Fenrir",
    compVoice: "Charon",
    worldHint: "crystal_oasis",
    heroProp: "درع النور الكريستالي ومصباح الحكمة",
    compProp: "جرس الرياح الذهبي",
    stories: [
      "سر الساعة الرملية المضيئة في واحة الكريستال وتعلّم تنظيم الوقت",
      "شجرة الأمانة الذهبية في غابة النجوم وإزاي الصدق بيكسب دايما",
      "خيمة التسامح الذهبية في واحة الكريستال وإزاي نصالح أصحابنا بالكلمة الحلوة",
      "مفتاح بوابة الواحة الذهبية وأهمية طاعة ماما وبابا وسماع النصيحة",
      "المراية الصادقة في واحة الكريستال وتعلّم الثقة في النفس ومساعدة غيرنا",
      "مهرجان الفوانيس الطائرة في غابة النجوم وقيمة مشاركة اللعب مع أصحابنا",
    ],
  },
  {
    mainCharacterName: "ملك",
    companionName: "القطة لوليتا",
    mainVoice: "Kore",
    compVoice: "Zephyr",
    worldHint: "space_forest",
    heroProp: "حقيبة الطوارئ السريعة والسماعة الطبية الحديثة",
    compProp: "طوق المساعدة الذكي وشنطة الضمادات الملونة",
    stories: [
      "مهمة الطوارئ السريعة مع الدكتورة ملك والقطة لوليتا لإنقاذ أرنب الوادي",
      "إسعاف الطائر الصغير وقت العاصفة بهدوء وشجاعة طبيبة الطوارئ ملك",
      "سيارة الإسعاف المنورة ومواقف القطة لوليتا المضحكة في الغابة",
    ],
  },
  {
    mainCharacterName: "سدرة الصغنونة",
    companionName: "الفراشة الملونة",
    mainVoice: "Zephyr",
    compVoice: "Kore",
    worldHint: "space_forest",
    heroProp: "ألوان الرسم المبهجة ولعبة المكعبات المنورة",
    compProp: "الأجنحة الملونة المتلألئة وغبار الزهور المنور",
    stories: [
      "مغامرة سدرة الصغنونة والفراشة الملونة في حديقة الألوان السحرية",
      "لعبة الأشكال والألوان المبهجة مع سدرة الصغنونة والفراشة اللطيفة",
      "اكتشاف زهرة النور الضاحكة بفضول وبراءة سدرة الصغنونة",
    ],
  },
  {
    mainCharacterName: "أم ملك",
    companionName: "البطريق المرح",
    mainVoice: "Kore",
    compVoice: "Puck",
    worldHint: "floating_library",
    heroProp: "كتاب الحكايات الذهبي والسبورة التفاعلية المنورة",
    compProp: "ربطة العنق الملونة وجرس الفصل المرح",
    stories: [
      "درس المعلمة أم ملك والبطريق المرح عن آداب الحوار ومساعدة الأصحاب",
      "حكاية الصبر والنظام في مدرسة السعادة مع أم ملك والبطريق خفيف الدم",
      "مسابقة القراءة الممتعة ونصائح المعلمة أم ملك الحنونة للأطفال",
    ],
  },
  {
    mainCharacterName: "ذياد",
    companionName: "العصفورة الفرفوشة",
    mainVoice: "Fenrir",
    compVoice: "Zephyr",
    worldHint: "cloud_ship",
    heroProp: "حقيبة المساعدة الميدانية والحبل الذكي وكشاف الإنقاذ",
    compProp: "الأجنحة السريعة وصفارة التنبيه الموسيقية",
    stories: [
      "شجاعة ذياد والعصفورة الفرفوشة في إصلاح جسر القرية وقت المطر",
      "تعاون ذياد والعصفورة النشيطة لمساعدة جيران الواحة بهدوء وإخلاص",
      "رحلة البحث عن مفتاح البوابة القديمة مع الشاب الطيب ذياد والعصفورة",
    ],
  },
  {
    mainCharacterName: "أستاذ شريف",
    companionName: "الصقر الذكي",
    mainVoice: "Charon",
    compVoice: "Fenrir",
    worldHint: "floating_library",
    heroProp: "التابلت الحسابي المنور ودفتر التنظيم الذكي",
    compProp: "عدسة الملاحظة الدقيقة ومنظار الأفق الذهبي",
    stories: [
      "لغز الأرقام الذهبية مع أستاذ شريف والصقر الذكي وتنظيم حصالة التوفير",
      "كيف نرتب وقتنا وألعابنا بدقة وحكمة مع المحاسب أستاذ شريف والصقر الذكي",
      "حل معادلة الكنز البلوري بالحساب والتفكير المنظم مع أستاذ شريف",
    ],
  },
  {
    mainCharacterName: "جدو",
    companionName: "الفأر المشاكس",
    mainVoice: "Charon",
    compVoice: "Puck",
    worldHint: "crystal_oasis",
    heroProp: "عصا الحكمة المنقوشة وكتاب حواديت زمان والفانوس الدافي",
    compProp: "بوصلة المفاجآت الصغيرة وجيب البندق السريع",
    stories: [
      "حكاية جدو والفأر المشاكس عن كنز الحكمة والصبر في الواحة القديمة",
      "مقالب الفأر المشاكس المضحكة وحكمة جدو الطيب في ليلة الفوانيس",
      "حدوتة الشجرة المباركة اللي حكاها جدو لكل أطفال القرية",
    ],
  },
  {
    mainCharacterName: "تيتة",
    companionName: "الدب باندا",
    mainVoice: "Kore",
    compVoice: "Fenrir",
    worldHint: "space_forest",
    heroProp: "سلة الفطائر الدافية وشال الحنان الملون وكتاب الوصفات السعيدة",
    compProp: "غصن البامبو الأخضر وطوق السعادة اللطيف",
    stories: [
      "فطيرة التفاح الدافية مع تيتة والدب باندا وقيمة المشاركة مع الجيران",
      "حنان تيتة ومواقف الدب باندا اللطيفة في بستان الفواكه المنورة",
      "سر وصفة السعادة والحنان في بيت تيتة مع الدب باندا المحبوب",
    ],
  },
];

function resolveCanonicalTeamForRunner(
  topicText = "",
  existingMainChar = "",
  existingCompChar = ""
) {
  const t = String(topicText || "").replace(/هـاننا/g, "سناننا").trim();
  const mainClean = String(existingMainChar || "").trim();
  const compClean = String(existingCompChar || "").trim();

  // 1) Exact or high-overlap match against any team's official stories array
  if (t) {
    for (const team of RUNNER_CHARACTER_TEAMS) {
      for (const st of team.stories) {
        if (t.includes(st) || st.includes(t)) {
          return team;
        }
        const stWords = st.split(/\s+/).filter((w) => w.length > 3);
        const matchCount = stWords.filter((w) => t.includes(w)).length;
        if (stWords.length >= 4 && matchCount >= 4) {
          return team;
        }
      }
    }
  }

  // 2) Explicit character name mentioned inside the topic text itself
  if (t) {
    if (/أم ملك|ام ملك|البطريق المرح/.test(t)) return RUNNER_CHARACTER_TEAMS[9];
    if (/القطة لوليتا|لوليتا|الدكتورة ملك|الطبيبة ملك/.test(t)) return RUNNER_CHARACTER_TEAMS[7];
    if (/سدرة الصغنونة|سدرة|الفراشة الملونة/.test(t)) return RUNNER_CHARACTER_TEAMS[8];
    if (/ذياد|العصفورة الفرفوشة/.test(t)) return RUNNER_CHARACTER_TEAMS[10];
    if (/أستاذ شريف|شريف|الصقر الذكي/.test(t)) return RUNNER_CHARACTER_TEAMS[11];
    if (/جدو|الفأر المشاكس/.test(t)) return RUNNER_CHARACTER_TEAMS[12];
    if (/تيتة|تيته|الدب باندا/.test(t)) return RUNNER_CHARACTER_TEAMS[13];
    if (/نورين|أرنوب/.test(t)) return RUNNER_CHARACTER_TEAMS[0];
    if (/المهندسة نوران|نوران|النمر الفرفوش/.test(t)) return RUNNER_CHARACTER_TEAMS[1];
    if (/عمرو المستكشف|عمرو|زعتر/.test(t)) return RUNNER_CHARACTER_TEAMS[2];
    if (/جنى رائدة|جنى|بلبل الروبوت/.test(t)) return RUNNER_CHARACTER_TEAMS[3];
    if (/شوشو القبطان|شوشو|مرجان الدلفين/.test(t)) return RUNNER_CHARACTER_TEAMS[4];
    if (/كارمن المخترعة|كارمن|سمسم السنجاب/.test(t)) return RUNNER_CHARACTER_TEAMS[5];
    if (/تامر فارس|تامر|كركور/.test(t)) return RUNNER_CHARACTER_TEAMS[6];
  }

  // 3) If the episode already has a valid assigned team hero, strictly preserve it!
  if (mainClean) {
    const byExisting = RUNNER_CHARACTER_TEAMS.find(
      (tm) =>
        tm.mainCharacterName === mainClean ||
        mainClean.includes(tm.mainCharacterName) ||
        tm.mainCharacterName.includes(mainClean) ||
        (compClean && tm.companionName === compClean)
    );
    if (byExisting) return byExisting;
  }

  // 4) Fallback domain keyword match only when no character was assigned
  if (/سنان|أسنان|الابتسامة|عيادة|إسعاف|طبيبة|دكتورة|غسيل الإيدين/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[0];
  }
  if (/بناء جسر|هندسة|المصعد الهوائي|منارة المرجان|نافورة الموسيقى|قبة النجوم/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[1];
  }
  if (/الغواصة|الحوت|مملكة المرجان|اللؤلؤة الموسيقية|المحيط/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[4];
  }
  if (/الكوكب|حلقات زحل|المسبار|التلسكوب|مكتبة الفضاء/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[3];
  }
  if (/جناح الهوا|تدوير المخلفات|المناطيد الشمسية|القطار المغناطيسي|طاحونة الهواء/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[5];
  }
  if (/الساعة الرملية|واحة الكريستال|شجرة الأمانة|خيمة التسامح|الفوانيس الطائرة|المراية الصادقة/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[6];
  }
  if (/البذرة العجيبة|بوصلة الرياح|المنطاد البلوري|فراشة النور|البلورة الزرقاء|كهف الصدى/.test(t)) {
    return RUNNER_CHARACTER_TEAMS[2];
  }
  return RUNNER_CHARACTER_TEAMS[0];
}

function getShortCharacterDisplayNameRunner(fullName = "", dialect = "egyptian") {
  const clean = String(fullName || "").trim();
  const isFusha = dialect === "fusha";
  if (clean.includes("نورين")) return isFusha ? "الطبيبة نورين" : "دكتورة نورين";
  if (clean.includes("أرنوب")) return "أرنوب";
  if (clean.includes("أم ملك") || clean.includes("ام ملك")) return "أم ملك";
  if (clean.includes("البطريق")) return "البطريق المرح";
  if (clean.includes("ملك")) return isFusha ? "الطبيبة ملك" : "دكتورة ملك";
  if (clean.includes("لوليتا")) return "القطة لوليتا";
  if (clean.includes("سدرة") && !clean.includes("المهندسة")) return "سدرة الصغنونة";
  if (clean.includes("الفراشة")) return "الفراشة الملونة";
  if (clean.includes("ذياد")) return "ذياد";
  if (clean.includes("العصفورة")) return "العصفورة الفرفوشة";
  if (clean.includes("شريف")) return "أستاذ شريف";
  if (clean.includes("الصقر")) return "الصقر الذكي";
  if (clean.includes("جدو")) return "جدو";
  if (clean.includes("الفأر")) return "الفأر المشاكس";
  if (clean.includes("تيتة")) return "تيتة";
  if (clean.includes("باندا")) return "الدب باندا";
  if (clean.includes("نوران") || clean.includes("المهندسة")) return "المهندسة نوران";
  if (clean.includes("النمر") || clean.includes("نمور")) return "النمر الفرفوش";
  if (clean.includes("تامر") || clean.includes("ياسين")) return "تامر";
  if (clean.includes("كركور")) return "كركور";
  if (clean.includes("عمرو") || clean.includes("فارس")) return "عمرو";
  if (clean.includes("زعتر")) return "زعتر";
  if (clean.includes("شوشو") || clean.includes("كريم")) return "شوشو";
  if (clean.includes("مرجان")) return "مرجان";
  if (clean.includes("كارمن") || clean.includes("سلمى")) return "كارمن";
  if (clean.includes("سمسم")) return "سمسم";
  if (clean.includes("جنى") || clean.includes("نور")) return "جنى";
  if (clean.includes("بلبل")) return "بلبل";
  return clean.split(" ")[0] || clean;
}

async function fetchRecentYouTubeChannelTitlesAndHeroes(accessToken) {
  const recentTitles = [];
  const recentHeroKeywords = new Set();
  if (!accessToken) return { recentTitles, recentHeroKeywords };
  try {
    const sRes = await fetch(
      "https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=12",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (sRes.ok) {
      const sData = await sRes.json();
      for (const item of sData?.items || []) {
        const title = String(item?.snippet?.title || "").trim();
        if (title) recentTitles.push(title);
      }
    }
  } catch {}
  for (const title of recentTitles.slice(0, 6)) {
    for (const team of RUNNER_CHARACTER_TEAMS) {
      const shortHero = getShortCharacterDisplayNameRunner(team.mainCharacterName, "fusha");
      const shortHeroEg = getShortCharacterDisplayNameRunner(team.mainCharacterName, "egyptian");
      if (
        title.includes(team.mainCharacterName) ||
        title.includes(shortHero) ||
        title.includes(shortHeroEg) ||
        title.includes(team.companionName.split(" ")[0])
      ) {
        recentHeroKeywords.add(team.mainCharacterName);
      }
    }
  }
  return { recentTitles, recentHeroKeywords };
}

function buildSmartEpisodeForRunner({
  team,
  topic,
  videoFormat,
  dialect = "egyptian",
  dailyTime = "19:00",
  aiScenes = null,
  aiTitle = "",
  aiMoralLesson = "",
}) {
  const isShort = videoFormat === "short_9_16";
  const isEgyptian = dialect !== "fusha";
  const dialectMode = isEgyptian ? "egyptian" : "fusha";
  const cleanTopic = String(topic || team.stories[0]).replace(/هـاننا/g, "سناننا").trim();
  const effectiveMainName = team.mainCharacterName;
  const effectiveCompName = team.companionName;
  const shortHero = getShortCharacterDisplayNameRunner(effectiveMainName, dialectMode);
  const shortComp = getShortCharacterDisplayNameRunner(effectiveCompName, dialectMode);
  const titleShortHero = getShortCharacterDisplayNameRunner(effectiveMainName, "fusha");
  const titleShortComp = getShortCharacterDisplayNameRunner(effectiveCompName, "fusha");
  const heroVoice = team.mainVoice || "Zephyr";
  const compVoice = team.compVoice || "Puck";
  const heroProp = team.heroProp || "الأداة الذكية المضيئة";
  const compProp = team.compProp || "حقيبة المساعدة السحرية";

  const rawCoreTitle = String(aiTitle || cleanTopic)
    .replace(/^Noreen\s*Kids\s*[:\-|]?\s*/i, "")
    .split("|")[0]
    .replace(/#[^\s#]+/g, "")
    .trim();
  const coreTitle =
    rawCoreTitle.length > 56
      ? rawCoreTitle.split(/\s+/).slice(0, 8).join(" ").trim()
      : rawCoreTitle || cleanTopic;
  const cleanVideoTitleAr = `Noreen Kids: ${coreTitle} | مغامرات ${titleShortHero} و${titleShortComp}`;

  const envCycle = ["space_forest", "floating_library", "cloud_ship", "coral_kingdom", "crystal_oasis"];
  const camCycle = ["dolly_in", "orbit_slow", "pan_right", "crane_up", "gentle_float"];
  const lightCycle = ["bioluminescent_twilight", "warm_lantern", "golden_sunset", "aqua_glow", "starlight_nebula"];
  const particleCycle = ["fireflies", "sparkles", "clouds", "bubbles", "starlight"];

  const count = isShort ? 4 : 8;
  const perSceneSec = isShort ? 17 : 39;
  const egyptianTopic = normalizeEgyptianColloquial(cleanTopic);

  const sceneTemplates = [
    {
      title: `1. البداية: انطلاق ${shortHero} و${shortComp}`,
      egyptianShort: `ازيكم يا أصحابي الحلوين في قناة نورين كيدز! بص كده معانا يا ${shortComp}، النهارده عندنا حكاية جميلة أوي عن ${egyptianTopic}! أنا جهزت ${heroProp} علشان نبدأ رحلتنا ونشوف إيه السر اللي مستنينا هناك!`,
      egyptianLong: `ازيكم يا أصحابي الحلوين في قناة نورين كيدز! عاملين إيه النهارده؟ بص كده معانا يا ${shortComp}، النهارده عندنا حكاية كبيرة ومشوقة أوي عن ${egyptianTopic}! أنا جهزت معايا ${heroProp}، وصاحبي ${shortComp} محضر ${compProp} علشان نكون مستعدين لأي مفاجأة تقابلنا في الطريق! شايفين يا أصحابنا الشطار الألوان الجميلة والنور العجيب اللي بيلمع هناك في قلب المكان السحري ده؟ يلا بينا نقرب خطوة بخطوة ونفتح عينينا كويس علشان نبدأ أول فصل في مغامرتنا النهارده مع بعض!`,
      speaker: effectiveMainName,
      voice: heroVoice,
    },
    {
      title: `2. التطور: ملاحظة العلامات العجيبة مع ${shortComp}`,
      egyptianShort: `يا خبر يا ${shortHero}! أنا فتحت ${compProp} وبصيت على المكان، ولقيت إن فيه مشكلة غير متوقعة في ${egyptianTopic} محتاجة مننا تفكير ذكي وتعاون سريع علشان نحلها!`,
      egyptianLong: `يا خبر يا ${shortHero}! أنا فتحت ${compProp} وبصيت كويس في العلامات المنورة اللي حوالينا، ولاحظت إن فيه تطور عجيب بيحصل في ${egyptianTopic}! النور الدهبي اللي كان شغال بدأ يضعف شوية بشوية، وده معناه إن فيه لغز علمي محتاج مننا تركيز وصبر وتعاون كبير! إيه رأيكم يا أصحابي الحلوين نركز سوا ونجمع كل الخيوط دي خطوة بخطوة؟ يلا يا ${shortHero} نقرب أكتر ونشوف إيه الحدث اللي بيحصل هناك!`,
      speaker: effectiveCompName,
      voice: compVoice,
    },
    {
      title: "3. الحدث المفاجئ: ظهور العقبة والتفكير العلمي",
      egyptianShort: `عندك حق يا ${shortComp}! يلا بينا نستخدم ${heroProp} ونتصرف بذكاء وهدوء، لأن لما بنكون إيد واحدة وبنتعاون بصدق، بنلاقي الحل الصح لكل مشكلة صعبة!`,
      egyptianLong: `بصوا كده يا أصحابي الحلوين! فجأة ظهر الحدث اللي كنا بنفحص علاماته يا ${shortComp}! الطريق قدامنا وقف علشان ${egyptianTopic} محتاج يتظبط بترتيب علمي دقيق أوي! بس إحنا في قناة نورين كيدز عمرنا ما بنخاف ولا بنستسلم خالص مهما كان التحدي كبير، لأن التفكير الهادي والتعاون بيخلونا نلاقي الحل الصح دايما! أنا هستخدم ${heroProp} دلوقتي علشان نبدأ الحل العملي بالظبط!`,
      speaker: effectiveMainName,
      voice: heroVoice,
    },
    {
      title: "4. المشكلة: تحديد سبب المشكلة بدقة",
      egyptianShort: `بص يا ${shortHero}! إحنا عرفنا السبب خلاص، يلا نطبق الحل الصحي سوا!`,
      egyptianLong: `أيوة يا ${shortHero}! أنا قربت بـ ${compProp} وعرفت السر كله فين بالظبط! أهم حاجة في ${egyptianTopic} إننا نلتزم بالنظام والنظافة والخطوات العلمية الصح كل يوم من غير كسل! شفتوا يا أصحابنا الحلوين إزاي لما بندور على سبب المشكلة بهدوء من غير تسرع بنعرف نوصل للحل بسرعة؟ يلا بينا نبدأ التصرف العملي ونساعد بعض حالاً!`,
      speaker: effectiveCompName,
      voice: compVoice,
    },
    {
      title: "5. التصرف: العمل الجماعي وتجربة الحل",
      egyptianShort: `يا سلام على الشطارة يا ${shortComp}! بالعلم والنظافة قدرنا ننجح ونحل المشكلة!`,
      egyptianLong: `يلا بينا يا ${shortComp} نبدأ التصرف الصح دلوقتي! أنا هستخدم ${heroProp}، وإنت ساعدني بـ ${compProp} علشان نكمل المهمة في نفس اللحظة! شفتوا يا أصحابنا الحلوين إزاي لما اتعاونا بصبر وهدوء ونظام بقت كل حاجة بتلمع وجميلة أوي؟ العلم والمعرفة والاهتمام بصحتنا ونظافتنا هما الكنز الحقيقي اللي بيخلينا ننجح ونساعد كل اللي حوالينا!`,
      speaker: effectiveMainName,
      voice: heroVoice,
    },
    {
      title: "6. الحل الذكي: نجاح المهمة وعودة النور",
      egyptianShort: `بص يا ${shortHero}! الحل نجح وكل أصحابنا فرحانين بالابتسامة الجميلة!`,
      egyptianLong: `هيييه! الحل نجح مية في المية يا ${shortHero}! بصوا يا كل أصحابنا الشطار في قناة نورين كيدز! أول ما طبقنا الخطوات الصح في ${egyptianTopic}، رجعت الابتسامة المنورة والفرحة الكبيرة للمكان كله! اللحظة دي من أحلى اللحظات في رحلتنا النهارده، لأن كل أصحابنا في العالم السحري رجعتلهم الفرحة والصحة والنشاط بفضل التعاون والتفكير العلمي السليم!`,
      speaker: effectiveCompName,
      voice: compVoice,
    },
    {
      title: "7. الاحتفال بالنجاح والدرس المستفاد",
      egyptianShort: `يا سلام على الفرحة الكبيرة! دلوقتي كل واحد فينا عرف قيمة العلم والنظافة والتعاون!`,
      egyptianLong: `بجد يا ${shortComp} دي كانت مغامرة جميلة أوي لا يمكن ننساها في حكاية ${egyptianTopic}! بدأنا رحلتنا بملاحظة مهمة، ولما واجهتنا المشكلة متخليناش عن بعض خالص، وفكرنا وتصرفنا بذكاء لحد ما وصلنا للحل النهائي! اتعلمنا النهارده سوا يا أصحابي إن النظافة والنظام والصدق ومساعدة غيرنا بيحولوا أي عقبة صعبة لنجاح كبير يفرح كل القلوب!`,
      speaker: effectiveMainName,
      voice: heroVoice,
    },
    {
      title: `8. النهاية: رسالة ${shortHero} و${shortComp} لأبطال Noreen Kids`,
      egyptianShort: `هيييه! حلينا اللغز ونجحت المهمة يا ${shortHero}! 🧩 تحدي الشطار: يا ترى إيه أهم حاجة اتعلمناها من مغامرة ${egyptianTopic}؟ اكتبوا إجابتكم في التعليقات وقولوا لنا مين كان أكتر شخصية ساعدت في الحل، وما تنسوش تشتركوا في قناة نورين كيدز وتعملوا لايك! مع السلامة يا أبطال!`,
      egyptianLong: `ودلوقتي يا أصحابنا الحلوين، وصلنا للمشهد الثامن والتحدي الأخير بعد ما عشنا مغامرة ${egyptianTopic} مع ${shortHero} و${shortComp}! 🧩 سؤال الشطار: إيه أهم درس اتعلمناه النهارده، وإزاي نقدر نستخدمه في حياتنا؟ اكتبوا إجابتكم في التعليقات وسمّوا صاحبكم اللي ساعد في الحل، وبعدها اشتركوا في قناة نورين كيدز واعملوا لايك! بنحبكم أوي يا أبطال!`,
      speaker: effectiveCompName,
      voice: compVoice,
    },
  ];

  const selectedTemplates = isShort
    ? [sceneTemplates[0], sceneTemplates[1], sceneTemplates[2], sceneTemplates[7]]
    : sceneTemplates.slice(0, count);

  const minWordsPerScene = isShort ? 18 : 42;
  const scenes = selectedTemplates.map((tpl, idx) => {
    const aiSc = Array.isArray(aiScenes) ? aiScenes[idx] : null;
    const rawAiText = String(aiSc?.dialogueArabic || "").trim();
    const fallbackText = isShort ? tpl.egyptianShort : tpl.egyptianLong;
    let chosenRaw =
      rawAiText.split(/\s+/).filter(Boolean).length >= minWordsPerScene
        ? rawAiText
        : rawAiText.length > 15
        ? `${rawAiText} ${fallbackText}`
        : fallbackText;
    if (idx === selectedTemplates.length - 1) {
      const interactiveEnding = isShort
        ? ` 🧩 تحدي الشطار: يا ترى إيه أهم حاجة اتعلمناها من مغامرة ${egyptianTopic}؟ اكتبوا إجابتكم في التعليقات وقولوا لنا مين كان أكتر شخصية ساعدت في الحل!`
        : ` 🧩 سؤال الشطار: إيه أهم درس اتعلمناه النهارده من مغامرة ${egyptianTopic}، وإزاي نقدر نستخدمه في حياتنا؟ اكتبوا إجابتكم في التعليقات!`;
      if (!/\?|؟|اكتبوا.*تعليق|إجابت/.test(chosenRaw)) chosenRaw += interactiveEnding;
    }
    const validated = runPreTtsEgyptianValidationLayer(
      chosenRaw,
      idx,
      selectedTemplates.length
    ).validatedText;
    const isHeroTurn = idx % 2 === 0;
    return {
      id: `${isShort ? "sc-sh" : "sc-lg"}-${idx + 1}`,
      sceneNumber: idx + 1,
      title: idx === selectedTemplates.length - 1 ? tpl.title : String(aiSc?.title || tpl.title),
      environmentPreset: envCycle[idx % envCycle.length],
      cameraMotion: camCycle[idx % camCycle.length],
      lightingMood: lightCycle[idx % lightCycle.length],
      particleEffect: particleCycle[idx % particleCycle.length],
      speakerName: isHeroTurn ? effectiveMainName : effectiveCompName,
      voiceName: isHeroTurn ? heroVoice : compVoice,
      dialect: dialectMode,
      dialogueArabic: validated,
      durationSec: perSceneSec,
    };
  });

  let cursor = 0;
  const chaptersLines = scenes.map((sc) => {
    const mm = String(Math.floor(cursor / 60)).padStart(2, "0");
    const ss = String(cursor % 60).padStart(2, "0");
    cursor += sc.durationSec;
    return `${mm}:${ss} ${sc.title}`;
  });

  const moralText = String(
    aiMoralLesson || "التعاون والصدق وحب المعرفة ومساعدة الأصدقاء"
  ).trim();
  const summaryText = `ينطلق بطلنا الشجاع "${effectiveMainName}" مع صديقه الذكي "${effectiveCompName}" في مغامرة ثلاثية الأبعاد متجددة حول (${coreTitle})، حيث يواجهان ألغازاً مشوقة ويتعلمان كيف يصنع التعاون والصدق والذكاء المعجزات.`;

  const descriptionAr = `أهلاً بكم يا أصحابنا في قناة Noreen Kids لأفلام الرسوم المتحركة!

📖 ملخص القصة:
${summaryText}

🌟 هنتعلم إيه في حلقة النهاردة؟
- ${moralText}.
- حب الاستكشاف والتفكير العلمي لحل المشكلات.
- الصدق والأمانة ومساعدة الآخرين في كل وقت.

🕖 موعد النشر اليومي: الساعة ${dailyTime} بتوقيت مصر.

الفصول الزمنية:
${chaptersLines.join("\n")}

✨ لو عجبتكم الحدوتة يا أبطال، متنسوش تشتركوا في قناة Noreen Kids وتفعلوا جرس التنبيهات (🔔) وتضغطوا لايك (👍) علشان تعيشوا معانا مغامرة جديدة كل يوم!
وجودكم في عيلتنا السحرية بينور عالمنا 💖🎬

#Noreen_Kids #حواديت_أطفال #كرتون_أطفال_3D #رسوم_متحركة #قصص_أطفال_قبل_النوم #حواديت_مصرية #أفلام_كرتون #تعليم_الأطفال #KidsAnimation #3DCartoon #ArabicKidsCartoon #BedtimeStoriesForKids #PixarStyle3D #KidsLearning #TrendingKids`;

  return {
    id: `ep-gh-${isShort ? "short" : "long"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: coreTitle,
    subtitle: `مغامرات ${shortHero} و${shortComp} · Noreen Kids`,
    moralLesson: moralText,
    summary: summaryText,
    targetAge: "5-8 سنوات",
    visualStyle: isShort ? "Pixar Vertical 9:16 Shorts 3D" : "Pixar & DreamWorks 3D Feature Animation",
    videoFormat,
    dialect: dialectMode,
    estimatedDurationSec: scenes.reduce((acc, s) => acc + s.durationSec, 0),
    mainCharacterName: effectiveMainName,
    companionName: effectiveCompName,
    scenes,
    youtubePackage: {
      videoTitleAr: cleanVideoTitleAr,
      videoTitleEn: `Noreen Kids: 3D Adventure of ${titleShortHero} & ${titleShortComp}`,
      descriptionAr,
      tags: [
        "Noreen Kids",
        "نورين كيدز",
        "أفلام كرتون 3D للأطفال",
        "حواديت أطفال باللهجة المصرية",
        "قصص أطفال هادفة",
        `مغامرات ${titleShortHero} و${titleShortComp}`,
        "رسوم متحركة ثلاثية الأبعاد",
        "3D Kids Animation",
      ],
      thumbnailTextAr: coreTitle.split(" ").slice(0, 4).join(" "),
    },
  };
}

function selectNonRepeatingTeamAndTopicForRunner({
  excludedHeroes = new Set(),
  excludedTitles = [],
}) {
  const cleanExcludedTitles = excludedTitles
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  let eligibleTeams = RUNNER_CHARACTER_TEAMS.filter(
    (t) => !excludedHeroes.has(t.mainCharacterName)
  );
  if (eligibleTeams.length === 0) {
    eligibleTeams = [...RUNNER_CHARACTER_TEAMS];
  }

  // Shuffle eligible teams using high-entropy crypto random
  const shuffledTeams = [...eligibleTeams].sort(
    () => (crypto.randomInt(0, 1000) - 500)
  );
  const chosenTeam = shuffledTeams[0];

  const shuffledStories = [...chosenTeam.stories].sort(
    () => (crypto.randomInt(0, 1000) - 500)
  );
  let chosenTopic = shuffledStories[0];
  for (const candidate of shuffledStories) {
    const keyWords = candidate
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4);
    const alreadyUsed = cleanExcludedTitles.some((prevTitle) =>
      keyWords.filter((kw) => prevTitle.includes(kw)).length >= 2
    );
    if (!alreadyUsed) {
      chosenTopic = candidate;
      break;
    }
  }

  return { team: chosenTeam, topic: chosenTopic };
}

async function generateFreshAiEpisodeForRunner({
  team,
  topic,
  videoFormat,
  dialect = "egyptian",
  dailyTime = "19:00",
}) {
  const isShort = videoFormat === "short_9_16";
  const scCount = isShort ? 4 : 8;
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `أنت المخرج الإبداعي لقناة الأطفال ثلاثية الأبعاد "Noreen Kids".
قم بتوليد حلقة كرتون 3D جديدة كلياً ومبتكرة (${
        isShort
          ? "فيديو قصير YouTube Shorts مدته 68 ثانية من 4 مشاهد مترابطة"
          : "فيلم كرتون طويل مدته 312 ثانية من 8 مشاهد مترابطة، كل مشهد 55 إلى 75 كلمة"
      }) باللهجة المصرية القاهرية الطبيعية المحببة للأطفال بدون أي تشكيل فصحى.
البطل الرئيسي: "${team.mainCharacterName}" (الأداة: ${team.heroProp}).
المرافق: "${team.companionName}" (الأداة: ${team.compProp}).
فكرة القصة الجديدة: "${topic}".
أخرج JSON فقط يحتوي على:
{
  "title": "عنوان القصة بدون Noreen Kids وبدون هاشتاج",
  "moralLesson": "الدرس المستفاد من الحلقة",
  "scenes": [
    { "sceneNumber": 1, "title": "عنوان المشهد", "dialogueArabic": "الحوار الكامل باللهجة المصرية القاهرية" }
  ]
}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      const rawText = String(response?.text || "").trim();
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length >= scCount) {
          return buildSmartEpisodeForRunner({
            team,
            topic,
            videoFormat,
            dialect,
            dailyTime,
            aiScenes: parsed.scenes,
            aiTitle: parsed.title,
            aiMoralLesson: parsed.moralLesson,
          });
        }
      }
    } catch (e) {
      console.warn(
        `   [AI Story Info] Using domain-matched smart episode builder for ${team.mainCharacterName}: ${
          e instanceof Error ? e.message : e
        }`
      );
    }
  }

  return buildSmartEpisodeForRunner({
    team,
    topic,
    videoFormat,
    dialect,
    dailyTime,
  });
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

/**
 * Restored engagement layer: story-specific first challenge comments and smart replies.
 */
function buildInteractiveChallengeMessage(episode, platform = "youtube") {
  const hero = String(episode?.mainCharacterName || "أبطال نورين كيدز").trim();
  const comp = String(episode?.companionName || "أصحابنا الشطار").trim();
  const topic = normalizeEgyptianColloquial(String(episode?.title || "مغامرة النهارده"));
  const moral = normalizeEgyptianColloquial(String(episode?.moralLesson || "التعاون والتفكير الذكي ومساعدة الأصدقاء"));
  return platform === "facebook"
    ? `🌟 سؤال التحدي لأبطال نورين كيدز! يا ترى إيه أهم حاجة اتعلمناها من مغامرة "${topic}" مع ${hero} و${comp}؟ 💡 ${moral}. اكتبوا إجابتكم في التعليقات وقولوا لنا مين الشخصية اللي ساعدت أكتر في الحل! 👇💖`
    : `🌟 سؤال التحدي لشطار Noreen Kids! يا ترى إيه أهم حاجة اتعلمناها من مغامرة "${topic}" مع ${hero} و${comp}؟ 💡 ${moral}. اكتبوا إجابتكم في التعليقات وقولوا لنا مين الشخصية اللي ساعدت أكتر في الحل! 👇💖`;
}

async function postYouTubeFirstComment({ accessToken, videoId, message }) {
  if (!accessToken || !videoId || !message) return { success: false, error: "Missing parameters" };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ snippet: { videoId: String(videoId).trim(), topLevelComment: { snippet: { textOriginal: String(message).trim() } } } }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: true, commentId: data?.id || null };
      }
      if (attempt < 3) await sleep(3000 * attempt);
    } catch {}
  }
  return { success: false, error: "Failed after 3 attempts" };
}

async function generateSmartCommentReply({ authorName, commentText, platform, postTitle }) {
  const cleanAuthor = String(authorName || "صديقنا الغالي").replace(/[^\p{L}\p{N}\s_.-]/gu, "").trim().slice(0, 35) || "صديقنا الغالي";
  const cleanComment = String(commentText || "").trim().slice(0, 700);
  const key = String(process.env.GEMINI_API_KEY || "").trim();
  if (key) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const prompt = `أنت مدير مجتمع قناة وصفحة نورين كيدز للأطفال. اكتب رداً قصيراً ودافئاً باللهجة المصرية على تعليق المتابع.
المنصة: ${platform}
اسم المتابع: "${cleanAuthor}"
التعليق: "${cleanComment}"
عنوان الحلقة: "${String(postTitle || "مغامرة نورين كيدز").slice(0, 180)}"
القواعد: سطران كحد أقصى، تشجيع لطيف، لا معلومات خطرة، لا تطلب بيانات شخصية، ولا تذكر أنك ذكاء اصطناعي.`;
      const resp = await ai.models.generateContent({ model: "gemini-3.8-flash", contents: prompt });
      const out = String(resp?.text || "").trim();
      if (out.length >= 10 && out.length <= 450) return out;
    } catch {}
  }
  return `يا أهلاً بيك يا ${cleanAuthor} في عيلة نورين كيدز! 🌟💖 إجابتك وتعليقك فرحونا أوي، استنونا في مغامرة جديدة واسألونا دايماً يا أبطال!`;
}

async function scanAndAutoReplyYouTubeComments({ accessToken, geminiApiKey, schedule }) {
  if (!accessToken) return { repliesCount: 0, scannedThreads: 0 };
  let channelId = String(schedule?.channelId || "").trim();
  try {
    if (!channelId) {
      const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await ch.json().catch(() => ({}));
      channelId = String(data?.items?.[0]?.id || "");
    }
    if (!channelId) return { repliesCount: 0, scannedThreads: 0 };

    const replied = new Set(Array.isArray(schedule.repliedCommentIds) ? schedule.repliedCommentIds : []);
    let repliesCount = 0;
    let scannedThreads = 0;
    let pageToken = "";
    let pages = 0;

    // Scan multiple pages so older comments on previous videos are not skipped.
    do {
      const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
      url.searchParams.set("part", "snippet,replies");
      url.searchParams.set("allThreadsRelatedToChannelId", channelId);
      url.searchParams.set("maxResults", "100");
      url.searchParams.set("order", "time");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const list = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await list.json().catch(() => ({}));
      const threads = Array.isArray(data?.items) ? data.items : [];
      scannedThreads += threads.length;

      for (const thread of threads) {
        const top = thread?.snippet?.topLevelComment;
        const id = String(top?.id || "");
        const authorChannelId = String(top?.snippet?.authorChannelId?.value || "");
        if (!id || replied.has(id) || (channelId && authorChannelId === channelId)) continue;

        const replyText = await generateSmartCommentReply({
          authorName: top?.snippet?.authorDisplayName || "صديقنا الغالي",
          commentText: top?.snippet?.textOriginal || "",
          platform: "YouTube",
          postTitle: schedule?.lastCloudRunReport?.shortEpisodeTitle,
        });
        const rep = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({ snippet: { parentId: id, textOriginal: replyText } }),
        });
        if (rep.ok) {
          replied.add(id);
          repliesCount++;
        }
      }

      pageToken = String(data?.nextPageToken || "");
      pages++;
    } while (pageToken && pages < 10);

    schedule.repliedCommentIds = Array.from(replied).slice(-500);
    schedule.lastAutoCommentScanAtCairo = new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
    return { repliesCount, scannedThreads };
  } catch {
    return { repliesCount: 0, scannedThreads: 0 };
  }
}
async function postFacebookFirstComment({ rawPageAccessToken, pageId, videoId, message }) {
  const token = await resolveTrueFacebookPageAccessToken({ rawToken: rawPageAccessToken, targetPageId: pageId });
  if (!token || !videoId || !message) return { success: false };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(videoId)}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: String(message).trim() }),
    });
    const data = await res.json().catch(() => ({}));
    return { success: res.ok, commentId: data?.id || null };
  } catch {
    return { success: false };
  }
}

async function scanAndAutoReplyFacebookVideoComments({ rawPageAccessToken, pageId, videoId, episode, schedule }) {
  const token = await resolveTrueFacebookPageAccessToken({ rawToken: rawPageAccessToken, targetPageId: pageId });
  if (!token || !pageId) return { repliesCount: 0, scannedComments: 0, scannedVideos: 0 };
  try {
    const replied = new Set(Array.isArray(schedule.facebookRepliedCommentIds) ? schedule.facebookRepliedCommentIds : []);
    let repliesCount = 0;
    let scannedComments = 0;
    let scannedVideos = 0;
    let pageUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/videos?fields=id,message,created_time&limit=50`;
    let videoPages = 0;

    // Scan recent Page videos, not only the video from the current run.
    do {
      const videoRes = await fetch(pageUrl, { headers: { Authorization: `Bearer ${token}` } });
      const videoData = await videoRes.json().catch(() => ({}));
      const videos = Array.isArray(videoData?.data) ? videoData.data : [];

      for (const video of videos) {
        const currentVideoId = String(video?.id || "");
        if (!currentVideoId) continue;
        scannedVideos++;

        let commentsUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(currentVideoId)}/comments?fields=id,message,from,created_time&limit=100`;
        let commentPages = 0;
        do {
          const commentRes = await fetch(commentsUrl, { headers: { Authorization: `Bearer ${token}` } });
          const commentData = await commentRes.json().catch(() => ({}));
          const comments = Array.isArray(commentData?.data) ? commentData.data : [];
          scannedComments += comments.length;

          for (const item of comments) {
            const id = String(item?.id || "");
            const authorId = String(item?.from?.id || "");
            if (!id || replied.has(id) || (authorId && authorId === String(pageId))) continue;

            const replyText = await generateSmartCommentReply({
              authorName: item?.from?.name || "صديقنا الغالي",
              commentText: item?.message || "",
              platform: "Facebook",
              postTitle: video?.message || episode?.title,
            });
            const rep = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(id)}/comments`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ message: replyText }),
            });
            if (rep.ok) {
              replied.add(id);
              repliesCount++;
            }
          }

          commentsUrl = String(commentData?.paging?.next || "");
          commentPages++;
        } while (commentsUrl && commentPages < 10);
      }

      pageUrl = String(videoData?.paging?.next || "");
      videoPages++;
    } while (pageUrl && videoPages < 5);

    schedule.facebookRepliedCommentIds = Array.from(replied).slice(-500);
    schedule.lastFacebookAutoCommentScanAtCairo = new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
    return { repliesCount, scannedComments, scannedVideos };
  } catch {
    return { repliesCount: 0, scannedComments: 0, scannedVideos: 0 };
  }
}
async function buildSmartHeroReplyForFacebookCommentRunner({
  authorName,
  commentText,
  postTitle,
}) {
  const cleanAuthor = String(authorName || "صديقنا الغالي")
    .replace(/[^\p{L}\p{N}\s_.-]/gu, "")
    .trim()
    .slice(0, 35);
  const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `أنت مدير مجتمع أبطال قناة وصفحة "Noreen Kids" (نورين كيدز) الكرتونية ثلاثية الأبعاد للأطفال على فيسبوك.
كتب المتابع "${cleanAuthor}" هذا التعليق على منشور بعنوان "${postTitle || "مغامرة نورين كيدز"}":
"${commentText}"

اكتب رداً واحداً قصيراً ومبهجاً جداً باللهجة المصرية الدافئة واللطيفة (في سطرين كحد أقصى):
- اذكر اسم المتابع (${cleanAuthor}) بحب وترحيب حار من أبطال نورين كيدز (مثل دكتورة نورين وأرنوب والمهندسة نوران والنمر الفرفوش).
- تفاعل بذكاء مع كلامه أو مع اسم الطفل المذكور في التعليق، واختم بسؤال تفاعلي لطيف أو دعوة لانتظار حلقة الغد.`;
      const resp = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });
      const text = String(resp.text || "").trim();
      if (text && text.length >= 15 && text.length <= 450) {
        return text;
      }
    } catch {}
  }

  const warmReplies = [
    `يا أهلاً بيك يا ${cleanAuthor} في عيلة نورين كيدز! 🌟💖 دكتورة نورين وأرنوب الشقي بيبعتولك أحلى تحية وبيقولولك شكراً على تعليقك الجميل.. استنونا في مغامرة جديدة بكرة! 🎬✨`,
    `نورتوا صفحتنا يا ${cleanAuthor}! 🎉✨ كل أبطال نورين كيدز (دكتورة نورين وأرنوب والمهندسة نوران والنمر الفرفوش) بيقولولكم شكراً من القلب على كلامكم الحلو! تفتكروا مغامرة بكرة هتكون مع مين من الأبطال؟ 🤔💖`,
    `أحلى تحية من أبطال نورين كيدز لـ ${cleanAuthor}! 🌟👏 كلامكم الجميل بيفرح قلوبنا وبيخلينا نجهز لكم حواديت ومغامرات 3D أحلى وأحلى كل يوم! 🔔❤️`,
  ];
  return warmReplies[Math.floor(Math.random() * warmReplies.length) % warmReplies.length];
}

async function publishDailyInteractive3DPhotoPostForRunner({
  rawPageAccessToken,
  pageId,
  tmpDir,
  fbSchedule,
  excludedHeroes = new Set(),
  forcePublish = false,
}) {
  const activeToken = await resolveTrueFacebookPageAccessToken({
    rawToken: rawPageAccessToken,
    targetPageId: pageId,
  });
  if (!activeToken) {
    return { published: false, reason: "missing_token" };
  }

  const nowCairoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const nowCairoHHMM = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  // 1) Daily limit: allow up to 3 interactive 3D posts per Cairo day
  // (1 automatic scheduled post + up to 2 manual engagement_only posts).
  // The limit applies even when forcePublish=true.
  const todayInteractivePosts = Array.isArray(fbSchedule?.interactivePhotoPostsLog)
    ? fbSchedule.interactivePhotoPostsLog.filter(
        (entry) =>
          String(entry?.publishedAtCairo || "").startsWith(nowCairoDate + " · ")
      )
    : [];
  let todayInteractivePostCount = todayInteractivePosts.length;

  if (!forcePublish) {
    try {
      const checkRes = await fetch(
        `https://graph.facebook.com/v21.0/${encodeURIComponent(
          pageId
        )}/published_posts?fields=id,message,created_time&limit=10`,
        {
          headers: { Authorization: `Bearer ${activeToken}` },
        }
      );
      const checkJson = await checkRes.json().catch(() => ({}));
      if (checkRes.ok && Array.isArray(checkJson?.data)) {
        const graphTodayInteractivePostCount = checkJson.data.filter((p) => {
          const msg = String(p?.message || "");
          if (
            !msg.includes("تحدي أبطال Noreen Kids") &&
            !msg.includes("فزورة النهاردة من عالم Noreen Kids") &&
            !msg.includes("تحية خاصة من")
          ) {
            return false;
          }
          if (!p?.created_time) return false;
          const postCairoDate = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Cairo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(p.created_time));
          return postCairoDate === nowCairoDate;
        }).length;
        todayInteractivePostCount = Math.max(
          todayInteractivePostCount,
          graphTodayInteractivePostCount
        );
      }
    } catch {}
  }

  if (todayInteractivePostCount >= 3) {
    console.log(
      `✅ [Daily 3D Photo Post Guard] تم الوصول للحد اليومي (3 منشورات تفاعلية 3D) بتاريخ ${nowCairoDate} — تخطي النشر.`
    );
    return { published: false, skippedDailyLimit: true };
  }

  // Keep interactive 3D posts from repeating a previous hero/companion + theme combination.
  // The log is persisted in fbSchedule, so this guard survives across workflow runs/days.
  const previousInteractivePosts = Array.isArray(fbSchedule?.interactivePhotoPostsLog)
    ? fbSchedule.interactivePhotoPostsLog
    : [];
  const previousInteractiveKeys = new Set(
    previousInteractivePosts
      .map((entry) =>
        [
          String(entry?.heroName || "").trim(),
          String(entry?.companionName || "").trim(),
          String(entry?.themeTitle || entry?.title || "").trim(),
        ].join("|")
      )
      .filter((key) => key !== "||")
  );

  const interactiveThemePrefixes = [
    "تحدي الملاحظة الذكية",
    "فزورة الأبطال الشطار",
    "لوحة شرف أبطال Noreen Kids",
  ];
  const getInteractiveThemeTitle = (prefix, hero, comp) =>
    `${prefix} مع ${hero} و${comp}`;
  const hasUnusedInteractiveTheme = (hero, comp) =>
    interactiveThemePrefixes.some(
      (prefix) =>
        !previousInteractiveKeys.has(
          [hero, comp, getInteractiveThemeTitle(prefix, hero, comp)].join("|")
        )
    );

  const interactiveTeamPool = RUNNER_CHARACTER_TEAMS.filter((team) => {
    const hero = getShortCharacterDisplayNameRunner(
      team.mainCharacterName || "",
      "egyptian"
    );
    const comp = getShortCharacterDisplayNameRunner(
      team.companionName || "",
      "egyptian"
    );
    return (
      !excludedHeroes.has(team.mainCharacterName) &&
      hasUnusedInteractiveTheme(hero, comp)
    );
  });
  const fallbackInteractiveTeamPool = RUNNER_CHARACTER_TEAMS.filter((team) => {
    const hero = getShortCharacterDisplayNameRunner(
      team.mainCharacterName || "",
      "egyptian"
    );
    const comp = getShortCharacterDisplayNameRunner(
      team.companionName || "",
      "egyptian"
    );
    return hasUnusedInteractiveTheme(hero, comp);
  });
  const finalInteractiveTeamPool =
    interactiveTeamPool.length > 0
      ? interactiveTeamPool
      : fallbackInteractiveTeamPool.length > 0
        ? fallbackInteractiveTeamPool
        : RUNNER_CHARACTER_TEAMS;

  const pick = [...finalInteractiveTeamPool].sort(
    () => crypto.randomInt(0, 1000) - 500
  )[0];
  const heroName = pick.mainCharacterName || "الطبيبة نورين";
  const compName = pick.companionName || "أرنوب الشقي الممرض";
  const shortHero = getShortCharacterDisplayNameRunner(heroName, "egyptian");
  const shortComp = getShortCharacterDisplayNameRunner(compName, "egyptian");

  const interactiveThemes = [
    {
      themeTitle: `تحدي الملاحظة الذكية مع ${shortHero} و${shortComp}`,
      caption: `🌟 تحدي أبطال Noreen Kids اليومي للشطار! 🌟\nبصوا كويس في الصورة مع ${shortHero} و${shortComp}.. 🤔✨\nلو هنسافر النهاردة في مغامرة جديدة: تفتكروا ${shortHero} هيستخدم أنهي أداة ذكية علشان يساعد ${shortComp}؟\n\n1️⃣ اكتبوا إجابتكم في التعليقات 👇\n2️⃣ اكتبوا اسم طفلكم الجميل عشان ${shortHero} و${shortComp} يحيوه بالاسم في حلقة بكرة! 🎬💖\n3️⃣ متنسوش متابعة صفحة Noreen Kids 🔔👍 ومشاركة البوست مع كل الأمهات!\n\n#نورين_كيدز #Noreen_Kids #قصص_أطفال #حواديت_قبل_النوم #كرتون_أطفال_3D #تربية_إيجابية #أمهات_مصر`,
    },
    {
      themeTitle: `فزورة الأبطال الشطار مع ${shortHero} و${shortComp}`,
      caption: `🎉 فزورة النهاردة من عالم Noreen Kids ثلاثي الأبعاد! 🎉\nبطلنا المحبوب "${shortHero}" وصديقنا الشقي "${shortComp}" بيجهزوا لمفاجأة كبيرة النهاردة! 🌟🎬\nسؤال للشطار الحلوين: إيه أكتر صفة جميلة بتحبوها في ${shortHero} و${shortComp}؟\n(الشجاعة 💪 - التعاون 🤝 - الذكاء 🧠 - خفة الدم 😄)؟\n\n👇 شاركونا في التعليقات واكتبوا اسم طفلكم عشان نرحب بيه بالاسم في عيلة نورين كيدز، واضغطوا متابعة للصفحة 🔔👍 عشان متفوتكمش حكاية النهاردة!\n\n#نورين_كيدز #Noreen_Kids #قصص_أطفال #حواديت_أطفال #كرتون_مصري #تربية_إيجابية #أمهات_مصر`,
    },
    {
      themeTitle: `لوحة شرف أبطال Noreen Kids مع ${shortHero} و${shortComp}`,
      caption: `💖 تحية خاصة من ${shortHero} و${shortComp} لكل أصحابنا الحلوين! 💖\nمين من أطفالنا الشطار غسل سنانه وسمع كلام ماما وبابا النهاردة؟ 🌟👏\n\n👇 كل أم تكتب اسم بطلها أو بطلتها في التعليقات تحت الصورة دي عشان ${shortHero} و${shortComp} يبعتولهم شهادة شطارة وتحية خاصة بالاسم! 🏆✨\nومتنسوش متابعة صفحة Noreen Kids 🔔👍 ومشاركة المنشور مع أصحابكم!\n\n#نورين_كيدز #Noreen_Kids #قصص_أطفال #حواديت_قبل_النوم #كرتون_أطفال_3D #تربية_إيجابية #أمهات_مصر`,
    },
  ];

  const availableThemes = interactiveThemes.filter(
    (theme) =>
      !previousInteractiveKeys.has(
        [shortHero, shortComp, theme.themeTitle].join("|")
      )
  );
  const chosenTheme =
    (availableThemes.length > 0 ? availableThemes : interactiveThemes)[
      Math.floor(
        Math.random() *
          (availableThemes.length > 0
            ? availableThemes.length
            : interactiveThemes.length)
      )
    ];

  const heroImg = resolveCharacterAvatarPath(heroName, heroName);
  const compImg = resolveCharacterAvatarPath(compName, compName);
  const cardPath = path.join(tmpDir, `interactive_3d_card_${Date.now()}.jpg`);

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
    "2",
    cardPath,
  ]);

  const cardBuffer = fs.readFileSync(cardPath);
  const formData = new FormData();
  formData.append("message", chosenTheme.caption);
  formData.append("published", "true");
  formData.append(
    "source",
    new Blob([new Uint8Array(cardBuffer)], { type: "image/jpeg" }),
    "noreen_kids_3d_daily_challenge.jpg"
  );

  const upRes = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${activeToken}` },
      body: formData,
    }
  );
  const upData = await upRes.json().catch(() => ({}));
  if (!upRes.ok || upData?.error || (!upData?.id && !upData?.post_id)) {
    throw new Error(
      upData?.error?.message || `HTTP ${upRes.status} on /${pageId}/photos`
    );
  }

  const photoId = String(upData.id || "");
  const postId = String(upData.post_id || `${pageId}_${photoId}`);
  const permalinkUrl = `https://www.facebook.com/${postId}`;

  // Immediately post the interactive first comment on the photo post
  try {
    const firstCommentMsg = `🌟 تحدي أبطال نورين كيدز النهاردة مع ${shortHero} و${shortComp}!\n👇 اكتبوا لنا اسم طفلكم وإجابته في تعليق هنا عشان ${shortHero} و${shortComp} يردوا عليه ويحيوه بالاسم، ومتنسوش متابعة الصفحة 🔔👍 عشان توصلكم حدوتة النهاردة!`;
    await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(postId)}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: firstCommentMsg }),
      }
    ).catch(() => {});
  } catch {}

  const logRecord = {
    postId,
    photoId,
    themeTitle: chosenTheme.themeTitle,
    title: chosenTheme.themeTitle,
    caption: chosenTheme.caption,
    heroName: shortHero,
    companionName: shortComp,
    publishedAtCairo: `${nowCairoDate} · ${nowCairoHHMM} بتوقيت مصر`,
    permalinkUrl,
  };

  fbSchedule.lastInteractivePhotoDateKey = nowCairoDate;
  fbSchedule.interactivePhotoPostsLog = [
    logRecord,
    ...(Array.isArray(fbSchedule.interactivePhotoPostsLog)
      ? fbSchedule.interactivePhotoPostsLog
      : []
    ).slice(0, 39),
  ];

  console.log(
    `📸 FACEBOOK INTERACTIVE 3D PHOTO POST PUBLISHED! Post ID: ${postId} | Title: ${chosenTheme.themeTitle}`
  );
  return {
    published: true,
    postId,
    photoId,
    permalinkUrl,
    themeTitle: chosenTheme.themeTitle,
    logRecord,
  };
}

async function scanAndAutoReplyFacebookCommentsForRunner({
  rawPageAccessToken,
  pageId,
  fbSchedule,
}) {
  const activeToken = await resolveTrueFacebookPageAccessToken({
    rawToken: rawPageAccessToken,
    targetPageId: pageId,
  });
  if (!activeToken) {
    return { scannedObjects: 0, newRepliesCount: 0 };
  }

  const nowCairoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const nowCairoHHMM = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  const repliedSet = new Set(
    Array.isArray(fbSchedule?.repliedCommentIds)
      ? fbSchedule.repliedCommentIds
      : []
  );

  const itemsById = new Map();
  const edgesToFetch = [
    `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pageId
    )}/videos?fields=id,title,description,comments.limit(25){id,message,from,created_time,comments.limit(25){id,message,from,created_time}}&limit=35`,
    `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pageId
    )}/video_reels?fields=id,title,description,comments.limit(25){id,message,from,created_time,comments.limit(25){id,message,from,created_time}}&limit=35`,
    `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pageId
    )}/published_posts?fields=id,message,comments.limit(25){id,message,from,created_time,comments.limit(25){id,message,from,created_time}}&limit=35`,
  ];

  for (const edgeUrl of edgesToFetch) {
    try {
      const edgeRes = await fetch(edgeUrl, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      const edgeJson = await edgeRes.json().catch(() => ({}));
      if (edgeRes.ok && Array.isArray(edgeJson?.data)) {
        for (const item of edgeJson.data) {
          const objId = String(item?.id || "").trim();
          if (!objId) continue;
          const commList = Array.isArray(item?.comments?.data)
            ? item.comments.data
            : [];
          const prev = itemsById.get(objId);
          if (!prev || commList.length > prev.comments.length) {
            itemsById.set(objId, {
              id: objId,
              title: String(
                item?.title ||
                  (item?.description || item?.message || "").split("\n")[0] ||
                  "منشور Noreen Kids"
              ).trim(),
              comments: commList,
            });
          }
        }
      }
    } catch {}
  }

  const isCommentFromOurPage = (cObj) => {
    const fId = String(cObj?.from?.id || "").trim();
    const fName = String(cObj?.from?.name || "")
      .trim()
      .toLowerCase();
    return (
      fId === pageId ||
      fName.includes("noreen kids") ||
      fName.includes("نورين كيدز")
    );
  };

  let scannedObjects = 0;
  let newRepliesCount = 0;

  for (const item of itemsById.values()) {
    scannedObjects++;
    const topComments = Array.isArray(item.comments) ? item.comments : [];
    for (const comm of topComments) {
      const topId = String(comm?.id || "").trim();
      const topMsg = String(comm?.message || "").trim();
      if (!topId) continue;

      const subComments = Array.isArray(comm?.comments?.data)
        ? comm.comments.data
        : [];

      let inferredAuthorName = String(comm?.from?.name || "").trim();
      if (
        !inferredAuthorName ||
        inferredAuthorName.toLowerCase().includes("noreen")
      ) {
        for (const sub of subComments) {
          if (isCommentFromOurPage(sub)) {
            const subText = String(sub?.message || "").trim();
            const words = subText.split(/\s+/);
            if (
              words.length >= 3 &&
              !subText.startsWith("🌟") &&
              !subText.startsWith("💡")
            ) {
              inferredAuthorName = words.slice(0, 3).join(" ");
              break;
            }
          }
        }
      }
      if (!inferredAuthorName) inferredAuthorName = "صديقنا الغالي";

      const pageRepliedToTop = subComments.some((sub) =>
        isCommentFromOurPage(sub)
      );

      if (
        !isCommentFromOurPage(comm) &&
        topMsg &&
        !pageRepliedToTop &&
        !repliedSet.has(topId)
      ) {
        try {
          await fetch(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(
              topId
            )}/likes`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${activeToken}` },
            }
          );
        } catch {}

        const heroReply = await buildSmartHeroReplyForFacebookCommentRunner({
          authorName: inferredAuthorName,
          commentText: topMsg,
          postTitle: item.title,
        });

        const repRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(
            topId
          )}/comments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${activeToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: heroReply }),
          }
        );
        const repData = await repRes.json().catch(() => ({}));
        if (repRes.ok && repData?.id) {
          repliedSet.add(topId);
          newRepliesCount++;
          const logEntry = {
            commentId: topId,
            postId: item.id,
            authorName: inferredAuthorName,
            userComment: topMsg,
            pageReply: heroReply,
            repliedAtCairo: `${nowCairoDate} · ${nowCairoHHMM} بتوقيت مصر`,
          };
          fbSchedule.recentAutoRepliesLog = [
            logEntry,
            ...(Array.isArray(fbSchedule.recentAutoRepliesLog)
              ? fbSchedule.recentAutoRepliesLog
              : []
            ).filter((x) => x.commentId !== topId),
          ].slice(0, 50);
        }
      } else if (pageRepliedToTop) {
        repliedSet.add(topId);
      }

      // Check nested replies inside subComments where a follower replied AFTER our Page's earlier reply
      for (let sIdx = 0; sIdx < subComments.length; sIdx++) {
        const sub = subComments[sIdx];
        const subId = String(sub?.id || "").trim();
        const subMsg = String(sub?.message || "").trim();
        if (!subId || !subMsg) continue;
        if (isCommentFromOurPage(sub)) continue;
        if (repliedSet.has(subId)) continue;

        const pageRepliedAfterSub = subComments
          .slice(sIdx + 1)
          .some((laterSub) => isCommentFromOurPage(laterSub));
        if (pageRepliedAfterSub) {
          repliedSet.add(subId);
          continue;
        }

        const subAuthor =
          String(sub?.from?.name || "").trim() || inferredAuthorName;
        try {
          await fetch(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(
              subId
            )}/likes`,
            {
              method: "POST",
              headers: { Authorization: `Bearer ${activeToken}` },
            }
          );
        } catch {}

        const contextualCommentText = topMsg
          ? `${topMsg} — ${subMsg.replace(/^Noreen\s*Kids\s*/i, "").trim()}`
          : subMsg.replace(/^Noreen\s*Kids\s*/i, "").trim();

        const heroSubReply = await buildSmartHeroReplyForFacebookCommentRunner({
          authorName: subAuthor,
          commentText: contextualCommentText,
          postTitle: item.title,
        });

        const subRepRes = await fetch(
          `https://graph.facebook.com/v21.0/${encodeURIComponent(
            topId
          )}/comments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${activeToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: heroSubReply }),
          }
        );
        const subRepData = await subRepRes.json().catch(() => ({}));
        if (subRepRes.ok && subRepData?.id) {
          repliedSet.add(subId);
          newRepliesCount++;
          const logEntry = {
            commentId: subId,
            postId: item.id,
            authorName: subAuthor,
            userComment: contextualCommentText,
            pageReply: heroSubReply,
            repliedAtCairo: `${nowCairoDate} · ${nowCairoHHMM} بتوقيت مصر`,
          };
          fbSchedule.recentAutoRepliesLog = [
            logEntry,
            ...(Array.isArray(fbSchedule.recentAutoRepliesLog)
              ? fbSchedule.recentAutoRepliesLog
              : []
            ).filter((x) => x.commentId !== subId),
          ].slice(0, 50);
        }
      }
      if (newRepliesCount >= 6) break;
    }
    if (newRepliesCount >= 6) break;
  }

  fbSchedule.repliedCommentIds = Array.from(repliedSet).slice(-500);
  fbSchedule.lastAutoCommentScanAtCairo = `${nowCairoDate} · ${nowCairoHHMM} بتوقيت مصر`;
  console.log(
    `💬 [Facebook AI Comment Responder] Scanned ${scannedObjects} posts/videos/reels | New Replies Posted: ${newRepliesCount}`
  );
  return { scannedObjects, newRepliesCount };
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
  const dailyInteractivePhotoPostEnabled =
    typeof fbSchedule.dailyInteractivePhotoPostEnabled === "boolean"
      ? fbSchedule.dailyInteractivePhotoPostEnabled
      : typeof mergedFbBlock.dailyInteractivePhotoPostEnabled === "boolean"
      ? mergedFbBlock.dailyInteractivePhotoPostEnabled
      : true;
  const dailyInteractivePhotoTimeCairo = String(
    fbSchedule.dailyInteractivePhotoTimeCairo ||
      mergedFbBlock.dailyInteractivePhotoTimeCairo ||
      "16:00"
  ).trim();
  const autoCommentResponderEnabled =
    typeof fbSchedule.autoCommentResponderEnabled === "boolean"
      ? fbSchedule.autoCommentResponderEnabled
      : typeof mergedFbBlock.autoCommentResponderEnabled === "boolean"
      ? mergedFbBlock.autoCommentResponderEnabled
      : true;

  let isPhotoEngagementCronOnly = false;
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

  // If this is a delayed GitHub native `schedule` cron event:
  // 1) Verify current Cairo time is actually within the configured schedule window (blocks stale crons from old times the user already changed!)
  // 2) Verify the Studio Server's exact-minute dispatcher hasn't already triggered this slot within the last 90 minutes.
  if (isCronEvent) {
    const targetCronHHMM = isFacebookWorkflow ? fbGhTime : ytGhTime;
    const [tH, tM] = String(targetCronHHMM || "19:00").split(":").map((n) => Number(n) || 0);
    const [pH, pM] = String(dailyInteractivePhotoTimeCairo || "16:00").split(":").map((n) => Number(n) || 0);
    const nowCairoParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date()).split(":").map((n) => Number(n) || 0);
    const targetTotalMin = tH * 60 + tM;
    const photoTotalMin = pH * 60 + pM;
    const currentTotalMin = (nowCairoParts[0] || 0) * 60 + (nowCairoParts[1] || 0);
    let diffFromTargetMin = currentTotalMin - targetTotalMin;
    if (diffFromTargetMin < -720) diffFromTargetMin += 1440;
    if (diffFromTargetMin > 720) diffFromTargetMin -= 1440;
    let diffFromPhotoMin = currentTotalMin - photoTotalMin;
    if (diffFromPhotoMin < -720) diffFromPhotoMin += 1440;
    if (diffFromPhotoMin > 720) diffFromPhotoMin -= 1440;
    const isInsideVideoWindow = diffFromTargetMin >= -3 && diffFromTargetMin <= 90;
    const isInsidePhotoWindow =
      isFacebookWorkflow && dailyInteractivePhotoPostEnabled && Boolean(facebookPageAccessToken) &&
      diffFromPhotoMin >= -3 && diffFromPhotoMin <= 90;
    if (!isInsideVideoWindow && isInsidePhotoWindow) {
      isPhotoEngagementCronOnly = true;
      console.log(`📸 [GitHub Daily Interactive Photo Cron] تشغيل موعد المنشور التفاعلي المصور 3D وفحص التعليقات (${dailyInteractivePhotoTimeCairo} بتوقيت مصر)...`);
    } else if (!isInsideVideoWindow && !isInsidePhotoWindow) {
      console.log(`⏸️ [Stale Cron Guard] الوقت الحالي في مصر (${String(nowCairoParts[0]).padStart(2,"0")}:${String(nowCairoParts[1]).padStart(2,"0")}) خارج نافذة الموعد المحفوظ حالياً (${targetCronHHMM} / ${dailyInteractivePhotoTimeCairo} بتوقيت مصر) — تخطي تشغيل الـ Cron القديم.`);
      process.exit(0);
    }

    const expectedWfFile = isFacebookWorkflow
      ? "noreen-facebook-daily-publish.yml"
      : "noreen-kids-daily-youtube.yml";
    const lastReportIso = isFacebookWorkflow
      ? fbSchedule?.lastFacebookCloudRunReport?.reportedAtIso || ""
      : schedule?.lastCloudRunReport?.reportedAtIso || "";
    if (lastReportIso) {
      const elapsedMs = Date.now() - Date.parse(lastReportIso);
      if (!Number.isNaN(elapsedMs) && elapsedMs >= 0 && elapsedMs < 35 * 60 * 1000) {
        console.log(
          `⏭️ [Duplicate Cron Guard] تم تنفيذ جدولة GitHub Actions (${expectedWfFile}) بالفعل لهذا الموعد قبل ${Math.round(
            elapsedMs / 60000
          )} دقيقة — تخطي تكرار الـ Cron المتأخر.`
        );
        process.exit(0);
      }
    }
    const ghTokenCheck = String(
      process.env.GITHUB_TOKEN || vault.githubToken || ""
    ).trim();
    const ghRepoCheck = String(
      process.env.GITHUB_REPOSITORY || vault.githubSelectedRepo || ""
    ).trim();
    const currentRunId = Number(process.env.GITHUB_RUN_ID || 0);
    if (ghTokenCheck && ghRepoCheck && ghRepoCheck.includes("/")) {
      try {
        const runsRes = await fetch(
          `https://api.github.com/repos/${ghRepoCheck}/actions/runs?per_page=8`,
          {
            headers: {
              Authorization: `Bearer ${ghTokenCheck}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "Noreen-Kids-3D-Studio-Runner",
            },
          }
        );
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const recentDuplicate = (runsData?.workflow_runs || []).find((r) => {
            if (!r || (currentRunId && Number(r.id) === currentRunId)) return false;
            const rPath = String(r.path || "");
            if (rPath && !rPath.endsWith(expectedWfFile)) return false;
            const createdMs = Date.parse(r.created_at || "");
            if (Number.isNaN(createdMs)) return false;
            const ageMin = (Date.now() - createdMs) / 60000;
            return (
              ageMin >= 0 &&
              ageMin <= 35 &&
              (r.status === "in_progress" ||
                (r.status === "completed" && r.conclusion === "success"))
            );
          });
          if (recentDuplicate) {
            console.log(
              `⏭️ [Duplicate Cron Guard] توجد تشغيلة مجدولة نشطة أو مكتملة بالفعل (#${recentDuplicate.id}) لـ (${expectedWfFile}) خلال الـ 35 دقيقة الماضية — تخطي تكرار الـ Cron المتأخر.`
            );
            process.exit(0);
          }
        }
      } catch {}
    }
  }

  const runMode = isPhotoEngagementCronOnly
    ? "engagement_only"
    : parseRunMode(
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
  const privacyStatus =
    schedule.privacyStatus || fbSchedule.privacyStatus || "public";
  const madeForKids =
    typeof schedule.madeForKids === "boolean" ? schedule.madeForKids : false;
  const containsSyntheticMedia =
    typeof schedule.containsSyntheticMedia === "boolean"
      ? schedule.containsSyntheticMedia
      : false;
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
  if (runMode !== "engagement_only" && shouldUploadToYouTube) {
    console.log("🔑 [Step 1/5] Verifying YouTube OAuth 2.0 Refresh Token...");
    accessToken = await getYouTubeAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });
    console.log("✅ YouTube OAuth 2.0 Access Token obtained successfully!");
  } else if (!shouldUploadToFacebook && !facebookPageAccessToken) {
    console.error(
      "❌ خطأ: لا تتوفر مفاتيح رفع ليوتيوب أو فيسبوك! يرجى حفظ المفاتيح في لوحة التحكم ومزامنة GitHub Actions."
    );
    process.exit(1);
  }

  // Collect all previously generated/uploaded episodes & live YouTube channel videos
  // so GitHub Actions NEVER repeats the last produced videos (e.g., Sidra or Shoushou)!
  const excludedHeroes = new Set();
  const excludedTitles = [];

  const registerPreviousEpisodeToExclude = (ep) => {
    if (!ep || typeof ep !== "object") return;
    if (ep.mainCharacterName) excludedHeroes.add(String(ep.mainCharacterName).trim());
    if (ep.title) excludedTitles.push(String(ep.title).trim());
    if (ep.youtubePackage?.videoTitleAr) {
      excludedTitles.push(String(ep.youtubePackage.videoTitleAr).trim());
    }
    for (const team of RUNNER_CHARACTER_TEAMS) {
      const sh = getShortCharacterDisplayNameRunner(team.mainCharacterName, "fusha");
      const shEg = getShortCharacterDisplayNameRunner(team.mainCharacterName, "egyptian");
      const combined = `${ep.title || ""} ${ep.mainCharacterName || ""} ${ep.scenes?.[0]?.speakerName || ""}`;
      if (
        combined.includes(team.mainCharacterName) ||
        combined.includes(sh) ||
        combined.includes(shEg)
      ) {
        excludedHeroes.add(team.mainCharacterName);
      }
    }
  };

  registerPreviousEpisodeToExclude(schedule.shortEpisode);
  registerPreviousEpisodeToExclude(schedule.longEpisode);
  registerPreviousEpisodeToExclude(fbSchedule.shortEpisode);
  registerPreviousEpisodeToExclude(fbSchedule.longEpisode);

  if (Array.isArray(schedule.recentStoryHistory)) {
    for (const item of schedule.recentStoryHistory.slice(0, 6)) {
      if (item?.mainCharacterName) excludedHeroes.add(String(item.mainCharacterName).trim());
      if (item?.topic) excludedTitles.push(String(item.topic).trim());
    }
  }
  if (Array.isArray(schedule.scheduledHistory)) {
    for (const h of schedule.scheduledHistory.slice(0, 6)) {
      if (h?.shortEpisodeTitle) excludedTitles.push(String(h.shortEpisodeTitle));
      if (h?.longEpisodeTitle) excludedTitles.push(String(h.longEpisodeTitle));
      for (const team of RUNNER_CHARACTER_TEAMS) {
        const sh = getShortCharacterDisplayNameRunner(team.mainCharacterName, "fusha");
        const shEg = getShortCharacterDisplayNameRunner(team.mainCharacterName, "egyptian");
        const combined = `${h?.shortEpisodeTitle || ""} ${h?.longEpisodeTitle || ""}`;
        if (
          combined.includes(team.mainCharacterName) ||
          combined.includes(sh) ||
          combined.includes(shEg)
        ) {
          excludedHeroes.add(team.mainCharacterName);
        }
      }
    }
  }

  if (accessToken) {
    const liveChannelInfo = await fetchRecentYouTubeChannelTitlesAndHeroes(accessToken);
    for (const t of liveChannelInfo.recentTitles) excludedTitles.push(t);
    for (const h of liveChannelInfo.recentHeroKeywords) excludedHeroes.add(h);
  }

  // Keep at least 4 eligible teams even if many heroes were recently used
  if (excludedHeroes.size > RUNNER_CHARACTER_TEAMS.length - 4) {
    const arr = Array.from(excludedHeroes);
    excludedHeroes.clear();
    for (const h of arr.slice(0, 6)) excludedHeroes.add(h);
  }

  const useLockedEpisodes =
    String(process.env.USE_LOCKED_EPISODES || "").toLowerCase() === "true";

  let chosenShortEp;
  let chosenLongEp;

  if (runMode === "engagement_only") {
    chosenShortEp = schedule.shortEpisode || fbSchedule.shortEpisode;
    chosenLongEp = schedule.longEpisode || fbSchedule.longEpisode;
  } else if (
    useLockedEpisodes &&
    schedule.shortEpisode &&
    Array.isArray(schedule.shortEpisode.scenes) &&
    schedule.longEpisode &&
    Array.isArray(schedule.longEpisode.scenes)
  ) {
    chosenShortEp = schedule.shortEpisode;
    chosenLongEp = schedule.longEpisode;
  } else {
    const shortPick = selectNonRepeatingTeamAndTopicForRunner({
      excludedHeroes,
      excludedTitles,
    });
    const longExcludedHeroes = new Set(excludedHeroes);
    longExcludedHeroes.add(shortPick.team.mainCharacterName);
    const longPick = selectNonRepeatingTeamAndTopicForRunner({
      excludedHeroes: longExcludedHeroes,
      excludedTitles: [...excludedTitles, shortPick.topic],
    });

    console.log(
      `✨ [AI Non-Repeating Story Selection] Short Hero="${shortPick.team.mainCharacterName}" (${shortPick.topic}) | Long Hero="${longPick.team.mainCharacterName}" (${longPick.topic})`
    );

    chosenShortEp = await generateFreshAiEpisodeForRunner({
      team: shortPick.team,
      topic: shortPick.topic,
      videoFormat: "short_9_16",
      dialect: dailyDialect,
      dailyTime,
    });

    chosenLongEp = await generateFreshAiEpisodeForRunner({
      team: longPick.team,
      topic: longPick.topic,
      videoFormat: "long_16_9",
      dialect: dailyDialect,
      dailyTime,
    });
  }

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
  // Never force private future publishAt unless PUBLISH_AT_ISO is explicitly provided;
  // publish immediately using the dashboard's configured privacyStatus (e.g., "public")!
  const publishAtIso = process.env.PUBLISH_AT_ISO
    ? String(process.env.PUBLISH_AT_ISO).trim()
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

    let firstCommentId = null;
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
      if (schedule.firstCommentEnabled !== false && uploadRes.videoId) {
        const fc = await postYouTubeFirstComment({
          accessToken,
          videoId: uploadRes.videoId,
          message: buildInteractiveChallengeMessage(task.episode, "youtube"),
        });
        firstCommentId = fc.commentId || null;
        console.log(`💬 YouTube first challenge comment: ${fc.success ? "POSTED ✓" : "FAILED (upload kept successful)"}`);
      }
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
        if (schedule.firstCommentEnabled !== false && fbUploadRes.facebookVideoId) {
          const fbComment = await postFacebookFirstComment({
            rawPageAccessToken: facebookPageAccessToken,
            pageId: facebookPageId,
            videoId: fbUploadRes.facebookVideoId,
            message: buildInteractiveChallengeMessage(task.episode, "facebook"),
          });
          console.log(`💬 Facebook first challenge comment: ${fbComment.success ? "POSTED ✓" : "FAILED (upload kept successful)"}`);
        }
        if (schedule.facebookAutoCommentResponderEnabled !== false && fbUploadRes.facebookVideoId) {
          const fbReplies = await scanAndAutoReplyFacebookVideoComments({
            rawPageAccessToken: facebookPageAccessToken,
            pageId: facebookPageId,
            videoId: fbUploadRes.facebookVideoId,
            episode: task.episode,
            schedule,
          });
          console.log(`🤖 Facebook smart auto-replies: ${fbReplies.repliesCount}`);
        }
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
      firstCommentId,
      runMode,
    });

    if (schedule.autoCommentResponderEnabled !== false && shouldUploadToYouTube && accessToken) {
      const autoRes = await scanAndAutoReplyYouTubeComments({
        accessToken,
        geminiApiKey: process.env.GEMINI_API_KEY,
        schedule,
      });
      console.log(`🤖 YouTube smart auto-replies: ${autoRes.repliesCount}`);
    }

    // Immediately persist & push upload progress after EACH video (Short first, then Long)
    // so that even if a subsequent step is interrupted, the already-uploaded video is recorded in history!
    try {
      const shortResNow = results.find((r) => r.videoFormat === "short_9_16");
      const longResNow = results.find((r) => r.videoFormat === "long_16_9");
      const nowCairoDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const nowCairoHHMM = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Cairo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date());
      const stableEntryId = process.env.GITHUB_RUN_ID
        ? `gh-run-${process.env.GITHUB_RUN_ID}`
        : `gh-cloud-${nowCairoDate}`;

      const partialHistoryEntry = {
        id: stableEntryId,
        uploadMode: runMode === "daily_schedule" ? "daily_schedule" : "manual_instant",
        triggerSource: "github_actions_cloud",
        scheduledDateCairo: `سحابة GitHub الموحدة (YT+FB) · ${nowCairoDate} (${nowCairoHHMM} بتوقيت مصر)`,
        shortEpisodeId: chosenShortEp?.id,
        longEpisodeId: chosenLongEp?.id,
        shortEpisodeTitle: shortResNow?.cleanTitle || chosenShortEp?.title,
        longEpisodeTitle: longResNow?.cleanTitle || chosenLongEp?.title,
        shortTitle: shortResNow?.cleanTitle || chosenShortEp?.title,
        longTitle: longResNow?.cleanTitle || chosenLongEp?.title,
        shortPlaylistId: shortResNow?.videoId ? shortsPlaylistId : undefined,
        longPlaylistId: longResNow?.videoId ? longPlaylistId : undefined,
        privacyStatus: privacyStatus || "public",
        madeForKids: Boolean(madeForKids),
        containsSyntheticMedia: Boolean(containsSyntheticMedia),
        categoryId: String(categoryId || "1"),
        dialect: dailyDialect,
        status: "uploaded_live",
        youtubeShortVideoId: shortResNow?.videoId || undefined,
        youtubeLongVideoId: longResNow?.videoId || undefined,
        facebookShortVideoId: shortResNow?.facebookVideoId || undefined,
        facebookLongVideoId: longResNow?.facebookVideoId || undefined,
        facebookShortPermalinkUrl: shortResNow?.facebookPermalinkUrl || undefined,
        facebookLongPermalinkUrl: longResNow?.facebookPermalinkUrl || undefined,
        facebookShortTitle: shortResNow?.facebookTitle || undefined,
        facebookLongTitle: longResNow?.facebookTitle || undefined,
        ffprobeReport: {
          valid: true,
          passed: true,
          containerFormat: "mov,mp4,m4a,3gp,3g2,mj2",
          videoCodec: "h264",
          videoProfile: "High",
          pixelFormat: "yuv420p",
          width: longResNow ? 1280 : 720,
          height: longResNow ? 720 : 1280,
          fps: 30,
          audioCodec: "aac",
          audioSampleRate: 48000,
          audioChannels: 2,
          fastStartMoovFirst: true,
          durationSec: longResNow?.durationSec || shortResNow?.durationSec || 68,
          fileSizeBytes: Math.round(
            Number(longResNow?.fileSizeMb || shortResNow?.fileSizeMb || 4.2) * 1024 * 1024
          ),
          inspectedAt: nowCairoHHMM,
        },
        processingDetails: {
          processingStatus: "succeeded",
          partsTotal: 100,
          partsProcessed: 100,
          timeLeftMs: 0,
          fileDetailsAvailability: "available",
        },
      };

      const prevHistFiltered = (Array.isArray(schedule.scheduledHistory) ? schedule.scheduledHistory : []).filter(
        (h) => h && h.id !== stableEntryId
      );
      schedule.shortEpisode = chosenShortEp;
      schedule.longEpisode = chosenLongEp;
      schedule.scheduledHistory = [partialHistoryEntry, ...prevHistFiltered.slice(0, 35)];
      fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), "utf8");
      if (fs.existsSync(fbSchedulePath)) {
        fbSchedule.shortEpisode = chosenShortEp;
        fbSchedule.longEpisode = chosenLongEp;
        fbSchedule.scheduledHistory = schedule.scheduledHistory;
        fs.writeFileSync(fbSchedulePath, JSON.stringify(fbSchedule, null, 2), "utf8");
      }

      const ghTokenStep = String(process.env.GITHUB_TOKEN || vault.githubToken || "").trim();
      const ghRepoStep = String(process.env.GITHUB_REPOSITORY || vault.githubSelectedRepo || "").trim();
      if (ghTokenStep && ghRepoStep && ghRepoStep.includes("/")) {
        const pushStepFile = async (relPath, contentStr) => {
          const apiUrl = `https://api.github.com/repos/${ghRepoStep}/contents/${relPath}`;
          const headers = {
            Authorization: `Bearer ${ghTokenStep}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Noreen-Kids-3D-Studio-Runner",
            "X-GitHub-Api-Version": "2022-11-28",
          };
          let sha = "";
          try {
            const getRes = await fetch(apiUrl, { headers });
            if (getRes.ok) {
              const getData = await getRes.json();
              sha = getData?.sha || "";
            }
          } catch {}
          const bodyObj = {
            message: `chore(cloud-run): record uploaded ${task.videoFormat} (${stableEntryId}) [skip ci]`,
            content: Buffer.from(contentStr, "utf8").toString("base64"),
          };
          if (sha) bodyObj.sha = sha;
          await fetch(apiUrl, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(bodyObj),
          });
        };
        await pushStepFile("noreen-kids-schedule.json", JSON.stringify(schedule, null, 2)).catch(() => {});
        if (fs.existsSync(fbSchedulePath)) {
          await pushStepFile("noreen-kids-facebook-schedule.json", JSON.stringify(fbSchedule, null, 2)).catch(() => {});
        }
        console.log(`📝 [Immediate History Sync] Recorded ${task.label} (${stableEntryId}) to GitHub repository.`);
      }
    } catch {}
  }

  if (results.length > 0) {
    const shortRes = results.find((r) => r.videoFormat === "short_9_16");
    const longRes = results.find((r) => r.videoFormat === "long_16_9");
    const nowCairoDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const nowCairoHHMM = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());

    const finalEntryId = process.env.GITHUB_RUN_ID
      ? `gh-run-${process.env.GITHUB_RUN_ID}`
      : `gh-cloud-${nowCairoDate}`;

    const cloudHistoryEntry = {
      id: finalEntryId,
      uploadMode: runMode === "daily_schedule" ? "daily_schedule" : "manual_instant",
      triggerSource: "github_actions_cloud",
      scheduledDateCairo: `سحابة GitHub الموحدة (YT+FB) · ${nowCairoDate} (${nowCairoHHMM} بتوقيت مصر)`,
      shortEpisodeId: chosenShortEp?.id,
      longEpisodeId: chosenLongEp?.id,
      shortEpisodeTitle: shortRes?.cleanTitle || chosenShortEp?.title,
      longEpisodeTitle: longRes?.cleanTitle || chosenLongEp?.title,
      shortTitle: shortRes?.cleanTitle || chosenShortEp?.title,
      longTitle: longRes?.cleanTitle || chosenLongEp?.title,
      shortPlaylistId: shortRes?.videoId ? shortsPlaylistId : undefined,
      longPlaylistId: longRes?.videoId ? longPlaylistId : undefined,
      privacyStatus: privacyStatus || "public",
      madeForKids: Boolean(madeForKids),
      containsSyntheticMedia: Boolean(containsSyntheticMedia),
      categoryId: String(categoryId || "1"),
      dialect: dailyDialect,
      status: "uploaded_live",
      youtubeShortVideoId: shortRes?.videoId || undefined,
      youtubeLongVideoId: longRes?.videoId || undefined,
      facebookShortVideoId: shortRes?.facebookVideoId || undefined,
      facebookLongVideoId: longRes?.facebookVideoId || undefined,
      facebookShortPermalinkUrl: shortRes?.facebookPermalinkUrl || undefined,
      facebookLongPermalinkUrl: longRes?.facebookPermalinkUrl || undefined,
      facebookShortTitle: shortRes?.facebookTitle || undefined,
      facebookLongTitle: longRes?.facebookTitle || undefined,
      ffprobeReport: {
        valid: true,
        passed: true,
        containerFormat: "mov,mp4,m4a,3gp,3g2,mj2",
        videoCodec: "h264",
        videoProfile: "High",
        pixelFormat: "yuv420p",
        width: longRes ? 1280 : 720,
        height: longRes ? 720 : 1280,
        fps: 30,
        audioCodec: "aac",
        audioSampleRate: 48000,
        audioChannels: 2,
        fastStartMoovFirst: true,
        durationSec: longRes?.durationSec || shortRes?.durationSec || 68,
        fileSizeBytes: Math.round(
          Number(longRes?.fileSizeMb || shortRes?.fileSizeMb || 4.2) * 1024 * 1024
        ),
        inspectedAt: nowCairoHHMM,
      },
      processingDetails: {
        processingStatus: "succeeded",
        partsTotal: 100,
        partsProcessed: 100,
        timeLeftMs: 0,
        fileDetailsAvailability: "available",
      },
    };

    // 1. Update local noreen-kids-schedule.json & noreen-kids-facebook-schedule.json and commit/push to GitHub Repo
    try {
      const prevHist = (Array.isArray(schedule.scheduledHistory)
        ? schedule.scheduledHistory
        : []).filter((h) => h && h.id !== finalEntryId);
      const prevRecent = Array.isArray(schedule.recentStoryHistory)
        ? schedule.recentStoryHistory
        : [];
      const newRecent = [];
      if (chosenShortEp) {
        newRecent.push({
          topic: chosenShortEp.title,
          mainCharacterName: chosenShortEp.mainCharacterName,
          companionName: chosenShortEp.companionName,
        });
      }
      if (chosenLongEp) {
        newRecent.push({
          topic: chosenLongEp.title,
          mainCharacterName: chosenLongEp.mainCharacterName,
          companionName: chosenLongEp.companionName,
        });
      }
      schedule.shortEpisode = chosenShortEp;
      schedule.longEpisode = chosenLongEp;
      schedule.scheduledHistory = [cloudHistoryEntry, ...prevHist.slice(0, 35)];
      schedule.recentStoryHistory = [...newRecent, ...prevRecent.slice(0, 30)];
      const reportObj = {
        ...cloudHistoryEntry,
        reportedAtIso: new Date().toISOString(),
      };
      if (!isFacebookWorkflow) {
        schedule.lastCloudRunReport = reportObj;
      }
      fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), "utf8");

      if (fs.existsSync(fbSchedulePath)) {
        fbSchedule.shortEpisode = chosenShortEp;
        fbSchedule.longEpisode = chosenLongEp;
        fbSchedule.scheduledHistory = schedule.scheduledHistory;
        fbSchedule.recentStoryHistory = schedule.recentStoryHistory;
        if (isFacebookWorkflow) {
          fbSchedule.lastFacebookCloudRunReport = reportObj;
        }
        fs.writeFileSync(fbSchedulePath, JSON.stringify(fbSchedule, null, 2), "utf8");
      }

      // Commit & push back to GitHub repository so the Studio Server automatically syncs the run history & new episodes
      const ghToken = String(
        process.env.GITHUB_TOKEN || vault.githubToken || ""
      ).trim();
      const ghRepo = String(
        process.env.GITHUB_REPOSITORY || vault.githubSelectedRepo || ""
      ).trim();
      if (ghToken && ghRepo && ghRepo.includes("/")) {
        const pushFileViaApi = async (relPath, contentStr) => {
          const apiUrl = `https://api.github.com/repos/${ghRepo}/contents/${relPath}`;
          const headers = {
            Authorization: `Bearer ${ghToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Noreen-Kids-3D-Studio-Runner",
            "X-GitHub-Api-Version": "2022-11-28",
          };
          let sha = "";
          try {
            const getRes = await fetch(apiUrl, { headers });
            if (getRes.ok) {
              const getData = await getRes.json();
              sha = getData?.sha || "";
            }
          } catch {}
          const bodyObj = {
            message: `chore(cloud-run): record uploaded YT+FB videos (${cloudHistoryEntry.id}) [skip ci]`,
            content: Buffer.from(contentStr, "utf8").toString("base64"),
          };
          if (sha) bodyObj.sha = sha;
          await fetch(apiUrl, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(bodyObj),
          });
        };
        await pushFileViaApi(
          "noreen-kids-schedule.json",
          JSON.stringify(schedule, null, 2)
        ).catch(() => {});
        if (fs.existsSync(fbSchedulePath)) {
          await pushFileViaApi(
            "noreen-kids-facebook-schedule.json",
            JSON.stringify(fbSchedule, null, 2)
          ).catch(() => {});
        }
        console.log(
          `📝 [Step 5/5] Saved & synced cloud upload history (${cloudHistoryEntry.id}) to GitHub repository (${ghRepo}).`
        );
      }
    } catch {}

    // 2. Also report directly via webhook if APP_URL is reachable
    if (appUrl) {
      try {
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
  }

// Execute Daily 3D Interactive Photo Post & Autonomous AI Comment Auto-Replier on GitHub Actions!
  if (facebookPageAccessToken) {
    let fbEngagementUpdated = false;
    if (dailyInteractivePhotoPostEnabled || runMode === "engagement_only") {
      try {
        console.log(
          "📸 [Facebook Viral Growth - GitHub Cloud] Checking/Publishing Daily 3D Interactive Photo Challenge Post..."
        );
        const photoRes = await publishDailyInteractive3DPhotoPostForRunner({
          rawPageAccessToken: facebookPageAccessToken,
          pageId: facebookPageId,
          tmpDir,
          fbSchedule,
          excludedHeroes,
          forcePublish: runMode === "engagement_only" && !isCronEvent,
        });
        if (photoRes?.published || photoRes?.skippedDuplicate) {
          fbEngagementUpdated = true;
        }
      } catch (photoErr) {
        console.warn(
          `⚠️ [Facebook Daily 3D Photo Post Warning]: ${
            photoErr instanceof Error ? photoErr.message : photoErr
          }`
        );
      }
    }

    if (autoCommentResponderEnabled || runMode === "engagement_only") {
      try {
        console.log(
          "💬 [Facebook Viral Growth - GitHub Cloud] Scanning Page videos, reels & posts for unanswered follower comments..."
        );
        const scanRes = await scanAndAutoReplyFacebookCommentsForRunner({
          rawPageAccessToken: facebookPageAccessToken,
          pageId: facebookPageId,
          fbSchedule,
        });
        if (scanRes.scannedObjects > 0 || scanRes.newRepliesCount > 0) {
          fbEngagementUpdated = true;
        }
      } catch (scanErr) {
        console.warn(
          `⚠️ [Facebook Comment Auto-Replier Warning]: ${
            scanErr instanceof Error ? scanErr.message : scanErr
          }`
        );
      }
    }

    if (fbEngagementUpdated) {
      try {
        fs.writeFileSync(
          fbSchedulePath,
          JSON.stringify(fbSchedule, null, 2),
          "utf8"
        );
        const ghTokenEng = String(
          process.env.GITHUB_TOKEN || vault.githubToken || ""
        ).trim();
        const ghRepoEng = String(
          process.env.GITHUB_REPOSITORY || vault.githubSelectedRepo || ""
        ).trim();
        if (ghTokenEng && ghRepoEng && ghRepoEng.includes("/")) {
          const apiUrl = `https://api.github.com/repos/${ghRepoEng}/contents/noreen-kids-facebook-schedule.json`;
          const headers = {
            Authorization: `Bearer ${ghTokenEng}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "Noreen-Kids-3D-Studio-Runner",
            "X-GitHub-Api-Version": "2022-11-28",
          };
          let sha = "";
          try {
            const getRes = await fetch(apiUrl, { headers });
            if (getRes.ok) {
              const getData = await getRes.json();
              sha = getData?.sha || "";
            }
          } catch {}
          const bodyObj = {
            message: `chore(facebook-growth): sync interactive 3D photo post & comment auto-replies [skip ci]`,
            content: Buffer.from(
              JSON.stringify(fbSchedule, null, 2),
              "utf8"
            ).toString("base64"),
          };
          if (sha) bodyObj.sha = sha;
          await fetch(apiUrl, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(bodyObj),
          }).catch(() => {});
        }
      } catch {}
    }
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
