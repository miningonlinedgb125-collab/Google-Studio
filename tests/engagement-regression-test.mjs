#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const runner = fs.readFileSync(new URL("../scripts/noreen-kids-youtube-runner.mjs", import.meta.url), "utf8");
const schedule = JSON.parse(fs.readFileSync(new URL("../noreen-kids-schedule.json", import.meta.url), "utf8"));

// Hook: the first-scene validator must not accept a plain "ازيكم" opening as sufficient.
// It must be able to inject the dedicated "يا خبر" hook.
assert.match(
  runner,
  /! \/\^\(يا خبر\|الحقوا\|الحقني\|بص\|بصوا\|شايف\|شايفين\|يلا بينا\)\//,
  "First-scene hook must require the dedicated يا خبر/urgent opening"
);

// Scene 8: final scene must contain an interactive challenge and comments CTA.
assert.match(runner, /المشهد الثامن والتحدي الأخير/);
assert.match(runner, /سؤال الشطار/);
assert.match(runner, /اكتبوا إجابتكم في التعليقات/);

// YouTube first comment must use commentThreads.insert.
assert.match(runner, /postYouTubeFirstComment/);
assert.match(runner, /www.googleapis.com\/youtube\/v3\/commentThreads\?part=snippet/);
assert.match(runner, /topLevelComment/);

// Facebook first comment must be posted to the uploaded video comments edge.
assert.match(runner, /postFacebookFirstComment/);
assert.match(runner, /graph\.facebook\.com\/v21\.0\/\$\{encodeURIComponent\(videoId\)\}\/comments/);

// Smart responders must exist for both platforms.
assert.match(runner, /scanAndAutoReplyYouTubeComments/);
assert.match(runner, /scanAndAutoReplyFacebookVideoComments/);
assert.match(runner, /generateSmartCommentReply/);
assert.match(runner, /allThreadsRelatedToChannelId/);
assert.match(runner, /nextPageToken/);
assert.match(runner, /\/videos\?fields=id,message,created_time&limit=50/);
assert.match(runner, /facebookRepliedCommentIds/);
assert.match(runner, /lastFacebookAutoCommentScanAtCairo/);

// Engagement must be explicitly enabled and must not be tied to upload success.
assert.equal(schedule.firstCommentEnabled, true);
assert.equal(schedule.autoCommentResponderEnabled, true);
assert.equal(schedule.facebookAutoCommentResponderEnabled, true);

console.log("PASS: engagement regression contracts (hook + scene 8 + YT/FB comments + smart replies)");

// Regression: story generation must not use the retired Gemini 2.5 Flash model.
assert.doesNotMatch(runner, /model: "gemini-2\\.5-flash"/);
assert.match(runner, /model: "gemini-3\\.8-flash"/);

// Regression: firstCommentId must be scoped outside the YouTube-only block because
// it is included in the per-result record even when YouTube upload is skipped.
assert.match(runner, /let firstCommentId = null;\\n    if \(shouldUploadToYouTube && accessToken\)/);


// Regression: engagement_only must be a real run mode and must not enter video task generation.
assert.match(runner, /s\.includes\("engagement_only"\)/);
assert.match(runner, /if \(runMode === "engagement_only"\)/);
assert.match(runner, /runMode !== "engagement_only" && shouldUploadToYouTube/);
assert.match(runner, /publishDailyInteractive3DPhotoPostForRunner/);

// Regression: engagement helpers use the current shared Facebook Page token resolver.
assert.equal(runner.includes("resolveTrueFacebookPageAccessTokenForRunner"), false);
assert.equal(runner.includes("rawToken: rawPageAccessToken"), true);
assert.equal(runner.includes("targetPageId: pageId"), true);

// Regression: interactive 3D posts must not repeat a previously published
// hero/companion/theme combination stored in interactivePhotoPostsLog.
assert.match(runner, /interactivePhotoPostsLog/);
assert.match(runner, /previousInteractiveKeys/);
assert.match(runner, /isPreviouslyPublishedInteractivePost/);
assert.match(runner, /previousInteractiveHeroNames/);
assert.match(runner, /const previousInteractiveKeys = new Set/);
assert.match(runner, /const hasUnusedInteractiveTheme =/);
assert.match(runner, /const availableThemes = interactiveThemes\\.filter/);
assert.match(runner, /!previousInteractiveKeys\\.has/);
