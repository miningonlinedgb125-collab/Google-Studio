#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePlatformRenderProfile,
  buildFacebookCameraFramingConfig,
  selectShortMicroReelScenes,
  buildLongTeaserMicroReelEpisode,
  computeMicroReelTimingPlan,
  validatePlatformVideoFfprobeReport,
  validateFacebookVideoFfprobeReport,
} from "../scripts/facebook-micro-reel-helpers.mjs";
import { validateAndSanitizeEgyptianDialogue } from "./short-pipeline-unit-test.mjs";

test("resolvePlatformRenderProfile keeps YT 720x1280 / 1280x720 and FB 1080x1920 with Micro-Format flags", () => {
  const ytShort = resolvePlatformRenderProfile("short_9_16", "youtube");
  assert.equal(ytShort.W, 720);
  assert.equal(ytShort.H, 1280);
  assert.equal(ytShort.isFb, false);
  assert.equal(ytShort.isMicroFormat, true);
  assert.equal(ytShort.overscanW % 2, 0);
  assert.equal(ytShort.overscanH % 2, 0);

  const ytLong = resolvePlatformRenderProfile("long_16_9", "youtube");
  assert.equal(ytLong.W, 1280);
  assert.equal(ytLong.H, 720);
  assert.equal(ytLong.isFb, false);
  assert.equal(ytLong.isMicroFormat, false);
  assert.equal(ytLong.overscanW % 2, 0);
  assert.equal(ytLong.overscanH % 2, 0);

  const fbLong = resolvePlatformRenderProfile("long_16_9", "facebook");
  assert.equal(fbLong.W, 1080);
  assert.equal(fbLong.H, 1920);
  assert.equal(fbLong.isFb, true);
  assert.equal(fbLong.isFbMicroReel, false);
  assert.equal(fbLong.isMicroFormat, false);

  const fbReel = resolvePlatformRenderProfile("short_9_16", "facebook_reel");
  assert.equal(fbReel.W, 1080);
  assert.equal(fbReel.H, 1920);
  assert.equal(fbReel.isFb, true);
  assert.equal(fbReel.isFbMicroReel, true);
  assert.equal(fbReel.isMicroFormat, true);
});

test("buildFacebookCameraFramingConfig enables 3.6s multi-shot cuts & instant start on BOTH YouTube and Facebook", () => {
  const ytShortCam = buildFacebookCameraFramingConfig({
    isFb: false,
    isVertical: true,
    isFbMicroReel: false,
    isMicroFormat: true,
    sceneIndex: 0,
    panRangeX: 102,
    panRangeY: 180,
    dur: 17,
  });
  assert.equal(ytShortCam.enableMultiShot, true);
  assert.equal(ytShortCam.shotIntervalSec, 3.6);
  assert.equal(ytShortCam.isScene1WithPosterAllowed, false);

  const ytLongScene0Cam = buildFacebookCameraFramingConfig({
    isFb: false,
    isVertical: false,
    isFbMicroReel: false,
    isMicroFormat: false,
    sceneIndex: 0,
    panRangeX: 180,
    panRangeY: 102,
    dur: 40,
  });
  assert.equal(ytLongScene0Cam.enableMultiShot, true);
  assert.equal(ytLongScene0Cam.shotIntervalSec, 3.6);

  const ytLongScene2Cam = buildFacebookCameraFramingConfig({
    isFb: false,
    isVertical: false,
    isFbMicroReel: false,
    isMicroFormat: false,
    sceneIndex: 2,
    panRangeX: 180,
    panRangeY: 102,
    dur: 40,
  });
  assert.equal(ytLongScene2Cam.enableMultiShot, true);
  assert.equal(ytLongScene2Cam.shotIntervalSec, 6.0);

  const fbReelCam = buildFacebookCameraFramingConfig({
    isFb: true,
    isVertical: true,
    isFbMicroReel: true,
    isMicroFormat: true,
    sceneIndex: 0,
    panRangeX: 152,
    panRangeY: 268,
    dur: 18,
  });
  assert.equal(fbReelCam.enableMultiShot, true);
  assert.equal(fbReelCam.shotIntervalSec, 3.6);
  assert.equal(fbReelCam.isScene1WithPosterAllowed, false);
});

test("selectShortMicroReelScenes chooses 2 turns when <= 20.5s or 1 hook turn otherwise", () => {
  const ep = {
    id: "ep_1",
    title: "سر غسل السنان قبل النوم",
    mainCharacterName: "الطبيبة نورين",
    companionName: "أرنوب الشقي الممرض",
    moralLesson: "النظافة بتحمينا من التسوس",
  };
  const twoShortTurns = [
    { scene: { speakerName: "الطبيبة نورين", dialogueArabic: "يا خبر!" }, voiceDurSec: 9.2, durationSec: 9.65, audioPath: "/tmp/a.wav" },
    { scene: { speakerName: "أرنوب الشقي الممرض", dialogueArabic: "بجد!" }, voiceDurSec: 8.8, durationSec: 9.25, audioPath: "/tmp/b.wav" },
  ];
  const planTwo = selectShortMicroReelScenes(ep, twoShortTurns, 15, 20.5);
  assert.equal(planTwo.selectedPreparedScenes.length, 2);
  assert.equal(planTwo.microEpisode.isFbMicroReel, true);
  assert.match(planTwo.microEpisode.facebookPackage.facebookTitleAr, /ريلز سريع/);

  const longTurns = [
    { scene: { speakerName: "الطبيبة نورين", dialogueArabic: "يا خبر!" }, voiceDurSec: 16.5, durationSec: 16.95, audioPath: "/tmp/a.wav" },
    { scene: { speakerName: "أرنوب الشقي الممرض", dialogueArabic: "بجد!" }, voiceDurSec: 15.0, durationSec: 15.45, audioPath: "/tmp/b.wav" },
  ];
  const planOne = selectShortMicroReelScenes(ep, longTurns, 15, 20.5);
  assert.equal(planOne.selectedPreparedScenes.length, 1);
});

test("buildLongTeaserMicroReelEpisode builds 2 Egyptian Cairene turns + YT & FB packages", () => {
  const longEp = {
    id: "long_ep_9",
    title: "رحلة الكوكب الأزرق",
    mainCharacterName: "القبطان جنى",
    companionName: "الروبوت بلبل",
    moralLesson: "التعاون والفضول العلمي",
  };
  const teaser = buildLongTeaserMicroReelEpisode(longEp, "egyptian");
  assert.equal(teaser.scenes.length, 2);
  assert.equal(teaser.isFbTeaserReel, true);
  assert.match(teaser.youtubePackage.videoTitleAr, /#Shorts/);
  assert.match(teaser.facebookPackage.facebookTitleAr, /تشويق الحلقة/);
  for (let i = 0; i < teaser.scenes.length; i++) {
    const check = validateAndSanitizeEgyptianDialogue(teaser.scenes[i].dialogueArabic, i, 2);
    assert.equal(check.replacedFindings.length, 0);
    assert.ok(check.egyptianMarkers.length >= 2);
  }
});

test("computeMicroReelTimingPlan & validatePlatformVideoFfprobeReport enforce YT and FB gates", () => {
  const normal = computeMicroReelTimingPlan([{ voiceDurSec: 17.5 }], 15, 20.5);
  assert.equal(normal.needsTempo, false);

  const fast = computeMicroReelTimingPlan([{ voiceDurSec: 23.0 }], 15, 20.5);
  assert.equal(fast.needsTempo, true);
  assert.ok(fast.speedRatio > 1.04 && fast.speedRatio <= 1.42);

  const okYtShort = {
    format: { duration: "18.0" },
    streams: [
      { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 720, height: 1280, duration: "18.0" },
      { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2, duration: "18.0" },
    ],
  };
  assert.equal(
    validatePlatformVideoFfprobeReport(okYtShort, { platform: "youtube", isShort: true }).valid,
    true
  );

  const badYtShortLongDur = { ...okYtShort, format: { duration: "65.0" } };
  assert.equal(
    validatePlatformVideoFfprobeReport(badYtShortLongDur, { platform: "youtube", isShort: true }).valid,
    false
  );

  const okFbReel = {
    format: { duration: "18.4" },
    streams: [
      { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1080, height: 1920, duration: "18.4" },
      { codec_type: "audio", codec_name: "aac", sample_rate: "48000", channels: 2, duration: "18.4" },
    ],
  };
  assert.equal(validateFacebookVideoFfprobeReport(okFbReel, { expectMicroReel: true }).valid, true);
});
