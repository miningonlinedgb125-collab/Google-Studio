#!/usr/bin/env node
/**
 * Unit & Integration Mock Test for deAPI.ai 3D Storyboard + Multi-Character Cartoon Animation Pipeline
 * Verifies:
 * 1. Dynamic model catalog discovery from GET /api/v2/models (img2img, txt2img, and img2video)
 * 2. Banner-free character portrait cropping (removing bottom 24% nameplate banner from char_*.jpg)
 * 3. Multi-character story prompt synthesis (Hero + Companion + Supporting Story Characters acting together in scene environment)
 * 4. Multi-Reference Story Keyframe synthesis (POST /api/v2/images/edits with images[] of Hero & Companion) -> Video Animation (POST /api/v2/videos/animations)
 * 5. HTTP 429 RPM Rate-Limit recovery (Retry-After / 60s window) & sequential execution so ALL 4/4 scenes (including Scene 1 & Scene 4) animate without static drops
 * 6. Scene 1 immediate motion check (no static split-poster overlay when deapiLoopMp4 is present) & Workflow YAML secret wiring
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
const startMarker = "// deAPI.ai 3D Cartoon Storyboard + Multi-Character Action Animation Engine";
const endMarker = "async function renderEpisodeMp4(";
const startIdx = runnerCode.indexOf(startMarker);
const endIdx = runnerCode.indexOf(endMarker);
assert.ok(startIdx > 0 && endIdx > startIdx, "deAPI story animation engine block must exist in runner script");

const extractedBlock = runnerCode.slice(startIdx, endIdx);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const engineFactory = new Function(
  "fs",
  "path",
  "execFileAsync",
  "sleep",
  `${extractedBlock}
  return {
    snapDimensionToGrid,
    scoreDeapiImg2VideoModel,
    scoreDeapiImg2ImgModel,
    scoreDeapiTxt2ImgModel,
    computeDeapiRateLimitWaitMs,
    discoverActiveDeapiModelsCatalog,
    discoverActiveDeapiImg2VideoModel,
    resolveDeapiModelRenderParams,
    describeCharacterVisualAppearanceEn,
    inferSupportingCastAndSettingEn,
    buildMultiCharacterStoryPrompts,
    buildCartoonSceneMotionPrompt,
    cropCharacterReferenceWithoutBanner,
    buildCleanLocalDuoStoryFrameJpg,
    prepareDeapiInputFrameJpg,
    generateAnimatedSceneClipViaDeapi,
    resetCache: () => {
      _cachedDeapiModelInfo = null;
      _cachedDeapiCatalog = null;
      _lastDeapiSubmissionAtMs = 0;
    }
  };`
);

const engine = engineFactory(fs, path, execFileAsync, sleep);

test("GitHub Actions workflows pass DEAPI_API_KEY secret, disable static poster on animated Scene 1, and run sequentially", () => {
  assert.match(ytWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(fbWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(ytWorkflow, /timeout-minutes:\s*90/);
  assert.match(fbWorkflow, /timeout-minutes:\s*90/);
  assert.match(
    runnerCode,
    /const isScene1WithPoster = i === 0 && isShort && !deapiLoopMp4 && fs\.existsSync\(verticalPosterPath\);/,
    "Scene 1 must NOT overlay static split poster when deapiLoopMp4 is active"
  );
  assert.ok(!runnerCode.includes("DEAPI_CONCURRENCY = 2"), "Parallel burst concurrency must be removed to prevent HTTP 429 drops");
});

test("Multi-character story prompts include BOTH Hero + Companion + Supporting Cast acting together in scene environment", () => {
  const storyPrompts = engine.buildMultiCharacterStoryPrompts({
    heroName: "شوشو القبطان الصغير",
    companionName: "مرجان الدلفين المرح",
    speakerName: "شوشو القبطان الصغير",
    sceneTitle: "إنقاذ الحوت الصغير في البحر",
    dialogueArabic: "بص يا مرجان! الحوت الصغير محتاج مساعدتنا عند الشعب المرجانية، يلا نعوم سوا وننقذه!",
    aiVisualScenePromptEn: "Captain Shoushou and Marjan the blue dolphin swimming side by side toward the trapped baby whale to free it gently",
    sceneIndex: 2,
    totalScenes: 4,
    topicText: "شوشو ومرجان وإنقاذ الحوت الصغير في البحر",
  });

  assert.match(storyPrompts.sceneKeyframePrompt, /Captain Shoushou/i);
  assert.match(storyPrompts.sceneKeyframePrompt, /Marjan/i);
  assert.match(storyPrompts.sceneKeyframePrompt, /baby blue whale/i);
  assert.match(storyPrompts.sceneKeyframePrompt, /ocean bay|coral/i);
  assert.match(storyPrompts.sceneKeyframePrompt, /NO text, NO letters, NO logos, NO banners/i);

  assert.match(storyPrompts.videoMotionPrompt, /Captain Shoushou/i);
  assert.match(storyPrompts.videoMotionPrompt, /Marjan/i);
  assert.match(storyPrompts.videoMotionPrompt, /baby blue whale/i);
  assert.match(storyPrompts.videoMotionPrompt, /moving naturally together/i);

  // Verify RPM 429 Retry-After calculation covers full 60s window in production mode
  const prevFast = process.env.DEAPI_FAST_TEST_BACKOFF;
  delete process.env.DEAPI_FAST_TEST_BACKOFF;
  try {
    const fakeHeaders = new Map([["retry-after", "58"]]);
    const waitMs = engine.computeDeapiRateLimitWaitMs(fakeHeaders, 1);
    assert.ok(waitMs >= 59_000, `Expected >=59000ms wait for Retry-After:58, got ${waitMs}`);
    const defaultAttempt3Wait = engine.computeDeapiRateLimitWaitMs(new Map(), 3);
    assert.ok(defaultAttempt3Wait >= 60_000, `Attempt 3 wait must cover 60s RPM window, got ${defaultAttempt3Wait}`);
  } finally {
    if (prevFast !== undefined) process.env.DEAPI_FAST_TEST_BACKOFF = prevFast;
  }
});

test("Banner-free portrait cropper strips bottom nameplate banner from 1024x1024 char_*.jpg cards", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-crop-"));
  try {
    const rawPortrait = path.join(repoRoot, "src/assets/images/char_shoushou_boy_captain_1790462024983.jpg");
    const croppedOut = path.join(tmpDir, "clean_shoushou.jpg");
    const outPath = await engine.cropCharacterReferenceWithoutBanner(rawPortrait, croppedOut);
    assert.equal(outPath, croppedOut);
    assert.ok(fs.existsSync(croppedOut) && fs.statSync(croppedOut).size > 5000);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", croppedOut,
    ]);
    assert.equal(stdout.trim(), "768,768");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("End-to-end 4-Scene Episode Simulation with HTTP 429 RPM spikes: Multi-Ref Keyframe (images/edits) + Video Animation (videos/animations) animates ALL 4/4 scenes (including Scene 1 & Scene 4)", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-4scenes-"));
  let server = null;
  const origBaseUrl = process.env.DEAPI_BASE_URL;
  const origFastBackoff = process.env.DEAPI_FAST_TEST_BACKOFF;
  process.env.DEAPI_FAST_TEST_BACKOFF = "1";

  try {
    // Synthetic cloud story keyframe JPEG & animated MP4
    const mockCloudKeyframeJpg = path.join(tmpDir, "mock_cloud_story_frame.jpg");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=512x768:rate=1", "-frames:v", "1", mockCloudKeyframeJpg,
    ]);
    const mockCloudAnimatedMp4 = path.join(tmpDir, "mock_cloud_anim.mp4");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=512x768:rate=24", "-c:v", "libx264", "-pix_fmt", "yuv420p", mockCloudAnimatedMp4,
    ]);

    let imageEditsCount = 0;
    let videoAnimAttempts = 0;
    let videoAnimAccepted = 0;
    let sawMultiImagesField = false;
    let jobCounter = 0;
    const jobKindById = new Map();

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
                inference_types: ["img2video", "txt2video"],
                info: {
                  defaults: { width: 768, height: 512, frames: 73, fps: 24, steps: 20, guidance: 3.0 },
                  limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32, min_frames: 25, max_frames: 121 },
                  features: { supports_steps: true, supports_guidance: true, supports_negative_prompt: true },
                },
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
          const bodyStr = Buffer.concat(chunks).toString("latin1");
          if (bodyStr.includes('name="images[]"') && bodyStr.includes("hero_ref.jpg") && bodyStr.includes("companion_ref.jpg")) {
            sawMultiImagesField = true;
          }
          imageEditsCount++;
          const id = `img_job_${++jobCounter}`;
          jobKindById.set(id, "img");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "POST" && req.url === "/api/v2/videos/animations") {
        videoAnimAttempts++;
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          // Simulate exact Run 40152782287 failure scenario: inject HTTP 429 on Scene 1 (first attempt) & Scene 4!
          if (videoAnimAttempts === 1 || videoAnimAttempts === 5) {
            res.writeHead(429, {
              "Content-Type": "application/json",
              "Retry-After": "1",
            });
            res.end(JSON.stringify({ message: "Too Many Attempts." }));
            return;
          }
          videoAnimAccepted++;
          const id = `vid_job_${++jobCounter}`;
          jobKindById.set(id, "vid");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: id } }));
        });
        return;
      }

      if (req.method === "GET" && req.url.startsWith("/api/v2/jobs/")) {
        const id = req.url.split("/").pop();
        const kind = jobKindById.get(id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: {
              status: "done",
              result_url: kind === "img" ? `http://${host}/download/frame.jpg` : `http://${host}/download/clip.mp4`,
            },
          })
        );
        return;
      }

      if (req.method === "GET" && req.url === "/download/frame.jpg") {
        const buf = fs.readFileSync(mockCloudKeyframeJpg);
        res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": buf.length });
        res.end(buf);
        return;
      }

      if (req.method === "GET" && req.url === "/download/clip.mp4") {
        const buf = fs.readFileSync(mockCloudAnimatedMp4);
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": buf.length });
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

    const heroImgPath = path.join(repoRoot, "src/assets/images/char_shoushou_boy_captain_1790462024983.jpg");
    const compImgPath = path.join(repoRoot, "src/assets/images/char_marjan_playful_dolphin_1790462076093.jpg");

    const renderedLoops = [];
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const mp4 = await engine.generateAnimatedSceneClipViaDeapi({
        apiKey: "test_deapi_key",
        rawImgPath: sIdx % 2 === 0 ? heroImgPath : compImgPath,
        heroImgPath,
        compImgPath,
        heroName: "شوشو القبطان الصغير",
        companionName: "مرجان الدلفين المرح",
        speakerName: sIdx % 2 === 0 ? "شوشو القبطان الصغير" : "مرجان الدلفين المرح",
        sceneTitle: `مشهد ${sIdx + 1}`,
        dialogueArabic: "يلا يا مرجان نساعد الحوت الصغير سوا في البحر!",
        aiVisualScenePromptEn: "Captain Shoushou and Marjan swimming side by side helping the baby whale",
        sceneIndex: sIdx,
        totalScenes: 4,
        topicText: "شوشو ومرجان وإنقاذ الحوت الصغير في البحر",
        isShort: true,
        outW: 720,
        outH: 1280,
        tmpDir,
        formatTag: "short_9_16",
      });
      renderedLoops.push(mp4);
    }

    assert.equal(renderedLoops.length, 4, "ALL 4 scenes (including Scene 1 and Scene 4) must animate successfully");
    assert.ok(sawMultiImagesField, "Must send BOTH hero_ref.jpg and companion_ref.jpg in images[] to /api/v2/images/edits");
    assert.equal(imageEditsCount, 4, "Every scene must synthesize a multi-character story keyframe");
    assert.equal(videoAnimAccepted, 4, "All 4 scenes must complete video animation after recovering from HTTP 429");
    for (const f of renderedLoops) {
      assert.ok(fs.existsSync(f) && fs.statSync(f).size > 2000, `Animated loop file must exist: ${f}`);
    }
  } finally {
    if (origBaseUrl === undefined) delete process.env.DEAPI_BASE_URL;
    else process.env.DEAPI_BASE_URL = origBaseUrl;
    if (origFastBackoff === undefined) delete process.env.DEAPI_FAST_TEST_BACKOFF;
    else process.env.DEAPI_FAST_TEST_BACKOFF = origFastBackoff;
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
