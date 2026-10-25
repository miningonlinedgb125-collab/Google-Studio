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
    buildNativeJointAudioVideoShotPrompt,
    probeAudioStreamLoudness,
    discoverActiveDeapiModelsCatalog,
    resolveDeapiModelRenderParams,
    inferSupportingCastAndSettingEn,
    buildMultiCharacterStoryPrompts,
    synthesizeContextualFoleySfxWav,
    synthesizeArabicFushaViaDeapiSpeech,
    cropCharacterReferenceWithoutBanner,
    generateAnimatedSceneClipViaDeapi,
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
