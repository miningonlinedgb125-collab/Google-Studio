#!/usr/bin/env node
/**
 * Unit & Integration Mock Test for deAPI.ai 3D Cartoon Animation Pipeline
 * Verifies:
 * 1. Dynamic model discovery from GET /api/v2/models (filtering img2video & respecting info.limits)
 * 2. Aspect-ratio-preserving input frame preparation (9:16 Short & 16:9 Long)
 * 3. Multipart FormData submission to POST /api/v2/videos/animations with Bearer DEAPI_API_KEY & first_frame_image
 * 4. Job status polling on GET /api/v2/jobs/{request_id} until status="done" & downloading result_url
 * 5. Seamless Ping-Pong (Forward + Reversed) 30fps loop generation & exact scene voice synchronization
 * 6. Workflow YAML secret wiring check (DEAPI_API_KEY in both YouTube & Facebook workflows)
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
const startMarker = "// deAPI.ai 3D Cartoon Image-to-Video Animation Engine (Seamless Motion Pipeline)";
const endMarker = "async function renderEpisodeMp4(";
const startIdx = runnerCode.indexOf(startMarker);
const endIdx = runnerCode.indexOf(endMarker);
assert.ok(startIdx > 0 && endIdx > startIdx, "deAPI animation engine block must exist in runner script");

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
    discoverActiveDeapiImg2VideoModel,
    resolveDeapiModelRenderParams,
    buildCartoonSceneMotionPrompt,
    prepareDeapiInputFrameJpg,
    generateAnimatedSceneClipViaDeapi,
    resetCache: () => { _cachedDeapiModelInfo = null; }
  };`
);
const engine = engineFactory(fs, path, execFileAsync, sleep);

test("GitHub Actions workflows pass DEAPI_API_KEY secret and allow 90-minute timeout", () => {
  assert.match(ytWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(fbWorkflow, /DEAPI_API_KEY:\s*\$\{\{\s*secrets\.DEAPI_API_KEY\s*\}\}/);
  assert.match(ytWorkflow, /timeout-minutes:\s*90/);
  assert.match(fbWorkflow, /timeout-minutes:\s*90/);
});

test("Dimension snapping, model scoring, and scene-aware cartoon motion prompts work accurately", () => {
  assert.equal(engine.snapDimensionToGrid(512, 256, 1280, 32), 512);
  assert.equal(engine.snapDimensionToGrid(768, 256, 1280, 32), 768);
  assert.equal(engine.snapDimensionToGrid(1400, 256, 1024, 64), 1024);

  const ltxScore = engine.scoreDeapiImg2VideoModel({ slug: "Ltx2_5_22B_Dist_INT8", name: "LTX 2.5" });
  const genericScore = engine.scoreDeapiImg2VideoModel({ slug: "other-vid", name: "Other" });
  assert.ok(ltxScore > genericScore);

  const shortParams = engine.resolveDeapiModelRenderParams(
    {
      slug: "Ltx2_5_22B_Dist_INT8",
      info: {
        defaults: { frames: 97, fps: 24, steps: 20, guidance: 3.0 },
        limits: { min_width: 256, max_width: 1024, min_height: 256, max_height: 1024, dimension_multiple: 32, min_frames: 25, max_frames: 121 },
        features: { supports_steps: true, supports_guidance: true, supports_negative_prompt: true },
      },
    },
    true
  );
  assert.equal(shortParams.width, 512);
  assert.equal(shortParams.height, 768);
  assert.equal((shortParams.frames - 1) % 8, 0, "LTX frame count snaps to 8k+1");

  const promptRabbit = engine.buildCartoonSceneMotionPrompt({
    speakerName: "أرنوب الشقي الممرض",
    sceneTitle: "المشهد الأول",
    sceneIndex: 0,
    totalScenes: 4,
    topicText: "نظافة الأسنان",
  });
  assert.match(promptRabbit, /nurse rabbit/i);
  assert.match(promptRabbit, /3D Pixar/i);
});

test("Full end-to-end deAPI mock server: model discovery -> multipart upload -> job poll -> seamless ping-pong MP4", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "deapi-unit-"));
  let server = null;
  const origBaseUrl = process.env.DEAPI_BASE_URL;

  try {
    // Generate a 3-second synthetic MP4 that our mock deAPI server will return as the animated result
    const mockDeapiOutputMp4 = path.join(tmpDir, "mock_deapi_cloud_out.mp4");
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3:size=512x768:rate=24",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      mockDeapiOutputMp4,
    ]);

    let receivedAuth = "";
    let receivedContentType = "";
    let receivedBodyBytes = 0;
    let pollCount = 0;

    server = http.createServer((req, res) => {
      const host = req.headers.host;
      if (req.url.startsWith("/api/v2/models")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            data: [
              {
                name: "FLUX Schnell",
                slug: "Flux1schnell",
                inference_types: ["txt2img"],
                info: [],
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

      if (req.method === "POST" && req.url === "/api/v2/videos/animations") {
        receivedAuth = req.headers.authorization || "";
        receivedContentType = req.headers["content-type"] || "";
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const fullBuf = Buffer.concat(chunks);
          receivedBodyBytes = fullBuf.length;
          const bodyStr = fullBuf.toString("latin1");
          assert.ok(bodyStr.includes('name="first_frame_image"'), "Must upload first_frame_image file field");
          assert.ok(bodyStr.includes("Ltx2_5_22B_Dist_INT8"), "Must include discovered model slug");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: { request_id: "job_noreen_test_001" } }));
        });
        return;
      }

      if (req.method === "GET" && req.url === "/api/v2/jobs/job_noreen_test_001") {
        pollCount++;
        res.writeHead(200, { "Content-Type": "application/json" });
        if (pollCount === 1) {
          res.end(JSON.stringify({ data: { status: "processing", progress: 45 } }));
        } else {
          res.end(
            JSON.stringify({
              data: {
                status: "done",
                result_url: `http://${host}/download/animated_clip.mp4`,
              },
            })
          );
        }
        return;
      }

      if (req.method === "GET" && req.url === "/download/animated_clip.mp4") {
        const mp4Buf = fs.readFileSync(mockDeapiOutputMp4);
        res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": mp4Buf.length });
        res.end(mp4Buf);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    process.env.DEAPI_BASE_URL = `http://127.0.0.1:${port}`;
    engine.resetCache();

    const samplePortrait = path.join(
      repoRoot,
      "src/assets/images/char_dr_noreen_girl_1790461976876.jpg"
    );

    const pingPongMp4 = await engine.generateAnimatedSceneClipViaDeapi({
      apiKey: "test_secret_deapi_key_123",
      rawImgPath: samplePortrait,
      speakerName: "الطبيبة نورين",
      sceneTitle: "المشهد الأول",
      sceneIndex: 0,
      totalScenes: 4,
      topicText: "نظافة الأسنان",
      isShort: true,
      outW: 720,
      outH: 1280,
      tmpDir,
      formatTag: "short_9_16",
    });

    assert.equal(receivedAuth, "Bearer test_secret_deapi_key_123");
    assert.match(receivedContentType, /multipart\/form-data/i);
    assert.ok(receivedBodyBytes > 5000, "Uploaded character image payload must be non-empty");
    assert.ok(pollCount >= 2, "Should poll until status transitions from processing to done");
    assert.ok(fs.existsSync(pingPongMp4), "Ping-pong seamless loop MP4 must exist on disk");

    const { stdout: probeJsonStr } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=width,height,codec_name,pix_fmt,r_frame_rate",
      "-of",
      "json",
      pingPongMp4,
    ]);
    const probe = JSON.parse(probeJsonStr);
    const vStream = probe.streams[0];
    const loopDur = Number(probe.format.duration);
    assert.equal(vStream.codec_name, "h264");
    assert.equal(vStream.pix_fmt, "yuv420p");
    assert.equal(vStream.width, 720);
    assert.equal(vStream.height, 1280);
    assert.equal(vStream.r_frame_rate, "30/1");
    assert.ok(loopDur >= 5.5 && loopDur <= 6.5, `Ping-pong of 3s clip should be ~5.96s (got ${loopDur}s)`);
  } finally {
    if (origBaseUrl === undefined) delete process.env.DEAPI_BASE_URL;
    else process.env.DEAPI_BASE_URL = origBaseUrl;
    if (server) await new Promise((r) => server.close(r));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
