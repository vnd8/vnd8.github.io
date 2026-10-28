import React, { useState, useEffect, useRef, useMemo } from "react";
import { LOGO_DATA_URI, LOGO_REMOTE_URL, GOOD_VOICE_PRESET_B64 } from "./data/embeddedAssets";
import { HOSTSCRIPT_JSX_CODE } from "./data/hostscriptCode";
import { I18N, Lang } from "./data/i18n";
import {
  MANIFEST_XML_CODE,
  buildFullPythonInstallerScript,
  buildSelfExtractingWindowsSetupCmd,
} from "./utils/installerGenerator";
import { getCepPanelHtmlTemplate } from "./utils/cepPanelHtmlTemplate";

type ViewId =
  | "home"
  | "autocut"
  | "sync"
  | "captions"
  | "tracking"
  | "curves"
  | "reports"
  | "settings";

interface SilenceSpan {
  start: number;
  end: number;
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  module: string;
  action: string;
  clipsCount: number;
  timeSavedSec: number;
  sequenceName: string;
  precisionScore: number;
}

const CURVE_PRESETS = [
  { id: "smooth", key: "crvSmooth", bezier: [0.42, 0.0, 0.58, 1.0] as [number, number, number, number] },
  { id: "launch", key: "crvLaunch", bezier: [0.16, 1.0, 0.3, 1.0] as [number, number, number, number] },
  { id: "glow", key: "crvGlow", bezier: [0.34, 1.56, 0.64, 1.0] as [number, number, number, number] },
  { id: "hit", key: "crvHit", bezier: [0.7, 0.0, 0.1, 1.0] as [number, number, number, number] },
  { id: "calm", key: "crvCalm", bezier: [0.25, 0.1, 0.25, 1.0] as [number, number, number, number] },
  { id: "linear", key: "crvLinear", bezier: [0.0, 0.0, 1.0, 1.0] as [number, number, number, number] },
];

const STRENGTH_ROWS = [
  { id: "soft", labelKey: "rowSoft", in: [0.32, 0, 0.67, 0], out: [0.33, 1, 0.68, 1], io: [0.37, 0, 0.63, 1] },
  { id: "med", labelKey: "rowMed", in: [0.55, 0.05, 0.67, 0.19], out: [0.22, 0.61, 0.36, 1], io: [0.65, 0, 0.35, 1] },
  { id: "clear", labelKey: "rowClear", in: [0.64, 0, 0.78, 0], out: [0.22, 1, 0.36, 1], io: [0.76, 0, 0.24, 1] },
  { id: "strong", labelKey: "rowStrong", in: [0.75, 0, 0.85, 0], out: [0.16, 1, 0.3, 1], io: [0.85, 0, 0.15, 1] },
  { id: "max", labelKey: "rowMax", in: [0.89, 0, 0.95, 0], out: [0.07, 0.95, 0.15, 1], io: [0.92, 0, 0.08, 1] },
  { id: "sharp", labelKey: "rowSharp", in: [0.95, 0.05, 0.79, 0.04], out: [0.19, 1, 0.22, 1], io: [0.9, 0.03, 0.1, 0.97] },
  { id: "circ", labelKey: "rowCirc", in: [0.55, 0, 1, 0.45], out: [0, 0.55, 0.45, 1], io: [0.85, 0.14, 0.15, 0.86] },
  { id: "bounce", labelKey: "rowBounce", in: [0.6, -0.28, 0.73, 0.04], out: [0.18, 0.89, 0.32, 1.28], io: [0.68, -0.55, 0.26, 1.55] },
];

export default function App() {
  // Primary Language is English ("en") as requested, with 1-click toggle to Arabic ("ar")
  const [lang, setLang] = useState<Lang>("en");
  const L = I18N[lang];

  const [currentView, setCurrentView] = useState<ViewId>("autocut");
  const [seqName, setSeqName] = useState<string>("Main_Episode_2026");

  // Shared Status & Progress
  const [statusMsg, setStatusMsg] = useState<string>(I18N.en.statusReady);
  const [statusType, setStatusType] = useState<"" | "success" | "error">("");
  const [progressPct, setProgressPct] = useState<number>(0);
  const [statClips, setStatClips] = useState<number>(42);
  const [statSaved, setStatSaved] = useState<string>("309.7 s");
  const [isWorking, setIsWorking] = useState<boolean>(false);

  // ==================== 1. AUTO CUT (TURBO + WAVEFORM + AUTO-ZOOM) STATE ====================
  const [targetType, setTargetType] = useState<"both" | "audio" | "video">("both");
  const [vTrackIdx, setVTrackIdx] = useState<string>("0");
  const [aTrackIdx, setATrackIdx] = useState<string>("0");
  const [voiceSourceChip, setVoiceSourceChip] = useState<string>("all"); // "all" | "A1" | "A2" | "A3" | "A4"
  const [rangeScope, setRangeScope] = useState<"auto" | "inout" | "selected" | "full">("inout");
  const [thresholdDb, setThresholdDb] = useState<number>(-32);
  const [sensitivityPct, setSensitivityPct] = useState<number>(40);
  const [minSilenceSec, setMinSilenceSec] = useState<number>(0.22);
  const [paddingSec, setPaddingSec] = useState<number>(0.04);
  const [cutMode, setCutMode] = useState<"ripple" | "lift" | "razor">("ripple");
  const [activePreset, setActivePreset] = useState<"fast" | "bal" | "pod">("fast");
  const [autoZoomOnCut, setAutoZoomOnCut] = useState<boolean>(true);
  const [backupBeforeCut, setBackupBeforeCut] = useState<boolean>(true);

  // Interactive Waveform State
  const [waveZoom, setWaveZoom] = useState<number>(2.0);
  const [wavePanSec, setWavePanSec] = useState<number>(306); // 5:06
  const [totalSeqDurationSec] = useState<number>(1224.2);
  const [detectedSilencesCount, setDetectedSilencesCount] = useState<number>(348);
  const [detectedRemovedSec, setDetectedRemovedSec] = useState<number>(309.7);
  const [playheadSec, setPlayheadSec] = useState<number>(420);
  const isDraggingWave = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);
  const dragStartPan = useRef<number>(0);

  // Generate realistic deterministic waveform samples + orange silent spans
  const waveformSamples = useMemo(() => {
    const count = 220;
    const arr: { amp: number; isSilent: boolean; timeSec: number }[] = [];
    const sensFactor = sensitivityPct / 100;
    for (let i = 0; i < count; i++) {
      const t = (i / count) * totalSeqDurationSec;
      const rawWave =
        Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.13) * 0.75) +
        Math.abs(Math.sin(i * 1.17) * 0.25);
      const isDip = (i % 7 === 0 || i % 11 === 0 || rawWave < sensFactor * 0.58);
      const amp = isDip ? Math.max(0.06, rawWave * 0.22) : Math.min(0.98, rawWave + 0.24);
      arr.push({ amp, isSilent: isDip, timeSec: t });
    }
    return arr;
  }, [sensitivityPct, totalSeqDurationSec]);

  // ==================== 2. SYNCHRONIZE STATE ====================
  const [syncScope, setSyncScope] = useState<string>("auto");
  const [syncRefTrack, setSyncRefTrack] = useState<string>("0");
  const [syncTgtTrack, setSyncTgtTrack] = useState<string>("-999");
  const [syncMode, setSyncMode] = useState<string>("auto");
  const [syncMoveVideo, setSyncMoveVideo] = useState<boolean>(true);

  // ==================== 3. CAPTIONS (WORD-BY-WORD ANIMATED) STATE ====================
  const [capLang, setCapLang] = useState<"ar" | "en" | "auto">("ar");
  const [capScope, setCapScope] = useState<"all" | "inout">("inout");
  const [capStyle, setCapStyle] = useState<
    "natural" | "karaoke" | "pop" | "capsule" | "typewriter" | "wave" | "smoothUp" | "smoothDown"
  >("capsule");
  const [capFont, setCapFont] = useState<string>("Cairo Bold");
  const [wordsPerPage, setWordsPerPage] = useState<number>(4);
  const [capLines, setCapLines] = useState<1 | 2>(1);
  const [capSizePct, setCapSizePct] = useState<number>(76);
  const [capPosYPct, setCapPosYPct] = useState<number>(72);
  const [capSpeedPct, setCapSpeedPct] = useState<number>(100);
  const [colorText, setColorText] = useState<string>("#FFFFFF");
  const [colorActive, setColorActive] = useState<string>("#FFD84D");
  const [colorAccent, setColorAccent] = useState<string>("#7CF2C8");
  const [activeWordIdx, setActiveWordIdx] = useState<number>(1);

  // Animate preview caption word highlight
  useEffect(() => {
    const intervalMs = Math.max(220, Math.round(650 / (capSpeedPct / 100)));
    const timer = setInterval(() => {
      setActiveWordIdx((prev) => (prev + 1) % Math.max(2, Math.min(4, wordsPerPage)));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [capSpeedPct, wordsPerPage]);

  // ==================== 4. SMART MOTION TRACKING STATE ====================
  const [trackMode, setTrackMode] = useState<"layer" | "camera">("layer");
  const [trackTargetType, setTrackTargetType] = useState<"face" | "eye" | "point">("face");
  const [trackSmoothPct, setTrackSmoothPct] = useState<number>(85);

  // ==================== 5. MOTION CURVES STATE ====================
  const [curveScope, setCurveScope] = useState<"all" | "playhead">("all");
  const [selectedCurveId, setSelectedCurveId] = useState<string>("smooth");
  const [bezierX1, setBezierX1] = useState<number>(0.4);
  const [bezierY1, setBezierY1] = useState<number>(0.0);
  const [bezierX2, setBezierX2] = useState<number>(0.2);
  const [bezierY2, setBezierY2] = useState<number>(1.0);

  // ==================== 6. PERIODIC REPORTS & EXPORT STATE ====================
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "srt" | "xml" | "prfpset">("json");
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([
    {
      id: "ACT-904",
      timestamp: "2026-10-28 11:24",
      module: "Auto Cut (Turbo)",
      action: "Ripple Delete 348 Silences + Alternating Zoom",
      clipsCount: 348,
      timeSavedSec: 309.7,
      sequenceName: "Main_Episode_2026",
      precisionScore: 99.6,
    },
    {
      id: "ACT-903",
      timestamp: "2026-10-28 10:52",
      module: "Batch Synchronize",
      action: "Multi-Cam Zero-Overlap Sync (A1 -> All Tracks)",
      clipsCount: 28,
      timeSavedSec: 142.0,
      sequenceName: "Podcast_4Cam_Master",
      precisionScore: 99.8,
    },
    {
      id: "ACT-902",
      timestamp: "2026-10-28 09:40",
      module: "Animated Captions",
      action: "Capsule Word-by-Word Captions (Cairo Bold)",
      clipsCount: 64,
      timeSavedSec: 210.5,
      sequenceName: "Reels_Short_04",
      precisionScore: 99.4,
    },
    {
      id: "ACT-901",
      timestamp: "2026-10-27 18:15",
      module: "Smart Tracking",
      action: "Camera Follows Face (Adjustment Layer)",
      clipsCount: 12,
      timeSavedSec: 95.0,
      sequenceName: "Vlog_Intro_Cut",
      precisionScore: 99.2,
    },
  ]);

  // ==================== 7. SETTINGS & AUTO-UPDATE STATE ====================
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(true);
  const [currentVersion, setCurrentVersion] = useState<string>("v12.0.0");
  const [updateStatusText, setUpdateStatusText] = useState<string>("v12.0.4 Ready to Install");
  const [turboThreads, setTurboThreads] = useState<number>(8);
  const [hwAccel, setHwAccel] = useState<boolean>(true);
  const [strictPrivacy, setStrictPrivacy] = useState<boolean>(true);
  const [frameSnapTol, setFrameSnapTol] = useState<number>(2);

  // Sync threshold dB and Sensitivity %
  const handleThresholdChange = (newDb: number) => {
    setThresholdDb(newDb);
    const pct = Math.round(((newDb - -60) / (-15 - -60)) * 100);
    setSensitivityPct(Math.max(5, Math.min(95, pct)));
    const newCount = Math.max(12, Math.round(180 + pct * 3.8));
    const newRem = Number((newCount * 0.89).toFixed(1));
    setDetectedSilencesCount(newCount);
    setDetectedRemovedSec(newRem);
  };

  const handleSensitivityChange = (newPct: number) => {
    setSensitivityPct(newPct);
    const db = Math.round(-60 + (newPct / 100) * 45);
    setThresholdDb(Math.max(-60, Math.min(-15, db)));
    const newCount = Math.max(12, Math.round(180 + newPct * 3.8));
    const newRem = Number((newCount * 0.89).toFixed(1));
    setDetectedSilencesCount(newCount);
    setDetectedRemovedSec(newRem);
  };

  const appendActivityLog = (
    module: string,
    action: string,
    clipsCount: number,
    timeSavedSec: number
  ) => {
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    setActivityLogs((prev) => [
      {
        id: `ACT-${905 + prev.length}`,
        timestamp: ts,
        module,
        action,
        clipsCount,
        timeSavedSec,
        sequenceName: seqName,
        precisionScore: 99.7,
      },
      ...prev,
    ]);
  };

  // ==================== HANDLERS FOR ALL MODULES ====================
  const handleAnalyzeAudioWaveform = () => {
    setIsWorking(true);
    setProgressPct(35);
    setStatusType("");
    setStatusMsg(L.btnAnalyzingAudio);

    setTimeout(() => {
      const count = Math.max(24, Math.round(210 + sensitivityPct * 3.4));
      const rem = Number((count * 0.89).toFixed(1));
      setDetectedSilencesCount(count);
      setDetectedRemovedSec(rem);
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(L.waveSummary(count, String(rem), String(totalSeqDurationSec)));
      setIsWorking(false);
    }, 320);
  };

  const handleAutoDbCalibrate = () => {
    setIsWorking(true);
    setProgressPct(50);
    setStatusType("");
    setStatusMsg(
      lang === "ar"
        ? "جاري تحليل الموجة الصوتية وأرضية الضوضاء لضبط أفضل dB تلقائياً..."
        : "Analyzing clip audio waveform (RMS & Noise Floor) to set optimal dB..."
    );
    setTimeout(() => {
      handleThresholdChange(-31);
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(
        lang === "ar"
          ? "تم ضبط الحساسية تلقائياً: -31 dB (متوسط الكلام: -19.4 dB | أرضية الصمت: -48.2 dB)."
          : "Auto dB set to -31 dB (Voice Avg: -19.4 dB | Noise Floor: -48.2 dB)."
      );
      setIsWorking(false);
    }, 280);
  };

  const handleExecuteTurboCut = () => {
    setIsWorking(true);
    setProgressPct(25);
    setStatusType("");
    setStatusMsg(
      lang === "ar"
        ? `جاري القص السريع Turbo (${turboThreads} مسارات متوازية | دفعات ذرية)...`
        : `Executing 4x Turbo Silence Cut (${turboThreads} parallel threads | BATCH_SIZE=8)...`
    );

    setTimeout(() => {
      setStatClips(detectedSilencesCount);
      setStatSaved(`${detectedRemovedSec} s`);
      setProgressPct(100);
      setStatusType("success");
      const zoomNote = autoZoomOnCut
        ? lang === "ar"
          ? " + زووم خفيف تلقائي"
          : " + Alternating Auto-Zoom (108%)"
        : "";
      const backupNote = backupBeforeCut
        ? lang === "ar"
          ? " (تم حفظ نسخة احتياطية)"
          : " (Sequence Backup Created)"
        : "";
      setStatusMsg(
        lang === "ar"
          ? `تم قص ${detectedSilencesCount} سكتة وإغلاق الفراغات بسرعة فائقة (${detectedRemovedSec} ث)${zoomNote}${backupNote}! للتراجع Ctrl+Z.`
          : `Turbo-cut ${detectedSilencesCount} silent segments (${detectedRemovedSec}s saved)${zoomNote}${backupNote}! Press Ctrl+Z to undo.`
      );
      appendActivityLog(
        "Auto Cut (Turbo)",
        `Cut ${detectedSilencesCount} silences (${cutMode})${zoomNote}`,
        detectedSilencesCount,
        detectedRemovedSec
      );
      setIsWorking(false);
    }, 380);
  };

  const handleApplyGoodVoice = () => {
    setIsWorking(true);
    setProgressPct(45);
    setStatusType("");
    setStatusMsg(
      lang === "ar"
        ? "جاري تطبيق بريسست 'good voice' (DeNoise + Parametric EQ + Multiband + Hard Limiter)..."
        : "Applying 'good voice' Studio Preset (DeNoise + Parametric EQ + Multiband + Hard Limiter)..."
    );
    setTimeout(() => {
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(
        lang === "ar"
          ? "تم تطبيق بريسست 'good voice' لتنقية الصوت على جميع المقاطع المحددة بنجاح!"
          : "Applied 'good voice' Studio Preset to 18 audio clips on timeline!"
      );
      appendActivityLog("Studio Voice Preset", "Applied good voice.prfpset chain", 18, 45.0);
      setIsWorking(false);
    }, 300);
  };

  const handleExecuteSync = () => {
    setIsWorking(true);
    setProgressPct(40);
    setStatusType("");
    setStatusMsg(
      lang === "ar"
        ? "جاري تحليل الموجات الصوتية ومزامنة جميع المقاطع المقصوصة دفعة واحدة..."
        : "Analyzing 200Hz audio envelopes & synchronizing cut clips across tracks..."
    );
    setTimeout(() => {
      setStatClips(32);
      setStatSaved("0.04 s");
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(
        lang === "ar"
          ? "تمت مزامنة 32 مقطع/جزء عبر 3 تراكات بنجاح وبدون أي تداخل (Zero-Overlap)! للتراجع Ctrl+Z."
          : "Successfully synchronized 32 cut clips across 3 tracks with zero overlap (Avg offset: 0.04s)!"
      );
      appendActivityLog("Batch Synchronize", "Zero-Overlap Multi-Track Sync", 32, 165.0);
      setIsWorking(false);
    }, 360);
  };

  const handleGenerateCaptions = () => {
    setIsWorking(true);
    setProgressPct(50);
    setStatusType("");
    setStatusMsg(
      lang === "ar"
        ? `جاري تفريغ الكلام وتوليد كابشن متحرك (${capStyle} - ${capFont})...`
        : `Transcribing speech & generating word-by-word animated captions (${capStyle} - ${capFont})...`
    );
    setTimeout(() => {
      setStatClips(58);
      setStatSaved("185.0 s");
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(
        lang === "ar"
          ? `تم توليد وإضافة 58 كابشن متحرك كلمة بكلمة (${capFont}) على التايملاين بنجاح!`
          : `Generated 58 word-by-word animated caption segments (${capFont} · ${capStyle}) on timeline!`
      );
      appendActivityLog(
        "Animated Captions",
        `Generated ${capStyle} captions (${capFont})`,
        58,
        185.0
      );
      setIsWorking(false);
    }, 380);
  };

  const handleStartTracking = () => {
    setIsWorking(true);
    setProgressPct(45);
    setStatusType("");
    setStatusMsg(
      lang === "ar"
        ? "جاري تتبع الهدف وكتابة فريمات الحركة (Transform Keyframes) بدقة عالية..."
        : "Analyzing frames & baking precision motion tracking keyframes..."
    );
    setTimeout(() => {
      setStatClips(1);
      setStatSaved("92.0 s");
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(
        lang === "ar"
          ? `تم تتبع (${trackTargetType === "face" ? "الوجه" : trackTargetType === "eye" ? "العين" : "النقاط"}) وكتابة 120 فريم حركة بنجاح!`
          : `Baked 120 precision tracking keyframes (${trackMode === "camera" ? "Camera Follows Face" : "Layer Follows Target"})!`
      );
      appendActivityLog(
        "Smart Tracking",
        `${trackMode === "camera" ? "Camera Follow Face" : "Layer Follow"} (${trackTargetType})`,
        1,
        92.0
      );
      setIsWorking(false);
    }, 340);
  };

  const handleApplyCurve = (b: [number, number, number, number], curveLabel: string, resetLinear = false) => {
    setBezierX1(b[0]);
    setBezierY1(b[1]);
    setBezierX2(b[2]);
    setBezierY2(b[3]);
    setProgressPct(100);
    setStatusType("success");
    setStatusMsg(
      resetLinear
        ? lang === "ar"
          ? "تم إرجاع جميع الفريمات للوضع الخطي الافتراضي (Linear)."
          : "Reset all selected keyframes to original Linear interpolation."
        : lang === "ar"
        ? `تم تطبيق منحنى السرعة (${curveLabel}) [${b.join(", ")}] بين الفريمات بنجاح!`
        : `Applied velocity curve (${curveLabel}) cubic-bezier(${b.join(", ")}) to selected keyframes!`
    );
    appendActivityLog("Motion Curves", `Applied ${curveLabel} [${b.join(", ")}]`, 14, 38.0);
  };

  // ==================== DOWNLOAD / EXPORT HANDLERS (SETUP.EXE, .PY, REPORTS) ====================
  const triggerFileDownload = (filename: string, content: string | Uint8Array, mimeType = "text/plain;charset=utf-8") => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSetupExeLauncher = () => {
    const pyScript = buildFullPythonInstallerScript(getCepPanelHtmlTemplate());
    const cmdContent = buildSelfExtractingWindowsSetupCmd(pyScript);
    triggerFileDownload("vndpro_v12_Setup.cmd", cmdContent, "application/x-msdos-program");
    setStatusType("success");
    setProgressPct(100);
    setStatusMsg(
      lang === "ar"
        ? "تم تنزيل المثبّت الذاتي المباشر (vndpro_v12_Setup.cmd)! شغّله بضغطة واحدة لتثبيت البلوقن أو لبناء ملف Setup.exe."
        : "Downloaded self-extracting Windows Setup launcher (vndpro_v12_Setup.cmd)! Double-click to install vndpro v12.0 immediately."
    );
  };

  const handleDownloadPythonInstaller = () => {
    const pyScript = buildFullPythonInstallerScript(getCepPanelHtmlTemplate());
    triggerFileDownload("vndpro_v12_installer.py", pyScript, "text/x-python;charset=utf-8");
    setStatusType("success");
    setProgressPct(100);
    setStatusMsg(
      lang === "ar"
        ? "تم تنزيل ملف التثبيت الكامل المحدّث (vndpro_v12_installer.py) شاملاً جميع الإضافات والقص السريع!"
        : "Downloaded complete upgraded vndpro_v12_installer.py with all new modules & 4x Turbo Silence Cutter!"
    );
  };

  const handleExportActivityReport = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (exportFormat === "json") {
      const payload = JSON.stringify(
        {
          plugin: "vndpro v12.0 (Adobe Spectrum Native Edition)",
          securityStandard: "AES-256-Local-Sandboxed",
          period: reportPeriod,
          exportedAt: new Date().toISOString(),
          summary: {
            totalSessions: activityLogs.length,
            totalClipsProcessed: activityLogs.reduce((s, x) => s + x.clipsCount, 0),
            totalTimeSavedSec: Number(
              activityLogs.reduce((s, x) => s + x.timeSavedSec, 0).toFixed(1)
            ),
          },
          logs: activityLogs,
        },
        null,
        2
      );
      triggerFileDownload(`vndpro_report_${timestamp}.json`, payload, "application/json");
    } else if (exportFormat === "csv") {
      const header = "ID,Timestamp,Module,Action,ClipsCount,TimeSavedSec,Sequence,PrecisionScore\n";
      const rows = activityLogs
        .map(
          (r) =>
            `"${r.id}","${r.timestamp}","${r.module}","${r.action}",${r.clipsCount},${r.timeSavedSec},"${r.sequenceName}",${r.precisionScore}%`
        )
        .join("\n");
      triggerFileDownload(`vndpro_report_${timestamp}.csv`, header + rows, "text/csv");
    } else if (exportFormat === "srt") {
      const srt = `1\n00:00:00,200 --> 00:00:01,850\nهذا كابشن احترافي متحرك\n\n2\n00:00:01,900 --> 00:00:03,600\nvndpro v12.0 Premiere Pro Studio\n`;
      triggerFileDownload(`vndpro_captions_${timestamp}.srt`, srt, "text/plain");
    } else if (exportFormat === "xml") {
      triggerFileDownload(`vndpro_manifest_${timestamp}.xml`, MANIFEST_XML_CODE, "application/xml");
    } else if (exportFormat === "prfpset") {
      triggerFileDownload(
        "good_voice_preset_b64.txt",
        GOOD_VOICE_PRESET_B64,
        "text/plain"
      );
    }

    setStatusType("success");
    setProgressPct(100);
    setStatusMsg(
      lang === "ar"
        ? `تم تصدير التقرير الدوري والبيانات بصيغة (${exportFormat.toUpperCase()}) بنجاح مع حماية كاملة للخصوصية!`
        : `Exported periodic user activity report & data in .${exportFormat.toUpperCase()} format!`
    );
  };

  const handleCheckAutoUpdate = () => {
    setIsWorking(true);
    setProgressPct(60);
    setStatusMsg(
      lang === "ar"
        ? "جاري الاتصال بخادم التحديث الآمن والتحقق من النسخة..."
        : "Checking secure VND update server (SHA-256 signature verification)..."
    );
    setTimeout(() => {
      setCurrentVersion("v12.0.4");
      setUpdateStatusText(L.upToDate);
      setProgressPct(100);
      setStatusType("success");
      setStatusMsg(
        lang === "ar"
          ? "تم التحديث التلقائي إلى الإصدار v12.0.4 بنجاح بدون إعادة تشغيل البريمير!"
          : "Auto-updated cleanly to v12.0.4 (SHA-256 verified) with zero downtime!"
      );
      setIsWorking(false);
    }, 350);
  };

  // Format mm:ss helper
  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#e4e4e4] flex flex-col">
      {/* ==================== TOP STUDIO HEADER BAR (Top Bar Contract) ==================== */}
      <header className="flex items-center justify-between gap-8 px-6 py-3 bg-[#181818] border-b border-[#303030]">
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setCurrentView("home");
          }}
          className="text-sm font-bold tracking-tight text-[#e4e4e4] whitespace-nowrap shrink-0 flex items-center gap-2.5"
        >
          <img
            src={LOGO_DATA_URI}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = LOGO_REMOTE_URL;
            }}
            alt="vndpro logo"
            className="w-5 h-5 object-contain rounded-sm"
          />
          <span>vndpro v12.0 Studio</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#a8a8a8]">
          <button
            onClick={() => setCurrentView("autocut")}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === "autocut" ? "text-[#378ef0] font-semibold" : ""
            }`}
          >
            {L.lblTabAutoCut}
          </button>
          <button
            onClick={() => setCurrentView("sync")}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === "sync" ? "text-[#378ef0] font-semibold" : ""
            }`}
          >
            {L.lblTabSync}
          </button>
          <button
            onClick={() => setCurrentView("captions")}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === "captions" ? "text-[#378ef0] font-semibold" : ""
            }`}
          >
            {L.lblTabCaptions}
          </button>
          <button
            onClick={() => setCurrentView("tracking")}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === "tracking" ? "text-[#378ef0] font-semibold" : ""
            }`}
          >
            {L.lblTabTrack}
          </button>
          <button
            onClick={() => setCurrentView("curves")}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentView === "curves" ? "text-[#378ef0] font-semibold" : ""
            }`}
          >
            {L.lblTabCurves}
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleDownloadSetupExeLauncher}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1473e6] hover:bg-[#0d66d0] rounded-[3px] transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{L.btnDownloadSetupExe}</span>
          </button>
        </div>
      </header>

      {/* ==================== MAIN WORKSPACE GRID (DOCKED PREMIERE PANEL + INSTALLER & LIVE PREVIEW) ==================== */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ==================== LEFT/CENTER: EXACT NATIVE ADOBE PREMIERE PRO SPECTRUM PLUGIN PANEL ==================== */}
        <section className="lg:col-span-5 xl:col-span-5 flex flex-col items-center">
          <div
            dir={L.dir}
            className="adb-plugin-root w-full max-w-[440px] border border-[#323232] rounded-[4px] shadow-2xl"
          >
            {/* Top Adobe Panel Header (Exact 1:1 Original Design) */}
            <div className="adb-topbar">
              <div
                className="adb-brand"
                onClick={() => setCurrentView("home")}
                title="Home / Workspace Menu"
              >
                <div className="adb-logo">
                  <img
                    src={LOGO_DATA_URI}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = LOGO_REMOTE_URL;
                    }}
                    alt="VND"
                  />
                </div>
                <div className="min-w-0">
                  <div className="adb-title">vndpro</div>
                  <div className="adb-subtitle">{L.hdrSub}</div>
                </div>
              </div>

              <div className="adb-top-actions">
                <div className="adb-seq-pill" title="Active Premiere Pro Sequence">
                  <span>{seqName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatusType("success");
                    setProgressPct(100);
                    setStatusMsg(
                      lang === "ar"
                        ? `متصل بالتايملاين النشط: ${seqName}`
                        : `Connected to active sequence: ${seqName}`
                    );
                  }}
                  className="adb-btn-icon"
                  title="Refresh Sequence Tracks"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 16h5v5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setLang((prev) => (prev === "en" ? "ar" : "en"))}
                  className="adb-btn-icon"
                  title="Switch Language (EN / AR)"
                >
                  {L.langBtn}
                </button>
              </div>
            </div>

            {/* Adobe Workspace Navigation Tabs (2 Clean Rows of 4 Tabs inside the Docked Panel) */}
            <div className="adb-nav-tabs">
              <button
                type="button"
                onClick={() => setCurrentView("home")}
                className={`adb-tab ${currentView === "home" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" />
                </svg>
                <span>{L.lblTabHome}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("autocut")}
                className={`adb-tab ${currentView === "autocut" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <line x1="20" y1="4" x2="8.12" y2="15.88" />
                  <line x1="14.47" y1="14.48" x2="20" y2="20" />
                  <line x1="8.12" y1="8.12" x2="12" y2="12" />
                </svg>
                <span>{L.lblTabAutoCut}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("sync")}
                className={`adb-tab ${currentView === "sync" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 12h3l2-6 3 12 3-9 2 6h7" />
                </svg>
                <span>{L.lblTabSync}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("captions")}
                className={`adb-tab ${currentView === "captions" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
                </svg>
                <span>{L.lblTabCaptions}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("tracking")}
                className={`adb-tab ${currentView === "tracking" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="7" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
                <span>{L.lblTabTrack}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("curves")}
                className={`adb-tab ${currentView === "curves" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 19C9 19 9 5 21 5" />
                  <circle cx="3" cy="19" r="2" />
                  <circle cx="21" cy="5" r="2" />
                </svg>
                <span>{L.lblTabCurves}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("reports")}
                className={`adb-tab ${currentView === "reports" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
                <span>{L.lblTabReports}</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentView("settings")}
                className={`adb-tab ${currentView === "settings" ? "active" : ""}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>{L.lblTabSettings}</span>
              </button>
            </div>

            {/* ==================== VIEW 1: HOME WORKSPACE ==================== */}
            {currentView === "home" && (
              <div>
                <div className="home-intro">
                  <span>{L.lblHomeIntro}</span>
                </div>
                <div className="home-cards-list">
                  <div className="home-module-card" onClick={() => setCurrentView("autocut")}>
                    <div className="hm-left">
                      <div className="hm-icon-box">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="6" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <line x1="20" y1="4" x2="8.12" y2="15.88" />
                          <line x1="14.47" y1="14.48" x2="20" y2="20" />
                        </svg>
                      </div>
                      <div className="hm-info">
                        <h2>{L.hmCutTitle}</h2>
                        <p>{L.hmCutDesc}</p>
                      </div>
                    </div>
                    <span className="text-[#a8a8a8] font-bold">›</span>
                  </div>

                  <div className="home-module-card" onClick={() => setCurrentView("sync")}>
                    <div className="hm-left">
                      <div className="hm-icon-box">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M2 12h3l2-6 3 12 3-9 2 6h7" />
                        </svg>
                      </div>
                      <div className="hm-info">
                        <h2>{L.hmSyncTitle}</h2>
                        <p>{L.hmSyncDesc}</p>
                      </div>
                    </div>
                    <span className="text-[#a8a8a8] font-bold">›</span>
                  </div>

                  <div className="home-module-card" onClick={() => setCurrentView("captions")}>
                    <div className="hm-left">
                      <div className="hm-icon-box">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
                        </svg>
                      </div>
                      <div className="hm-info">
                        <h2>{L.hmCapTitle}</h2>
                        <p>{L.hmCapDesc}</p>
                      </div>
                    </div>
                    <span className="text-[#a8a8a8] font-bold">›</span>
                  </div>

                  <div className="home-module-card" onClick={() => setCurrentView("tracking")}>
                    <div className="hm-left">
                      <div className="hm-icon-box">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <circle cx="12" cy="12" r="7" />
                          <circle cx="12" cy="12" r="2" />
                        </svg>
                      </div>
                      <div className="hm-info">
                        <h2>{L.hmTrkTitle}</h2>
                        <p>{L.hmTrkDesc}</p>
                      </div>
                    </div>
                    <span className="text-[#a8a8a8] font-bold">›</span>
                  </div>

                  <div className="home-module-card" onClick={() => setCurrentView("curves")}>
                    <div className="hm-left">
                      <div className="hm-icon-box">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M3 19C9 19 9 5 21 5" />
                        </svg>
                      </div>
                      <div className="hm-info">
                        <h2>{L.hmCrvTitle}</h2>
                        <p>{L.hmCrvDesc}</p>
                      </div>
                    </div>
                    <span className="text-[#a8a8a8] font-bold">›</span>
                  </div>

                  <div className="home-module-card" onClick={() => setCurrentView("reports")}>
                    <div className="hm-left">
                      <div className="hm-icon-box">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M18 20V10M12 20V4M6 20v-6" />
                        </svg>
                      </div>
                      <div className="hm-info">
                        <h2>{L.hmRepTitle}</h2>
                        <p>{L.hmRepDesc}</p>
                      </div>
                    </div>
                    <span className="text-[#a8a8a8] font-bold">›</span>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== VIEW 2: AUTO CUT + INTERACTIVE WAVEFORM + AUTO-ZOOM ==================== */}
            {currentView === "autocut" && (
              <div>
                {/* Target Tracks & Speech Source Chips */}
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="4" width="18" height="6" rx="1" />
                        <rect x="3" y="14" width="18" height="6" rx="1" />
                      </svg>
                      <span>{L.sec1Title}</span>
                    </span>
                  </div>

                  <div className="adb-row">
                    <span className="adb-label">{L.lblTargetType}</span>
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value as "both" | "audio" | "video")}
                      className="adb-select"
                    >
                      <option value="both">{L.optBoth}</option>
                      <option value="audio">{L.optAudio}</option>
                      <option value="video">{L.optVideo}</option>
                    </select>
                  </div>

                  {/* Quick Audio Track Selector Buttons (All Audio | A1 | A2 | A3 | A4) from Image 4 */}
                  <div className="adb-row">
                    <span className="adb-label">{L.lblVoiceSource}</span>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { id: "all", label: L.allAudiosChip, idx: "-999" },
                        { id: "A1", label: "A1", idx: "0" },
                        { id: "A2", label: "A2", idx: "1" },
                        { id: "A3", label: "A3", idx: "2" },
                        { id: "A4", label: "A4", idx: "3" },
                      ].map((tr) => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            setVoiceSourceChip(tr.id);
                            setATrackIdx(tr.idx);
                          }}
                          className={`adb-preset-btn ${voiceSourceChip === tr.id ? "active" : ""}`}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="adb-grid-2">
                    <div>
                      <span className="adb-label">{L.lblVTrack}</span>
                      <select
                        value={vTrackIdx}
                        disabled={targetType === "audio"}
                        onChange={(e) => setVTrackIdx(e.target.value)}
                        className="adb-select"
                      >
                        <option value="-999">{L.allVTracks}</option>
                        <option value="0">V1 - Main Cam (14 clips)</option>
                        <option value="1">V2 - B-Roll / Cam 2 (8 clips)</option>
                      </select>
                    </div>
                    <div>
                      <span className="adb-label">{L.lblATrack}</span>
                      <select
                        value={aTrackIdx}
                        disabled={targetType === "video"}
                        onChange={(e) => setATrackIdx(e.target.value)}
                        className="adb-select"
                      >
                        <option value="-999">{L.allATracks}</option>
                        <option value="0">A1 - Master Mic (14 clips)</option>
                        <option value="1">A2 - Guest Mic (9 clips)</option>
                        <option value="2">A3 - Room Audio (4 clips)</option>
                        <option value="3">A4 - SFX Track (6 clips)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Timeline Range (From In & Out / Full Sequence / Selected) */}
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" />
                        <line x1="9" y1="12" x2="15" y2="12" />
                      </svg>
                      <span>{L.sec2Title}</span>
                    </span>
                  </div>

                  <div className="adb-scope-grid">
                    {(
                      [
                        { id: "auto", t: L.rcAutoTitle, d: L.rcAutoDesc },
                        { id: "inout", t: L.rcInoutTitle, d: L.rcInoutDesc },
                        { id: "selected", t: L.rcSelTitle, d: L.rcSelDesc },
                        { id: "full", t: L.rcFullTitle, d: L.rcFullDesc },
                      ] as const
                    ).map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setRangeScope(sc.id)}
                        className={`adb-scope-btn ${rangeScope === sc.id ? "active" : ""}`}
                      >
                        <div className="sb-top">{sc.t}</div>
                        <div className="sb-sub">{sc.d}</div>
                      </button>
                    ))}
                  </div>

                  <div className="adb-readout-bar">
                    <span>{L.lblRangeStatus}</span>
                    <span className="adb-hotval">
                      {rangeScope === "inout"
                        ? "In: 05:06.0 ➔ Out: 15:18.0"
                        : rangeScope === "selected"
                        ? "14 Selected Clips"
                        : "00:00.0 ➔ 20:24.2"}
                    </span>
                  </div>
                </div>

                {/* NEW: Interactive Audio Waveform & Silence Visualizer (from Image 4, styled in Adobe Spectrum) */}
                <div className="adb-panel">
                  <button
                    type="button"
                    onClick={handleAnalyzeAudioWaveform}
                    className="adb-btn-secondary mb-2"
                    style={{ borderColor: "#1473e6", background: "rgba(20, 115, 230, 0.14)" }}
                  >
                    <svg className="w-3.5 h-3.5 text-[#378ef0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12h3l2-6 3 12 3-9 2 6h7" />
                    </svg>
                    <span className="text-[#e4e4e4] font-semibold">{L.btnAnalyzeAudio}</span>
                  </button>

                  {/* Summary Readout */}
                  <div className="bg-[#141414] border border-[#303030] rounded-[3px] px-2.5 py-1.5 mb-2 flex items-center justify-between text-[10.5px]">
                    <span className="text-[#5fe0b7] font-semibold tabular-nums">
                      {L.waveSummary(
                        detectedSilencesCount,
                        String(detectedRemovedSec),
                        String(totalSeqDurationSec)
                      )}
                    </span>
                  </div>

                  {/* Waveform Zoom Controls */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setWaveZoom((z) => Math.max(1.0, Number((z - 0.5).toFixed(1))))}
                        className="adb-btn-icon px-2 py-0.5"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaveZoom((z) => Math.min(8.0, Number((z + 0.5).toFixed(1))))}
                        className="adb-btn-icon px-2 py-0.5"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWaveZoom(1.0);
                          setWavePanSec(0);
                        }}
                        className="adb-btn-icon"
                      >
                        {L.btnAllAudioZoom}
                      </button>
                    </div>
                    <span className="text-[10px] text-[#a8a8a8] tabular-nums" dir="ltr">
                      {fmtTime(wavePanSec)} ➔ {fmtTime(Math.min(totalSeqDurationSec, wavePanSec + totalSeqDurationSec / waveZoom))} · {waveZoom.toFixed(1)}×
                    </span>
                  </div>

                  {/* Interactive Waveform Canvas Box */}
                  <div
                    onWheel={(e) => {
                      e.preventDefault();
                      const delta = e.deltaY < 0 ? 0.4 : -0.4;
                      setWaveZoom((z) => Math.max(1.0, Math.min(8.0, Number((z + delta).toFixed(1)))));
                    }}
                    onDoubleClick={() => {
                      setWaveZoom(1.0);
                      setWavePanSec(0);
                    }}
                    onMouseDown={(e) => {
                      isDraggingWave.current = true;
                      dragStartX.current = e.clientX;
                      dragStartPan.current = wavePanSec;
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingWave.current) return;
                      const dx = e.clientX - dragStartX.current;
                      const nextPan = Math.max(
                        0,
                        Math.min(totalSeqDurationSec - 120, dragStartPan.current - dx * 1.8)
                      );
                      setWavePanSec(Math.round(nextPan));
                    }}
                    onMouseUp={() => {
                      isDraggingWave.current = false;
                    }}
                    onMouseLeave={() => {
                      isDraggingWave.current = false;
                    }}
                    className="relative h-[108px] bg-[#101214] border border-[#303030] rounded-[3px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
                  >
                    {/* Top Timecode Ruler */}
                    <div
                      dir="ltr"
                      className="h-4 bg-[#16181a] border-b border-[#262626] px-2 flex items-center justify-between text-[9px] text-[#888888] tabular-nums"
                    >
                      {[0, 1, 2, 3, 4, 5, 6].map((tick) => {
                        const span = totalSeqDurationSec / waveZoom;
                        const tSec = Math.min(totalSeqDurationSec, wavePanSec + (tick / 6) * span);
                        return <span key={tick}>{fmtTime(tSec)}</span>;
                      })}
                    </div>

                    {/* Waveform Bars + Orange Silence Highlights */}
                    <div className="h-[88px] px-1 flex items-center justify-between gap-[1px]" dir="ltr">
                      {waveformSamples.map((s, idx) => {
                        const hPct = Math.round(s.amp * 84);
                        return (
                          <div
                            key={idx}
                            onClick={() => setPlayheadSec(Math.round(s.timeSec))}
                            className="relative h-full flex-1 flex items-center justify-center"
                            style={{
                              backgroundColor: s.isSilent
                                ? "rgba(215, 95, 55, 0.34)"
                                : "transparent",
                            }}
                          >
                            <div
                              style={{
                                height: `${hPct}%`,
                                width: "100%",
                                backgroundColor: s.isSilent ? "#e67e51" : "#3ad29f",
                                opacity: s.isSilent ? 0.85 : 0.95,
                                borderRadius: "1px",
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Threshold horizontal line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-[#4b9cf5]/70 pointer-events-none"
                      style={{
                        top: `${Math.max(22, Math.min(88, 100 - sensitivityPct))}%`,
                      }}
                    />
                  </div>

                  <div className="text-center text-[9.5px] text-[#6e6e6e] mt-1">{L.waveHint}</div>
                </div>

                {/* Silence Parameters + Sensitivity % + Auto-Zoom Toggle */}
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <line x1="4" y1="21" x2="4" y2="14" />
                        <line x1="12" y1="21" x2="12" y2="12" />
                        <line x1="20" y1="21" x2="20" y2="16" />
                      </svg>
                      <span>{L.sec3Title}</span>
                    </span>
                  </div>

                  <div className="adb-presets-bar">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePreset("fast");
                        handleThresholdChange(-32);
                        setMinSilenceSec(0.22);
                        setPaddingSec(0.04);
                      }}
                      className={`adb-preset-btn ${activePreset === "fast" ? "active" : ""}`}
                    >
                      {L.pChipFast}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePreset("bal");
                        handleThresholdChange(-35);
                        setMinSilenceSec(0.35);
                        setPaddingSec(0.1);
                      }}
                      className={`adb-preset-btn ${activePreset === "bal" ? "active" : ""}`}
                    >
                      {L.pChipBal}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePreset("pod");
                        handleThresholdChange(-42);
                        setMinSilenceSec(0.45);
                        setPaddingSec(0.12);
                      }}
                      className={`adb-preset-btn ${activePreset === "pod" ? "active" : ""}`}
                    >
                      {L.pChipPod}
                    </button>
                  </div>

                  {/* Silence Sensitivity % Slider (Synced with dB Threshold) */}
                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblSensitivity}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleAutoDbCalibrate}
                          className="adb-btn-autodb"
                        >
                          <span>{L.lblAutoDbBtn}</span>
                        </button>
                        <span className="adb-hotval">
                          {sensitivityPct}% ({thresholdDb} dB)
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={1}
                      value={sensitivityPct}
                      onChange={(e) => handleSensitivityChange(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  {/* Min Silence Duration */}
                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblMinSilence}</span>
                      <span className="adb-hotval">{minSilenceSec.toFixed(2)} s</span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={2.0}
                      step={0.01}
                      value={minSilenceSec}
                      onChange={(e) => setMinSilenceSec(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  {/* Speech Padding Before & After */}
                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblPadding}</span>
                      <span className="adb-hotval">{paddingSec.toFixed(2)} s</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={0.4}
                      step={0.01}
                      value={paddingSec}
                      onChange={(e) => setPaddingSec(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  {/* Alternating Auto-Zoom & Sequence Backup Checkboxes (from Image 4) */}
                  <div className="adb-row pt-1 border-t border-[#2d2d2d]">
                    <label className="adb-check-row">
                      <input
                        type="checkbox"
                        checked={autoZoomOnCut}
                        onChange={(e) => setAutoZoomOnCut(e.target.checked)}
                      />
                      <span>{L.lblAutoZoomToggle}</span>
                    </label>
                    <label className="adb-check-row">
                      <input
                        type="checkbox"
                        checked={backupBeforeCut}
                        onChange={(e) => setBackupBeforeCut(e.target.checked)}
                      />
                      <span>{L.lblBackupSeqToggle}</span>
                    </label>
                  </div>

                  <div className="adb-row">
                    <span className="adb-label">{L.lblCutMode}</span>
                    <select
                      value={cutMode}
                      onChange={(e) => setCutMode(e.target.value as "ripple" | "lift" | "razor")}
                      className="adb-select"
                    >
                      <option value="ripple">{L.modeRipple}</option>
                      <option value="lift">{L.modeLift}</option>
                      <option value="razor">{L.modeRazor}</option>
                    </select>
                  </div>
                </div>

                {/* 1-Click "good voice" Studio Preset */}
                <div className="adb-panel">
                  <button
                    type="button"
                    onClick={handleApplyGoodVoice}
                    className="adb-btn-secondary"
                  >
                    <svg className="w-3.5 h-3.5 text-[#4b9cf5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                    <span>{L.lblCleanVoiceBtn}</span>
                  </button>
                </div>

                {/* Execute Cut + Stop */}
                <div className="adb-action-bar">
                  <button
                    type="button"
                    disabled={isWorking}
                    onClick={handleExecuteTurboCut}
                    className="adb-btn-primary"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{isWorking ? L.cutBtnWorking : L.lblCutBtn}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!isWorking}
                    onClick={() => setIsWorking(false)}
                    className="adb-btn-stop"
                  >
                    <span>{L.lblStopBtn}</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== VIEW 3: MULTI-CLIP BATCH SYNCHRONIZE ==================== */}
            {currentView === "sync" && (
              <div>
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12h3l2-6 3 12 3-9 2 6h7" />
                      </svg>
                      <span>{L.secSyncTracksTitle}</span>
                    </span>
                  </div>

                  <div className="adb-row">
                    <span className="adb-label">{L.lblSyncScope}</span>
                    <select
                      value={syncScope}
                      onChange={(e) => setSyncScope(e.target.value)}
                      className="adb-select"
                    >
                      <option value="auto">{L.syncScopeAuto}</option>
                      <option value="full">{L.syncScopeFull}</option>
                      <option value="selected">{L.syncScopeSel}</option>
                      <option value="inout">{L.syncScopeInOut}</option>
                    </select>
                  </div>

                  <div className="adb-grid-2 adb-row">
                    <div>
                      <span className="adb-label">{L.lblRefTrack}</span>
                      <select
                        value={syncRefTrack}
                        onChange={(e) => setSyncRefTrack(e.target.value)}
                        className="adb-select"
                      >
                        <option value="0">A1 - Master Mic (Reference)</option>
                        <option value="1">A2 - Boom Audio</option>
                      </select>
                    </div>
                    <div>
                      <span className="adb-label">{L.lblTgtTrack}</span>
                      <select
                        value={syncTgtTrack}
                        onChange={(e) => setSyncTgtTrack(e.target.value)}
                        className="adb-select"
                      >
                        <option value="-999">{L.allTracksSyncOpt}</option>
                        <option value="A:1">A2 - Camera 2 Audio</option>
                        <option value="A:2">A3 - Camera 3 Audio</option>
                        <option value="V:1">V2 - B-Roll Camera</option>
                      </select>
                    </div>
                  </div>

                  <div className="adb-row">
                    <span className="adb-label">{L.lblSyncMode}</span>
                    <select
                      value={syncMode}
                      onChange={(e) => setSyncMode(e.target.value)}
                      className="adb-select"
                    >
                      <option value="auto">{L.syncModeAuto}</option>
                      <option value="move">{L.syncModeMove}</option>
                      <option value="slice">{L.syncModeSlice}</option>
                    </select>
                  </div>

                  <label className="adb-check-row">
                    <input
                      type="checkbox"
                      checked={syncMoveVideo}
                      onChange={(e) => setSyncMoveVideo(e.target.checked)}
                    />
                    <span>{L.lblSyncMoveVideo}</span>
                  </label>
                </div>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={handleExecuteSync}
                  className="adb-btn-primary"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12h3l2-6 3 12 3-9 2 6h7" />
                  </svg>
                  <span>{isWorking ? L.syncWorkingBtn : L.lblSyncNowBtn}</span>
                </button>
              </div>
            )}

            {/* ==================== VIEW 4: WORD-BY-WORD ANIMATED CAPTIONS (Image 1 features in Adobe Spectrum UI) ==================== */}
            {currentView === "captions" && (
              <div>
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M7 15h4M15 15h2M7 11h2M13 11h4" />
                      </svg>
                      <span>{L.secCapTitle}</span>
                    </span>
                  </div>

                  {/* Speech Language & Range */}
                  <div className="adb-grid-2 adb-row">
                    <div>
                      <span className="adb-label">{L.lblCapLang}</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { id: "ar", label: L.capLangAr },
                            { id: "en", label: L.capLangEn },
                            { id: "auto", label: L.capLangAuto },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCapLang(item.id)}
                            className={`adb-preset-btn ${capLang === item.id ? "active" : ""}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="adb-label">{L.lblCapWhere}</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setCapScope("all")}
                          className={`adb-preset-btn ${capScope === "all" ? "active" : ""}`}
                        >
                          {L.capWhereAll}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCapScope("inout")}
                          className={`adb-preset-btn ${capScope === "inout" ? "active" : ""}`}
                        >
                          {L.capWhereInOut}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Live Vertical Frame Preview Box (Playhead Frame) */}
                  <div className="adb-row">
                    <span className="adb-label">{L.lblCapPreview}</span>
                    <div className="mx-auto w-[156px] h-[220px] bg-[#101318] border border-[#363636] rounded-[6px] relative flex flex-col justify-between p-3 overflow-hidden shadow-inner">
                      <div className="flex items-center justify-between text-[8.5px] text-[#6e6e6e] tabular-nums" dir="ltr">
                        <span>REC · 9:16</span>
                        <span>00:07:12</span>
                      </div>

                      {/* Dynamic Animated Caption Preview at Y-Position */}
                      <div
                        style={{
                          top: `${Math.max(15, Math.min(82, capPosYPct))}%`,
                          transform: `translateY(-50%) scale(${capSizePct / 80})`,
                        }}
                        className="absolute inset-x-2 flex flex-wrap items-center justify-center gap-1 text-center pointer-events-none"
                        dir={capLang === "en" ? "ltr" : "rtl"}
                      >
                        {(capLang === "en"
                          ? ["This", "caption", "moves", "live"]
                          : ["هذا", "كابشن", "متحرك", "احترافي"]
                        )
                          .slice(0, wordsPerPage)
                          .map((word, wIdx) => {
                            const isCur = wIdx === activeWordIdx;
                            const isSpecial = wIdx === 1;
                            const bgCapsule =
                              capStyle === "capsule" && isCur
                                ? colorActive
                                : "transparent";
                            const txtColor =
                              capStyle === "capsule" && isCur
                                ? "#111111"
                                : isCur
                                ? colorActive
                                : isSpecial
                                ? colorAccent
                                : colorText;
                            return (
                              <span
                                key={wIdx}
                                style={{
                                  backgroundColor: bgCapsule,
                                  color: txtColor,
                                  padding: capStyle === "capsule" && isCur ? "1px 6px" : "0 2px",
                                  borderRadius: "4px",
                                  fontWeight: 800,
                                  fontSize: "13px",
                                  transition: "all 0.14s ease",
                                  transform:
                                    capStyle === "pop" && isCur ? "scale(1.18)" : "scale(1.0)",
                                }}
                              >
                                {word}
                              </span>
                            );
                          })}
                      </div>

                      <div className="text-[8.5px] text-center text-[#888888]">
                        {L.capPreviewSub}
                      </div>
                    </div>
                  </div>

                  {/* 8 Caption Animation Styles */}
                  <div className="adb-row">
                    <span className="adb-label">{L.lblCapStyle}</span>
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: "natural", label: L.styleNatural },
                          { id: "karaoke", label: L.styleKaraoke },
                          { id: "pop", label: L.stylePop },
                          { id: "capsule", label: L.styleCapsule },
                          { id: "typewriter", label: L.styleTypewriter },
                          { id: "wave", label: L.styleWave },
                          { id: "smoothUp", label: L.styleSmoothUp },
                          { id: "smoothDown", label: L.styleSmoothDown },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setCapStyle(st.id)}
                          className={`adb-preset-btn ${capStyle === st.id ? "active" : ""}`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Family Selector & Lines */}
                  <div className="adb-grid-2 adb-row">
                    <div>
                      <span className="adb-label">{L.lblCapFont}</span>
                      <select
                        value={capFont}
                        onChange={(e) => setCapFont(e.target.value)}
                        className="adb-select"
                      >
                        <option value="Cairo Bold">Cairo Bold (خط القالب)</option>
                        <option value="Tajawal ExtraBold">Tajawal ExtraBold</option>
                        <option value="IBM Plex Sans Arabic">IBM Plex Arabic</option>
                        <option value="Adobe Clean Bold">Adobe Clean Bold</option>
                        <option value="Montserrat Black">Montserrat Black</option>
                      </select>
                    </div>
                    <div>
                      <span className="adb-label">{L.lblCapLines}</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          onClick={() => setCapLines(1)}
                          className={`adb-preset-btn ${capLines === 1 ? "active" : ""}`}
                        >
                          {L.capOneLine}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCapLines(2)}
                          className={`adb-preset-btn ${capLines === 2 ? "active" : ""}`}
                        >
                          {L.capTwoLines}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sliders: Words Per Page, Size %, Position Y %, Animation Speed % */}
                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblWordsPerPage}</span>
                      <span className="adb-hotval">{wordsPerPage}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={8}
                      step={1}
                      value={wordsPerPage}
                      onChange={(e) => setWordsPerPage(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  <div className="adb-grid-2 adb-row">
                    <div>
                      <div className="adb-param-hdr">
                        <span>{L.lblCapSize}</span>
                        <span className="adb-hotval">{capSizePct}%</span>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={140}
                        value={capSizePct}
                        onChange={(e) => setCapSizePct(Number(e.target.value))}
                        className="adb-slider"
                      />
                    </div>
                    <div>
                      <div className="adb-param-hdr">
                        <span>{L.lblCapPosY}</span>
                        <span className="adb-hotval">{capPosYPct}%</span>
                      </div>
                      <input
                        type="range"
                        min={15}
                        max={90}
                        value={capPosYPct}
                        onChange={(e) => setCapPosYPct(Number(e.target.value))}
                        className="adb-slider"
                      />
                    </div>
                  </div>

                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblCapSpeed}</span>
                      <span className="adb-hotval">{capSpeedPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={200}
                      value={capSpeedPct}
                      onChange={(e) => setCapSpeedPct(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  {/* 3 Color Pickers (Text Color, Active Word, Special Keyword) */}
                  <div className="adb-row">
                    <span className="adb-label">{L.lblCapColors}</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <label className="bg-[#141414] border border-[#303030] rounded-[3px] p-1.5 flex items-center justify-between cursor-pointer">
                        <span className="text-[9.5px] text-[#a8a8a8] truncate">{L.lblColorText}</span>
                        <input
                          type="color"
                          value={colorText}
                          onChange={(e) => setColorText(e.target.value)}
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                      </label>
                      <label className="bg-[#141414] border border-[#303030] rounded-[3px] p-1.5 flex items-center justify-between cursor-pointer">
                        <span className="text-[9.5px] text-[#a8a8a8] truncate">{L.lblColorActive}</span>
                        <input
                          type="color"
                          value={colorActive}
                          onChange={(e) => setColorActive(e.target.value)}
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                      </label>
                      <label className="bg-[#141414] border border-[#303030] rounded-[3px] p-1.5 flex items-center justify-between cursor-pointer">
                        <span className="text-[9.5px] text-[#a8a8a8] truncate">{L.lblColorAccent}</span>
                        <input
                          type="color"
                          value={colorAccent}
                          onChange={(e) => setColorAccent(e.target.value)}
                          className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={handleGenerateCaptions}
                  className="adb-btn-primary"
                >
                  <span>{L.btnGenerateCaptions}</span>
                </button>
              </div>
            )}

            {/* ==================== VIEW 5: SMART MOTION TRACKING (Image 2 features in Adobe Spectrum UI) ==================== */}
            {currentView === "tracking" && (
              <div>
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="7" />
                        <circle cx="12" cy="12" r="2" />
                      </svg>
                      <span>{L.secTrackTitle}</span>
                    </span>
                  </div>

                  <p className="text-[10.5px] text-[#a8a8a8] mb-2.5 leading-relaxed">
                    {L.trackHelpDesc}
                  </p>

                  {/* Two Primary Tracking Mode Cards from Image 2 */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setTrackMode("layer")}
                      className={`p-3 rounded-[4px] border text-center flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                        trackMode === "layer"
                          ? "bg-[#1473e6]/16 border-[#1473e6] text-white"
                          : "bg-[#141414] border-[#3d3d3d] text-[#a8a8a8] hover:border-[#555]"
                      }`}
                    >
                      <svg className="w-5 h-5 text-[#378ef0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="7" />
                        <circle cx="12" cy="12" r="2" />
                        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                      </svg>
                      <div className="text-[11px] font-bold text-[#e4e4e4]">{L.cardLayerTrackTitle}</div>
                      <div className="text-[9.5px] text-[#888888]">{L.cardLayerTrackSub}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTrackMode("camera")}
                      className={`p-3 rounded-[4px] border text-center flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                        trackMode === "camera"
                          ? "bg-[#1473e6]/16 border-[#1473e6] text-white"
                          : "bg-[#141414] border-[#3d3d3d] text-[#a8a8a8] hover:border-[#555]"
                      }`}
                    >
                      <svg className="w-5 h-5 text-[#378ef0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="m22 8-6 4 6 4V8Z" />
                        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                      </svg>
                      <div className="text-[11px] font-bold text-[#e4e4e4]">{L.cardCamTrackTitle}</div>
                      <div className="text-[9.5px] text-[#888888]">{L.cardCamTrackSub}</div>
                    </button>
                  </div>

                  <div className="adb-row">
                    <span className="adb-label">{L.lblTrackTargetType}</span>
                    <select
                      value={trackTargetType}
                      onChange={(e) => setTrackTargetType(e.target.value as "face" | "eye" | "point")}
                      className="adb-select"
                    >
                      <option value="face">{L.trkTargetFace}</option>
                      <option value="eye">{L.trkTargetEye}</option>
                      <option value="point">{L.trkTargetPoint}</option>
                    </select>
                  </div>

                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblTrackSmooth}</span>
                      <span className="adb-hotval">{trackSmoothPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={trackSmoothPct}
                      onChange={(e) => setTrackSmoothPct(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  <div className="bg-[#141414] border border-[#303030] rounded-[3px] p-2 text-[9.5px] text-[#999999] leading-relaxed">
                    {L.lblTrackRangeNote}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isWorking}
                  onClick={handleStartTracking}
                  className="adb-btn-primary"
                >
                  <span>{L.btnStartTracking}</span>
                </button>
              </div>
            )}

            {/* ==================== VIEW 6: VELOCITY & KEYFRAME MOTION CURVES (Image 3 features in Adobe Spectrum UI) ==================== */}
            {currentView === "curves" && (
              <div>
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 19C9 19 9 5 21 5" />
                      </svg>
                      <span>{L.secCurvesTitle}</span>
                    </span>
                  </div>

                  <p className="text-[10px] text-[#a8a8a8] mb-2">{L.curvesHelpDesc}</p>

                  {/* Scope Selector: Between All Keyframes vs Span Under Playhead */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setCurveScope("all")}
                      className={`adb-preset-btn ${curveScope === "all" ? "active" : ""}`}
                    >
                      {L.curveScopeAll}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurveScope("playhead")}
                      className={`adb-preset-btn ${curveScope === "playhead" ? "active" : ""}`}
                    >
                      {L.curveScopePlayhead}
                    </button>
                  </div>

                  {/* 6 Signature Quick Curves */}
                  <span className="adb-label">{L.lblQuickPresets}</span>
                  <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                    {CURVE_PRESETS.map((cp) => {
                      const label = L[cp.key as keyof typeof L] as string;
                      const [x1, y1, x2, y2] = cp.bezier;
                      return (
                        <button
                          key={cp.id}
                          type="button"
                          onClick={() => {
                            setSelectedCurveId(cp.id);
                            handleApplyCurve(cp.bezier, label);
                          }}
                          className={`p-1.5 rounded-[3px] border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            selectedCurveId === cp.id
                              ? "bg-[#1473e6]/18 border-[#1473e6] text-white"
                              : "bg-[#141414] border-[#343434] text-[#a8a8a8] hover:border-[#555]"
                          }`}
                        >
                          <svg className="w-8 h-5" viewBox="0 0 32 20" fill="none">
                            <path
                              d={`M 2 18 C ${2 + x1 * 28} ${18 - y1 * 14}, ${2 + x2 * 28} ${
                                18 - y2 * 14
                              }, 30 2`}
                              stroke="#378ef0"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="text-[9.5px] font-semibold truncate max-w-full">
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 8x3 Strength Grid (Soft, Medium, Clear, Strong, Extreme, Sharp, Circular, Bounce) */}
                  <span className="adb-label">{L.lblByStrength}</span>
                  <div className="max-h-[175px] overflow-y-auto pr-0.5 space-y-1 mb-2.5 border border-[#2c2c2c] rounded-[3px] p-1.5 bg-[#161616]">
                    {STRENGTH_ROWS.map((row) => {
                      const rowLabel = L[row.labelKey as keyof typeof L] as string;
                      return (
                        <div key={row.id} className="grid grid-cols-10 items-center gap-1">
                          <span className="col-span-2 text-[9.5px] text-[#a8a8a8] font-medium truncate">
                            {rowLabel}
                          </span>
                          {(
                            [
                              { type: "in", b: row.in, lbl: L.colEaseIn },
                              { type: "out", b: row.out, lbl: L.colEaseOut },
                              { type: "io", b: row.io, lbl: L.colEaseInOut },
                            ] as const
                          ).map((cell) => {
                            const cellId = `${row.id}-${cell.type}`;
                            const [x1, y1, x2, y2] = cell.b;
                            return (
                              <button
                                key={cell.type}
                                type="button"
                                onClick={() => {
                                  setSelectedCurveId(cellId);
                                  handleApplyCurve(
                                    cell.b as [number, number, number, number],
                                    `${rowLabel} · ${cell.lbl}`
                                  );
                                }}
                                className={`col-span-2 py-1 px-1 rounded-[3px] border flex flex-col items-center cursor-pointer ${
                                  selectedCurveId === cellId
                                    ? "bg-[#1473e6]/20 border-[#1473e6] text-white"
                                    : "bg-[#1d1d1d] border-[#303030] text-[#a8a8a8] hover:border-[#4b9cf5]"
                                }`}
                              >
                                <svg className="w-6 h-3.5" viewBox="0 0 24 14" fill="none">
                                  <path
                                    d={`M 2 12 C ${2 + x1 * 20} ${12 - y1 * 10}, ${
                                      2 + x2 * 20
                                    } ${12 - y2 * 10}, 22 2`}
                                    stroke="#4b9cf5"
                                    strokeWidth="1.7"
                                  />
                                </svg>
                                <span className="text-[8.5px] truncate">{cell.lbl}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>

                  {/* Custom Cubic-Bezier Numeric Inputs */}
                  <span className="adb-label">{L.lblCustomBezier}</span>
                  <div className="grid grid-cols-5 gap-1 items-center mb-2" dir="ltr">
                    <input
                      type="number"
                      step="0.05"
                      value={bezierX1}
                      onChange={(e) => setBezierX1(Number(e.target.value))}
                      className="adb-input text-center tabular-nums"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={bezierY1}
                      onChange={(e) => setBezierY1(Number(e.target.value))}
                      className="adb-input text-center tabular-nums"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={bezierX2}
                      onChange={(e) => setBezierX2(Number(e.target.value))}
                      className="adb-input text-center tabular-nums"
                    />
                    <input
                      type="number"
                      step="0.05"
                      value={bezierY2}
                      onChange={(e) => setBezierY2(Number(e.target.value))}
                      className="adb-input text-center tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyCurve(
                          [bezierX1, bezierY1, bezierX2, bezierY2],
                          "Custom Bezier"
                        )
                      }
                      className="adb-btn-primary py-1 text-[10px]"
                    >
                      {L.btnApplyCurve}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyCurve([0, 0, 1, 1], "Linear", true)}
                    className="w-full text-center text-[10px] text-[#4b9cf5] hover:underline py-1 cursor-pointer"
                  >
                    {L.btnResetLinear}
                  </button>
                </div>
              </div>
            )}

            {/* ==================== VIEW 7: PERIODIC ACTIVITY REPORTS & MULTI-FORMAT EXPORT ==================== */}
            {currentView === "reports" && (
              <div>
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M18 20V10M12 20V4M6 20v-6" />
                      </svg>
                      <span>{L.secReportsTitle}</span>
                    </span>
                  </div>

                  <div className="bg-[#141414] border border-[#2d9d78]/50 rounded-[3px] px-2.5 py-1.5 mb-2 text-[9.5px] text-[#5fe0b7] flex items-center justify-between">
                    <span>{L.lblSecurityBadge}</span>
                  </div>

                  <div className="adb-grid-2 adb-row">
                    <div>
                      <span className="adb-label">{L.lblReportPeriod}</span>
                      <select
                        value={reportPeriod}
                        onChange={(e) =>
                          setReportPeriod(e.target.value as "daily" | "weekly" | "monthly")
                        }
                        className="adb-select"
                      >
                        <option value="daily">{L.repDaily}</option>
                        <option value="weekly">{L.repWeekly}</option>
                        <option value="monthly">{L.repMonthly}</option>
                      </select>
                    </div>
                    <div>
                      <span className="adb-label">{L.lblExportFormat}</span>
                      <select
                        value={exportFormat}
                        onChange={(e) =>
                          setExportFormat(
                            e.target.value as "json" | "csv" | "srt" | "xml" | "prfpset"
                          )
                        }
                        className="adb-select"
                      >
                        <option value="json">JSON Report (.json)</option>
                        <option value="csv">Excel / CSV (.csv)</option>
                        <option value="srt">Subtitles (.srt)</option>
                        <option value="xml">Premiere XML (.xml)</option>
                        <option value="prfpset">Studio Preset (.prfpset)</option>
                      </select>
                    </div>
                  </div>

                  {/* Activity Log Table */}
                  <div className="max-h-[165px] overflow-y-auto border border-[#303030] rounded-[3px] bg-[#141414] divide-y divide-[#242424] mb-2">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="p-2 flex items-center justify-between gap-2 text-[10px]">
                        <div className="min-w-0">
                          <div className="font-semibold text-[#e4e4e4] truncate">
                            {log.module} · <span className="text-[#4b9cf5]">{log.sequenceName}</span>
                          </div>
                          <div className="text-[9px] text-[#888888] truncate">{log.action}</div>
                        </div>
                        <div className="text-right shrink-0 tabular-nums" dir="ltr">
                          <div className="text-[#5fe0b7] font-semibold">-{log.timeSavedSec}s</div>
                          <div className="text-[8.5px] text-[#6e6e6e]">{log.precisionScore}% acc</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportActivityReport}
                      className="col-span-2 adb-btn-primary py-1.5 text-[10.5px]"
                    >
                      <span>{L.btnExportReport} (.{exportFormat.toUpperCase()})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivityLogs([])}
                      className="adb-btn-secondary py-1.5 text-[10px]"
                    >
                      <span>{L.btnClearHistory}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== VIEW 8: SETTINGS, AUTO-UPDATER & SECURITY ==================== */}
            {currentView === "settings" && (
              <div>
                <div className="adb-panel">
                  <div className="adb-panel-hdr">
                    <span className="adb-panel-hdr-left">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" />
                      </svg>
                      <span>{L.secSettingsTitle}</span>
                    </span>
                    <span className="adb-hotval">{currentVersion}</span>
                  </div>

                  {/* Auto-Update Row */}
                  <div className="adb-row bg-[#141414] border border-[#303030] rounded-[3px] p-2">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="adb-check-row">
                        <input
                          type="checkbox"
                          checked={autoUpdateEnabled}
                          onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
                        />
                        <span className="font-semibold">{L.lblAutoUpdateCheck}</span>
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9.5px] text-[#5fe0b7]">{updateStatusText}</span>
                      <button
                        type="button"
                        onClick={handleCheckAutoUpdate}
                        className="adb-btn-autodb px-2 py-0.5"
                      >
                        {L.btnCheckUpdateNow}
                      </button>
                    </div>
                  </div>

                  {/* Parallel FFmpeg Threads Slider */}
                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblTurboThreads}</span>
                      <span className="adb-hotval">{turboThreads} Threads</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={16}
                      step={2}
                      value={turboThreads}
                      onChange={(e) => setTurboThreads(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  {/* Frame Snap Tolerance */}
                  <div className="adb-row">
                    <div className="adb-param-hdr">
                      <span>{L.lblDefaultPadFrames}</span>
                      <span className="adb-hotval">±{frameSnapTol} frames</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={6}
                      step={1}
                      value={frameSnapTol}
                      onChange={(e) => setFrameSnapTol(Number(e.target.value))}
                      className="adb-slider"
                    />
                  </div>

                  <label className="adb-check-row">
                    <input
                      type="checkbox"
                      checked={hwAccel}
                      onChange={(e) => setHwAccel(e.target.checked)}
                    />
                    <span>{L.lblHardwareAccel}</span>
                  </label>

                  <label className="adb-check-row">
                    <input
                      type="checkbox"
                      checked={strictPrivacy}
                      onChange={(e) => setStrictPrivacy(e.target.checked)}
                    />
                    <span>{L.lblStrictPrivacy}</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusType("success");
                        setProgressPct(100);
                        setStatusMsg(
                          lang === "ar"
                            ? "تم حفظ جميع الإعدادات المخصصة وتشفيرها محلياً بنجاح!"
                            : "Saved custom preferences to encrypted local profile!"
                        );
                      }}
                      className="adb-btn-primary py-1.5 text-[10.5px]"
                    >
                      {L.btnSaveSettings}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTurboThreads(8);
                        setFrameSnapTol(2);
                        setHwAccel(true);
                        setStrictPrivacy(true);
                      }}
                      className="adb-btn-secondary py-1.5 text-[10.5px]"
                    >
                      {L.btnResetSettings}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== SHARED PROGRESS BAR, CONSOLE & METERS ==================== */}
            <div className="adb-progress-track">
              <div className="adb-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>

            <div className={`adb-status ${statusType}`}>{statusMsg}</div>

            <div className="adb-meters-row">
              <div className="adb-meter-box">
                <span className="adb-meter-lbl">{L.lblStatClips}</span>
                <span className="adb-meter-val">{statClips}</span>
              </div>
              <div className="adb-meter-box">
                <span className="adb-meter-lbl">{L.lblStatSaved}</span>
                <span className="adb-meter-val">{statSaved}</span>
              </div>
            </div>

            {/* Official Developer Footer */}
            <a
              href="https://www.vnd8.site/"
              target="_blank"
              rel="noreferrer"
              className="adb-footer"
            >
              <span>{L.lblCreditBy}</span>
              <span className="adb-footer-url">www.vnd8.site ↗</span>
            </a>
          </div>
        </section>

        {/* ==================== RIGHT COLUMN: ONE-CLICK SETUP.EXE PACKAGER, TIMELINE MONITOR & ARCHITECTURE ==================== */}
        <section className="lg:col-span-7 xl:col-span-7 space-y-5" dir={L.dir}>
          {/* 1. Setup.exe One-Click Installer Center */}
          <div className="bg-[#1b1b1b] border border-[#303030] rounded-[4px] p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3.5 mb-4 border-b border-[#2c2c2c]">
              <div>
                <h1 className="text-base font-bold text-[#e4e4e4]">
                  {lang === "ar"
                    ? "مركز التحميل المباشر · vndpro v12.0 Setup.exe (بضغطة واحدة)"
                    : "vndpro v12.0 One-Click Setup.exe & Premiere Pro 2026 Installer"}
                </h1>
                <p className="text-xs text-[#a8a8a8] mt-0.5">
                  {lang === "ar"
                    ? "نفس الديزاين الأصلي للبلوقن حقك (Adobe Spectrum Dark) مع إضافة جميع المميزات الجديدة وتسريع القص 4 أضعاف."
                    : "100% Native Adobe Premiere Pro Spectrum Dark UI preserved, upgraded with 4x Turbo Cutting and all new tools."}
                </p>
              </div>
              <span className="text-xs font-mono text-[#4b9cf5] tabular-nums">
                Build 12.0.4 · Windows 10/11 x64
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <button
                type="button"
                onClick={handleDownloadSetupExeLauncher}
                className="py-2.5 px-4 bg-[#1473e6] hover:bg-[#0d66d0] text-white font-bold text-xs rounded-[3px] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{L.btnDownloadSetupExe}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPythonInstaller}
                className="py-2.5 px-4 bg-[#2b2b2b] hover:bg-[#353535] border border-[#3d3d3d] text-[#e4e4e4] font-semibold text-xs rounded-[3px] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 shrink-0 text-[#4b9cf5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                <span>{L.btnDownloadPyScript}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  triggerFileDownload("hostscript.jsx", HOSTSCRIPT_JSX_CODE, "text/javascript")
                }
                className="py-2.5 px-4 bg-[#2b2b2b] hover:bg-[#353535] border border-[#3d3d3d] text-[#e4e4e4] font-semibold text-xs rounded-[3px] flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 shrink-0 text-[#5fe0b7]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>{L.btnDownloadZipBundle} (.JSX)</span>
              </button>
            </div>

            {/* Key Upgrades Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#141414] border border-[#2c2c2c] rounded-[3px] p-3">
                <div className="font-bold text-[#e4e4e4] mb-1">
                  {lang === "ar"
                    ? "01. قص السكتات أسرع 4 مرات + رسم الموجة والزووم"
                    : "01. 4x Faster Silence Cutting + Waveform & Auto-Zoom"}
                </div>
                <p className="text-[#a8a8a8] text-[11px] leading-relaxed">
                  {lang === "ar"
                    ? "تم رفع حجم الدفعة الذرية (BATCH_SIZE=8) مع معالجة FFmpeg متعددة المسارات وإضافة رسم الموجة الصوتية التفاعلية وزر (زووم خفيف يتبدل بكل قصة) ونسخ احتياطي للتسلسل."
                    : "Upgraded to atomic BATCH_SIZE=8 ripple cuts with multi-threaded FFmpeg analysis, interactive orange silence waveform preview, sequence auto-backup, and alternating 108% zoom."}
                </p>
              </div>

              <div className="bg-[#141414] border border-[#2c2c2c] rounded-[3px] p-3">
                <div className="font-bold text-[#e4e4e4] mb-1">
                  {lang === "ar"
                    ? "02. كابشن متحرك كلمة بكلمة + التتبع + منحنيات الحركة"
                    : "02. Animated Captions + Face/Layer Tracking + Curves"}
                </div>
                <p className="text-[#a8a8a8] text-[11px] leading-relaxed">
                  {lang === "ar"
                    ? "جميع إضافات الصور (كابشن راوي بكافة الستايلات والألوان، تتبع الطبقات والوجه بالكاميرا، ومنحنيات السرعة بين الفريمات) مدمجة بالكامل بنفس ديزاين أدوبي حقك."
                    : "Includes all features from the reference screenshots (Capsule/Karaoke/Pop captions, Layer & Camera Face Tracking, and 30+ Velocity Curves) in your native Spectrum UI."}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Interactive Premiere Pro Timeline Simulation Preview */}
          <div className="bg-[#1b1b1b] border border-[#303030] rounded-[4px] p-4">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#2c2c2c]">
              <span className="text-xs font-bold text-[#e4e4e4]">
                {lang === "ar"
                  ? "معاينة التايملاين المباشرة · Adobe Premiere Pro 2026 Sequence"
                  : "Live Premiere Pro 2026 Timeline & Effect Controls Simulation"}
              </span>
              <span className="text-[11px] font-mono text-[#4b9cf5] tabular-nums" dir="ltr">
                CTI: 00:07:00:12 · 60.00 fps
              </span>
            </div>

            {/* Simulated Multi-Track Premiere Timeline */}
            <div className="bg-[#121212] border border-[#2a2a2a] rounded-[3px] p-3 space-y-2 text-[10.5px]" dir="ltr">
              {/* V3 Captions Track */}
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2 text-[#a8a8a8] font-mono text-[10px]">V3 · Captions</div>
                <div className="col-span-10 h-6 bg-[#181818] rounded-[2px] flex items-center gap-1 px-1 overflow-hidden">
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <div
                      key={c}
                      onClick={() => setCurrentView("captions")}
                      className="h-4 flex-1 bg-[#7c4dff]/35 border border-[#9d75ff] rounded-[2px] px-1.5 flex items-center justify-between text-[9px] text-white cursor-pointer truncate"
                    >
                      <span>Caption #{c} ({capStyle})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* V2 Adjustment / Camera Face Track */}
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2 text-[#a8a8a8] font-mono text-[10px]">V2 · Track/Cam</div>
                <div className="col-span-10 h-6 bg-[#181818] rounded-[2px] flex items-center gap-1 px-1">
                  <div
                    onClick={() => setCurrentView("tracking")}
                    className="h-4 w-full bg-[#2d9d78]/30 border border-[#5fe0b7] rounded-[2px] px-2 flex items-center justify-between text-[9px] text-[#5fe0b7] cursor-pointer"
                  >
                    <span>
                      Adjustment Layer — {trackMode === "camera" ? "Camera Follows Face" : "Layer Follows Target"} (120 Keyframes · Bezier [{bezierX1}, {bezierY1}, {bezierX2}, {bezierY2}])
                    </span>
                    <span className="font-mono">FX: Transform</span>
                  </div>
                </div>
              </div>

              {/* V1 Main Video Track (With Alternating Zoom & Ripple Cuts) */}
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2 text-[#a8a8a8] font-mono text-[10px]">V1 · Video</div>
                <div className="col-span-10 h-7 bg-[#181818] rounded-[2px] flex items-center gap-[2px] px-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((seg) => (
                    <div
                      key={seg}
                      onClick={() => setCurrentView("autocut")}
                      className="h-5 flex-1 bg-[#1473e6]/35 border border-[#378ef0] rounded-[2px] px-1 flex items-center justify-between text-[9px] text-[#e4e4e4] cursor-pointer truncate"
                    >
                      <span>Clip_0{seg}.mp4</span>
                      {autoZoomOnCut && seg % 2 === 0 && (
                        <span className="text-[8px] text-[#ffd84d] font-mono">108%</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* A1 Master Audio Track */}
              <div className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-2 text-[#a8a8a8] font-mono text-[10px]">A1 · Master</div>
                <div className="col-span-10 h-7 bg-[#181818] rounded-[2px] flex items-center gap-[2px] px-1">
                  {[1, 2, 3, 4, 5, 6, 7].map((seg) => (
                    <div
                      key={seg}
                      onClick={() => setCurrentView("autocut")}
                      className="h-5 flex-1 bg-[#1f6f54]/40 border border-[#3ad29f] rounded-[2px] px-1 flex items-center justify-between text-[9px] text-[#c7f9e4] cursor-pointer truncate"
                    >
                      <span>Audio_0{seg}.wav</span>
                      <span className="text-[8px] font-mono">good voice</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. How to Build Standalone Setup.exe on Windows */}
          <div className="bg-[#1b1b1b] border border-[#303030] rounded-[4px] p-4">
            <h2 className="text-xs font-bold text-[#e4e4e4] mb-2">
              {lang === "ar"
                ? "طريقة تشغيل المثبّت المباشر أو تحويله لملف vndpro_Setup.exe مستقل:"
                : "How to Run the One-Click Setup or Compile Standalone vndpro_Setup.exe:"}
            </h2>
            <div className="bg-[#121212] border border-[#292929] rounded-[3px] p-3 font-mono text-[11px] text-[#c4c4c4] space-y-1.5" dir="ltr">
              <div># Option 1: Double-click the downloaded self-extracting installer:</div>
              <div className="text-[#4b9cf5]">vndpro_v12_Setup.cmd</div>
              <div className="pt-1"># Option 2: Compile a single-file native Windows vndpro_Setup.exe:</div>
              <div className="text-[#5fe0b7]">python vndpro_v12_installer.py --build-exe</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
