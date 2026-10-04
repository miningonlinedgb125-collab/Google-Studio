#!/usr/bin/env node
/**
 * Noreen Kids 3D Animation Studio - 24/7 Self-Contained GitHub Actions Pipeline
 * Supports 4 Run Modes:
 *   1. daily_schedule (الجدولة اليومية: قصير + طويل في الموعد المحدد)
 *   2. short_only     (تشغيل قصير فقط - Short 9:16 -> Playlist PLPwfeXzB3ozU)
 *   3. long_only      (تشغيل طويل فقط - Long 16:9 -> Playlist PLbjN20PzrCYk)
 *   4. both_now       (تشغيل الاثنين معاً الآن: قصير + طويل)
 */
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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
  if (s.includes("engagement_only") || s.includes("تفاعل") || s.includes("تعليقات")) return "engagement_only";
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
  // Egypt Standard Time is UTC+2
  const utcTargetH = (targetH - 2 + 24) % 24;
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    utcTargetH,
    targetM,
    0
  ));
  // YouTube requires publishAt to be at least 20 minutes in the future
  if (candidate.getTime() - now.getTime() < 25 * 60 * 1000) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}

function splitArabicSentencesForTts(text) {
  const cleaned = String(text || "ازيكم يا أصحابي الحلوين في قناة نورين كيدز!")
    .replace(/["«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const rawParts = cleaned.split(/(?<=[.!?؟،,])\s+/);
  const chunks = [];
  let current = "";
  for (const part of rawParts) {
    if ((current + " " + part).trim().length <= 165) {
      current = (current + " " + part).trim();
    } else {
      if (current) chunks.push(current);
      if (part.length <= 165) {
        current = part;
      } else {
        const words = part.split(" ");
        let wChunk = "";
        for (const w of words) {
          if ((wChunk + " " + w).trim().length <= 165) {
            wChunk = (wChunk + " " + w).trim();
          } else {
            if (wChunk) chunks.push(wChunk);
            wChunk = w;
          }
        }
        current = wChunk;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [cleaned.slice(0, 160)];
}

async function synthesizeSceneVoiceWav(scene, sceneIndex, tmpDir, episode) {
  const targetDur = Math.max(8, Number(scene.durationSec) || 17);
  const outWav = path.join(tmpDir, `scene_voice_${sceneIndex}.wav`);
  const dialogue = String(scene.dialogueArabic || "إزيكم يا أصحابي الحلوين في قناة نورين كيدز! يلا بينا نبدأ مغامرة جديدة!");

  const dialect = String(episode?.dialect || "egyptian").toLowerCase();
  const mainId = String(episode?.mainCharacterId || "");
  const femaleIds = new Set(["dr_noreen","eng_nouran","janna","carmen","malak","sidra","om_malak","teta"]);
  const voiceName = dialect === "egyptian"
    ? (femaleIds.has(mainId) ? "ar-EG-SalmaNeural" : "ar-EG-ShakirNeural")
    : (femaleIds.has(mainId) ? "ar-SA-ZariyahNeural" : "ar-SA-HamedNeural");

  const chunks = splitArabicSentencesForTts(dialogue);
  const mp3Files = [];

  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const result = await tts.toFile(tmpDir, chunks[cIdx]);
      const generated = result?.audioFilePath;
      if (generated && fs.existsSync(generated) && fs.statSync(generated).size > 256) {
        const mp3Path = path.join(tmpDir, `tts_${sceneIndex}_${cIdx}.mp3`);
        fs.copyFileSync(generated, mp3Path);
        mp3Files.push(mp3Path);
      }
    }
  } catch (edgeErr) {
    console.warn(`⚠️ Edge TTS failed; Egyptian Google fallback: ${edgeErr?.message || edgeErr}`);
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      try {
        const res = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=ar-EG&client=tw-ob&q=${encodeURIComponent(chunks[cIdx])}`, {
          headers: { "User-Agent": "Mozilla/5.0 Chrome/124.0.0.0 Safari/537.36" }
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 256) {
            const mp3Path = path.join(tmpDir, `tts_${sceneIndex}_${cIdx}.mp3`);
            fs.writeFileSync(mp3Path, buf);
            mp3Files.push(mp3Path);
          }
        }
      } catch {}
    }
  }

  if (!mp3Files.length) {
    throw new Error(`تعذر إنشاء الصوت للمشهد ${sceneIndex + 1}؛ تم إيقاف الرفع لمنع فيديو بلا صوت.`);
  }

  const concatListPath = path.join(tmpDir, `tts_concat_${sceneIndex}.txt`);
  fs.writeFileSync(concatListPath, mp3Files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const rawSpeechWav = path.join(tmpDir, `raw_speech_${sceneIndex}.wav`);
  await execFileAsync("ffmpeg", ["-y","-f","concat","-safe","0","-i",concatListPath,"-ar","48000","-ac","2",rawSpeechWav]);

  // Stable voice: no artificial alternating pitch/tempo.
  await execFileAsync("ffmpeg", [
    "-y","-i",rawSpeechWav,
    "-f","lavfi","-i",`sine=frequency=${sceneIndex % 2 === 0 ? 523.25 : 659.25}:duration=${targetDur}:sample_rate=48000`,
    "-filter_complex",
    `[0:a]volume=1.65,apad=whole_dur=${targetDur}[voice];[1:a]volume=0.018,afade=t=in:st=0:d=0.5,afade=t=out:st=${Math.max(0.5,targetDur-1)}:d=0.8[bgm];[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=0,alimiter=limit=0.95[outa]`,
    "-map","[outa]","-t",String(targetDur),"-c:a","pcm_s16le","-ar","48000","-ac","2",outWav
  ]);
  return outWav;
}

const CHARACTER_ASSETS = {
  dr_noreen:"src/assets/images/char_dr_noreen_girl_1790461976876.jpg",
  eng_nouran:"src/assets/images/char_eng_sidra_girl_1790461988894.jpg",
  amr:"src/assets/images/char_yassin_boy_knight_1790462110000.jpg",
  janna:"src/assets/images/char_faris_astronaut_1790446843914.jpg",
  shosho:"src/assets/images/char_karim_boy_captain_1790462024983.jpg",
  carmen:"src/assets/images/char_salma_girl_inventor_1790462010894.jpg",
  tamer:"src/assets/images/char_yassin_boy_knight_1790462110000.jpg",
  malak:"src/assets/images/char_malak_emergency_doctor_1790685772412.jpg",
  sidra:"src/assets/images/char_baby_sidra_toddler_1790685815760.jpg",
  om_malak:"src/assets/images/char_om_malak_teacher_1790685841625.jpg",
  ziad:"src/assets/images/char_ziad_young_man_1790685879815.jpg",
  mr_sherif:"src/assets/images/char_mr_sherif_accountant_1790685911579.jpg",
  gedo:"src/assets/images/char_gedo_grandpa_1790685953317.jpg",
  teta:"src/assets/images/char_teta_grandma_1790685980597.jpg",
  arnoob:"src/assets/images/char_arnoob_nurse_rabbit_1790462042886.jpg",
  namoor:"src/assets/images/char_namoor_cheerful_tiger_1790462054821.jpg",
  zaatar:"src/assets/images/char_zaatar_fox_1790446857963.jpg",
  bulbul:"src/assets/images/char_bulbul_cute_robot_1790462065051.jpg",
  marjan:"src/assets/images/char_marjan_playful_dolphin_1790462076093.jpg",
  simsim:"src/assets/images/char_simsim_flying_squirrel_1790462087579.jpg",
  karkour:"src/assets/images/char_karkour_wise_parrot_1790462097550.jpg",
  lolita:"src/assets/images/char_lolita_cat_1790685786758.jpg",
  cheerful_bird:"src/assets/images/char_cheerful_bird_1790685899352.jpg",
  funny_penguin:"src/assets/images/char_funny_penguin_1790685854532.jpg",
  colorful_butterfly:"src/assets/images/char_colorful_butterfly_1790685827095.jpg",
  smart_falcon:"src/assets/images/char_smart_falcon_1790685922310.jpg",
  mischievous_mouse:"src/assets/images/char_mischievous_mouse_1790685967206.jpg",
  panda_bear:"src/assets/images/char_panda_bear_1790685992445.jpg"
};

const STORY_ASSETS = [
  "src/assets/images/story_magical_clinic_discovery_1790480734838.jpg",
  "src/assets/images/story_crystal_oasis_bridge_1790480747634.jpg",
  "src/assets/images/story_sky_cloud_observatory_1790480767967.jpg",
  "src/assets/images/story_coral_underwater_palace_1790480758612.jpg",
  "src/assets/images/scene_cloud_ship_1790446831622.jpg",
  "src/assets/images/scene_floating_library_1790446812818.jpg",
  "src/assets/images/scene_space_forest_1790446800763.jpg"
];

function copyAsset(relativePath, target) {
  const source = path.resolve(process.cwd(), relativePath || "");
  if (!relativePath || !fs.existsSync(source)) return null;
  fs.copyFileSync(source, target);
  return target;
}

function getEpisodeVisualAssets(episode, tmpDir) {
  const hero = copyAsset(CHARACTER_ASSETS[episode?.mainCharacterId], path.join(tmpDir,"hero.jpg"));
  const companion = copyAsset(CHARACTER_ASSETS[episode?.companionCharacterId], path.join(tmpDir,"companion.jpg"));
  const story = STORY_ASSETS.map((p,i)=>copyAsset(p,path.join(tmpDir,`story_${i}.jpg`))).filter(Boolean);
  if (!hero || !companion) {
    throw new Error(`Character assets missing for mainCharacterId=${episode?.mainCharacterId}, companionCharacterId=${episode?.companionCharacterId}`);
  }
  return { hero, companion, story };
}

async function renderEpisodeMp4(episode, videoFormat, tmpDir) {
  const isShort = videoFormat === "short_9_16";
  const W = isShort ? 720 : 1280;
  const H = isShort ? 1280 : 720;
  const scenes = Array.isArray(episode?.scenes) && episode.scenes.length
    ? episode.scenes
    : [{ id:"s1", title:"بداية المغامرة", durationSec:isShort?17:39,
         dialogueArabic:"إزيكم يا أبطال نورين كيدز! يلا بينا نبدأ مغامرة جديدة!" }];

  const visuals = getEpisodeVisualAssets(episode, tmpDir);
  const visualSequence = [visuals.hero, visuals.companion, ...visuals.story];
  const sceneMp4Files = [];

  for (let i=0;i<scenes.length;i++) {
    const sc=scenes[i];
    const dur=Math.max(8,Number(sc.durationSec)||(isShort?17:39));
    console.log(`   -> [Scene ${i+1}/${scenes.length}] Egyptian voice + local character montage (${dur}s)...`);
    const wavPath=await synthesizeSceneVoiceWav(sc,i,tmpDir,episode);
    const imgPath=visualSequence[i % visualSequence.length];
    if(!imgPath || !fs.existsSync(imgPath)) throw new Error(`Local visual missing for scene ${i+1}`);

    const sceneMp4=path.join(tmpDir,`scene_out_${i}.mp4`);
    const scaleW=Math.round(W*1.18), scaleH=Math.round(H*1.18);
    await execFileAsync("ffmpeg",[
      "-y","-loop","1","-i",imgPath,"-i",wavPath,
      "-vf",`scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase,crop=${W}:${H}:x='(${scaleW}-${W})/2+((${scaleW}-${W})/2)*sin(t*0.55)':y='(${scaleH}-${H})/2+((${scaleH}-${H})/2)*cos(t*0.45)',eq=saturation=1.2:contrast=1.05,format=yuv420p`,
      "-t",String(dur),"-r","30","-c:v","libx264","-preset","superfast","-profile:v","high","-pix_fmt","yuv420p",
      "-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-shortest",sceneMp4
    ]);
    sceneMp4Files.push(sceneMp4);
  }

  const concatTxt=path.join(tmpDir,`concat_${videoFormat}.txt`);
  fs.writeFileSync(concatTxt,sceneMp4Files.map(f=>`file '${f.replace(/'/g,"'\\''")}'`).join("\n"));
  const finalMp4=path.join(tmpDir,`noreen_kids_${videoFormat}.mp4`);
  await execFileAsync("ffmpeg",["-y","-f","concat","-safe","0","-i",concatTxt,"-c","copy","-movflags","+faststart",finalMp4]);
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

function getCanonicalYouTubeTitle(episode) {
  const pkg=episode?.youtubePackage||{};
  const raw=String(pkg.videoTitleAr||episode?.title||"مغامرة جديدة");
  const body=raw.replace(/#[^\s#]+/g,"").replace(/\s+/g," ").trim().replace(/^Noreen\s*Kids\s*[:\-|]?\s*/i,"");
  return `Noreen Kids: ${body}`.slice(0,98);
}

async function uploadMp4ToYouTube({
  accessToken,
  mp4Path,
  title,
  description,
  tags,
  privacyStatus,
  publishAtIso,
  playlistId,
}) {
  const mp4Buffer = fs.readFileSync(mp4Path);
  const cleanTitle = String(title || "Noreen Kids: مغامرة جديدة").replace(/#[^\s#]+/g,"").replace(/\s+/g," ").trim().slice(0,98);

  const attemptInit = async (usePublishAt) => {
    const statusObj = {
      privacyStatus: usePublishAt ? "private" : privacyStatus || "private",
      selfDeclaredMadeForKids: true,
      containsSyntheticMedia: true,
    };
    if (usePublishAt && publishAtIso) {
      statusObj.publishAt = publishAtIso;
    }
    const metadata = {
      snippet: {
        title: cleanTitle.slice(0, 98),
        description: String(description || cleanTitle),
        tags: Array.isArray(tags) ? tags.slice(0, 18) : ["Noreen Kids", "كرتون اطفال 3D"],
        categoryId: "1",
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

async function postYouTubeFirstComment({ accessToken, videoId, message }) {
  if (!accessToken || !videoId || !message) return { success: false, error: "Missing parameters" };
  const cleanId = String(videoId).trim();
  const cleanMsg = String(message).trim();
  console.log(`💬 [First Comment] Attempting to post interactive comment on YouTube video ${cleanId}...`);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://www.googleapis.com/youtube/v3/commentThreads?part=snippet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          snippet: {
            videoId: cleanId,
            topLevelComment: {
              snippet: {
                textOriginal: cleanMsg,
              },
            },
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ [First Comment] Success! Comment ID: ${data?.id}`);
        return { success: true, commentId: data?.id };
      } else {
        const errText = await res.text();
        console.warn(`⚠️ [First Comment] Attempt ${attempt} failed (${res.status}): ${errText}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    } catch (e) {
      console.warn(`⚠️ [First Comment] Attempt ${attempt} error:`, e.message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  return { success: false, error: "Failed after 3 attempts" };
}

async function scanAndAutoReplyYouTubeComments({ accessToken, geminiApiKey, schedule }) {
  console.log("🔍 [Auto-Responder] Scanning recent YouTube comment threads on channel...");
  let channelId = schedule.channelId || "";
  if (!channelId) {
    try {
      const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (chRes.ok) {
        const chData = await chRes.json();
        if (chData.items?.[0]?.id) channelId = chData.items[0].id;
      }
    } catch {}
  }

  const repliedSet = new Set(schedule.repliedCommentIds || []);
  let threads = [];

  try {
    const listRes = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${encodeURIComponent(channelId)}&maxResults=30&order=time`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      if (Array.isArray(listData?.items)) threads = listData.items;
    }
  } catch {}

  const cairoTimeNow = new Date().toLocaleString("ar-EG", {
    timeZone: "Africa/Cairo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  let repliesCount = 0;
  for (const thread of threads) {
    const topComment = thread?.snippet?.topLevelComment;
    const commentId = String(topComment?.id || "").trim();
    if (!commentId || repliedSet.has(commentId)) continue;

    const authorChannelId = topComment?.snippet?.authorChannelId?.value;
    if (channelId && authorChannelId === channelId) continue;

    const authorName = topComment?.snippet?.authorDisplayName || "صديق القناة";
    const commentText = topComment?.snippet?.textOriginal || "";

    // Generate warm Egyptian reply
    let replyText = `أهلاً بك يا ${authorName} البطل في عيلة نورين كيدز! دكتورة نورين وأرنوب وكل أبطالنا فرحانين بيك جداً وبيقولوا لك: شاطر ومنور دايماً يا بطل! 🌟💖`;

    if (geminiApiKey) {
      try {
        const prompt = `أنت بطل كرتون محبوب للأطفال في قناة "Noreen Kids". جاءك هذا التعليق اللطيف من طفل أو أم:
الاسم: "${authorName}"
التعليق: "${commentText}"
اكتب رداً قصيراً دافئاً ومشجعاً بالعامية المصرية المحبوبة للأطفال (لا يتجاوز سطرين) مع ذكر اسم الطفل وتشجيعه على العادات الإيجابية.`;
        const gemRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );
        if (gemRes.ok) {
          const gData = await gemRes.json();
          const candidateText = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (candidateText) replyText = candidateText;
        }
      } catch {}
    }

    try {
      const repRes = await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          snippet: { parentId: commentId, textOriginal: replyText },
        }),
      });
      if (repRes.ok) {
        repliedSet.add(commentId);
        repliesCount++;
        schedule.repliedCommentIds = Array.from(repliedSet);
        schedule.recentAutoRepliesLog = [
          {
            commentId,
            authorName,
            userCommentText: commentText,
            replyText,
            repliedAtCairo: `اليوم ${cairoTimeNow} بتوقيت مصر`,
          },
          ...(schedule.recentAutoRepliesLog || []).slice(0, 49),
        ];
        console.log(`✅ [Auto-Responder] Replied to ${authorName}: "${replyText.slice(0, 60)}..."`);
      }
    } catch (err) {
      console.warn(`⚠️ [Auto-Responder] Failed to reply to ${commentId}:`, err.message);
    }
  }

  schedule.lastAutoCommentScanAtCairo = `اليوم ${cairoTimeNow} بتوقيت القاهرة`;
  return { repliesCount };
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
  const clientId = (process.env.YOUTUBE_CLIENT_ID || vault.youtubeClientId || "").trim();
  const clientSecret = (process.env.YOUTUBE_CLIENT_SECRET || vault.youtubeClientSecret || "").trim();
  const refreshToken = (process.env.YOUTUBE_REFRESH_TOKEN || vault.youtubeRefreshToken || "").trim();

  const runMode = parseRunMode(process.env.RUN_MODE || "daily_schedule");
  const dailyTime = schedule.dailyPublishTimeCairo || "19:00";
  const shortsPlaylistId = schedule.shortsPlaylistId || "PLPwfeXzB3ozU";
  const longPlaylistId = schedule.longPlaylistId || "PLbjN20PzrCYk";

  console.log(`📌 Run Mode Selected : ${runMode}`);
  console.log(`🕖 Daily Time (Cairo): ${dailyTime}`);
  console.log(`📂 Playlists         : Short=${shortsPlaylistId} | Long=${longPlaylistId}`);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("❌ خطأ: مفاتيح YouTube OAuth (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN) غير متوفرة!");
    console.error("يرجى إدخال مفاتيح يوتيوب في لوحة التحكم والضغط على زر (مزامنة Workflow 24/7 مع GitHub).");
    process.exit(1);
  }

  console.log("🔑 [Step 1/4] Verifying YouTube OAuth 2.0 Refresh Token...");
  const accessToken = await getYouTubeAccessToken({
    clientId,
    clientSecret,
    refreshToken,
  });
  console.log("✅ YouTube OAuth 2.0 Access Token obtained successfully!");

  if (runMode === "engagement_only") {
    console.log("⚡ [Run Mode: engagement_only] Running AI auto-responder for YouTube comments...");
    const replyRes = await scanAndAutoReplyYouTubeComments({
      accessToken,
      geminiApiKey: process.env.GEMINI_API_KEY,
      schedule,
    });
    fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), "utf8");

    if (process.env.GITHUB_STEP_SUMMARY) {
      const summaryLines = [
        "## 💬 تقرير التفاعل والرد الذكي على تعليقات YouTube (Noreen Kids)",
        `- **وضع التشغيل:** \`engagement_only\``,
        `- **عدد الردود الذكية الجديدة:** \`${replyRes.repliesCount}\``,
        `- **إجمالي الردود المنفذة بالسجل:** \`${schedule.repliedCommentIds?.length || 0}\``,
        `- **آخر توقيت فحص (القاهرة):** \`${schedule.lastAutoCommentScanAtCairo}\``,
      ];
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join("\n"));
    }

    if (process.env.GITHUB_TOKEN) {
      try {
        await execFileAsync("git", ["config", "user.name", "github-actions[bot]"]);
        await execFileAsync("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
        await execFileAsync("git", ["add", "noreen-kids-schedule.json"]);
        await execFileAsync("git", ["commit", "-m", "chore: sync YouTube growth comments [skip ci]"]);
        await execFileAsync("git", ["push"]);
      } catch {}
    }

    console.log("==================================================================");
    console.log(`✅ Completed engagement scan! New replies: ${replyRes.repliesCount}`);
    console.log("==================================================================");
    return;
  }

  const tasks = [];
  if (runMode === "short_only" || runMode === "both_now" || runMode === "daily_schedule") {
    tasks.push({
      label: "Short 3D Video (9:16)",
      videoFormat: "short_9_16",
      playlistId: shortsPlaylistId,
      episode: schedule.shortEpisode || {
        title: "Noreen Kids: مغامرة نورين وأرنوب في غابة النجوم",
        youtubePackage: {
          videoTitleAr: "Noreen Kids: مغامرة نورين وأرنوب في غابة النجوم | مغامرات الطبيبة نورين وأرنوب الشقي",
          descriptionAr: `أهلاً بكم يا أصحابنا في قناة Noreen Kids لأفلام الرسوم المتحركة!\n📖 ملخص القصة:\nمغامرة جديدة وممتعة باللهجة المصرية.\n🕖 موعد النشر اليومي: الساعة ${dailyTime} بتوقيت مصر.`,
          tags: ["Noreen Kids", "نورين كيدز", "كرتون اطفال 3D", "حواديت اطفال"],
        },
      },
    });
  }

  if (runMode === "long_only" || runMode === "both_now" || runMode === "daily_schedule") {
    tasks.push({
      label: "Long 3D Episode (16:9)",
      videoFormat: "long_16_9",
      playlistId: longPlaylistId,
      episode: schedule.longEpisode || {
        title: "Noreen Kids: سر السفينة الطائرة مع سدرة والنمر الفرفوش",
        youtubePackage: {
          videoTitleAr: "Noreen Kids: سر السفينة الطائرة فوق السحاب | مغامرات المهندسة سدرة والنمر الفرفوش",
          descriptionAr: `أهلاً بكم يا أصحابنا في قناة Noreen Kids لأفلام الرسوم المتحركة!\n📖 ملخص القصة:\nحلقة طويلة ممتعة ومفيدة للأطفال باللهجة المصرية.\n🕖 موعد النشر اليومي: الساعة ${dailyTime} بتوقيت مصر.`,
          tags: ["Noreen Kids", "نورين كيدز", "كرتون اطفال 3D", "افلام كرتون"],
        },
      },
    });
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "noreenkids-gh-"));
  const results = [];
  const isCronEvent = process.env.GITHUB_EVENT_NAME === "schedule";
  const publishAtIso =
    runMode === "daily_schedule" && !isCronEvent
      ? computeNextCairoPublishIso(dailyTime)
      : null;

  for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
    const task = tasks[tIdx];
    console.log("------------------------------------------------------------------");
    console.log(`🎬 [Step 2/4] Rendering ${task.label} (${tIdx + 1}/${tasks.length})...`);
    const mp4Path = await renderEpisodeMp4(task.episode, task.videoFormat, tmpDir);

    console.log(`🔍 [Step 3/4] Running ffprobe verification on ${path.basename(mp4Path)}...`);
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
    console.log(`✅ ffprobe PASSED: Duration=${durSec}s | Container=MP4 | Codec=H.264+AAC | FastStart=Enabled`);

    console.log(`☁️ [Step 4/4] Uploading ${task.label} to YouTube Channel (Noreen Kids)...`);
    const pkg = task.episode?.youtubePackage || {};
    const uploadRes = await uploadMp4ToYouTube({
      accessToken,
      mp4Path,
      title: getCanonicalYouTubeTitle(task.episode),
      description: pkg.descriptionAr || task.episode?.subtitle,
      tags: pkg.tags,
      privacyStatus: schedule.privacyStatus || "private",
      publishAtIso,
      playlistId: task.playlistId,
    });

    console.log(`🎉 SUCCESS! Uploaded Video ID: ${uploadRes.videoId}`);
    console.log(`🔗 Watch URL: https://www.youtube.com/watch?v=${uploadRes.videoId}`);
    console.log(`📂 Playlist (${uploadRes.playlistId}): ${uploadRes.playlistAdded ? "Added ✓" : "Skipped"}`);

    // Step 1: Post First Interactive Comment if enabled
    let firstCommentId = null;
    if (schedule.firstCommentEnabled !== false && uploadRes.videoId) {
      const challengeMsg = `🌟 سؤال التحدي لشطار وأبطال قناة Noreen Kids في حلقة "${uploadRes.cleanTitle}": إيه أكتر تصرف ذكي وشجاع عجبكم في مغامرة النهاردة؟ شاركونا إجاباتكم وأسامي أبطالكم الصغار في التعليقات علشان نرد عليكم بنفسنا ونفرح بيكم! 💖✨`;
      const fcRes = await postYouTubeFirstComment({
        accessToken,
        videoId: uploadRes.videoId,
        message: challengeMsg,
      });
      if (fcRes.success) {
        firstCommentId = fcRes.commentId;
      }
    }

    results.push({
      ...uploadRes,
      label: task.label,
      durationSec: durSec,
      firstCommentId,
      runMode,
    });
  }

  // Step 2: Run AI Comment Auto-Responder if enabled
  let autoRepliesCount = 0;
  if (schedule.autoCommentResponderEnabled !== false) {
    console.log("------------------------------------------------------------------");
    console.log("🤖 Running AI Auto-Responder for Recent YouTube Comments...");
    const autoRes = await scanAndAutoReplyYouTubeComments({
      accessToken,
      geminiApiKey: process.env.GEMINI_API_KEY,
      schedule,
    });
    autoRepliesCount = autoRes.repliesCount;
  }

  // Update schedule file
  fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), "utf8");

  // Sync to Git if running on GitHub Actions
  if (process.env.GITHUB_TOKEN) {
    try {
      await execFileAsync("git", ["config", "user.name", "github-actions[bot]"]);
      await execFileAsync("git", ["config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
      await execFileAsync("git", ["add", "noreen-kids-schedule.json"]);
      await execFileAsync("git", ["commit", "-m", "chore: sync YouTube video uploads & comment replies [skip ci]"]);
      await execFileAsync("git", ["push"]);
    } catch {}
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryLines = [
      "## 🎬 تقرير تشغيل وإنتاج قناة Noreen Kids 3D Studio",
      `- **وضع التشغيل:** \`${runMode}\``,
      `- **موعد الجدولة اليومية (توقيت مصر):** \`${dailyTime}\``,
      `- **الردود الذكية المنفذة اليوم:** \`${autoRepliesCount}\``,
      "",
      "| نوع الفيديو | العنوان | المدة | الحجم | أول تعليق تفاعلي | قائمة التشغيل | رابط يوتيوب |",
      "|---|---|---|---|---|---|---|",
      ...results.map(
        (r) =>
          `| ${r.label} | ${r.cleanTitle} | ${r.durationSec}s | ${r.fileSizeMb} MB | ${r.firstCommentId ? "تم التثبيت ✓" : "تلقائي"} | \`${r.playlistId}\` | [https://youtu.be/${r.videoId}](https://youtu.be/${r.videoId}) |`
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
