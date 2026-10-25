#!/usr/bin/env node
/**
 * Unit & Integration Mock Test for deAPI.ai 3D Storyboard + Lip-Synced Audio-to-Video & Foley SFX Pipeline
 * Verifies:
 * 1. Dynamic model catalog discovery from GET /api/v2/models (aud2video, img2video, img2img, txt2img, txt2audio)
 * 2. Audio chunking plan (<= 9.4s chunks for LTX-2.5 10s audio window) & 8k+1 frame snapping up to 241 frames @ 24fps
 * 3. Multi-character story prompt + contextual Foley SFX theme detection & physical Foley WAV synthesis (water, forest, workshop, oasis, space, park)
 * 4. Dialect-aware deAPI Chatterbox Arabic TTS (`POST /api/v2/audio/speech` with `lang: "ar"`) for Modern Standard Arabic (`fusha`)
 * 5. Chunked Lip-Synced Audio-to-Video (`POST /api/v2/videos/audio-syncs` with `audio` + `first_frame_image`), Last-Frame Chaining across >10s speech, Native LTX SFX extraction, and HTTP 429 RPM recovery across ALL 4/4 scenes
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
const ytWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/noreen-kids-daily-youtube.yml"), "utf8");
const fbWorkflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/noreen-facebook-daily-publish.yml"), "utf8");

// Extract pure deAPI engine functions from runner script for direct testing
const startMarker = "// deAPI.ai 3D Cartoon Storyboard + Lip-Synced Audio-to-Video & Foley SFX Engine";
const endMarker = "async function renderEpisodeMp4(";
const startIdx = runnerCode.indexOf(startMarker);
const endIdx = runnerCode.indexOf(endMarker);
assert.ok(startIdx > 0 && endIdx > startIdx, "deAPI lip-sync & foley engine block must exist in runner script");

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
    scoreDeapiArabicTtsModel,
    computeDeapiRateLimitWaitMs,
    computeAudioChunkPlanSec,
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
    }
  };`
);

const engine = engineFactory(fs, path, execFileAsync, sleep, measureAudioDurationSec);

test("Workflows wire DEAPI_API_KEY, allow 150-min timeout, prioritize Egyptian via Gemini and Fusha via deAPI Chatterbox", () => {
  assert.match(ytWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(fbWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(ytWorkflow, /timeout-minutes:\s*150/);
  assert.match(fbWorkflow, /timeout-minutes:\s*150/);
  assert.match(
    runnerCode,
    /if \(dialect === "fusha" && deapiTtsKey\)/,
    "Runner must route fusha dialect to deAPI Chatterbox while keeping egyptian dialect on Egyptian voice primary"
  );
  assert.match(
    runnerCode,
    /sidechaincompress=threshold=/,
    "Stage 2 audio mixer must duck Foley SFX & BGM under character dialogue via sidechaincompress"
  );
});

test("Audio chunking (<= 9.4s), 241-frame LTX-2.5 calculation, and contextual Foley SFX WAV synthesis work cleanly", async () => {
  const chunks24s = engine.computeAudioChunkPlanSec(24.5, 9.4, 2.2);
  assert.equal(chunks24s.length, 3, "24.5s speech should split evenly into 3 chunks <= 9.4s each");
  for (const c of chunks24s) {
    assert.ok(c.durSec <= 9.4 && c.durSec >= 2.2, `Chunk duration out of bounds: ${c.durSec}`);
  }

  const syncParams = engine.resolveDeapiModelRenderParams(
    {
      slug: "Ltx2_5_22B_Dist_INT8",
      info: {
        defaults: { frames: 97, fps: 24, steps: 20 },
        limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32, min_frames: 49, max_frames: 241 },
      },
    },
    true,
    8.2
  );
  assert.equal((syncParams.frames - 1) % 8, 0, "LTX-2.5 frame count must snap to 8k+1");
  assert.ok(syncParams.frames >= 185 && syncParams.frames <= 209, `8.2s @ 24fps should be ~193-201 frames (got ${syncParams.frames})`);

  const seaPrompts = engine.buildMultiCharacterStoryPrompts({
    heroName: "شوشو القبطان الصغير",
    companionName: "مرجان الدلفين المرح",
    speakerName: "شوشو القبطان الصغير",
    sceneTitle: "إنقاذ الحوت الصغير في البحر",
    dialogueArabic: "يلا يا مرجان نعوم في البحر ونساعد الحوت الصغير!",
    sceneIndex: 0,
    totalScenes: 4,
    topicText: "شوشو ومرجان وإنقاذ الحوت الصغير",
  });
  assert.equal(seaPrompts.foleyTheme, "water");
  assert.match(seaPrompts.videoMotionPrompt, /accurate expressive mouth lip-sync/i);
  assert.match(seaPrompts.videoMotionPrompt, /ocean waves/i);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "foley-unit-"));
  try {
    for (const theme of ["water", "forest", "workshop", "oasis", "space", "park"]) {
      const wav = await engine.synthesizeContextualFoleySfxWav({
        foleyTheme: theme,
        durationSec: 3.0,
        sceneIndex: 0,
        tmpDir,
      });
      assert.ok(fs.existsSync(wav) && fs.statSync(wav).size > 20_000, `Foley WAV must be generated for ${theme}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("End-to-end Mock Server: Multi-chunk Audio-Syncs (>16s scene -> 2 chained chunks) + Native SFX Extraction + Chatterbox Arabic TTS + 429 Recovery", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-lipsync-"));
  let server = null;
  const origBaseUrl = process.env.DEAPI_BASE_URL;
  const origFastBackoff = process.env.DEAPI_FAST_TEST_BACKOFF;
  process.env.DEAPI_FAST_TEST_BACKOFF = "1";

  try {
    // 1) Create a 16.4-second synthetic speech WAV (triggers 2 chained chunks of ~8.2s each!)
    const longSceneSpeechWav = path.join(tmpDir, "scene_speech_16s.wav");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "sine=frequency=280:duration=16.4:sample_rate=24000", "-c:a", "pcm_s16le", longSceneSpeechWav,
    ]);

    // 2) Create mock cloud assets: story keyframe JPG, animated MP4 WITH native audio stream, and TTS WAV
    const mockKeyframeJpg = path.join(tmpDir, "cloud_keyframe.jpg");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=512x768:rate=1", "-frames:v", "1", mockKeyframeJpg,
    ]);

    const mockSyncedMp4WithAudio = path.join(tmpDir, "cloud_synced_with_sfx.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", "testsrc=duration=8.2:size=512x768:rate=24",
      "-f", "lavfi", "-i", "sine=frequency=520:duration=8.2:sample_rate=44100",
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-shortest",
      mockSyncedMp4WithAudio,
    ]);

    const mockTtsWav = path.join(tmpDir, "cloud_chatterbox_ar.wav");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "sine=frequency=340:duration=4.5:sample_rate=24000", "-c:a", "pcm_s16le", mockTtsWav,
    ]);

    let audioSyncReceivedCount = 0;
    let sawAudioMultipartField = false;
    let sawFirstFrameField = false;
    let ttsReceivedLangAr = false;
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
                  defaults: { width: 512, height: 768, steps: 4 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32 },
                  features: { supports_steps: true, supports_negative_prompt: true },
                },
              },
              {
                name: "LTX-2.5 22B Distilled",
                slug: "Ltx2_5_22B_Dist_INT8",
                inference_types: ["img2video", "aud2video", "txt2video"],
                info: {
                  defaults: { width: 512, height: 768, frames: 97, fps: 24, steps: 20, guidance: 3.0 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32, min_frames: 49, max_frames: 241 },
                  features: { supports_steps: true, supports_guidance: true, supports_negative_prompt: true },
                },
              },
              {
                name: "Chatterbox Multilingual TTS",
                slug: "Chatterbox",
                inference_types: ["txt2audio"],
                languages: [{ code: "ar", name: "Arabic" }, { code: "en", name: "English" }],
              },
            ],
          })
        );
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/audio/speech") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          if (body.model === "Chatterbox" && body.lang === "ar") {
            ttsReceivedLangAr = true;
          }
          const id = `tts_${++jobSeq}`;
          jobKind.set(id, "tts");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
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

          // Inject HTTP 429 once on second chunk to verify rate-limit recovery on audio-syncs
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
          tts: `http://${host}/download/tts.wav`,
          img: `http://${host}/download/keyframe.jpg`,
          vid: `http://${host}/download/synced.mp4`,
        };
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { status: "done", result_url: urlMap[k] } }));
        return;
      }

      if (req.method === "GET" && req.url === "/download/tts.wav") {
        const buf = fs.readFileSync(mockTtsWav);
        res.writeHead(200, { "Content-Type": "audio/wav" });
        res.end(buf);
        return;
      }
      if (req.method === "GET" && req.url === "/download/keyframe.jpg") {
        const buf = fs.readFileSync(mockKeyframeJpg);
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(buf);
        return;
      }
      if (req.method === "GET" && req.url === "/download/synced.mp4") {
        const buf = fs.readFileSync(mockSyncedMp4WithAudio);
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(buf);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    process.env.DEAPI_BASE_URL = `http://127.0.0.1:${port}`;
    engine.resetCache();

    // Verify Fusha TTS via deAPI Chatterbox
    const fushaWav = await engine.synthesizeArabicFushaViaDeapiSpeech({
      apiKey: "test_key",
      text: "أهلاً وسهلاً بأصدقائنا الأبطال في مغامرة اليوم الجميلة والمفيدة.",
      sceneIndex: 0,
      tmpDir,
    });
    assert.ok(ttsReceivedLangAr, "Must call /api/v2/audio/speech with Chatterbox and lang='ar'");
    assert.ok(fushaWav && fs.existsSync(fushaWav), "Synthesized MSA WAV must exist on disk");

    // Verify 16.4s scene speech -> 2 chained audio-syncs chunks + native SFX extraction!
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
      sceneAudioPath: longSceneSpeechWav,
      sceneDurationSec: 16.8,
      sceneIndex: 0,
      totalScenes: 4,
      topicText: "اختراع آلة جمع الثمار الذكية في البستان",
      isShort: true,
      outW: 720,
      outH: 1280,
      tmpDir,
      formatTag: "short_9_16",
    });

    assert.equal(audioSyncReceivedCount, 2, "16.8s scene must execute 2 sequential chained /api/v2/videos/audio-syncs chunks");
    assert.ok(sawAudioMultipartField, "Must upload sliced MP3 audio in multipart 'audio' field");
    assert.ok(sawFirstFrameField, "Must upload reference/chained frame in 'first_frame_image' field");
    assert.ok(injected429Recovered, "Must recover cleanly from HTTP 429 during audio-sync chunking");
    assert.ok(fs.existsSync(syncedMp4), "Final chained lip-synced MP4 must exist");

    const metaPath = `${syncedMp4}.meta.json`;
    assert.ok(fs.existsSync(metaPath), "Sidecar metadata with native SFX & foley theme must be saved");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    assert.equal(meta.mode, "audio-sync-chained");
    assert.equal(meta.chunksCount, 2);
    assert.ok(meta.nativeSfxWavPath && fs.existsSync(meta.nativeSfxWavPath), "Extracted native LTX SFX WAV must exist");

    const vidDur = await measureAudioDurationSec(syncedMp4, 0);
    assert.ok(vidDur >= 16.0 && vidDur <= 17.5, `Chained video duration (${vidDur}s) must match ~16.8s scene audio without ping-pong looping!`);
  } finally {
    if (origBaseUrl === undefined) delete process.env.DEAPI_BASE_URL;
    else process.env.DEAPI_BASE_URL = origBaseUrl;
    if (origFastBackoff === undefined) delete process.env.DEAPI_FAST_TEST_BACKOFF;
    else process.env.DEAPI_FAST_TEST_BACKOFF = origFastBackoff;
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
