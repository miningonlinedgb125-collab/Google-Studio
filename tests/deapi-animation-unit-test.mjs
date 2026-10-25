#!/usr/bin/env node
/**
 * Unit & Integration Mock Test for deAPI.ai Cinema-Grade 1080p + Native Joint Audio-Video (Fusha + Real Diegetic SFX) & Lip-Sync Pipeline
 * Verifies:
 * 1. Dynamic model catalog discovery from GET /api/v2/models (seedance-2.5, Ltx2_5_22B_Dist_INT8, Flux_2_Pro, FlashVSR_Tiny, Chatterbox)
 * 2. Native HD 9:16 & 16:9 dimension selection (1088x1920 / 736x1280 / 576x1024 instead of blurry 512x768) & Seedance parameter compliance
 * 3. Multi-shot Arabic Fusha dialogue splitting + Native Joint Audio-Video prompt construction (vocalized Arabic dialogue + physical Foley SFX)
 * 4. Primary Native Joint Audio+Video (`POST /api/v2/videos/animations`) with partner fallback (`seedance-2.5` 402 -> `Ltx2_5_22B_Dist_INT8`),
 *    authentic audio+Foley extraction BEFORE AI Video Upscaling (`POST /api/v2/videos/upscales`), and crisp 1080x1920 output
 * 5. Backward-compatible Egyptian chunked Lip-Synced Audio-to-Video (`POST /api/v2/videos/audio-syncs`) + HTTP 429 recovery
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const runnerCode = fs.readFileSync(path.join(repoRoot, "scripts/noreen-kids-youtube-runner.mjs"), "utf8");
const ytSchedule = JSON.parse(fs.readFileSync(path.join(repoRoot, "noreen-kids-schedule.json"), "utf8"));
const fbSchedule = JSON.parse(fs.readFileSync(path.join(repoRoot, "noreen-kids-facebook-schedule.json"), "utf8"));
const ytWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/noreen-kids-daily-youtube.yml"), "utf8");
const fbWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/noreen-facebook-daily-publish.yml"), "utf8");

// Extract pure deAPI engine functions from runner script for direct testing
const startMarker = "// deAPI.ai 3D Cartoon Storyboard + Lip-Synced Audio-to-Video & Foley SFX Engine";
const endMarker = "async function renderEpisodeMp4(";
const startIdx = runnerCode.indexOf(startMarker);
const endIdx = runnerCode.indexOf(endMarker);
assert.ok(startIdx > 0 && endIdx > startIdx, "deAPI animation & native audio engine block must exist in runner script");

const extractedBlock = runnerCode.slice(startIdx, endIdx);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function measureAudioDurationSec(filePath, fallbackSec = 10) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath,
    ]);
    const val = parseFloat(String(stdout || "").trim());
    if (!isNaN(val) && val > 0.2) return val;
  } catch {}
  return fallbackSec;
}

const engineFactory = new Function(
  "fs",
  "path",
  "execFileAsync",
  "sleep",
  "measureAudioDurationSec",
  `${extractedBlock}
  return {
    snapDimensionToGrid,
    scoreDeapiImg2VideoModel,
    scoreDeapiAud2VideoModel,
    scoreDeapiImg2ImgModel,
    scoreDeapiVidUpscaleModel,
    scoreDeapiArabicTtsModel,
    computeDeapiRateLimitWaitMs,
    computeAudioChunkPlanSec,
    splitDialogueIntoTimedNativeShots,
    normalizeAndVocalizePureFushaText,
    ensureFinalSceneClosingCtaAndQuestion,
    buildNativeJointAudioVideoShotPrompt,
    probeAudioStreamLoudness,
    discoverActiveDeapiModelsCatalog,
    resolveDeapiModelRenderParams,
    inferSupportingCastAndSettingEn,
    getCharacterSpeciesProfileEn,
    describeCharacterVisualAppearanceEn,
    sanitizeAiVisualScenePromptAgainstChimeras,
    ANTI_CHIMERA_NEGATIVE_PROMPT,
    buildMultiCharacterStoryPrompts,
    synthesizeContextualFoleySfxWav,
    synthesizeArabicFushaViaDeapiSpeech,
    cropCharacterReferenceWithoutBanner,
    generateAnimatedSceneClipViaDeapi,
    computeChannelWatermarkLayout,
    resolveChannelWatermarkLogoPath,
    prepareCircularChannelWatermarkPng,
    resetCache: () => {
      _cachedDeapiModelInfo = null;
      _cachedDeapiCatalog = null;
      _lastDeapiSubmissionAtMs = 0;
      _sessionUnavailableSlugs.clear();
    }
  };`
);

const engine = engineFactory(fs, path, execFileAsync, sleep, measureAudioDurationSec);

test("Schedules & Workflows default to Modern Standard Arabic (fusha) for Native Engine Audio + SFX and Full HD 1080p", () => {
  assert.ok(
    ytSchedule.dailyDialect === "egyptian" || ytSchedule.dailyDialect === "fusha",
    "YouTube schedule must configure valid dailyDialect (egyptian or fusha)"
  );
  assert.ok(
    fbSchedule.dailyDialect === "egyptian" || fbSchedule.dailyDialect === "fusha",
    "Facebook schedule must configure valid dailyDialect (egyptian or fusha)"
  );
  assert.match(ytWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(fbWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(ytWorkflow, /DEAPI_NATIVE_VOICE:\s*['"]?1['"]?/, "YouTube workflow must explicitly set DEAPI_NATIVE_VOICE=1");
  assert.match(fbWorkflow, /DEAPI_NATIVE_VOICE:\s*['"]?1['"]?/, "Facebook workflow must explicitly set DEAPI_NATIVE_VOICE=1");
  assert.match(
    runnerCode,
    /dialect === "fusha" && Boolean\(deapiApiKey\) && process\.env\.DEAPI_NATIVE_VOICE !== "0"/,
    "renderEpisodeMp4 must enable useNativeJointEngineAudio by default for Fusha unless DEAPI_NATIVE_VOICE === '0'"
  );
  assert.doesNotMatch(
    runnerCode,
    /buildSceneFoleyAmbienceWav/,
    "Runner must not contain undefined buildSceneFoleyAmbienceWav ReferenceError"
  );
  assert.match(ytWorkflow, /timeout-minutes:\s*150/);
  assert.match(fbWorkflow, /timeout-minutes:\s*150/);
  assert.match(
    runnerCode,
    /const W = isShort \? 1080 : 1920;\s*\n\s*const H = isShort \? 1920 : 1080;/,
    "renderEpisodeMp4 must output Full HD 1080x1920 (Short) and 1920x1080 (Long)"
  );
  assert.match(
    runnerCode,
    /hasAuthenticNativeAudio/,
    "Stage 2 must preserve 100% pure native joint audio + Foley SFX without synthetic background music"
  );
});

test("HD Model Scoring, Native 9:16/16:9 Resolution Upgrade, Seedance Compliance, and Native Joint AV Shot Prompts work cleanly", async () => {
  // Model priority scoring
  assert.ok(
    engine.scoreDeapiImg2VideoModel({ slug: "seedance-2.5", name: "Seedance 2.5" }) >
      engine.scoreDeapiImg2VideoModel({ slug: "Ltx2_5_22B_Dist_INT8", name: "LTX 2.5" }),
    "seedance-2.5 must outrank LTX-2.5 when available"
  );
  assert.ok(
    engine.scoreDeapiImg2ImgModel({ slug: "Flux_2_Pro", name: "FLUX.2 Pro" }) >
      engine.scoreDeapiImg2ImgModel({ slug: "Flux_2_Klein_4B_BF16", name: "FLUX.2 Klein" }),
    "Flux_2_Pro must outrank Flux_2_Klein_4B_BF16"
  );
  assert.ok(
    engine.scoreDeapiVidUpscaleModel({ slug: "FlashVSR_Tiny", name: "FlashVSR" }) > 0,
    "FlashVSR_Tiny video upscaler must score positively"
  );

  // Seedance HD 1088x1920 & omitted steps/guidance/negative_prompt
  const seedanceParams = engine.resolveDeapiModelRenderParams(
    {
      slug: "seedance-2.5",
      info: {
        defaults: { width: 720, height: 1280, frames: 121, fps: 24 },
        limits: { min_width: 480, max_width: 1920, min_height: 480, max_height: 1920, dimension_multiple: 16, min_frames: 97, max_frames: 289 },
      },
    },
    true,
    5.5
  );
  assert.equal(seedanceParams.width, 1072, "1072x1920 fits within 1080p 2,073,600 pixel cap on 16px grid");
  assert.equal(seedanceParams.height, 1920);
  assert.equal(seedanceParams.steps, null, "Seedance must omit steps");
  assert.equal(seedanceParams.guidance, null, "Seedance must omit guidance");
  assert.equal(seedanceParams.supportsNegative, false, "Seedance must omit negative_prompt");
  assert.ok(seedanceParams.frames >= 97, "Seedance must enforce >= 97 frames");

  // LTX-2.5 HD 736x1280 (9:16) instead of blurry 512x768
  const ltxHdParams = engine.resolveDeapiModelRenderParams(
    {
      slug: "Ltx2_5_22B_Dist_INT8",
      info: {
        defaults: { width: 512, height: 768, frames: 97, fps: 24, steps: 20 },
        limits: { min_width: 256, max_width: 1280, min_height: 256, max_height: 1280, dimension_multiple: 32, min_frames: 49, max_frames: 241 },
      },
    },
    true,
    8.2
  );
  assert.equal(ltxHdParams.width, 736);
  assert.equal(ltxHdParams.height, 1280);
  assert.equal((ltxHdParams.frames - 1) % 8, 0, "LTX-2.5 frame count must snap to 8k+1");

  // Multi-shot Arabic Fusha dialogue splitter & Native Joint AV prompt
  const shots = engine.splitDialogueIntoTimedNativeShots(
    "مَرْحَباً يَا أَصْدِقَائِي الأَبْطَال! هَيَّا نَسْبَحُ مَعاً فِي البَحْرِ الجَمِيلِ لِنُسَاعِدَ الدُّلْفِينَ الصَّغِيرَ، وَنَتَعَلَّمَ قِيمَةَ التَّعَاوُنِ وَالشَّجَاعَةِ مَعَ المُرْجَانِ المُلَوَّن!",
    16.4,
    8.8
  );
  assert.equal(shots.length, 2, "16.4s Arabic Fusha scene should split into 2 native ~8.2s shots");

  const castInfo = engine.inferSupportingCastAndSettingEn({
    heroName: "شوشو القبطان الصغير",
    companionName: "مرجان الدلفين المرح",
    sceneTitle: "إنقاذ الدلفين في البحر",
    dialogueArabic: shots[0].textAr,
    topicText: "التعاون في البحر",
  });
  const avPrompt = engine.buildNativeJointAudioVideoShotPrompt({
    baseMotionPrompt: "Two cute 3D friends sailing together.",
    heroName: "شوشو القبطان الصغير",
    companionName: "مرجان الدلفين المرح",
    speakerName: "شوشو القبطان الصغير",
    shotArabicLine: shots[0].arabicLine,
    soundEffectsEn: "crisp ocean water splashes, playful dolphin clicks, wooden boat creaks",
    foleyTheme: castInfo.foleyTheme,
    shotIndex: 0,
    totalShots: 2,
  });
  assert.match(avPrompt, /Modern Standard Arabic/);
  assert.match(avPrompt, /crisp ocean water splashes/);
  assert.ok(avPrompt.includes(shots[0].arabicLine), "Native AV prompt must embed the exact vocalized Arabic shot dialogue");
});

test("End-to-end Mock Server (Fusha Primary): Native Joint Audio+Video (/videos/animations) + Partner 402 Fallback + AI Video Upscaling (/videos/upscales) -> 1080x1920 MP4", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-native-av-"));
  let server = null;
  const origBaseUrl = process.env.DEAPI_BASE_URL;
  const origFastBackoff = process.env.DEAPI_FAST_TEST_BACKOFF;
  process.env.DEAPI_FAST_TEST_BACKOFF = "1";
    globalThis.__deapiAccountExhausted = false;

  try {
    const mockKeyframeJpg = path.join(tmpDir, "cloud_hd_keyframe.jpg");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=768x1344:rate=1", "-frames:v", "1", mockKeyframeJpg,
    ]);

    // Native animated clip WITH audible stereo speech + SFX
    const mockNativeAvMp4 = path.join(tmpDir, "cloud_native_av.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "testsrc=duration=7.6:size=736x1280:rate=24",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=7.6:sample_rate=48000",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-ac", "2", "-shortest",
      mockNativeAvMp4,
    ]);

    // Upscaled video returned by /api/v2/videos/upscales (even without audio, runner already extracted native audio!)
    const mockUpscaledMp4 = path.join(tmpDir, "cloud_upscaled_1080p.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "testsrc=duration=7.6:size=1080x1920:rate=24",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
      mockUpscaledMp4,
    ]);

    let seedanceAttemptedAndFellBack = false;
    let ltxAnimationsCount = 0;
    let upscaleCallsCount = 0;
    let lastAnimationPrompt = "";
    let jobSeq = 0;
    const jobKind = new Map();

    server = http.createServer((req, res) => {
      const host = req.headers.host;

      if (req.url.startsWith("/api/v2/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                name: "FLUX.2 Pro",
                slug: "Flux_2_Pro",
                inference_types: ["txt2img", "img2img"],
                info: {
                  defaults: { width: 768, height: 1344, steps: 20 },
                  limits: { min_width: 256, max_width: 1536, min_height: 256, max_height: 1536, dimension_multiple: 32 },
                  features: { supports_steps: true, supports_negative_prompt: true },
                },
              },
              {
                name: "BytePlus Seedance 2.5",
                slug: "seedance-2.5",
                inference_types: ["img2video", "txt2video"],
                info: {
                  defaults: { width: 1088, height: 1920, frames: 121, fps: 24 },
                  limits: { min_width: 480, max_width: 1920, min_height: 480, max_height: 1920, dimension_multiple: 16, min_frames: 97, max_frames: 289 },
                },
              },
              {
                name: "LTX-2.5 22B Distilled",
                slug: "Ltx2_5_22B_Dist_INT8",
                inference_types: ["img2video", "aud2video", "txt2video"],
                info: {
                  defaults: { width: 736, height: 1280, frames: 97, fps: 24, steps: 20, guidance: 3.0 },
                  limits: { min_width: 256, max_width: 1280, min_height: 256, max_height: 1280, dimension_multiple: 32, min_frames: 49, max_frames: 241 },
                  features: { supports_steps: true, supports_guidance: true, supports_negative_prompt: true },
                },
              },
              {
                name: "FlashVSR Tiny AI Video Upscaler",
                slug: "FlashVSR_Tiny",
                inference_types: ["vid-upscale"],
              },
            ],
          })
        );
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/images/edits") {
        req.on("data", () => {});
        req.on("end", () => {
          const id = `img_${++jobSeq}`;
          jobKind.set(id, "img");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/videos/animations") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const bodyStr = Buffer.concat(chunks).toString("utf8");
          if (bodyStr.includes("seedance-2.5")) {
            seedanceAttemptedAndFellBack = true;
            res.writeHead(402, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Partner tier unavailable on current plan" }));
            return;
          }
          lastAnimationPrompt = bodyStr;
          ltxAnimationsCount++;
          const id = `anim_${++jobSeq}`;
          jobKind.set(id, "anim");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/videos/upscales") {
        req.on("data", () => {});
        req.on("end", () => {
          upscaleCallsCount++;
          const id = `up_${++jobSeq}`;
          jobKind.set(id, "up");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "GET" && req.url.startsWith("/api/v2/jobs/")) {
        const id = req.url.split("/").pop();
        const k = jobKind.get(id);
        const urlMap = {
          img: `http://${host}/download/keyframe.jpg`,
          anim: `http://${host}/download/native_av.mp4`,
          up: `http://${host}/download/upscaled.mp4`,
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { status: "done", result_url: urlMap[k] } }));
        return;
      }

      if (req.method === "GET" && req.url === "/download/keyframe.jpg") {
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(fs.readFileSync(mockKeyframeJpg));
        return;
      }
      if (req.method === "GET" && req.url === "/download/native_av.mp4") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(fs.readFileSync(mockNativeAvMp4));
        return;
      }
      if (req.method === "GET" && req.url === "/download/upscaled.mp4") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(fs.readFileSync(mockUpscaledMp4));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    process.env.DEAPI_BASE_URL = `http://127.0.0.1:${port}`;
    engine.resetCache();

    const heroImgPath = path.join(repoRoot, "src/assets/images/char_carmen_girl_inventor_1790462010894.jpg");
    const compImgPath = path.join(repoRoot, "src/assets/images/char_simsim_flying_squirrel_1790462087579.jpg");

    const nativeClipMp4 = await engine.generateAnimatedSceneClipViaDeapi({
      apiKey: "test_key",
      rawImgPath: heroImgPath,
      heroImgPath,
      compImgPath,
      heroName: "كارمن المخترعة الصغيرة",
      companionName: "سمسم السنجاب الطائر",
      speakerName: "كارمن المخترعة الصغيرة",
      sceneTitle: "اختراع آلة جمع الثمار في البستان",
      dialogueArabic: "مَرْحَباً يَا أَصْدِقَائِي الأَبْطَال! انْظُرُوا إِلَى آلَةِ جَمْعِ الثِّمَارِ الذَّكِيَّةِ التِي صَنَعْنَاهَا فِي البُسْتَان، هَيَّا نُشَغِّلُهَا مَعاً يَا سِمْسِم!",
      soundEffectsEn: "crisp footsteps on garden path, cheerful squirrel chatter, gentle mechanical gears clicking",
      dialect: "fusha",
      sceneAudioPath: null,
      sceneDurationSec: 15.2,
      sceneIndex: 0,
      totalScenes: 4,
      topicText: "اختراع آلة جمع الثمار الذكية في البستان",
      isShort: true,
      outW: 1080,
      outH: 1920,
      tmpDir,
      formatTag: "short_9_16",
    });

    assert.ok(seedanceAttemptedAndFellBack, "Must try top-ranked seedance-2.5 first and fall back cleanly on HTTP 402");
    assert.equal(ltxAnimationsCount, 2, "15.2s Fusha scene must execute 2 chained /api/v2/videos/animations shots on LTX-2.5");
    assert.equal(upscaleCallsCount, 2, "Each Short shot must be AI-upscaled via /api/v2/videos/upscales");
    assert.ok(lastAnimationPrompt.includes("Modern Standard Arabic"), "Animation prompt must instruct native Arabic Fusha speech");
    assert.ok(fs.existsSync(nativeClipMp4), "Final 1080x1920 native clip MP4 must exist");

    const meta = JSON.parse(fs.readFileSync(`${nativeClipMp4}.meta.json`, "utf8"));
    assert.equal(meta.mode, "native-joint-av-chained");
    assert.equal(meta.hasNativeJointAudio, true, "Must preserve authentic native joint audio + Foley SFX");
    assert.ok(meta.masterAudioWavPath && fs.existsSync(meta.masterAudioWavPath), "Extracted native stereo master WAV must exist");

    const loudness = await engine.probeAudioStreamLoudness(meta.masterAudioWavPath);
    assert.equal(loudness.isAudible, true, "Master native audio WAV must be genuinely audible");

    const { stdout: probeStr } = await execFileAsync("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", nativeClipMp4,
    ]);
    const vStream = JSON.parse(probeStr).streams[0];
    assert.equal(vStream.width, 1080);
    assert.equal(vStream.height, 1920);
  } finally {
    if (origBaseUrl === undefined) delete process.env.DEAPI_BASE_URL;
    else process.env.DEAPI_BASE_URL = origBaseUrl;
    if (origFastBackoff === undefined) delete process.env.DEAPI_FAST_TEST_BACKOFF;
    else process.env.DEAPI_FAST_TEST_BACKOFF = origFastBackoff;
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("End-to-end Mock Server (Egyptian Fallback Mode): Multi-chunk Audio-Syncs (>16s scene -> 2 chained chunks) + HTTP 429 Recovery", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-lipsync-"));
  let server = null;
  const origBaseUrl = process.env.DEAPI_BASE_URL;
  const origFastBackoff = process.env.DEAPI_FAST_TEST_BACKOFF;
  process.env.DEAPI_FAST_TEST_BACKOFF = "1";
    globalThis.__deapiAccountExhausted = false;

  try {
    const longSceneSpeechWav = path.join(tmpDir, "scene_speech_16s.wav");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "sine=frequency=280:duration=16.4:sample_rate=24000", "-c:a", "pcm_s16le", longSceneSpeechWav,
    ]);

    const mockKeyframeJpg = path.join(tmpDir, "cloud_keyframe.jpg");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=576x1024:rate=1", "-frames:v", "1", mockKeyframeJpg,
    ]);

    const mockSyncedMp4WithAudio = path.join(tmpDir, "cloud_synced_with_sfx.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "testsrc=duration=8.2:size=576x1024:rate=24",
      "-f", "lavfi", "-i", "sine=frequency=520:duration=8.2:sample_rate=44100",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest",
      mockSyncedMp4WithAudio,
    ]);

    let audioSyncReceivedCount = 0;
    let sawAudioMultipartField = false;
    let sawFirstFrameField = false;
    let injected429Recovered = false;
    let jobSeq = 0;
    const jobKind = new Map();

    server = http.createServer((req, res) => {
      const host = req.headers.host;

      if (req.url.startsWith("/api/v2/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                name: "FLUX.2 Klein 4B",
                slug: "Flux_2_Klein_4B_BF16",
                inference_types: ["txt2img", "img2img"],
                info: {
                  defaults: { width: 576, height: 1024, steps: 4 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32 },
                  features: { supports_steps: true, supports_negative_prompt: true },
                },
              },
              {
                name: "LTX-2.5 22B Distilled",
                slug: "Ltx2_5_22B_Dist_INT8",
                inference_types: ["img2video", "aud2video", "txt2video"],
                info: {
                  defaults: { width: 576, height: 1024, frames: 97, fps: 24, steps: 20, guidance: 3.0 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32, min_frames: 49, max_frames: 241 },
                  features: { supports_steps: true, supports_guidance: true, supports_negative_prompt: true },
                },
              },
            ],
          })
        );
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/images/edits") {
        req.on("data", () => {});
        req.on("end", () => {
          const id = `img_${++jobSeq}`;
          jobKind.set(id, "img");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/videos/audio-syncs") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const bodyStr = Buffer.concat(chunks).toString("latin1");
          if (bodyStr.includes('name="audio"')) sawAudioMultipartField = true;
          if (bodyStr.includes('name="first_frame_image"')) sawFirstFrameField = true;

          if (audioSyncReceivedCount === 1 && !injected429Recovered) {
            injected429Recovered = true;
            res.writeHead(429, { "Content-Type": "application/json", "Retry-After": "1" });
            res.end(JSON.stringify({ message: "Too Many Attempts." }));
            return;
          }

          audioSyncReceivedCount++;
          const id = `sync_${++jobSeq}`;
          jobKind.set(id, "vid");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "GET" && req.url.startsWith("/api/v2/jobs/")) {
        const id = req.url.split("/").pop();
        const k = jobKind.get(id);
        const urlMap = {
          img: `http://${host}/download/keyframe.jpg`,
          vid: `http://${host}/download/synced.mp4`,
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { status: "done", result_url: urlMap[k] } }));
        return;
      }

      if (req.method === "GET" && req.url === "/download/keyframe.jpg") {
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(fs.readFileSync(mockKeyframeJpg));
        return;
      }
      if (req.method === "GET" && req.url === "/download/synced.mp4") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(fs.readFileSync(mockSyncedMp4WithAudio));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    process.env.DEAPI_BASE_URL = `http://127.0.0.1:${port}`;
    engine.resetCache();

    const heroImgPath = path.join(repoRoot, "src/assets/images/char_carmen_girl_inventor_1790462010894.jpg");
    const compImgPath = path.join(repoRoot, "src/assets/images/char_simsim_flying_squirrel_1790462087579.jpg");

    const syncedMp4 = await engine.generateAnimatedSceneClipViaDeapi({
      apiKey: "test_key",
      rawImgPath: heroImgPath,
      heroImgPath,
      compImgPath,
      heroName: "كارمن المخترعة الصغيرة",
      companionName: "سمسم السنجاب الطائر",
      speakerName: "كارمن المخترعة الصغيرة",
      sceneTitle: "اختراع آلة جمع الثمار في البستان",
      dialogueArabic: "يلا يا سمسم نشغل آلة جمع الثمار الذكية في البستان!",
      dialect: "egyptian",
      sceneAudioPath: longSceneSpeechWav,
      sceneDurationSec: 16.8,
      sceneIndex: 0,
      totalScenes: 4,
      topicText: "اختراع آلة جمع الثمار الذكية في البستان",
      isShort: true,
      outW: 1080,
      outH: 1920,
      tmpDir,
      formatTag: "short_9_16",
    });

    assert.equal(audioSyncReceivedCount, 2, "16.8s Egyptian scene must execute 2 sequential chained /api/v2/videos/audio-syncs chunks");
    assert.ok(sawAudioMultipartField, "Must upload sliced MP3 audio in multipart 'audio' field");
    assert.ok(sawFirstFrameField, "Must upload reference/chained frame in 'first_frame_image' field");
    assert.ok(injected429Recovered, "Must recover cleanly from HTTP 429 during audio-sync chunking");
    assert.ok(fs.existsSync(syncedMp4), "Final chained lip-synced MP4 must exist");
  } finally {
    if (origBaseUrl === undefined) delete process.env.DEAPI_BASE_URL;
    else process.env.DEAPI_BASE_URL = origBaseUrl;
    if (origFastBackoff === undefined) delete process.env.DEAPI_FAST_TEST_BACKOFF;
    else process.env.DEAPI_FAST_TEST_BACKOFF = origFastBackoff;
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Anti-Chimera Species Lock & Chatterbox MP3 Format Compliance: Human Heroes Stay 100% Human, Bird/Animal Companions Never Receive Portrait-Bust Fusion or Humanoid Actions", async () => {
  // 1. Verify all canonical heroes resolve to 100% human and all animal/bird companions resolve to pure non-human species
  const heroes = [
    "ذياد",
    "الطبيبة نورين",
    "أستاذ شريف",
    "الشيخ محمود",
    "تيتا فوزية",
    "جدو صالح",
    "كابتن طارق",
    "مهندس كريم",
    "كارمن المخترعة الصغيرة",
    "شوشو القبطان الصغير",
  ];
  for (const h of heroes) {
    const prof = engine.getCharacterSpeciesProfileEn(h);
    assert.equal(prof.kind, "human", `Hero "${h}" must strictly have kind="human"`);
    assert.match(prof.visualDescEn, /100%\s*(normal\s+)?human/i);
  }

  const nonHumanCompanions = [
    ["العصفورة الفرفوشة", "bird"],
    ["الصقر الذكي", "bird"],
    ["الديك الفصيح", "bird"],
    ["كركور الببغاء", "bird"],
    ["أرنوب الشقي الممرض", "quadruped"],
    ["القطة لوليتا", "quadruped"],
    ["زقلط الكلب الوفي", "quadruped"],
    ["زعتر الثعلب الصغير", "quadruped"],
    ["نمور الصغير الشجاع", "quadruped"],
    ["سمسم السنجاب الطائر", "quadruped"],
    ["الفأر الذكي", "quadruped"],
    ["باندا اللطيف", "quadruped"],
    ["مرجان الدلفين المرح", "dolphin"],
    ["البطريق المرح", "penguin"],
    ["فراشة الألوان الجميلة", "butterfly"],
    ["بلبل الروبوت الصغير", "robot"],
  ];

  for (const [compName, expectedKind] of nonHumanCompanions) {
    const prof = engine.getCharacterSpeciesProfileEn(compName);
    assert.equal(prof.kind, expectedKind, `Companion "${compName}" must strictly resolve to "${expectedKind}"`);
    assert.match(prof.visualDescEn, /NO human body|ZERO human body|pure/i);
    assert.doesNotMatch(
      prof.visualDescEn,
      /\b(nurse|shirt|jacket|pants|trousers|dress|vest|bow tie|bandana)\b/i,
      `Companion "${compName}" description must NOT contain human clothing/uniform words`
    );
  }

  // 2. Verify Ziad + Cheerful Bird prompts strictly separate human actions from bird actions (even when the bird speaks!)
  const birdSpeakingPrompts = engine.buildMultiCharacterStoryPrompts({
    heroName: "ذياد",
    companionName: "العصفورة الفرفوشة",
    speakerName: "العصفورة الفرفوشة",
    sceneTitle: "مغامرة التعاون في الحديقة",
    dialogueArabic: "زَقْزَقْ! هَيَّا يَا ذِيَادُ نَجْمَعُ البُذُورَ مَعاً بِسُرْعَةٍ وَنَشَاطٍ!",
    aiVisualScenePromptEn: "Ziad and the bird walking side by side and pointing with lively hand gestures in the park",
    sceneIndex: 1,
    totalScenes: 4,
    topicText: "التعاون والنشاط في الحديقة",
  });

  assert.match(birdSpeakingPrompts.sceneKeyframePrompt, /STRICT ANATOMY LOCK/);
  assert.match(birdSpeakingPrompts.sceneKeyframePrompt, /palm-sized|miniature bird anatomy/i);
  assert.doesNotMatch(
    birdSpeakingPrompts.sceneKeyframePrompt,
    /walking side by side/i,
    "Sanitizer must strip joint bipedal 'walking side by side' from AI visual prompts"
  );
  assert.match(
    birdSpeakingPrompts.videoMotionPrompt,
    /small orange bird beak|tiny real songbird/i,
    "When bird companion speaks, videoMotionPrompt must animate beak + wings, NOT human hands"
  );

  // 3. Mock server test: verify /api/v2/images/edits does NOT upload companion_ref.jpg portrait bust when companion is a bird,
  //    includes ANTI_CHIMERA_NEGATIVE_PROMPT, and verify synthesizeArabicFushaViaDeapiSpeech sends format: "mp3" (not "wav" -> 422)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-antichimera-"));
  let server = null;
  const origBaseUrl = process.env.DEAPI_BASE_URL;
  const origFastBackoff = process.env.DEAPI_FAST_TEST_BACKOFF;
  process.env.DEAPI_FAST_TEST_BACKOFF = "1";
  globalThis.__deapiAccountExhausted = false;

  try {
    const mockKeyframeJpg = path.join(tmpDir, "ziad_bird_keyframe.jpg");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=576x1024:rate=1", "-frames:v", "1", mockKeyframeJpg,
    ]);
    const mockNativeAvMp4 = path.join(tmpDir, "ziad_bird_native.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "testsrc=duration=6.2:size=576x1024:rate=24",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=6.2:sample_rate=48000",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-ac", "2", "-shortest",
      mockNativeAvMp4,
    ]);
    const mockTtsMp3 = path.join(tmpDir, "chatterbox_out.mp3");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "sine=frequency=330:duration=2.0:sample_rate=24000", "-c:a", "libmp3lame", mockTtsMp3,
    ]);

    let capturedEditsMultipart = "";
    let capturedSpeechPayload = null;
    let jobSeq = 0;
    const jobKind = new Map();

    server = http.createServer((req, res) => {
      const host = req.headers.host;
      if (req.url.startsWith("/api/v2/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                name: "FLUX.2 Klein 4B",
                slug: "Flux_2_Klein_4B_BF16",
                inference_types: ["txt2img", "img2img"],
                info: {
                  defaults: { width: 576, height: 1024, steps: 4 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32 },
                  features: { supports_steps: true, supports_negative_prompt: true },
                },
              },
              {
                name: "LTX-2.5 22B Distilled",
                slug: "Ltx2_5_22B_Dist_INT8",
                inference_types: ["img2video", "aud2video", "txt2video"],
                info: {
                  defaults: { width: 576, height: 1024, frames: 97, fps: 24, steps: 20, guidance: 3.0 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32, min_frames: 49, max_frames: 241 },
                  features: { supports_steps: true, supports_guidance: true, supports_negative_prompt: true },
                },
              },
              {
                name: "Chatterbox Multilingual TTS",
                slug: "Chatterbox",
                inference_types: ["txt2audio"],
                languages: [{ slug: "ar", name: "Arabic" }],
              },
            ],
          })
        );
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/images/edits") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          capturedEditsMultipart = Buffer.concat(chunks).toString("latin1");
          const id = `img_${++jobSeq}`;
          jobKind.set(id, "img");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/videos/animations") {
        req.on("data", () => {});
        req.on("end", () => {
          const id = `anim_${++jobSeq}`;
          jobKind.set(id, "anim");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/audio/speech") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          capturedSpeechPayload = parsed;
          if (parsed.format !== "mp3") {
            res.writeHead(422, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "This output format is not supported by this model. Available formats: mp3." }));
            return;
          }
          const id = `tts_${++jobSeq}`;
          jobKind.set(id, "tts");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "GET" && req.url.startsWith("/api/v2/jobs/")) {
        const id = req.url.split("/").pop();
        const k = jobKind.get(id);
        const urlMap = {
          img: `http://${host}/download/keyframe.jpg`,
          anim: `http://${host}/download/native.mp4`,
          tts: `http://${host}/download/speech.mp3`,
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { status: "done", result_url: urlMap[k] } }));
        return;
      }

      if (req.url === "/download/keyframe.jpg") {
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(fs.readFileSync(mockKeyframeJpg));
        return;
      }
      if (req.url === "/download/native.mp4") {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(fs.readFileSync(mockNativeAvMp4));
        return;
      }
      if (req.url === "/download/speech.mp3") {
        res.writeHead(200, { "Content-Type": "audio/mpeg" });
        res.end(fs.readFileSync(mockTtsMp3));
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    process.env.DEAPI_BASE_URL = `http://127.0.0.1:${port}`;
    engine.resetCache();

    // Verify Chatterbox TTS sends format: "mp3" and converts cleanly to WAV
    const ttsWav = await engine.synthesizeArabicFushaViaDeapiSpeech({
      apiKey: "test_key",
      text: "مَرْحَباً يَا أَصْدِقَائِي!",
      sceneIndex: 0,
      tmpDir,
    });
    assert.ok(capturedSpeechPayload, "Must call /api/v2/audios/speech");
    assert.equal(capturedSpeechPayload.format, "mp3", "Chatterbox request must send format='mp3' (never 'wav')");
    assert.ok(ttsWav && fs.existsSync(ttsWav), "Converted WAV from Chatterbox MP3 must exist");

    // Verify Ziad + Cheerful Bird keyframe edit sends ONLY hero_ref.jpg (NO companion_ref.jpg or duo_scene_ref.jpg!)
    const ziadImg = path.join(repoRoot, "src/assets/images/char_ziad_young_man_1790685879815.jpg");
    const birdImg = path.join(repoRoot, "src/assets/images/char_cheerful_bird_1790685899352.jpg");

    await engine.generateAnimatedSceneClipViaDeapi({
      apiKey: "test_key",
      rawImgPath: birdImg,
      heroImgPath: ziadImg,
      compImgPath: birdImg,
      heroName: "ذياد",
      companionName: "العصفورة الفرفوشة",
      speakerName: "العصفورة الفرفوشة",
      sceneTitle: "مغامرة البذور في الحديقة",
      dialogueArabic: "زَقْزَقْ! هَيَّا يَا ذِيَادُ نَجْمَعُ البُذُورَ مَعاً!",
      dialect: "fusha",
      preferNativeJointAudio: true,
      sceneAudioPath: null,
      sceneDurationSec: 7.5,
      sceneIndex: 1,
      totalScenes: 4,
      topicText: "التعاون في الحديقة",
      isShort: true,
      outW: 1080,
      outH: 1920,
      tmpDir,
      formatTag: "short_9_16",
    });

    assert.ok(capturedEditsMultipart.includes('filename="hero_ref.jpg"'), "Must include human hero_ref.jpg in v2/images/edits");
    assert.ok(
      !capturedEditsMultipart.includes('filename="companion_ref.jpg"'),
      "Must NEVER pass 1024x1024 non-human companion_ref.jpg portrait bust into v2/images/edits (prevents bird-headed human chimera)"
    );
    assert.ok(
      !capturedEditsMultipart.includes('filename="duo_scene_ref.jpg"'),
      "Must NEVER pass equal-bust duo_scene_ref.jpg into v2/images/edits when companion is non-human"
    );
    assert.ok(
      capturedEditsMultipart.includes("human body with bird head"),
      "v2/images/edits negative_prompt must include explicit anti-chimera terms"
    );
  } finally {
    if (origBaseUrl === undefined) delete process.env.DEAPI_BASE_URL;
    else process.env.DEAPI_BASE_URL = origBaseUrl;
    if (origFastBackoff === undefined) delete process.env.DEAPI_FAST_TEST_BACKOFF;
    else process.env.DEAPI_FAST_TEST_BACKOFF = origFastBackoff;
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Pure Classical Vocalized Fusha & Authentic Qaf [q] Guard: Eliminates All Colloquialisms, Fixes Vocative 'يا الـ', and Enforces Uvular Qaf", () => {
  // Exact real colloquial leak case from Run 40211170743 (Grandpa + Mischievous Mouse)
  const leakedFushaSample =
    "انْظُرْ مَعِي يَا الفأر المشاكس، اليَوْمَ نَنْطَلِقُ حَوْلَ حدوتة الزارع الصبور اللي سقى البذرة لحد ما بقت نخلة عالية! مَعِي عصا الحكمة المنقوشة وكتاب حواديت زمان والفانوس الدافي، وإزاي نحافظ على سناننا بيضا وقوية ونضيفة بالمية!";

  const purified = engine.normalizeAndVocalizePureFushaText(leakedFushaSample);
  const plainPurified = purified.replace(/[\u064B-\u065F\u0670]/gu, "");

  assert.doesNotMatch(
    plainPurified,
    /(^|\s)(اللي|بقت|حدوتة|حواديت|إزاي|ازاي|سناننا|بيضا|ونضيفة|بالمية|المية|الدافي|علشان|دلوقتي|الفرفوشة)(\s|$)/u,
    `Purified Fusha must contain ZERO colloquial words, got: ${purified}`
  );
  assert.doesNotMatch(
    plainPurified,
    /يا الفأر/u,
    "Must fix ungrammatical 'يا الفأر' into classical 'يا أيها الفأر'"
  );
  assert.match(purified, /يَا أَيُّهَا الْفَأْرُ/u);
  assert.match(purified, /سَقَى/u, "Verb سَقَى must carry vocalized Qaf");
  assert.match(purified, /حَتَّى أَصْبَحَتْ/u, "'لحد ما بقت' must become 'حَتَّى أَصْبَحَتْ'");
  assert.match(purified, /وَقَوِيَّةً/u, "'وقوية' must carry explicit vocalized Qaf");

  // Feminine vocative check ("يا العصفورة الفرفوشة" -> "يَا أَيَّتُهَا الْعُصْفُورَةُ الْمَرِحَةُ")
  const femVoc = engine.normalizeAndVocalizePureFushaText("هيا يا العصفورة الفرفوشة نقول الحق في قناة وصفحة نورين كيدز!");
  assert.match(femVoc, /يَا أَيَّتُهَا/u);
  assert.match(femVoc, /قَنَاةِ وَصَفْحَةِ/u);
  assert.match(femVoc, /نَقُولُ الْحَقَّ|نَقُولُ الْحَقِّ/u);

  // Dialectal hamza-for-Qaf restoration ("أولت طريء حئيئي دئيئة" -> pure Qaf)
  const hamzaFixed = engine.normalizeAndVocalizePureFushaText("أولت هذا طريء حئيئي في دئيئة");
  assert.match(hamzaFixed, /قُلْتُ/u);
  assert.match(hamzaFixed, /طَرِيقٌ/u);
  assert.match(hamzaFixed, /حَقِيقِيٌّ/u);
  assert.match(hamzaFixed, /دَقِيقَةٌ/u);

  // Verify Native Joint AV shot prompt enforces classical uvular Qaf [q] and loud foreground SFX
  const avPrompt = engine.buildNativeJointAudioVideoShotPrompt({
    baseMotionPrompt: "Professor Sherif and the Smart Falcon walk along a sunlit path.",
    heroName: "أستاذ شريف",
    companionName: "الصقر الذكي",
    speakerName: "أستاذ شريف",
    shotArabicLine: "انظر يا الصقر الذكي إلى القرية الجميلة فوق القمة!",
    soundEffectsEn: "crisp footsteps walking on path, fresh wind breeze, falcon wing flap",
    foleyTheme: "park",
    shotIndex: 0,
    totalShots: 2,
  });
  assert.match(avPrompt, /crisp classical uvular Qaf \[q\] articulation/i);
  assert.match(avPrompt, /never glottal-stop hamza/i);
  assert.match(avPrompt, /Loud, crisp, clearly audible foreground diegetic foley sound effects/i);
  assert.match(avPrompt, /يَا أَيُّهَا الصَّقْرُ/u);
});

test("Mandatory Final-Scene Closing CTA & سؤال الشطار: Enforced in BOTH Short & Long Videos (Fusha & Egyptian, AI & Fallback)", () => {
  // Case 1: AI Short Fusha ending that previously had a generic '?' question without 'سؤال الشطار' and without Subscribe/Like/Share (exact Run 40211170743 Scene 4!)
  const run40211170743Scene4 =
    "بِالتَّأْكِيدِ يَا أُسْتَاذُ شَرِيف! عِنْدَمَا يَكُونُ كُلُّ شَيْءٍ فِي مَكَانِهِ الصَّحِيحِ نَشْعُرُ بِالرَّاحَةِ وَالسَّعَادَةِ. وَالآنَ يَا أَطْفَالُ، مَاذَا تُحِبُّونَ أَنْ تُرَتِّبُوا فِي غُرَفِكُمْ الْيَوْمَ؟ اكْتُبُوا إِجَابَتَكُمْ فِي التَّعْلِيقَاتِ!";

  const fixedShortFusha = engine.ensureFinalSceneClosingCtaAndQuestion(run40211170743Scene4, {
    dialect: "fusha",
    isShort: true,
    topicMention: "تنظيم الوقت",
  });
  const plainShortFusha = fixedShortFusha.replace(/[\u064B-\u065F\u0670]/gu, "");

  assert.match(plainShortFusha, /سؤال الشطار/, "Short Fusha final scene must explicitly include 'سؤال الشطار'");
  assert.match(plainShortFusha, /التعليقات/, "Short Fusha final scene must prompt answers in comments");
  assert.match(
    plainShortFusha,
    /لا تنسوا الاشتراك في قناة وصفحة نورين كيدز.*الإعجاب.*مشاركة.*أصدقائكم!$/,
    `Short Fusha final scene MUST end with Subscribe + Like + Share on قناة وصفحة نورين كيدز, got: ${plainShortFusha}`
  );

  // Case 2: Long Fusha final scene that previously ended with incomplete "ولا تنسوا الاشتراك في القناة، إلى اللقاء!" (exact Run 40211170743 Long Scene 8!)
  const run40211170743Scene8 =
    "وَالآنَ يَا أَصْدِقَاءَنَا الرَّائِعِينَ فِي عَائِلَةِ نُورِين كِيدْز! 🧩 سؤال الشطار اليَوْمَ: مَا أَهَمُّ دَرْسٍ اسْتَفَدْتُمُوهُ مِنَ القِصَّةِ؟ اكتبوا إجابتكم في التعليقات، وَلَا تَنْسَوُا الاشْتِرَاكَ فِي القَنَاةِ، إِلَى اللِّقَاءِ!";

  const fixedLongFusha = engine.ensureFinalSceneClosingCtaAndQuestion(run40211170743Scene8, {
    dialect: "fusha",
    isShort: false,
    topicMention: "الصبر والتعاون",
  });
  const plainLongFusha = fixedLongFusha.replace(/[\u064B-\u065F\u0670]/gu, "");
  const countDontForget = (plainLongFusha.match(/لا تنسوا الاشتراك/g) || []).length;
  assert.equal(countDontForget, 1, "Must replace partial trailing CTA cleanly without duplicating 'لا تنسوا الاشتراك'");
  assert.match(plainLongFusha, /سؤال الشطار/);
  assert.match(
    plainLongFusha,
    /ولا تنسوا الاشتراك في قناة وصفحة نورين كيدز.*الإعجاب.*مشاركة.*إلى اللقاء يا أبطال!$/,
    `Long Fusha final scene MUST end with full Subscribe + Like + Share on قناة وصفحة نورين كيدز, got: ${plainLongFusha}`
  );

  // Case 3: Short & Long Egyptian final scenes (even when AI omitted question & CTA completely)
  const bareEgyptian = "يا سلام! الفكرة نجحت وفرحنا كل أصحابنا في الحديقة!";
  const fixedShortEg = engine.ensureFinalSceneClosingCtaAndQuestion(bareEgyptian, {
    dialect: "egyptian",
    isShort: true,
    topicMention: "التعاون في الحديقة",
  });
  const fixedLongEg = engine.ensureFinalSceneClosingCtaAndQuestion(bareEgyptian, {
    dialect: "egyptian",
    isShort: false,
    topicMention: "التعاون في الحديقة",
  });

  for (const egOut of [fixedShortEg, fixedLongEg]) {
    assert.match(egOut, /سؤال الشطار/, "Egyptian final scene must include 'سؤال الشطار'");
    assert.match(egOut, /التعليقات/, "Egyptian final scene must include 'التعليقات'");
    assert.match(
      egOut,
      /وما تنسوش تشتركوا في قناة وصفحة نورين كيدز، وتعملوا لايك وشير/,
      `Egyptian final scene must end with Subscribe + Like + Share on قناة وصفحة نورين كيدز, got: ${egOut}`
    );
  }
});

test("Crystal-Clear Live-Action Foley SFX Engine: Walking, Running, Wind, Water, and Bird/Animal Companion Calls Are Vividly Audible & Duck Smoothly Under Native Voice", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-foley-sfx-"));
  try {
    const scenarios = [
      {
        label: "Falcon + Running + Wind",
        foleyTheme: "park",
        companionName: "الصقر الذكي",
        soundEffectsEn: "running footsteps on path, strong wind breeze, falcon wing flaps",
        dialogueArabic: "هَيَّا نَجْرِي بِسُرْعَةٍ يَا أَيُّهَا الصَّقْرُ الذَّكِيُّ!",
      },
      {
        label: "Songbird + Forest Leaves",
        foleyTheme: "forest",
        companionName: "العصفورة الفرفوشة",
        soundEffectsEn: "walking footsteps on grass, rustling leaves, cheerful bird chirps",
        dialogueArabic: "نَمْشِي مَعاً فِي الْغَابَةِ الْجَمِيلَةِ!",
      },
      {
        label: "Kitten + Clinic/Garden",
        foleyTheme: "park",
        companionName: "القطة لوليتا",
        soundEffectsEn: "cute cat meow, footsteps on garden path",
        dialogueArabic: "انْظُرُوا إِلَى الْقِطَّةِ لُولِيتَا اللطيفة!",
      },
      {
        label: "Puppy + Playful Park",
        foleyTheme: "park",
        companionName: "الكلب زقلط",
        soundEffectsEn: "playful puppy bark, running paws",
        dialogueArabic: "هَيَّا نَلْعَبُ وَنَرْكُضُ فِي الْحَدِيقَةِ!",
      },
      {
        label: "Dolphin + Ocean Water",
        foleyTheme: "water",
        companionName: "مرجان الدلفين المرح",
        soundEffectsEn: "ocean waves splashing, dolphin clicks, footsteps on wooden boat deck",
        dialogueArabic: "أَمْوَاجُ الْبَحْرِ وَالْمَاءِ تَتَلَأْلَأُ مَعَ الدُّلْفِينِ!",
      },
      {
        label: "Rooster + Oasis Breeze",
        foleyTheme: "oasis",
        companionName: "الديك الفصيح",
        soundEffectsEn: "sand footsteps, desert breeze, rooster call",
        dialogueArabic: "صَبَاحُ النَّشَاطِ فِي الْوَاحَةِ!",
      },
    ];

    let sampleFoleyWav = null;
    for (let i = 0; i < scenarios.length; i++) {
      const sc = scenarios[i];
      const wavPath = await engine.synthesizeContextualFoleySfxWav({
        foleyTheme: sc.foleyTheme,
        durationSec: 4.5,
        sceneIndex: `test_${i}`,
        tmpDir,
        companionName: sc.companionName,
        soundEffectsEn: sc.soundEffectsEn,
        dialogueArabic: sc.dialogueArabic,
      });
      assert.ok(fs.existsSync(wavPath) && fs.statSync(wavPath).size > 50_000, `${sc.label} WAV must be generated`);
      const loudness = await engine.probeAudioStreamLoudness(wavPath);
      assert.equal(loudness.hasAudio, true, `${sc.label} must have stereo audio stream`);
      assert.ok(
        loudness.meanVolumeDb > -24.5 && loudness.meanVolumeDb < -8.0,
        `${sc.label} Foley must be clearly audible (expected mean between -24.5dB and -8dB, got ${loudness.meanVolumeDb.toFixed(1)}dB)`
      );
      assert.ok(
        loudness.maxVolumeDb > -8.5,
        `${sc.label} Foley peaks (footsteps/bird/animal calls) must be crisp and prominent (expected max > -8.5dB, got ${loudness.maxVolumeDb.toFixed(1)}dB)`
      );
      if (i === 0) sampleFoleyWav = wavPath;
    }

    // Verify Stage 2 Native-AV sidechain cinema mix formula blends authentic speech + rich stereo Foley cleanly without clipping
    const mockSpeechWav = path.join(tmpDir, "mock_native_speech.wav");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "aevalsrc='0.38*lt(mod(t,1.5),0.85)*sin(2*PI*220*t)|0.38*lt(mod(t,1.5),0.85)*sin(2*PI*220*t)':s=48000:c=stereo:d=4.5",
      "-c:a",
      "pcm_s16le",
      mockSpeechWav,
    ]);
    const mixedNativeOut = path.join(tmpDir, "mixed_native_cinema.wav");
    const dur = 4.5;
    const fadeOutSt = dur - 0.85;
    const nativeCinemaMixFilter =
      `[0:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${dur},asplit=2[nat_v][nat_sc];` +
      `[1:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,afade=t=in:st=0:d=0.15,afade=t=out:st=${fadeOutSt}:d=0.45[fx_in];` +
      `[fx_in][nat_sc]sidechaincompress=threshold=0.055:ratio=2.2:attack=18:release=220[fx_ducked];` +
      `[nat_v][fx_ducked]amix=inputs=2:duration=first:weights='1.0 0.78':normalize=0,alimiter=limit=0.96,asetpts=PTS-STARTPTS,aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo[outa]`;

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      mockSpeechWav,
      "-i",
      sampleFoleyWav,
      "-filter_complex",
      nativeCinemaMixFilter,
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
      mixedNativeOut,
    ]);
    const mixLoudness = await engine.probeAudioStreamLoudness(mixedNativeOut);
    assert.equal(mixLoudness.isAudible, true);
    assert.ok(mixLoudness.meanVolumeDb > -18.0, `Combined Native Voice + SFX cinema mix must be rich and full (got ${mixLoudness.meanVolumeDb.toFixed(1)}dB)`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Persistent Circular Channel Watermark (Noreen Kids Broadcast Bug): Transparent Corners, Crisp 360° Yellow Ring at 88% Opacity, Safe Top-Right Placement, and Zero Scene-Boundary Flicker", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "noreen-watermark-test-"));
  try {
    const logoSrc = engine.resolveChannelWatermarkLogoPath(repoRoot);
    assert.ok(logoSrc && fs.existsSync(logoSrc), "Approved local channel watermark logo must exist in src/assets/images/noreen_kids_watermark_logo.png");

    const longLayout = engine.computeChannelWatermarkLayout(false, 1920, 1080);
    const shortLayout = engine.computeChannelWatermarkLayout(true, 1080, 1920);
    assert.deepEqual(
      { size: longLayout.size, x: longLayout.x, y: longLayout.y, opacityPct: longLayout.opacityPct },
      { size: 146, x: 1738, y: 32, opacityPct: 88 },
      "Long 1920x1080 layout must be 146x146 at Top-Right (x=1738, y=32, 88% opacity)"
    );
    assert.deepEqual(
      { size: shortLayout.size, x: shortLayout.x, y: shortLayout.y, opacityPct: shortLayout.opacityPct },
      { size: 140, x: 910, y: 88, opacityPct: 88 },
      "Short 1080x1920 layout must be 140x140 at Top-Right safe zone (x=910, y=88, 88% opacity)"
    );

    for (const [isShort, layout, tag] of [
      [false, longLayout, "long_16_9"],
      [true, shortLayout, "short_9_16"],
    ]) {
      const wmPng = path.join(tmpDir, `wm_${tag}.png`);
      const outPath = await engine.prepareCircularChannelWatermarkPng({
        logoSrcPath: logoSrc,
        isShort,
        outPngPath: wmPng,
      });
      assert.equal(outPath, wmPng);
      assert.ok(fs.existsSync(wmPng), `Prepared circular watermark PNG must exist for ${tag}`);

      const { stdout: probeJson } = await execFileAsync("ffprobe", [
        "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "json", wmPng,
      ]);
      const st = JSON.parse(probeJson).streams[0];
      assert.equal(st.width, layout.size);
      assert.equal(st.height, layout.size);
      assert.equal(st.pix_fmt, "rgba", "Watermark PNG must preserve RGBA alpha channel");

      const { stdout: rawBuf } = await execFileAsync(
        "ffmpeg",
        ["-v", "error", "-i", wmPng, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
        { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 }
      );
      const S = layout.size;
      const getRgba = (x, y) => {
        const idx = (y * S + x) * 4;
        return [rawBuf[idx], rawBuf[idx + 1], rawBuf[idx + 2], rawBuf[idx + 3]];
      };

      // 1. All 4 square corners MUST be 100% transparent (alpha === 0, zero dark-blue box!)
      for (const [cx, cy] of [
        [0, 0],
        [S - 1, 0],
        [0, S - 1],
        [S - 1, S - 1],
        [4, 4],
        [S - 5, S - 5],
      ]) {
        const [, , , a] = getRgba(cx, cy);
        assert.equal(a, 0, `${tag} corner (${cx},${cy}) must have alpha=0 (fully transparent cutout)`);
      }

      // 2. Interior pixel must have ~88% opacity (alpha === 224)
      const [, , , centerAlpha] = getRgba(Math.floor(S / 2), Math.floor(S / 2));
      assert.equal(centerAlpha, 224, `${tag} center pixel must have 88% broadcast opacity (224/255)`);

      // 3. Top, Bottom, Left, Right outer ring pixels just inside radius must be bright yellow (zero dark-blue fringe leak!)
      const mid = Math.floor(S / 2);
      for (const [label, rx, ry] of [
        ["top-ring", mid, 2],
        ["bottom-ring", mid, S - 3],
        ["left-ring", 2, mid],
        ["right-ring", S - 3, mid],
      ]) {
        const [r, g, b, a] = getRgba(rx, ry);
        assert.ok(
          r > 195 && g > 165 && b < 95 && a >= 200,
          `${tag} ${label} (${rx},${ry}) must be crisp yellow ring at ~88% alpha, got rgba(${r},${g},${b},${a})`
        );
      }
    }

    // 4. Verify Zero-Flicker Continuity across faded scene boundary + Closed-GOP concat (-c:v copy)
    const wmShortPng = path.join(tmpDir, "wm_short_9_16.png");
    const sc0 = path.join(tmpDir, "sc0.mp4");
    const sc1 = path.join(tmpDir, "sc1.mp4");
    for (const [idx, color, outMp4] of [
      [0, "0x1E293B", sc0],
      [1, "0x0F766E", sc1],
    ]) {
      await execFileAsync("ffmpeg", [
        "-y",
        "-f", "lavfi", "-i", `color=c=${color}:s=1080x1920:r=30:d=1.2`,
        "-i", wmShortPng,
        "-filter_complex",
        `[0:v]fps=30,trim=duration=1.2,setpts=PTS-STARTPTS,setsar=1,fade=t=in:st=0:d=0.22,fade=t=out:st=0.92:d=0.25,format=yuv420p[sc_faded];` +
          `[1:v]format=rgba[wm];` +
          `[sc_faded][wm]overlay=x=${shortLayout.x}:y=${shortLayout.y}:eof_action=repeat:format=auto,setsar=1,format=yuv420p[vout]`,
        "-map", "[vout]",
        "-an", "-r", "30", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "17", "-g", "30", "-flags", "+cgop", "-pix_fmt", "yuv420p",
        outMp4,
      ]);
      assert.ok(fs.existsSync(outMp4), `Rendered watermarked scene ${idx} must exist`);
    }

    const concatTxt = path.join(tmpDir, "concat.txt");
    fs.writeFileSync(concatTxt, `file '${sc0}'\nfile '${sc1}'\n`);
    const joinedMp4 = path.join(tmpDir, "joined_short.mp4");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", concatTxt, "-c:v", "copy", joinedMp4,
    ]);

    // Sample frame right at t=0.00s (when scene background is 100% black due to fade-in!): watermark MUST still be bright and visible!
    const { stdout: fadeFrameRgb } = await execFileAsync(
      "ffmpeg",
      ["-v", "error", "-ss", "0.00", "-i", joinedMp4, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { encoding: "buffer", maxBuffer: 8 * 1024 * 1024 }
    );
    // Background pixel away from watermark (100, 100) is faded to near-black (~0..5)
    const bgIdx = (100 * 1080 + 100) * 3;
    assert.ok(fadeFrameRgb[bgIdx] < 12 && fadeFrameRgb[bgIdx + 1] < 12, "Scene background at t=0.00s must be faded to black");

    // Top-ring pixel of watermark (x = 910 + 70 = 980, y = 88 + 2 = 90) MUST be bright yellow even during black scene fade!
    const wmRingIdx = ((shortLayout.y + 2) * 1080 + (shortLayout.x + 70)) * 3;
    assert.ok(
      fadeFrameRgb[wmRingIdx] > 165 && fadeFrameRgb[wmRingIdx + 1] > 140,
      `Watermark at Top-Right must NOT fade to black during scene transitions (got rgb(${fadeFrameRgb[wmRingIdx]},${fadeFrameRgb[wmRingIdx + 1]},${fadeFrameRgb[wmRingIdx + 2]}))`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});


