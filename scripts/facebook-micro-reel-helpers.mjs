/**
 * Noreen Kids 3D Studio - Unified High-Retention Micro-Shorts / Micro-Reels (15-20s)
 * & Fast Multi-Shot Camera Pacing Helpers (YouTube + Facebook)
 */

export function resolvePlatformRenderProfile(videoFormat, targetPlatform = "youtube") {
  const targetLower = String(targetPlatform || "youtube").toLowerCase();
  const isFb = targetLower.includes("facebook");
  const isShort = videoFormat === "short_9_16";
  const isMicroFormat =
    isShort || targetLower.includes("reel") || targetLower.includes("micro");
  const isFbMicroReel = isFb && isMicroFormat;
  const isVertical = isShort || isFb;
  const W = isFb ? 1080 : isShort ? 720 : 1280;
  const H = isFb ? 1920 : isShort ? 1280 : 720;

  // Even-aligned overscan for clean yuv420p H.264 crop & multi-shot duo composite across all formats
  const overscanW = Math.round((W * 1.14) / 2) * 2;
  const overscanH = Math.round((H * 1.14) / 2) * 2;
  const panRangeX = Math.max(8, overscanW - W);
  const panRangeY = Math.max(8, overscanH - H);

  return {
    isFb,
    isFbMicroReel,
    isMicroFormat,
    isShort,
    isVertical,
    W,
    H,
    overscanW,
    overscanH,
    panRangeX,
    panRangeY,
  };
}

export function buildFacebookCameraFramingConfig({
  isFb,
  isVertical,
  isFbMicroReel,
  isMicroFormat,
  sceneIndex,
  panRangeX,
  panRangeY,
  dur,
}) {
  const halfSpanX = Math.round(panRangeX * 0.5);
  const ampX = Math.max(4, Math.round(panRangeX * 0.45));
  const useVerticalSafeTop = Boolean(isFb || isVertical);
  const baseY = useVerticalSafeTop
    ? Math.round(panRangeY * 0.28)
    : Math.round(panRangeY * 0.5);
  const ampY = useVerticalSafeTop
    ? Math.max(4, Math.round(panRangeY * 0.22))
    : Math.max(4, Math.round(panRangeY * 0.42));
  const duoAmpX = Math.max(4, Math.round(ampX * 0.55));

  // Unified high-retention pacing across BOTH YouTube and Facebook:
  // - All Shorts/Reels & Scene 0 of Long Episodes: switch shot every 3.6s (defeats the 0-20s drop-off)
  // - Later scenes in Long Episodes: switch shot every 6.0s for lively cartoon conversation
  const isMicro = Boolean(isFbMicroReel || isMicroFormat);
  const shotIntervalSec = isMicro || sceneIndex === 0 ? 3.6 : 6.0;

  return {
    enableMultiShot: Number(dur) >= 4.0,
    shotIntervalSec,
    isScene1WithPosterAllowed: false,
    camExprX:
      sceneIndex % 2 === 0
        ? `${halfSpanX}+${ampX}*sin(2*PI*t/8.0)`
        : `${halfSpanX}-${ampX}*cos(2*PI*t/8.5)`,
    camExprY:
      sceneIndex % 2 === 0
        ? `${baseY}+${ampY}*cos(2*PI*t/10.0)`
        : `${baseY}+${ampY}*sin(2*PI*t/9.5)`,
    camPartnerX:
      sceneIndex % 2 === 0
        ? `${halfSpanX}-${ampX}*cos(2*PI*t/7.5)`
        : `${halfSpanX}+${ampX}*sin(2*PI*t/8.0)`,
    camPartnerY: `${baseY}+${ampY}*sin(2*PI*t/9.0)`,
    camDuoX: `${halfSpanX}+${duoAmpX}*sin(2*PI*t/7.0)`,
    camDuoY: `${baseY}`,
  };
}

export function cleanStoryTopicForReel(rawTitle) {
  return String(rawTitle || "مغامرة أبطال نورين كيدز")
    .replace(/^Noreen\s*Kids\s*[:\-|]?\s*/i, "")
    .split("|")[0]
    .replace(/#[^\s#]+/g, "")
    .trim();
}

export function selectShortMicroReelScenes(
  episode,
  sharedPreparedScenes,
  targetMinSec = 15,
  targetMaxSec = 20.5
) {
  const scenesList = Array.isArray(sharedPreparedScenes) ? sharedPreparedScenes : [];
  if (scenesList.length === 0) {
    return null;
  }

  const s0 = scenesList[0];
  const s1 = scenesList[1];
  let chosen;

  if (s1 && Number(s0.voiceDurSec || 0) + Number(s1.voiceDurSec || 0) + 0.9 <= targetMaxSec) {
    chosen = [
      { ...s0, scene: { ...s0.scene } },
      { ...s1, scene: { ...s1.scene } },
    ];
  } else {
    chosen = [{ ...s0, scene: { ...s0.scene } }];
  }

  const topic = cleanStoryTopicForReel(episode?.title || episode?.youtubePackage?.videoTitleAr);
  const hero = String(episode?.mainCharacterName || chosen[0]?.scene?.speakerName || "الطبيبة نورين").trim();
  const comp = String(episode?.companionName || scenesList[1]?.scene?.speakerName || "أرنوب الشقي الممرض").trim();
  const moral = String(
    episode?.moralLesson || episode?.summary || "التعاون والذكاء ومساعدة الأصدقاء"
  ).trim();

  const microEpisode = {
    ...episode,
    id: `${String(episode?.id || "ep")}_fb_short_reel`,
    isFbMicroReel: true,
    fbReelKind: "story_hook_reel",
    mainCharacterName: hero,
    companionName: comp,
    scenes: chosen.map((c) => ({ ...c.scene })),
    facebookPackage: {
      facebookTitleAr: `🎬 ريلز سريع | ${topic} مع ${hero} و${comp}`.slice(0, 120),
      facebookCaptionAr:
        `⚡ شوفوا المفاجأة السريعة دي مع ${hero} و${comp} في "${topic}"!\n` +
        `💡 قيمة المغامرة: ${moral}.\n` +
        `💬 قولوا لنا في التعليقات بتحبوا مين أكتر: ${hero} ولا ${comp}؟ وتابعوا الصفحة لكل المغامرات اليومية! 🌟🎬`,
      facebookHashtags: [
        "#أبطال_نورين_كيدز",
        "#Noreen_Kids",
        "#نورين_كيدز",
        "#Reels",
        "#قصص_أطفال",
        "#كرتون_أطفال_3D",
        "#حكايات_مصرية",
      ],
    },
  };

  return {
    microEpisode,
    selectedPreparedScenes: chosen,
    targetMinSec,
    targetMaxSec,
  };
}

export function buildLongTeaserMicroReelEpisode(longEpisode, dialect = "egyptian") {
  const topic = cleanStoryTopicForReel(
    longEpisode?.title || longEpisode?.youtubePackage?.videoTitleAr
  );
  const hero = String(
    longEpisode?.mainCharacterName || longEpisode?.scenes?.[0]?.speakerName || "الطبيبة نورين"
  ).trim();
  const comp = String(
    longEpisode?.companionName || longEpisode?.scenes?.[1]?.speakerName || "أرنوب الشقي الممرض"
  ).trim();
  const moral = String(
    longEpisode?.moralLesson || longEpisode?.summary || "الذكاء والتعاون وحب الخير"
  ).trim();

  const isFusha = dialect === "fusha";
  const heroLine = isFusha
    ? `يا أبطال عائلة نورين كيدز! هل شاهدتم المفاجأة الكبرى في مغامرة ${topic}؟ أنا ورفيقي ${comp} اكتشفنا أمراً مدهشاً!`
    : `يا خبر يا أبطال عيلة نورين كيدز! بصوا بسرعة لحقتوا تشوفوا المفاجأة اللي حصلت في ${topic}؟ أنا و${comp} اكتشفنا حاجة تجنن!`;

  const compLine = isFusha
    ? `نعم إنها مغامرة رائعة ومفيدة جداً! شاهدوا الحلقة الكاملة الآن على قناتنا واكتبوا رأيكم في التعليقات!`
    : `أيوة يا سلام مغامرة خطيرة أوي! ادخلوا دلوقتي اتفرجوا على الحلقة الكاملة واكتبوا لنا إيه أكتر حتة عجبتكم في التعليقات!`;

  const baseTags = Array.isArray(longEpisode?.youtubePackage?.tags)
    ? longEpisode.youtubePackage.tags
    : [];

  return {
    ...longEpisode,
    id: `${String(longEpisode?.id || "long")}_teaser_micro`,
    isFbMicroReel: true,
    isFbTeaserReel: true,
    fbReelKind: "long_episode_teaser_reel",
    mainCharacterName: hero,
    companionName: comp,
    scenes: [
      {
        id: "fb_teaser_1",
        speakerName: hero,
        partnerName: comp,
        durationSec: 9,
        dialogueArabic: heroLine,
      },
      {
        id: "fb_teaser_2",
        speakerName: comp,
        partnerName: hero,
        durationSec: 9,
        dialogueArabic: compLine,
      },
    ],
    youtubePackage: {
      ...(longEpisode?.youtubePackage || {}),
      videoTitleAr: `🔥 تشويق الحلقة: ${topic} | ${hero} و${comp} #Shorts`.slice(0, 95),
      descriptionAr:
        `🔥 مقتطف سريع من مغامرة النهارده الكاملة: "${topic}" مع ${hero} و${comp}!\n` +
        `📺 شاهدوا الحلقة الكاملة الآن على قناة نورين كيدز (Noreen Kids) ولا تنسوا الإجابة على التحدي في التعليقات! 💬✨\n` +
        `💡 القيمة التربوية: ${moral}\n` +
        `#Shorts #نورين_كيدز #Noreen_Kids #أبطال_نورين_كيدز #قصص_أطفال #كرتون_أطفال_3D`,
      tags: Array.from(
        new Set([...baseTags, "Shorts", "نورين كيدز", "Noreen Kids", "أبطال نورين كيدز"])
      ).slice(0, 15),
    },
    facebookPackage: {
      facebookTitleAr: `🔥 تشويق الحلقة الكاملة | ${topic} - ${hero} و${comp}`.slice(0, 120),
      facebookCaptionAr:
        `✨ مقتطف سريع من مغامرة النهارده الطويلة: "${topic}" مع ${hero} و${comp}!\n` +
        `📺 الحلقة الكاملة نزلت دلوقتي على صفحتنا Noreen Kids (بالعرض الطولي للموبايل 🎬)!\n` +
        `💡 القيمة التربوية: ${moral}.\n` +
        `💬 اكتبوا لنا في التعليقات بعد ما تشوفوا الحلقة الكاملة: اتعلمتوا إيه من مغامرة النهارده؟ 🌟`,
      facebookHashtags: [
        "#أبطال_نورين_كيدز",
        "#Noreen_Kids",
        "#نورين_كيدز",
        "#Reels",
        "#كرتون_أطفال_3D",
        "#حكايات_مصرية",
        "#تحدي_الشطار",
      ],
    },
  };
}

export function computeMicroReelTimingPlan(
  preparedScenes,
  minReelSec = 15,
  maxReelSec = 20.5
) {
  const list = Array.isArray(preparedScenes) ? preparedScenes : [];
  const totalVoiceSec = list.reduce((sum, s) => sum + Number(s?.voiceDurSec || 0), 0);
  const maxSafeVoiceSec = Math.max(10, maxReelSec - 0.85);
  const needsTempo = totalVoiceSec > maxSafeVoiceSec;
  const speedRatio = needsTempo
    ? Math.min(1.42, Math.max(1.04, totalVoiceSec / (maxReelSec - 1.6)))
    : 1.0;

  return {
    totalVoiceSec,
    maxSafeVoiceSec,
    needsTempo,
    speedRatio,
    minReelSec,
    maxReelSec,
  };
}

export function validatePlatformVideoFfprobeReport(
  probeJson,
  { platform = "facebook", isShort = false, expectMicroReel = false } = {}
) {
  const errors = [];
  const durSec = Number(probeJson?.format?.duration || 0);
  const streams = Array.isArray(probeJson?.streams) ? probeJson.streams : [];
  const vStream = streams.find((s) => s.codec_type === "video");
  const aStream = streams.find((s) => s.codec_type === "audio");

  if (!vStream || !aStream) {
    errors.push("Missing H.264 video stream or AAC audio stream.");
    return { valid: false, errors, durSec };
  }

  const width = Number(vStream.width || 0);
  const height = Number(vStream.height || 0);
  const vCodec = String(vStream.codec_name || "").toLowerCase();
  const pixFmt = String(vStream.pix_fmt || "").toLowerCase();
  const aCodec = String(aStream.codec_name || "").toLowerCase();
  const aSampleRate = Number(aStream.sample_rate || 0);
  const aChannels = Number(aStream.channels || 0);
  const vDur = Number(vStream.duration || durSec);
  const aDur = Number(aStream.duration || durSec);
  const avDrift = Math.abs(vDur - aDur);

  const expectedW = platform === "facebook" ? 1080 : isShort ? 720 : 1280;
  const expectedH = platform === "facebook" ? 1920 : isShort ? 1280 : 720;

  if (width !== expectedW || height !== expectedH) {
    errors.push(
      `Expected ${expectedW}x${expectedH} dimensions for ${platform} (${isShort ? "Short/Reel" : "Long"}), got ${width}x${height}.`
    );
  }
  if (vCodec !== "h264" || (pixFmt !== "yuv420p" && pixFmt !== "yuvj420p")) {
    errors.push(`Non-compliant video codec/pix_fmt: ${vCodec}/${pixFmt}.`);
  }
  if (aCodec !== "aac" || aSampleRate !== 48000 || aChannels !== 2) {
    errors.push(`Non-compliant audio stream: ${aCodec} ${aSampleRate}Hz ${aChannels}ch.`);
  }
  if (avDrift > 1.8) {
    errors.push(`Audio/Video duration drift too high: ${avDrift.toFixed(2)}s.`);
  }

  const microGate = Boolean(expectMicroReel || isShort);
  if (microGate) {
    if (durSec < 13.5 || durSec > 23.5) {
      errors.push(
        `${platform} Micro-Short/Reel duration (${durSec.toFixed(1)}s) outside target 14-23s window.`
      );
    }
  } else {
    if (durSec < 300 || durSec > 600) {
      errors.push(
        `${platform} Long duration (${durSec.toFixed(1)}s) outside 300-600s window.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    durSec,
    width,
    height,
    vCodec,
    pixFmt,
    aCodec,
    aSampleRate,
    aChannels,
    avDrift,
  };
}

export function validateFacebookVideoFfprobeReport(probeJson, { expectMicroReel = false } = {}) {
  return validatePlatformVideoFfprobeReport(probeJson, {
    platform: "facebook",
    isShort: expectMicroReel,
    expectMicroReel,
  });
}
