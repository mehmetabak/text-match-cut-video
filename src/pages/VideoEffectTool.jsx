import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { t } from '../lib/i18n';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Play,
  RotateCcw,
  Download,
  Check,
  Edit2,
  Volume2,
  Plus,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import Switch from '../components/Switch';
import SegmentedControl from '../components/SegmentedControl';
import { createVideoFromFrames, extractAudioFromVideo } from '../lib/ffmpeg';
import { applyAudioEffect, generateTypewriterAudioTrack, playLiveTypewriterClick, muteLiveAudio } from '../lib/audioUtils';
import {
  drawKenBurnsFrame,
  drawVhsEffect,
  drawGlitchEffect,
  drawTypewriterFrame,
  drawScanlineEffect,
  drawAsciiEffect,
  drawGoogleSearchEffect,
  drawSpotlightFrame,
  drawFormulaFrame,
  drawTimelineFrame,
  drawEventTreeFrame,
  drawCounterFrame,
  drawPaperCutoutFrame,
  drawTrackingHudFrame,
  drawImageCover,
  drawVignette
} from '../renderer/effects';
import { isMobileDevice, requestScreenWakeLock, getOptimizedCanvasContext } from '../lib/canvasUtils';

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${seconds}s`;
}

export default function VideoEffectTool() {
  const { type } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = useSettingsStore(state => state.lang);
  const { user, saveProject, projects, loading: authLoading } = useAuthStore();

  const [projectId, setProjectId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const titleInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileDuration, setFileDuration] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, processing, completed, error
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [progress, setProgress] = useState(0);

  // Common Settings
  const [formatPreset, setFormatPreset] = useState('16:9'); // '16:9' | '9:16' | '1:1'
  const [hdOutput, setHdOutput] = useState(false);
  const [fastRender, setFastRender] = useState(false);
  const [duration, setDuration] = useState(5); // in seconds (3 - 300)
  const [audioFxEnabled, setAudioFxEnabled] = useState(false);

  // 1. Ken Burns Settings
  const [zoomRate, setZoomRate] = useState(0.04);
  const [zoomDirection, setZoomDirection] = useState('in'); // 'in' | 'out'
  const [panStyle, setPanStyle] = useState('center'); // 'center', 'left_to_right', 'right_to_left', 'top_to_bottom', 'bottom_to_top'

  // 2. VHS Tape Settings
  const [aberrationStrength, setAberrationStrength] = useState(1.2);
  const [trackingNoise, setTrackingNoise] = useState('medium'); // 'low' | 'medium' | 'high'
  const [scanlineFlicker, setScanlineFlicker] = useState(true);
  const [vhsTimestamp, setVhsTimestamp] = useState(true);

  // 3. Glitch Master Settings
  const [glitchIntensity, setGlitchIntensity] = useState(0.6);
  const [rgbShift, setRgbShift] = useState(14);
  const [sliceRate, setSliceRate] = useState(8);

  // 4. Typewriter Settings
  const [typewriterText, setTypewriterText] = useState(
    lang === 'tr'
      ? "Her hikaye tek bir kelimeyle başlar.\nAnimationMaker büyüleyici videolar üretir."
      : "Every story begins with a single word.\nAnimationMaker creates the magic."
  );
  const [typingSpeed, setTypingSpeed] = useState(18); // chars per sec
  const [cursorStyle, setCursorStyle] = useState('block'); // 'block' | 'line' | 'underscore'
  const [typewriterMode, setTypewriterMode] = useState('classic'); // 'classic' | 'terminal' | 'code' | 'vintage'
  const [paperSize, setPaperSize] = useState('normal'); // 'normal' | 'large'
  const [typewriterFontSize, setTypewriterFontSize] = useState('medium'); // 'small' | 'medium' | 'large' | 'xlarge'
  const [codeFileName, setCodeFileName] = useState('main.js');
  const [fontColor, setFontColor] = useState('#FFFFFF');

  // 5. Scanline CRT Settings
  const [scanlineDensity, setScanlineDensity] = useState(4);
  const [phosphorGlow, setPhosphorGlow] = useState(0.5);

  // 6. ASCII Matrix Settings
  const [asciiTheme, setAsciiTheme] = useState('matrixGreen'); // 'matrixGreen' | 'cyberNeon' | 'retroAmber' | 'trueColor'
  const [asciiResolution, setAsciiResolution] = useState(12);

  // 7. Echo Motion Settings
  const [echoCount, setEchoCount] = useState(5);
  const [echoDecay, setEchoDecay] = useState(0.7);

  // 8. Google Search Settings
  const [searchQuery, setSearchQuery] = useState(t('gsearchQueryDefault', lang));
  const [searchUrl, setSearchUrl] = useState("https://animationmaker.m0s.space › effects");
  const [searchHeadline, setSearchHeadline] = useState(t('gsearchHeadlineDefault', lang));
  const [searchSnippet, setSearchSnippet] = useState(t('gsearchSnippetDefault', lang));
  const [searchTheme, setSearchTheme] = useState('dark'); // 'dark' | 'light'

  // 9. Document Spotlight Settings
  const [spotlightSource, setSpotlightSource] = useState("NATURE • Research Article");
  const [spotlightDate, setSpotlightDate] = useState("OCTOBER 2024 • ISSUE 8192");
  const [spotlightHeadline, setSpotlightHeadline] = useState(
    lang === 'tr'
      ? "Oda Sıcaklığında Kuantum Uyumluluğu Keşfedildi"
      : "Quantum Coherence Discovered in Room Temperature Macromolecules"
  );
  const [spotlightSnippet, setSpotlightSnippet] = useState(
    lang === 'tr'
      ? "Yapılan son laboratuvar deneyleri, kuantum uyumluluğunun oda sıcaklığında korunduğunu gösterdi. Bu temel buluş, biyolojik enerji transferini ve yeni nesil kuantum teknolojilerini kökten değiştirebilir."
      : "Recent laboratory experiments demonstrate macroscopic quantum coherence sustained under ambient room temperatures. This fundamental discovery transforms our understanding of biological energy transfer and next-generation quantum computing."
  );
  const [spotlightHighlight, setSpotlightHighlight] = useState(
    lang === 'tr'
      ? "kuantum uyumluluğunun oda sıcaklığında korunduğunu"
      : "macroscopic quantum coherence sustained under ambient room temperatures"
  );
  const [spotlightColor, setSpotlightColor] = useState("yellow"); // 'yellow' | 'cyan' | 'green' | 'pink'
  const [spotlightTheme, setSpotlightTheme] = useState("archival"); // 'archival' | 'modern' | 'dark'
  const [spotlightPaperFormat, setSpotlightPaperFormat] = useState("standard"); // 'standard' | 'a4' | 'expanded'
  const [spotlightFontSize, setSpotlightFontSize] = useState(20); // 12px to 38px (default 20)

  // 10. LaTeX Math & Science Formula Settings
  const [formulaTitle, setFormulaTitle] = useState("EULER'S IDENTITY");
  const [formulaLatex, setFormulaLatex] = useState("e^{i\\pi} + 1 = 0");
  const [formulaDesc, setFormulaDesc] = useState(
    lang === 'tr'
      ? "Matematiğin en zarif ve temel denklemi"
      : "The most beautiful equation in mathematics"
  );
  const [formulaTheme, setFormulaTheme] = useState("blackboard"); // 'blackboard' | 'blueprint' | 'quantum' | 'clean'
  const [formulaGlow, setFormulaGlow] = useState("cyan"); // 'cyan' | 'gold' | 'purple' | 'emerald'

  // 11. Storytelling Timeline Settings
  const [timelineTitle, setTimelineTitle] = useState(
    lang === 'tr' ? "MODERN ÇAĞIN KRONOLOJİSİ" : "THE CHRONICLES OF MODERN AGE"
  );
  const [timelineEvents, setTimelineEvents] = useState(
    lang === 'tr'
      ? "1969 | Ay İnişi | Apollo 11 görevi başarıyla tamamlandı\n1989 | Berlin Duvarı | Soğuk Savaşın Sonu\n2000 | İnternet Devrimi | Dijital Çağ Başladı\n2024 | Yapay Zeka | Generative AI Dönemi"
      : "1969 | Moon Landing | Apollo 11 mission succeeded\n1989 | Berlin Wall | End of the Cold War\n2000 | Internet Age | Global digital revolution\n2024 | Artificial Intelligence | Generative AI transformation"
  );
  const [timelineTheme, setTimelineTheme] = useState("cyberDark"); // 'cyberDark' | 'documentary' | 'minimalWhite' | 'emeraldBio'
  const [timelineStyle, setTimelineStyle] = useState("ruler"); // 'ruler' | 'minimal' | 'neonPulse' | 'documentary'
  const [timelineStartMilestone, setTimelineStartMilestone] = useState(0);
  const [timelineEndMilestone, setTimelineEndMilestone] = useState(3);
  const [timelineZoom, setTimelineZoom] = useState(1.0);

  // 12. Vox Event & Plan Tree Settings
  const [treeRootTitle, setTreeRootTitle] = useState(
    lang === 'tr' ? "SANAYİ DEVRİMİ" : "INDUSTRIAL REVOLUTION"
  );
  const [treeRootSubtitle, setTreeRootSubtitle] = useState(
    lang === 'tr' ? "TARİHİ DÖNÜM NOKTASI • 18. YÜZYIL" : "KEY TURNING POINT • 18TH CENTURY"
  );
  const [treeBranches, setTreeBranches] = useState(
    lang === 'tr'
      ? "Hızlı Otomasyon | Makineler insan emeğinin yerini aldı | %85 Verim\nKentleşme Dalgası | Nüfus sanayi şehirlerine göç etti | +%340 Büyüme\nKüresel Ticaret | Yeni deniz ve demiryolu hatları açıldı | $4.2B Hacim"
      : "Rapid Automation | Machines replace manual labor | 85% Efficiency\nUrban Shift | Population migrates to industrial cities | +340% Growth\nNew Global Trade | Maritime routes expand worldwide | $4.2B Volume"
  );
  const [treeTheme, setTreeTheme] = useState("voxGold"); // 'voxGold' | 'neonCyber' | 'cleanSlate'
  const [treeConnectorStyle, setTreeConnectorStyle] = useState("bezierCurve"); // 'bezierCurve' | 'circuit' | 'straightLaser'

  // 13. Kinetic Stat Counter & Metric Bar Settings
  const [counterHeadline, setCounterHeadline] = useState(
    lang === 'tr' ? "KÜRESEL TEMİZ ENERJİ KAPASİTESİ" : "GLOBAL CLEAN ENERGY CAPACITY"
  );
  const [counterSubtitle, setCounterSubtitle] = useState(
    lang === 'tr' ? "ULUSLARARASI ENERJİ AJANSI (IEA) • 1990 - 2024" : "INTERNATIONAL ENERGY AGENCY • 1990 - 2024"
  );
  const [counterVal1, setCounterVal1] = useState(4200);
  const [counterLabel1, setCounterLabel1] = useState(
    lang === 'tr' ? "2024 Güncel Kapasite" : "2024 Current Capacity"
  );
  const [counterVal2, setCounterVal2] = useState(850);
  const [counterLabel2, setCounterLabel2] = useState(
    lang === 'tr' ? "1990 Başlangıç Seviyesi" : "1990 Baseline Level"
  );
  const [counterPrefix, setCounterPrefix] = useState("");
  const [counterSuffix, setCounterSuffix] = useState(" GW");
  const [counterTrendTag, setCounterTrendTag] = useState("+394% SURGE ↗");
  const [counterTheme, setCounterTheme] = useState("financial"); // 'financial' | 'cyberMetric' | 'warningRed' | 'slateClean'
  const [counterShowGauges, setCounterShowGauges] = useState(true);

  // 13. Paper Cutout Collage Settings (FREE)
  const [paperHeadline, setPaperHeadline] = useState(
    lang === 'tr' ? "GİZLİ ARŞİV BELGELERİ SIZDIRILDI" : "CLASSIFIED DOSSIER LEAKED"
  );
  const [paperSnippet, setPaperSnippet] = useState(
    lang === 'tr'
      ? "Gizli araştırmacı gazetecilik raporları, kamuoyundan saklanan stratejik projeleri ve tutanakları gözler önüne seriyor."
      : "Confidential investigative reports reveal undisclosed operations and strategic records."
  );
  const [paperSourceTag, setPaperSourceTag] = useState("NATIONAL ARCHIVES • FILE #741");
  const [paperDateTag, setPaperDateTag] = useState(lang === 'tr' ? "KASIM 1974" : "OCTOBER 1974");
  const [paperTheme, setPaperTheme] = useState("vintage"); // 'vintage' | 'noir' | 'neonNote' | 'cardstock'
  const [paperTornStyle, setPaperTornStyle] = useState("rippedEdge"); // 'rippedEdge' | 'polaroid' | 'stampTicket'
  const [paperTapeColor, setPaperTapeColor] = useState("washiGold"); // 'washiGold' | 'hazardStripe' | 'crimsonRed' | 'clearMatte'
  const [paperJitter, setPaperJitter] = useState(true);
  const [paperHighlight, setPaperHighlight] = useState(
    lang === 'tr' ? "stratejik projeleri" : "undisclosed operations"
  );
  const [paperImageScale, setPaperImageScale] = useState(1.0);
  const [paperImagePanY, setPaperImagePanY] = useState(0);
  const [paperImageHeight, setPaperImageHeight] = useState(0.35);
  const [paperImageFit, setPaperImageFit] = useState("cover"); // 'cover' | 'contain'

  // 14. AI Target & Subject Tracker HUD Settings (PRO)
  const [trackingTargetLabel, setTrackingTargetLabel] = useState("[CONFIRMED ID: SUBJECT 09]");
  const [trackingCategory, setTrackingCategory] = useState("FACIAL BIOMETRICS • 4K SENSOR");
  const [trackingConfidence, setTrackingConfidence] = useState(99.4);
  const [trackingCoordinates, setTrackingCoordinates] = useState("LAT: 37.7749° N | LON: 122.4194° W");
  const [trackingHudTheme, setTrackingHudTheme] = useState("cyberCyan"); // 'cyberCyan' | 'tacticalAmber' | 'crimsonAlert' | 'matrixEmerald'
  const [trackingReticleStyle, setTrackingReticleStyle] = useState("cornerBrackets"); // 'cornerBrackets' | 'circularSniper' | 'fullHud'
  const [trackingScanBeam, setTrackingScanBeam] = useState(true);
  const [trackingLockAnimation, setTrackingLockAnimation] = useState(true);
  const [trackingImageScale, setTrackingImageScale] = useState(1.0);
  const [trackingImagePanX, setTrackingImagePanX] = useState(0);
  const [trackingImagePanY, setTrackingImagePanY] = useState(0);
  const [trackingBoxScale, setTrackingBoxScale] = useState(1.0);
  const [trackingBoxOffsetX, setTrackingBoxOffsetX] = useState(0);
  const [trackingBoxOffsetY, setTrackingBoxOffsetY] = useState(0);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const sourceMediaRef = useRef(null);
  const hasInitialized = useRef(false);
  const lastSavedSnapshotRef = useRef(null);
  const lastCharIndexRef = useRef(0);
  const audioFxEnabledRef = useRef(audioFxEnabled);

  const handleAudioToggle = (val) => {
    const isChecked = typeof val === 'boolean' ? val : Boolean(val?.target?.checked ?? val);
    setAudioFxEnabled(isChecked);
    audioFxEnabledRef.current = isChecked;
    if (!isChecked) {
      muteLiveAudio();
    }
  };

  const handleToggleHdOutput = (val) => {
    const isChecked = typeof val === 'boolean' ? val : Boolean(val?.target?.checked ?? val);
    setHdOutput(isChecked);
    if (isChecked) {
      setFastRender(false);
    }
  };

  const handleToggleFastRender = (val) => {
    const isChecked = typeof val === 'boolean' ? val : Boolean(val?.target?.checked ?? val);
    setFastRender(isChecked);
    if (isChecked) {
      setHdOutput(false);
    }
  };

  useEffect(() => {
    audioFxEnabledRef.current = audioFxEnabled;
  }, [audioFxEnabled]);

  const validTypes = ['ken-burns', 'vhs-tape', 'glitch-master', 'typewriter', 'scanline', 'ascii', 'echo', 'gsearch', 'spotlight', 'formula', 'timeline', 'tree', 'counter', 'paper', 'tracking'];
  const isProTool = !['gsearch', 'spotlight', 'formula', 'timeline', 'tree', 'counter', 'paper'].includes(type);

  // Route & Pro Access Protection
  useEffect(() => {
    if (!validTypes.includes(type)) {
      navigate('/tools', { replace: true });
      return;
    }

    if (!authLoading && isProTool && !user?.isPro) {
      navigate('/pricing', { replace: true });
    }
  }, [type, isProTool, authLoading, user?.isPro, navigate]);

  // Tool Meta (Title & Description formatted like MatchCutTool)
  const toolMetaMap = {
    'ken-burns': {
      title1: 'Ken Burns',
      title2: 'Pro',
      desc: t('tool_kenburns_desc', lang) || t('toolKenBurnsDesc', lang)
    },
    'vhs-tape': {
      title1: 'VHS',
      title2: 'Tape',
      desc: t('tool_vhs_desc', lang)
    },
    'glitch-master': {
      title1: 'Glitch',
      title2: 'Master',
      desc: t('tool_glitch_desc', lang) || t('toolGlitchDesc', lang)
    },
    'typewriter': {
      title1: 'Typewriter',
      title2: 'Terminal',
      desc: t('tool_typewriter_desc', lang)
    },
    'scanline': {
      title1: 'CRT',
      title2: 'Scanline',
      desc: t('tool_scanline_desc', lang)
    },
    'ascii': {
      title1: 'ASCII',
      title2: 'Matrix',
      desc: t('tool_ascii_desc', lang)
    },
    'echo': {
      title1: 'Echo',
      title2: 'Motion',
      desc: t('tool_echo_desc', lang)
    },
    'gsearch': {
      title1: 'Google',
      title2: 'Search',
      desc: t('tool_gsearch_desc', lang)
    },
    'spotlight': {
      title1: 'Document',
      title2: 'Spotlight',
      desc: t('tool_spotlight_desc', lang)
    },
    'formula': {
      title1: 'LaTeX',
      title2: 'Formula',
      desc: t('tool_formula_desc', lang)
    },
    'timeline': {
      title1: 'Story',
      title2: 'Timeline',
      desc: t('tool_timeline_desc', lang)
    },
    'tree': {
      title1: 'Event',
      title2: 'Tree',
      desc: t('tool_tree_desc', lang)
    },
    'counter': {
      title1: 'Stat',
      title2: 'Counter',
      desc: t('tool_counter_desc', lang)
    },
    'paper': {
      title1: 'Paper',
      title2: 'Cutout',
      desc: t('tool_paper_desc', lang)
    },
    'tracking': {
      title1: 'Target',
      title2: 'Tracker HUD',
      desc: t('tool_tracking_desc', lang)
    }
  };

  const toolInfo = toolMetaMap[type] || { title1: type, title2: 'Tool', desc: 'AnimationMaker Pro Video Effect' };

  // Helper to build settings object
  const getCurrentSettings = () => ({
    projectName: projectName.trim(),
    formatPreset,
    hdOutput: Boolean(hdOutput),
    fastRender: Boolean(fastRender),
    duration: Number(duration) || 5,
    audioFxEnabled: Boolean(audioFxEnabled),
    zoomRate: Number(zoomRate) || 0.04,
    zoomDirection,
    panStyle,
    aberrationStrength: Number(aberrationStrength) || 1.2,
    trackingNoise,
    scanlineFlicker: Boolean(scanlineFlicker),
    vhsTimestamp: Boolean(vhsTimestamp),
    glitchIntensity: Number(glitchIntensity) || 0.6,
    rgbShift: Number(rgbShift) || 14,
    sliceRate: Number(sliceRate) || 8,
    typewriterText,
    typingSpeed: Number(typingSpeed) || 18,
    cursorStyle,
    typewriterMode,
    paperSize,
    typewriterFontSize,
    codeFileName,
    fontColor,
    scanlineDensity: Number(scanlineDensity) || 4,
    phosphorGlow: Number(phosphorGlow) || 0.5,
    asciiTheme,
    asciiResolution: Number(asciiResolution) || 12,
    echoCount: Number(echoCount) || 5,
    echoDecay: Number(echoDecay) || 0.7,
    searchQuery,
    searchUrl,
    searchHeadline,
    searchSnippet,
    searchTheme,
    spotlightSource,
    spotlightDate,
    spotlightHeadline,
    spotlightSnippet,
    spotlightHighlight,
    spotlightColor,
    spotlightTheme,
    spotlightPaperFormat,
    spotlightFontSize,
    formulaTitle,
    formulaLatex,
    formulaDesc,
    formulaTheme,
    formulaGlow,
    timelineTitle,
    timelineEvents,
    timelineTheme,
    timelineStyle,
    timelineStartMilestone: Number(timelineStartMilestone) || 0,
    timelineEndMilestone: Number(timelineEndMilestone) || 0,
    timelineZoom: Number(timelineZoom) || 1.0,
    treeRootTitle,
    treeRootSubtitle,
    treeBranches,
    treeTheme,
    treeConnectorStyle,
    counterHeadline,
    counterSubtitle,
    counterVal1: Number(counterVal1) || 0,
    counterLabel1,
    counterVal2: Number(counterVal2) || 0,
    counterLabel2,
    counterPrefix,
    counterSuffix,
    counterTrendTag,
    counterTheme,
    counterShowGauges: Boolean(counterShowGauges),
    paperHeadline,
    paperSnippet,
    paperSourceTag,
    paperDateTag,
    paperTheme,
    paperTornStyle,
    paperTapeColor,
    paperJitter: Boolean(paperJitter),
    paperHighlight,
    paperImageScale: Number(paperImageScale) || 1.0,
    paperImagePanY: Number(paperImagePanY) || 0,
    paperImageHeight: Number(paperImageHeight) || 0.35,
    paperImageFit,
    trackingTargetLabel,
    trackingCategory,
    trackingConfidence: Number(trackingConfidence) || 99.4,
    trackingCoordinates,
    trackingHudTheme,
    trackingReticleStyle,
    trackingScanBeam: Boolean(trackingScanBeam),
    trackingLockAnimation: Boolean(trackingLockAnimation),
    trackingImageScale: Number(trackingImageScale) || 1.0,
    trackingImagePanX: Number(trackingImagePanX) || 0,
    trackingImagePanY: Number(trackingImagePanY) || 0,
    trackingBoxScale: Number(trackingBoxScale) || 1.0,
    trackingBoxOffsetX: Number(trackingBoxOffsetX) || 0,
    trackingBoxOffsetY: Number(trackingBoxOffsetY) || 0
  });

  const loadedDraftIdRef = useRef(null);
  const isAutoSavingRef = useRef(false);

  const resetToDefaults = () => {
    loadedDraftIdRef.current = null;
    setSearchParams({}, { replace: true });
    setProjectId(null);
    setProjectName('');
    setFormatPreset('16:9');
    setHdOutput(false);
    setFastRender(false);
    setDuration(5);
    setAudioFxEnabled(false);
    audioFxEnabledRef.current = false;
    muteLiveAudio();
    setZoomRate(0.04);
    setZoomDirection('in');
    setPanStyle('center');
    setAberrationStrength(1.2);
    setTrackingNoise('medium');
    setScanlineFlicker(true);
    setVhsTimestamp(true);
    setGlitchIntensity(0.6);
    setRgbShift(14);
    setSliceRate(8);
    setTypewriterText(
      t('typewriterDefaultText', lang) || (
        lang === 'tr'
          ? "Her hikaye tek bir kelimeyle başlar.\nAnimationMaker büyüleyici videolar üretir."
          : "Every story begins with a single word.\nAnimationMaker creates the magic."
      )
    );
    setTypingSpeed(18);
    setCursorStyle('block');
    setTypewriterMode('classic');
    setPaperSize('normal');
    setTypewriterFontSize('medium');
    setCodeFileName('main.js');
    setFontColor('#FFFFFF');
    setScanlineDensity(4);
    setPhosphorGlow(0.5);
    setAsciiTheme('matrixGreen');
    setAsciiResolution(12);
    setEchoCount(5);
    setEchoDecay(0.7);
    setSearchQuery(t('gsearchQueryDefault', lang));
    setSearchUrl("https://animationmaker.m0s.space › effects");
    setSearchHeadline(t('gsearchHeadlineDefault', lang));
    setSearchSnippet(t('gsearchSnippetDefault', lang));
    setSearchTheme('dark');
    setSpotlightSource("NATURE • Research Article");
    setSpotlightDate("OCTOBER 2024 • ISSUE 8192");
    setSpotlightHeadline(
      lang === 'tr'
        ? "Oda Sıcaklığında Kuantum Uyumluluğu Keşfedildi"
        : "Quantum Coherence Discovered in Room Temperature Macromolecules"
    );
    setSpotlightSnippet(
      lang === 'tr'
        ? "Yapılan son laboratuvar deneyleri, kuantum uyumluluğunun oda sıcaklığında korunduğunu gösterdi. Bu temel buluş, biyolojik enerji transferini ve yeni nesil kuantum teknolojilerini kökten değiştirebilir."
        : "Recent laboratory experiments demonstrate macroscopic quantum coherence sustained under ambient room temperatures. This fundamental discovery transforms our understanding of biological energy transfer and next-generation quantum computing."
    );
    setSpotlightHighlight(
      lang === 'tr'
        ? "kuantum uyumluluğunun oda sıcaklığında korunduğunu"
        : "macroscopic quantum coherence sustained under ambient room temperatures"
    );
    setSpotlightColor("yellow");
    setSpotlightTheme("archival");
    setSpotlightPaperFormat("standard");
    setSpotlightFontSize(20);
    setFormulaTitle("EULER'S IDENTITY");
    setFormulaLatex("e^{i\\pi} + 1 = 0");
    setFormulaDesc(
      lang === 'tr'
        ? "Matematiğin en zarif ve temel denklemi"
        : "The most beautiful equation in mathematics"
    );
    setFormulaTheme("blackboard");
    setFormulaGlow("cyan");
    setTimelineTitle(lang === 'tr' ? "MODERN ÇAĞIN KRONOLOJİSİ" : "THE CHRONICLES OF MODERN AGE");
    setTimelineEvents(
      lang === 'tr'
        ? "1969 | Ay İnişi | Apollo 11 görevi başarıyla tamamlandı\n1989 | Berlin Duvarı | Soğuk Savaşın Sonu\n2000 | İnternet Devrimi | Dijital Çağ Başladı\n2024 | Yapay Zeka | Generative AI Dönemi"
        : "1969 | Moon Landing | Apollo 11 mission succeeded\n1989 | Berlin Wall | End of the Cold War\n2000 | Internet Age | Global digital revolution\n2024 | Artificial Intelligence | Generative AI transformation"
    );
    setTimelineTheme("cyberDark");
    setTimelineStyle("ruler");
    setTimelineStartMilestone(0);
    setTimelineEndMilestone(3);
    setTimelineZoom(1.0);
    setTreeRootTitle(lang === 'tr' ? "SANAYİ DEVRİMİ" : "INDUSTRIAL REVOLUTION");
    setTreeRootSubtitle(lang === 'tr' ? "TARİHİ DÖNÜM NOKTASI • 18. YÜZYIL" : "KEY TURNING POINT • 18TH CENTURY");
    setTreeBranches(
      lang === 'tr'
        ? "Hızlı Otomasyon | Makineler insan emeğinin yerini aldı | %85 Verim\nKentleşme Dalgası | Nüfus sanayi şehirlerine göç etti | +%340 Büyüme\nKüresel Ticaret | Yeni deniz ve demiryolu hatları açıldı | $4.2B Hacim"
        : "Rapid Automation | Machines replace manual labor | 85% Efficiency\nUrban Shift | Population migrates to industrial cities | +340% Growth\nNew Global Trade | Maritime routes expand worldwide | $4.2B Volume"
    );
    setTreeTheme("voxGold");
    setTreeConnectorStyle("bezierCurve");
    setCounterHeadline(lang === 'tr' ? "KÜRESEL TEMİZ ENERJİ KAPASİTESİ" : "GLOBAL CLEAN ENERGY CAPACITY");
    setCounterSubtitle(lang === 'tr' ? "ULUSLARARASI ENERJİ AJANSI (IEA) • 1990 - 2024" : "INTERNATIONAL ENERGY AGENCY • 1990 - 2024");
    setCounterVal1(4200);
    setCounterLabel1(lang === 'tr' ? "2024 Güncel Kapasite" : "2024 Current Capacity");
    setCounterVal2(850);
    setCounterLabel2(lang === 'tr' ? "1990 Başlangıç Seviyesi" : "1990 Baseline Level");
    setCounterPrefix("");
    setCounterSuffix(" GW");
    setCounterTrendTag("+394% SURGE ↗");
    setCounterTheme("financial");
    setCounterShowGauges(true);
    setPaperHeadline(lang === 'tr' ? "GİZLİ ARŞİV BELGELERİ SIZDIRILDI" : "CLASSIFIED DOSSIER LEAKED");
    setPaperSnippet(
      lang === 'tr'
        ? "Gizli araştırmacı gazetecilik raporları, kamuoyundan saklanan stratejik projeleri ve tutanakları gözler önüne seriyor."
        : "Confidential investigative reports reveal undisclosed operations and strategic records."
    );
    setPaperSourceTag("NATIONAL ARCHIVES • FILE #741");
    setPaperDateTag(lang === 'tr' ? "KASIM 1974" : "OCTOBER 1974");
    setPaperTheme("vintage");
    setPaperTornStyle("rippedEdge");
    setPaperTapeColor("washiGold");
    setPaperJitter(true);
    setPaperHighlight(lang === 'tr' ? "stratejik projeleri" : "undisclosed operations");
    setPaperImageScale(1.0);
    setPaperImagePanY(0);
    setPaperImageHeight(0.35);
    setPaperImageFit("cover");
    setTrackingTargetLabel("[CONFIRMED ID: SUBJECT 09]");
    setTrackingCategory("FACIAL BIOMETRICS • 4K SENSOR");
    setTrackingConfidence(99.4);
    setTrackingCoordinates("LAT: 37.7749° N | LON: 122.4194° W");
    setTrackingHudTheme("cyberCyan");
    setTrackingReticleStyle("cornerBrackets");
    setTrackingScanBeam(true);
    setTrackingLockAnimation(true);
    setTrackingImageScale(1.0);
    setTrackingImagePanX(0);
    setTrackingImagePanY(0);
    setTrackingBoxScale(1.0);
    setTrackingBoxOffsetX(0);
    setTrackingBoxOffsetY(0);
    lastSavedSnapshotRef.current = null;
  };

  const applyDraftSettings = useCallback((s, draftId) => {
    if (!s) return;
    setProjectId(draftId);
    loadedDraftIdRef.current = draftId;
    
    // Yüklenen taslağın snapshot'ını kaydet ki hemen tekrar gereksiz auto-save tetiklenmesin
    lastSavedSnapshotRef.current = JSON.stringify(s);

    if (s.projectName) setProjectName(s.projectName);
    if (s.formatPreset) setFormatPreset(s.formatPreset);
    if (s.hdOutput !== undefined) {
      setHdOutput(Boolean(s.hdOutput));
      if (s.hdOutput) {
        setFastRender(false);
      } else if (s.fastRender !== undefined) {
        setFastRender(Boolean(s.fastRender));
      }
    } else if (s.fastRender !== undefined) {
      setFastRender(Boolean(s.fastRender));
    }
    if (s.duration) setDuration(s.duration);
    if (s.audioFxEnabled !== undefined) {
      setAudioFxEnabled(Boolean(s.audioFxEnabled));
      audioFxEnabledRef.current = Boolean(s.audioFxEnabled);
    }
    if (s.zoomRate !== undefined) setZoomRate(s.zoomRate);
    if (s.zoomDirection) setZoomDirection(s.zoomDirection);
    if (s.panStyle) setPanStyle(s.panStyle);
    if (s.aberrationStrength !== undefined) setAberrationStrength(s.aberrationStrength);
    if (s.trackingNoise) setTrackingNoise(s.trackingNoise);
    if (s.scanlineFlicker !== undefined) setScanlineFlicker(s.scanlineFlicker);
    if (s.vhsTimestamp !== undefined) setVhsTimestamp(s.vhsTimestamp);
    if (s.glitchIntensity !== undefined) setGlitchIntensity(s.glitchIntensity);
    if (s.rgbShift !== undefined) setRgbShift(s.rgbShift);
    if (s.sliceRate !== undefined) setSliceRate(s.sliceRate);
    if (s.typewriterText !== undefined) setTypewriterText(s.typewriterText);
    if (s.typingSpeed !== undefined) setTypingSpeed(s.typingSpeed);
    if (s.cursorStyle) setCursorStyle(s.cursorStyle);
    if (s.typewriterMode) setTypewriterMode(s.typewriterMode);
    if (s.paperSize) setPaperSize(s.paperSize);
    if (s.typewriterFontSize) setTypewriterFontSize(s.typewriterFontSize);
    if (s.codeFileName) setCodeFileName(s.codeFileName);
    if (s.fontColor) setFontColor(s.fontColor);
    if (s.scanlineDensity !== undefined) setScanlineDensity(s.scanlineDensity);
    if (s.phosphorGlow !== undefined) setPhosphorGlow(s.phosphorGlow);
    if (s.asciiTheme) setAsciiTheme(s.asciiTheme);
    if (s.asciiResolution !== undefined) setAsciiResolution(s.asciiResolution);
    if (s.echoCount !== undefined) setEchoCount(s.echoCount);
    if (s.echoDecay !== undefined) setEchoDecay(s.echoDecay);
    if (s.searchQuery) setSearchQuery(s.searchQuery);
    if (s.searchUrl) setSearchUrl(s.searchUrl);
    if (s.searchHeadline) setSearchHeadline(s.searchHeadline);
    if (s.searchSnippet) setSearchSnippet(s.searchSnippet);
    if (s.searchTheme) setSearchTheme(s.searchTheme);
    if (s.spotlightSource) setSpotlightSource(s.spotlightSource);
    if (s.spotlightDate) setSpotlightDate(s.spotlightDate);
    if (s.spotlightHeadline) setSpotlightHeadline(s.spotlightHeadline);
    if (s.spotlightSnippet) setSpotlightSnippet(s.spotlightSnippet);
    if (s.spotlightHighlight) setSpotlightHighlight(s.spotlightHighlight);
    if (s.spotlightColor) setSpotlightColor(s.spotlightColor);
    if (s.spotlightTheme) setSpotlightTheme(s.spotlightTheme);
    if (s.spotlightPaperFormat) setSpotlightPaperFormat(s.spotlightPaperFormat);
    if (s.spotlightFontSize !== undefined) {
      if (typeof s.spotlightFontSize === 'string') {
        const sizeMap = { small: 15, medium: 20, large: 26, xlarge: 34 };
        setSpotlightFontSize(sizeMap[s.spotlightFontSize] || 20);
      } else {
        setSpotlightFontSize(Number(s.spotlightFontSize) || 20);
      }
    }
    if (s.formulaTitle) setFormulaTitle(s.formulaTitle);
    if (s.formulaLatex) setFormulaLatex(s.formulaLatex);
    if (s.formulaDesc) setFormulaDesc(s.formulaDesc);
    if (s.formulaTheme) setFormulaTheme(s.formulaTheme);
    if (s.formulaGlow) setFormulaGlow(s.formulaGlow);
    if (s.timelineTitle) setTimelineTitle(s.timelineTitle);
    if (s.timelineEvents) setTimelineEvents(s.timelineEvents);
    if (s.timelineTheme) setTimelineTheme(s.timelineTheme);
    if (s.timelineStyle) setTimelineStyle(s.timelineStyle);
    if (s.timelineStartMilestone !== undefined) setTimelineStartMilestone(Number(s.timelineStartMilestone));
    if (s.timelineEndMilestone !== undefined) setTimelineEndMilestone(Number(s.timelineEndMilestone));
    if (s.timelineZoom !== undefined) setTimelineZoom(Number(s.timelineZoom));
    if (s.treeRootTitle) setTreeRootTitle(s.treeRootTitle);
    if (s.treeRootSubtitle) setTreeRootSubtitle(s.treeRootSubtitle);
    if (s.treeBranches) setTreeBranches(s.treeBranches);
    if (s.treeTheme) setTreeTheme(s.treeTheme);
    if (s.treeConnectorStyle) setTreeConnectorStyle(s.treeConnectorStyle);
    if (s.counterHeadline) setCounterHeadline(s.counterHeadline);
    if (s.counterSubtitle) setCounterSubtitle(s.counterSubtitle);
    if (s.counterVal1 !== undefined) setCounterVal1(Number(s.counterVal1));
    if (s.counterLabel1) setCounterLabel1(s.counterLabel1);
    if (s.counterVal2 !== undefined) setCounterVal2(Number(s.counterVal2));
    if (s.counterLabel2) setCounterLabel2(s.counterLabel2);
    if (s.counterPrefix !== undefined) setCounterPrefix(s.counterPrefix);
    if (s.counterSuffix !== undefined) setCounterSuffix(s.counterSuffix);
    if (s.counterTrendTag !== undefined) setCounterTrendTag(s.counterTrendTag);
    if (s.counterTheme) setCounterTheme(s.counterTheme);
    if (s.counterShowGauges !== undefined) setCounterShowGauges(Boolean(s.counterShowGauges));
    if (s.paperHeadline) setPaperHeadline(s.paperHeadline);
    if (s.paperSnippet) setPaperSnippet(s.paperSnippet);
    if (s.paperSourceTag) setPaperSourceTag(s.paperSourceTag);
    if (s.paperDateTag) setPaperDateTag(s.paperDateTag);
    if (s.paperTheme) setPaperTheme(s.paperTheme);
    if (s.paperTornStyle) setPaperTornStyle(s.paperTornStyle);
    if (s.paperTapeColor) setPaperTapeColor(s.paperTapeColor);
    if (s.paperJitter !== undefined) setPaperJitter(Boolean(s.paperJitter));
    if (s.paperHighlight) setPaperHighlight(s.paperHighlight);
    if (s.paperImageScale !== undefined) setPaperImageScale(Number(s.paperImageScale));
    if (s.paperImagePanY !== undefined) setPaperImagePanY(Number(s.paperImagePanY));
    if (s.paperImageHeight !== undefined) setPaperImageHeight(Number(s.paperImageHeight));
    if (s.paperImageFit) setPaperImageFit(s.paperImageFit);
    if (s.trackingTargetLabel) setTrackingTargetLabel(s.trackingTargetLabel);
    if (s.trackingCategory) setTrackingCategory(s.trackingCategory);
    if (s.trackingConfidence !== undefined) setTrackingConfidence(Number(s.trackingConfidence));
    if (s.trackingCoordinates) setTrackingCoordinates(s.trackingCoordinates);
    if (s.trackingHudTheme) setTrackingHudTheme(s.trackingHudTheme);
    if (s.trackingReticleStyle) setTrackingReticleStyle(s.trackingReticleStyle);
    if (s.trackingScanBeam !== undefined) setTrackingScanBeam(Boolean(s.trackingScanBeam));
    if (s.trackingLockAnimation !== undefined) setTrackingLockAnimation(Boolean(s.trackingLockAnimation));
    if (s.trackingImageScale !== undefined) setTrackingImageScale(Number(s.trackingImageScale));
    if (s.trackingImagePanX !== undefined) setTrackingImagePanX(Number(s.trackingImagePanX));
    if (s.trackingImagePanY !== undefined) setTrackingImagePanY(Number(s.trackingImagePanY));
    if (s.trackingBoxScale !== undefined) setTrackingBoxScale(Number(s.trackingBoxScale));
    if (s.trackingBoxOffsetX !== undefined) setTrackingBoxOffsetX(Number(s.trackingBoxOffsetX));
    if (s.trackingBoxOffsetY !== undefined) setTrackingBoxOffsetY(Number(s.trackingBoxOffsetY));
  }, []);

  // 1. Load Draft / Restore Project (from query param or localStorage or cloud projects)
  useEffect(() => {
    const draftId = searchParams.get('draft');

    if (!draftId) {
      if (loadedDraftIdRef.current !== null || !hasInitialized.current) {
        hasInitialized.current = true;
        loadedDraftIdRef.current = null;
        setProjectId(null);
        setProjectName('');
        if (!projectId) {
          resetToDefaults();
        }
      }
      return;
    }

    // Eğer bu taslak zaten belleğe yüklenmiş ve aktif düzenleniyorsa tekrar üzerine yazma!
    if (draftId === loadedDraftIdRef.current) {
      return;
    }

    hasInitialized.current = true;

    // 1. Önce localStorage'dan dene (Projects sayfasından tıklandıysa)
    const savedDraft = localStorage.getItem('draft_project');
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft);
        if (draftData.id === draftId) {
          applyDraftSettings(draftData, draftId);
          localStorage.removeItem('draft_project');
          return;
        }
      } catch (e) {
        console.warn("Draft parsing error", e);
      }
    }

    // 2. Araç özelindeki yerel taslaktan dene
    const toolDraft = localStorage.getItem('draft_project_' + type);
    if (toolDraft) {
      try {
        const draftData = JSON.parse(toolDraft);
        if (draftData.id === draftId) {
          applyDraftSettings(draftData.settings || draftData, draftId);
          return;
        }
      } catch (e) {
        console.warn("Tool draft parse error", e);
      }
    }

    // 3. Bellekteki projelerden ara
    if (projects && projects.length > 0) {
      const cloudDraft = projects.find(p => p.id === draftId);
      if (cloudDraft && cloudDraft.settings) {
        applyDraftSettings(cloudDraft.settings, draftId);
        return;
      }
    }

    // 4. Doğrudan Firestore'dan çekmeyi dene
    const fetchAuthStoreProject = useAuthStore.getState().fetchProjectDoc;
    if (fetchAuthStoreProject) {
      fetchAuthStoreProject(draftId).then((docData) => {
        if (docData && docData.settings && loadedDraftIdRef.current !== draftId) {
          applyDraftSettings(docData.settings, draftId);
        }
      }).catch(err => {
        console.warn("Draft direct fetch warning:", err);
      });
    }
  }, [searchParams, projects, type, applyDraftSettings]);

  // 2. Debounced Auto-Save to Firestore (1:1 with MatchCutTool)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const projectSettings = getCurrentSettings();

      // Firestore undefined değerleri kabul etmez, temizle
      Object.keys(projectSettings).forEach(key => {
        if (projectSettings[key] === undefined) {
          delete projectSettings[key];
        }
      });

      // İsmi de ayarlara ekle ki Firestore'a gitsin
      if (projectName.trim()) {
        projectSettings.projectName = projectName.trim();
      }

      const currentSnapshot = JSON.stringify(projectSettings);

      // Değişiklik yoksa kaydetme! (Sürekli kaydetme döngüsünü engeller)
      if (currentSnapshot === lastSavedSnapshotRef.current) {
        return;
      }

      // Check if current settings match the initial defaults for this effect type
      let isDefault = 
        !projectName.trim() && 
        !projectId && 
        duration === 5 && 
        formatPreset === '16:9' && 
        !hdOutput && 
        !fastRender && 
        !audioFxEnabled;

      if (isDefault) {
        if (type === 'typewriter') {
          const defaultTr = "Her hikaye tek bir kelimeyle başlar.\nAnimationMaker büyüleyici videolar üretir.";
          const defaultEn = "Every story begins with a single word.\nAnimationMaker creates the magic.";
          const currentTextTrimmed = typewriterText?.trim();
          const isTextDefault = currentTextTrimmed === defaultTr.trim() || currentTextTrimmed === defaultEn.trim() || currentTextTrimmed === t('typewriterDefaultText', lang)?.trim();
          isDefault = isTextDefault && typingSpeed === 18 && cursorStyle === 'block' && typewriterMode === 'classic' && (!paperSize || paperSize === 'normal') && (!typewriterFontSize || typewriterFontSize === 'medium') && (!codeFileName || codeFileName === 'main.js') && fontColor === '#FFFFFF';
        } else if (type === 'ken-burns') {
          isDefault = zoomRate === 0.04 && zoomDirection === 'in' && panStyle === 'center';
        } else if (type === 'vhs-tape') {
          isDefault = aberrationStrength === 1.2 && trackingNoise === 'medium' && scanlineFlicker === true && vhsTimestamp === true;
        } else if (type === 'glitch-master') {
          isDefault = glitchIntensity === 0.6 && rgbShift === 14 && sliceRate === 8;
        } else if (type === 'scanline') {
          isDefault = scanlineDensity === 4 && phosphorGlow === 0.5;
        } else if (type === 'ascii') {
          isDefault = asciiTheme === 'matrixGreen' && asciiResolution === 12;
        } else if (type === 'echo') {
          isDefault = echoCount === 5 && echoDecay === 0.7;
        } else if (type === 'gsearch') {
          isDefault = searchQuery === t('gsearchQueryDefault', lang) && searchHeadline === t('gsearchHeadlineDefault', lang);
        } else if (type === 'spotlight') {
          isDefault = spotlightTheme === 'archival' && spotlightColor === 'yellow' && spotlightPaperFormat === 'standard';
        } else if (type === 'formula') {
          isDefault = formulaTheme === 'blackboard' && formulaGlow === 'cyan' && formulaLatex === 'e^{i\\pi} + 1 = 0';
        } else if (type === 'timeline') {
          isDefault = timelineTheme === 'cyberDark' && timelineStyle === 'ruler' && timelineStartMilestone === 0 && timelineZoom === 1.0;
        } else if (type === 'tree') {
          isDefault = treeTheme === 'voxGold' && treeConnectorStyle === 'bezierCurve';
        } else if (type === 'counter') {
          isDefault = counterTheme === 'financial' && counterVal1 === 4200 && counterVal2 === 850 && counterShowGauges === true;
        } else if (type === 'paper') {
          const isDefaultHeadline = paperHeadline === "TOP SECRET // CLASSIFIED DOSSIER" || paperHeadline === "GİZLİ BELGE // DOSYA #741" || !paperHeadline.trim();
          isDefault = isDefaultHeadline && paperTheme === 'vintage' && paperTornStyle === 'rippedEdge' && paperTapeColor === 'washiGold' && paperImageScale === 1.0 && paperImagePanY === 0 && paperImageHeight === 0.35 && paperImageFit === 'cover' && paperJitter === true;
        } else if (type === 'tracking') {
          isDefault = trackingHudTheme === 'cyberCyan' && trackingReticleStyle === 'cornerBrackets' && trackingConfidence === 99.4 && trackingImageScale === 1.0 && trackingImagePanX === 0 && trackingImagePanY === 0 && trackingBoxScale === 1.0 && trackingTargetLabel === "[CONFIRMED ID: SUBJECT 09]" && trackingCategory === "FACIAL BIOMETRICS • 4K SENSOR";
        }
      }

      // Boş ve değiştirilmemiş varsayılan projeyi kaydetmeyi engelle
      if (isDefault) {
        return;
      }

      setSaveStatus(t('saving', lang));

      // Aynı isimde bir proje varsa, yeni oluşturmak yerine onun ID'sini kullan (üzerine yaz)
      let targetProjectId = projectId;
      if (!targetProjectId && projectSettings.projectName) {
        const existingDuplicate = projects?.find(p => p.toolId === type && p.settings?.projectName === projectSettings.projectName);
        if (existingDuplicate) {
          targetProjectId = existingDuplicate.id;
        }
      }

      try {
        isAutoSavingRef.current = true;
        const savedId = await saveProject(type, projectSettings, targetProjectId);
        if (savedId) {
          setProjectId(savedId);
          loadedDraftIdRef.current = savedId;
          lastSavedSnapshotRef.current = currentSnapshot;
          const currentParam = searchParams.get('draft');
          if (currentParam !== savedId) {
            setSearchParams({ draft: savedId }, { replace: true });
          }
        }
        setSaveStatus(user ? t('savedToCloud', lang) : t('draftSaved', lang));
        setTimeout(() => setSaveStatus(''), 2500);
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveStatus('');
      } finally {
        isAutoSavingRef.current = false;
      }
    }, 1500); // 1.5 saniye bekle (Debounce)

    return () => clearTimeout(timeoutId);
  }, [
    user, projectName, formatPreset, hdOutput, fastRender, duration, audioFxEnabled,
    zoomRate, zoomDirection, panStyle, aberrationStrength, trackingNoise,
    scanlineFlicker, vhsTimestamp, glitchIntensity, rgbShift, sliceRate,
    typewriterText, typingSpeed, cursorStyle, typewriterMode, paperSize, typewriterFontSize, codeFileName, fontColor, scanlineDensity,
    phosphorGlow, asciiTheme, asciiResolution, echoCount, echoDecay,
    searchQuery, searchUrl, searchHeadline, searchSnippet, searchTheme,
    spotlightSource, spotlightDate, spotlightHeadline, spotlightSnippet, spotlightHighlight, spotlightColor, spotlightTheme, spotlightPaperFormat, spotlightFontSize,
    formulaTitle, formulaLatex, formulaDesc, formulaTheme, formulaGlow,
    timelineTitle, timelineEvents, timelineTheme, timelineStyle, timelineStartMilestone, timelineEndMilestone, timelineZoom,
    treeRootTitle, treeRootSubtitle, treeBranches, treeTheme, treeConnectorStyle,
    counterHeadline, counterSubtitle, counterVal1, counterLabel1, counterVal2, counterLabel2, counterPrefix, counterSuffix, counterTrendTag, counterTheme, counterShowGauges,
    paperHeadline, paperSnippet, paperSourceTag, paperDateTag, paperTheme, paperTornStyle, paperTapeColor, paperJitter, paperHighlight,
    trackingTargetLabel, trackingCategory, trackingConfidence, trackingCoordinates, trackingHudTheme, trackingReticleStyle, trackingScanBeam, trackingLockAnimation,
    type, lang, saveProject, projects, projectId, searchParams, setSearchParams
  ]);

  // Handle Media Upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);

      if (selectedFile.type.startsWith('image/')) {
        const img = new Image();
        img.src = url;
        img.onload = () => {
          sourceMediaRef.current = img;
          setFileDuration(null);
        };
      } else if (selectedFile.type.startsWith('video/')) {
        const vid = document.createElement('video');
        vid.src = url;
        vid.crossOrigin = 'anonymous';
        vid.loop = true;
        vid.muted = true;
        vid.onloadedmetadata = () => {
          if (vid.duration && !isNaN(vid.duration)) {
            const detectedSec = Math.min(300, Math.max(3, Math.round(vid.duration)));
            setFileDuration(vid.duration);
            setDuration(detectedSec);
          }
        };
        vid.play().catch(() => {});
        sourceMediaRef.current = vid;
      }
    }
  };

  // Generate Sample Texture if no file uploaded
  useEffect(() => {
    if (!fileUrl && type !== 'typewriter') {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 640;
      sampleCanvas.height = 360;
      const sCtx = sampleCanvas.getContext('2d');
      
      const grad = sCtx.createLinearGradient(0, 0, 640, 360);
      grad.addColorStop(0, '#16171E');
      grad.addColorStop(0.5, '#1E202B');
      grad.addColorStop(1, '#0F1015');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 640, 360);

      sCtx.fillStyle = '#FFFFFF';
      sCtx.font = '800 32px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.fillText('ANIMATIONMAKER', 320, 165);
      sCtx.fillStyle = '#F5B301';
      sCtx.font = '700 16px monospace';
      sCtx.fillText(`[ ${type.toUpperCase().replace('-', ' ')} ]`, 320, 205);
      
      sourceMediaRef.current = sampleCanvas;
    }
  }, [fileUrl, type]);

  // Live Canvas Interactive Preview Loop (Smooth with Mobile Inactivity Throttling)
  useEffect(() => {
    let active = true;
    let startTime = performance.now();
    let lastFrameTime = 0;
    const isMobile = isMobileDevice();
    const frameInterval = isMobile ? (1000 / 30) : 0; // 30 FPS cap on mobile to save ~50% GPU & battery

    const renderLoop = (time) => {
      if (!active) return;

      // Page Visibility Check: if tab is hidden in background, pause loop to save 100% CPU/GPU
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      // Mobile FPS Capping
      if (frameInterval > 0) {
        const delta = time - lastFrameTime;
        if (delta < frameInterval) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
          return;
        }
        lastFrameTime = time - (delta % frameInterval);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = getOptimizedCanvasContext(canvas);
        if (ctx) {
          const width = canvas.width;
          const height = canvas.height;
          const elapsed = (time - startTime) / 1000;
          const loopDuration = Math.max(3, duration);
          const progressVal = (elapsed % loopDuration) / loopDuration;

        if (type === 'typewriter') {
          const totalChars = typewriterText.length;
          const currentChars = Math.min(totalChars, Math.floor(progressVal * (totalChars + 4)));
          if (audioFxEnabledRef.current && currentChars > 0 && currentChars !== lastCharIndexRef.current && currentChars <= totalChars) {
            lastCharIndexRef.current = currentChars;
            const char = typewriterText[currentChars - 1];
            const charType = char === '\n' ? 'newline' : (char === ' ' || char === '\t' ? 'space' : 'letter');
            playLiveTypewriterClick(charType, true, typewriterMode);
          } else if (currentChars === 0) {
            lastCharIndexRef.current = 0;
          }

          drawTypewriterFrame(ctx, width, height, progressVal, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            typewriterMode,
            paperSize,
            typewriterFontSize,
            codeFileName,
            darkTheme: true
          });
        } else if (type === 'ken-burns') {
          drawKenBurnsFrame(ctx, sourceMediaRef.current, width, height, progressVal, {
            zoomRate,
            zoomDirection,
            panStyle
          });
        } else if (type === 'vhs-tape') {
          drawVhsEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            aberrationStrength,
            trackingNoise,
            scanlineFlicker,
            vhsTimestamp
          });
        } else if (type === 'glitch-master') {
          drawGlitchEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            intensity: glitchIntensity,
            rgbShift,
            sliceRate
          });
        } else if (type === 'scanline') {
          drawScanlineEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            density: scanlineDensity,
            glow: phosphorGlow
          });
        } else if (type === 'ascii') {
          drawAsciiEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            theme: asciiTheme,
            resolution: asciiResolution
          });
        } else if (type === 'echo') {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, width, height);
          if (sourceMediaRef.current) {
            ctx.save();
            const scale = 1 + (progressVal * 0.12);
            drawImageCover(ctx, sourceMediaRef.current, 0, 0, width, height, scale);
            drawVignette(ctx, width, height, 0.4);
            ctx.restore();
          }
        } else if (type === 'gsearch') {
          drawGoogleSearchEffect(ctx, sourceMediaRef.current, width, height, progressVal, {
            query: searchQuery,
            url: searchUrl,
            headline: searchHeadline,
            snippet: searchSnippet,
            theme: searchTheme,
            lang
          });
        } else if (type === 'spotlight') {
          drawSpotlightFrame(ctx, width, height, progressVal, {
            sourceName: spotlightSource,
            articleDate: spotlightDate,
            headline: spotlightHeadline,
            snippet: spotlightSnippet,
            highlightKeywords: spotlightHighlight,
            highlightColor: spotlightColor,
            documentTheme: spotlightTheme,
            paperFormat: spotlightPaperFormat,
            fontSize: spotlightFontSize
          });
        } else if (type === 'formula') {
          drawFormulaFrame(ctx, width, height, progressVal, {
            title: formulaTitle,
            latex: formulaLatex,
            description: formulaDesc,
            theme: formulaTheme,
            glowColor: formulaGlow
          });
        } else if (type === 'timeline') {
          drawTimelineFrame(ctx, width, height, progressVal, {
            title: timelineTitle,
            events: timelineEvents,
            theme: timelineTheme,
            style: timelineStyle,
            startMilestone: timelineStartMilestone,
            endMilestone: timelineEndMilestone,
            zoom: timelineZoom
          });
        } else if (type === 'tree') {
          drawEventTreeFrame(ctx, width, height, progressVal, {
            rootTitle: treeRootTitle,
            rootSubtitle: treeRootSubtitle,
            branches: treeBranches,
            theme: treeTheme,
            connectorStyle: treeConnectorStyle
          });
        } else if (type === 'counter') {
          drawCounterFrame(ctx, width, height, progressVal, {
            headline: counterHeadline,
            subtitle: counterSubtitle,
            val1: counterVal1,
            label1: counterLabel1,
            val2: counterVal2,
            label2: counterLabel2,
            prefix: counterPrefix,
            suffix: counterSuffix,
            trendTag: counterTrendTag,
            theme: counterTheme,
            showGauges: counterShowGauges
          });
        } else if (type === 'paper') {
          drawPaperCutoutFrame(ctx, sourceMediaRef.current, width, height, progressVal, {
            headline: paperHeadline,
            snippet: paperSnippet,
            sourceTag: paperSourceTag,
            dateTag: paperDateTag,
            theme: paperTheme,
            tornStyle: paperTornStyle,
            tapeColor: paperTapeColor,
            jitter: paperJitter,
            highlightKeyword: paperHighlight,
            imageScale: paperImageScale,
            imagePanY: paperImagePanY,
            imageHeightRatio: paperImageHeight,
            imageFit: paperImageFit
          });
        } else if (type === 'tracking') {
          drawTrackingHudFrame(ctx, sourceMediaRef.current, width, height, progressVal, {
            targetLabel: trackingTargetLabel,
            category: trackingCategory,
            confidence: trackingConfidence,
            coordinates: trackingCoordinates,
            theme: trackingHudTheme,
            reticleStyle: trackingReticleStyle,
            scanBeam: trackingScanBeam,
            lockAnimation: trackingLockAnimation,
            imageScale: trackingImageScale,
            imagePanX: trackingImagePanX,
            imagePanY: trackingImagePanY,
            boxScale: trackingBoxScale,
            boxOffsetX: trackingBoxOffsetX,
            boxOffsetY: trackingBoxOffsetY
          });
        }
        }
      }
      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && active) {
        lastFrameTime = performance.now();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(renderLoop);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);
    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [
    type, duration, typewriterText, fontColor, cursorStyle, typewriterMode, audioFxEnabled,
    paperSize, typewriterFontSize, codeFileName,
    zoomRate, zoomDirection, panStyle,
    aberrationStrength, trackingNoise, scanlineFlicker, vhsTimestamp,
    glitchIntensity, rgbShift, sliceRate,
    scanlineDensity, phosphorGlow, asciiTheme, asciiResolution,
    echoCount, echoDecay, searchQuery, searchUrl, searchHeadline, searchSnippet, searchTheme,
    spotlightSource, spotlightDate, spotlightHeadline, spotlightSnippet, spotlightHighlight, spotlightColor, spotlightTheme,
    spotlightPaperFormat, spotlightFontSize,
    formulaTitle, formulaLatex, formulaDesc, formulaTheme, formulaGlow,
    timelineTitle, timelineEvents, timelineTheme, timelineStyle, timelineStartMilestone, timelineEndMilestone, timelineZoom,
    treeRootTitle, treeRootSubtitle, treeBranches, treeTheme, treeConnectorStyle,
    counterHeadline, counterSubtitle, counterVal1, counterLabel1, counterVal2, counterLabel2, counterPrefix, counterSuffix, counterTrendTag, counterTheme, counterShowGauges,
    paperHeadline, paperSnippet, paperSourceTag, paperDateTag, paperTheme, paperTornStyle, paperTapeColor, paperJitter, paperHighlight,
    trackingTargetLabel, trackingCategory, trackingConfidence, trackingCoordinates, trackingHudTheme, trackingReticleStyle, trackingScanBeam, trackingLockAnimation,
    lang
  ]);

  // Client-Side Device Render (FFmpeg WASM & Canvas Frames with Audio Preservation)
  const startDeviceRender = async () => {
    if (isProTool && !user?.isPro) {
      navigate('/pricing', { replace: true });
      return;
    }

    setStatus('processing');
    setProgress(2);
    setErrorMsg('');
    setResultUrl('');

    const releaseWakeLock = await requestScreenWakeLock();

    try {
      const totalDuration = Math.max(3, Number(duration) || 5);

      // 1. Extract and process audio if the source is a video file OR generate typewriter mechanical sound
      let audioBlob = null;
      if (type === 'typewriter' && audioFxEnabled) {
        setProgress(4);
        audioBlob = await generateTypewriterAudioTrack(typewriterText, totalDuration, typewriterMode);
      } else if (file && file.type.startsWith('video/')) {
        setProgress(4);
        const rawAudioBlob = await extractAudioFromVideo(file);
        if (rawAudioBlob) {
          setProgress(7);
          if (audioFxEnabled && ['vhs-tape', 'scanline', 'glitch-master'].includes(type)) {
            audioBlob = await applyAudioEffect(rawAudioBlob, type, {
              intensity: glitchIntensity,
              aberrationStrength: aberrationStrength,
              scanlineDensity: scanlineDensity
            });
          } else {
            audioBlob = rawAudioBlob;
          }
        }
      }

      const canvas = document.createElement('canvas');
      let outWidth, outHeight;
      if (formatPreset === '16:9') {
        outWidth = hdOutput ? 1920 : 1280;
        outHeight = hdOutput ? 1080 : 720;
      } else if (formatPreset === '9:16') {
        outWidth = hdOutput ? 1080 : 720;
        outHeight = hdOutput ? 1920 : 1280;
      } else {
        // 1:1 Square
        outWidth = hdOutput ? 1080 : 720;
        outHeight = hdOutput ? 1080 : 720;
      }
      canvas.width = outWidth;
      canvas.height = outHeight;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const fps = 30;
      const totalFrames = Math.round(fps * totalDuration);
      const frames = [];

      const videoElement = sourceMediaRef.current instanceof HTMLVideoElement ? sourceMediaRef.current : null;

      for (let i = 0; i < totalFrames; i++) {
        const frameProgress = i / totalFrames;

        // Sync video frame accurate timestamp
        if (videoElement) {
          videoElement.currentTime = frameProgress * totalDuration;
          await new Promise((resolve) => {
            const onSeeked = () => {
              videoElement.removeEventListener('seeked', onSeeked);
              resolve();
            };
            videoElement.addEventListener('seeked', onSeeked);
            setTimeout(resolve, 40);
          });
        }

        if (type === 'typewriter') {
          drawTypewriterFrame(ctx, canvas.width, canvas.height, frameProgress, {
            text: typewriterText,
            fontColor,
            cursorStyle,
            typewriterMode,
            paperSize,
            typewriterFontSize,
            codeFileName,
            darkTheme: true
          });
        } else if (type === 'ken-burns') {
          drawKenBurnsFrame(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            zoomRate,
            zoomDirection,
            panStyle
          });
        } else if (type === 'vhs-tape') {
          drawVhsEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            aberrationStrength,
            trackingNoise,
            scanlineFlicker,
            vhsTimestamp
          });
        } else if (type === 'glitch-master') {
          drawGlitchEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            intensity: glitchIntensity,
            rgbShift,
            sliceRate
          });
        } else if (type === 'scanline') {
          drawScanlineEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            density: scanlineDensity,
            glow: phosphorGlow
          });
        } else if (type === 'ascii') {
          drawAsciiEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            theme: asciiTheme,
            resolution: asciiResolution
          });
        } else if (type === 'echo') {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (sourceMediaRef.current) {
            const scale = 1 + (frameProgress * 0.12);
            drawImageCover(ctx, sourceMediaRef.current, 0, 0, canvas.width, canvas.height, scale);
            drawVignette(ctx, canvas.width, canvas.height, 0.4);
          }
        } else if (type === 'gsearch') {
          drawGoogleSearchEffect(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            query: searchQuery,
            url: searchUrl,
            headline: searchHeadline,
            snippet: searchSnippet,
            theme: searchTheme,
            lang
          });
        } else if (type === 'spotlight') {
          drawSpotlightFrame(ctx, canvas.width, canvas.height, frameProgress, {
            sourceName: spotlightSource,
            articleDate: spotlightDate,
            headline: spotlightHeadline,
            snippet: spotlightSnippet,
            highlightKeywords: spotlightHighlight,
            highlightColor: spotlightColor,
            documentTheme: spotlightTheme,
            paperFormat: spotlightPaperFormat,
            fontSize: spotlightFontSize
          });
        } else if (type === 'formula') {
          drawFormulaFrame(ctx, canvas.width, canvas.height, frameProgress, {
            title: formulaTitle,
            latex: formulaLatex,
            description: formulaDesc,
            theme: formulaTheme,
            glowColor: formulaGlow
          });
        } else if (type === 'timeline') {
          drawTimelineFrame(ctx, canvas.width, canvas.height, frameProgress, {
            title: timelineTitle,
            events: timelineEvents,
            theme: timelineTheme,
            style: timelineStyle,
            startMilestone: timelineStartMilestone,
            endMilestone: timelineEndMilestone,
            zoom: timelineZoom
          });
        } else if (type === 'tree') {
          drawEventTreeFrame(ctx, canvas.width, canvas.height, frameProgress, {
            rootTitle: treeRootTitle,
            rootSubtitle: treeRootSubtitle,
            branches: treeBranches,
            theme: treeTheme,
            connectorStyle: treeConnectorStyle
          });
        } else if (type === 'counter') {
          drawCounterFrame(ctx, canvas.width, canvas.height, frameProgress, {
            headline: counterHeadline,
            subtitle: counterSubtitle,
            val1: counterVal1,
            label1: counterLabel1,
            val2: counterVal2,
            label2: counterLabel2,
            prefix: counterPrefix,
            suffix: counterSuffix,
            trendTag: counterTrendTag,
            theme: counterTheme,
            showGauges: counterShowGauges
          });
        } else if (type === 'paper') {
          drawPaperCutoutFrame(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            headline: paperHeadline,
            snippet: paperSnippet,
            sourceTag: paperSourceTag,
            dateTag: paperDateTag,
            theme: paperTheme,
            tornStyle: paperTornStyle,
            tapeColor: paperTapeColor,
            jitter: paperJitter,
            highlightKeyword: paperHighlight,
            imageScale: paperImageScale,
            imagePanY: paperImagePanY,
            imageHeightRatio: paperImageHeight,
            imageFit: paperImageFit
          });
        } else if (type === 'tracking') {
          drawTrackingHudFrame(ctx, sourceMediaRef.current, canvas.width, canvas.height, frameProgress, {
            targetLabel: trackingTargetLabel,
            category: trackingCategory,
            confidence: trackingConfidence,
            coordinates: trackingCoordinates,
            theme: trackingHudTheme,
            reticleStyle: trackingReticleStyle,
            scanBeam: trackingScanBeam,
            lockAnimation: trackingLockAnimation,
            imageScale: trackingImageScale,
            imagePanX: trackingImagePanX,
            imagePanY: trackingImagePanY,
            boxScale: trackingBoxScale,
            boxOffsetX: trackingBoxOffsetX,
            boxOffsetY: trackingBoxOffsetY
          });
        } else {
          ctx.fillStyle = '#0F1015';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          if (sourceMediaRef.current) {
            drawImageCover(ctx, sourceMediaRef.current, 0, 0, canvas.width, canvas.height, 1.0);
          }
        }

        const mime = (hdOutput && !fastRender) ? 'image/png' : 'image/jpeg';
        const quality = (hdOutput && !fastRender) ? 1.0 : (fastRender ? 0.86 : 0.96);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
        const arrayBuf = await blob.arrayBuffer();
        frames.push(new Uint8Array(arrayBuf));

        if (i % 5 === 0) {
          setProgress(Math.round(5 + (i / totalFrames) * 45));
        }
      }

      setProgress(52);
      const videoUrl = await createVideoFromFrames(frames, audioBlob, fps, { highQuality: hdOutput, fastRender }, (p) => {
        setProgress(Math.round(p));
      });

      // Clear frames buffer to free memory on mobile
      frames.length = 0;

      setResultUrl(videoUrl);
      setStatus('completed');
      setProgress(100);
    } catch (err) {
      console.error("Render processing error:", err);
      setErrorMsg(err.message || 'Error occurred during rendering.');
      setStatus('error');
    } finally {
      releaseWakeLock();
    }
  };

  // Cloud Render Queue Submission (Echo Motion only)
  const startCloudRender = async () => {
    if (isProTool && !user?.isPro) {
      navigate('/pricing', { replace: true });
      return;
    }

    if (!file) {
      setErrorMsg(t('chooseFile', lang));
      setStatus('error');
      return;
    }

    try {
      setStatus('uploading');
      setProgress(10);

      // Upload source media to Firebase Storage
      const storageRef = ref(storage, `effects/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 40;
            setProgress(Math.round(10 + pct));
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
      setProgress(55);
      setStatus('processing');

      // Create Cloud Render Task in Firestore
      const jobRef = doc(collection(db, 'render_jobs'));
      const params = {
        media_url: downloadUrl,
        media_type: file.type.startsWith('video/') ? 'video' : 'image',
        duration: duration,
        format: formatPreset,
        hd_output: hdOutput,
        echo_count: echoCount,
        echo_decay: echoDecay,
        zoom_rate: zoomRate,
        zoom_direction: zoomDirection,
        pan_style: panStyle,
        aberration_strength: aberrationStrength
      };

      await setDoc(jobRef, {
        uid: auth.currentUser.uid,
        status: 'pending',
        tool_type: type,
        params: params,
        created_at: serverTimestamp()
      });

      // Listen for Render Completion
      const unsubscribe = onSnapshot(jobRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data.status === 'processing' && data.progress) {
          setProgress(Math.round(55 + data.progress * 0.4));
        } else if (data.status === 'completed' && data.output_url) {
          setResultUrl(data.output_url);
          setStatus('completed');
          setProgress(100);
          unsubscribe();
        } else if (data.status === 'failed') {
          setErrorMsg(data.error || 'Server render failed.');
          setStatus('error');
          unsubscribe();
        }
      }, (err) => {
        console.error("Snapshot error:", err);
        setErrorMsg(err.message || 'Error tracking render job.');
        setStatus('error');
      });
    } catch (err) {
      console.error("Cloud processing error:", err);
      setErrorMsg(err.message || 'Failed to submit cloud render job.');
      setStatus('error');
    }
  };

  const isServerTool = type === 'echo';
  const isGenerativeTool = ['typewriter', 'spotlight', 'formula', 'timeline', 'tree', 'counter'].includes(type);
  const isOptionalMediaTool = type === 'gsearch';

  return (
    <div className="w-full flex-grow flex flex-col h-full">
      <Helmet>
        <title>{`${toolInfo.title1} ${toolInfo.title2} — Free Online Video Effect Maker | AnimationMaker`}</title>
        <meta name="description" content={`${toolInfo.desc} Create professional ${toolInfo.title1} ${toolInfo.title2} video animations online in seconds directly in your browser.`} />
        <meta name="keywords" content={`${toolInfo.title1} ${toolInfo.title2}, ${type} video effect, online video animator, free video effect maker, kinetic video effects, animationmaker`} />
        <link rel="canonical" href={`https://animationmaker.m0s.space/effects/${type}`} />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta property="og:title" content={`${toolInfo.title1} ${toolInfo.title2} | AnimationMaker`} />
        <meta property="og:description" content={toolInfo.desc} />
        <meta property="og:url" content={`https://animationmaker.m0s.space/effects/${type}`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AnimationMaker" />
        <meta property="og:image" content="https://animationmaker.m0s.space/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${toolInfo.title1} ${toolInfo.title2} | AnimationMaker`} />
        <meta name="twitter:description" content={toolInfo.desc} />
        <meta name="twitter:image" content="https://animationmaker.m0s.space/og-image.png" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": `${toolInfo.title1} ${toolInfo.title2}`,
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "description": toolInfo.desc,
            "url": `https://animationmaker.m0s.space/effects/${type}`,
            "publisher": {
              "@type": "Organization",
              "name": "AnimationMaker",
              "url": "https://animationmaker.m0s.space"
            }
          })}
        </script>
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-grow flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full relative z-10 h-full min-h-0"
      >
        {/* Header matching MatchCutTool */}
        <header className="mb-4 sm:mb-6 flex-shrink-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3 pr-28 sm:pr-0">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              {isEditingName ? (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 mb-2"
                >
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    placeholder={t('projectNamePlaceholder', lang)}
                    className="bg-zinc-900 border border-zinc-700 focus:border-accent-gold text-white text-xl sm:text-2xl font-bold px-3 py-1 rounded-lg outline-none w-full max-w-[300px]"
                    autoFocus
                  />
                  <button onClick={() => setIsEditingName(false)} className="p-2 bg-accent-gold text-black rounded-lg hover:bg-yellow-400">
                    <Check size={18} />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 mb-2 group cursor-pointer w-fit"
                  onClick={() => setIsEditingName(true)}
                >
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                    {projectName || (
                      <span>{toolInfo.title1} <span className="text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">{toolInfo.title2}</span></span>
                    )}
                  </h2>
                  {user && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
                      <Edit2 size={16} />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="text-zinc-400 max-w-2xl text-sm md:text-base">
              {toolInfo.desc}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap mt-1 sm:mt-0">
            {user && (
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800/90 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg border border-zinc-700/80 shadow-md transition-all active:scale-95"
                title={t('freshProjectTitle', lang)}
              >
                <Plus size={14} className="text-[#F5B301]" />
                <span>{t('newProject', lang)}</span>
              </button>
            )}
            {saveStatus && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 text-xs font-mono bg-zinc-900/90 px-3 py-1.5 rounded-full text-zinc-300 border border-zinc-700 shadow-lg"
              >
                <span className={`w-2 h-2 rounded-full ${saveStatus === 'Saving...' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                {saveStatus}
              </motion.div>
            )}
          </div>
        </header>

        {/* Main Workspace (Left: Settings, Right: Preview) */}
        <main className="flex flex-col lg:flex-row gap-6 lg:gap-6 flex-1 min-h-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          
          {/* LEFT COLUMN: Settings Panel (Matching SettingsPanel.jsx) */}
          <div className="w-full lg:w-[320px] xl:w-[380px] flex-shrink-0 flex flex-col h-auto lg:h-full lg:overflow-hidden gap-4">
            <div className="flex-1 lg:overflow-y-auto lg:pr-2 lg:custom-scrollbar">
              <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 p-4 md:p-6 rounded-lg h-full shadow-lg flex flex-col">
                <h2 className="text-xl font-bold text-white flex-shrink-0">{t('customize', lang) || 'ÖZELLEŞTİR'}</h2>

                <div className="flex-grow space-y-5 border-t border-zinc-700 mt-4 pt-4 overflow-y-auto pr-2 custom-scrollbar">
                  
                  {/* Video Duration (Max 5 Min) */}
                  <div>
                    <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                      <span>{t('videoDurationMax5m', lang)}</span>
                      <span className="text-yellow-400 font-mono font-bold">{formatDuration(duration)}</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="300"
                      step="1"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[5, 15, 30, 60, 180, 300].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDuration(s)}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${
                            duration === s
                              ? 'bg-accent text-white'
                              : 'bg-zinc-800 text-gray-400 hover:bg-zinc-700'
                          }`}
                        >
                          {s >= 60 ? `${s / 60}m` : `${s}s`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          if (fileDuration && !isNaN(fileDuration)) {
                            const fullSec = Math.min(300, Math.max(3, Math.round(fileDuration)));
                            setDuration(fullSec);
                          } else {
                            setDuration(300);
                          }
                        }}
                        className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-colors ${
                          duration === (fileDuration ? Math.min(300, Math.max(3, Math.round(fileDuration))) : 300)
                            ? 'bg-accent text-white'
                            : 'bg-zinc-800 text-yellow-400 hover:bg-zinc-700'
                        }`}
                        title={fileDuration ? `${t('fullVideoDuration', lang)} (${Math.round(fileDuration)}s)` : 'Max 5m (300s)'}
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* 1. KEN BURNS CONTROLS */}
                  {type === 'ken-burns' && (
                    <>
                      <SegmentedControl
                        label={t('zoomDirectionLabel', lang)}
                        options={[
                          { value: 'in', label: t('zoomIn', lang) },
                          { value: 'out', label: t('zoomOut', lang) }
                        ]}
                        value={zoomDirection}
                        onChange={setZoomDirection}
                      />

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('panStyleLabel', lang)}
                        </label>
                        <select
                          value={panStyle}
                          onChange={(e) => setPanStyle(e.target.value)}
                          className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm outline-none"
                        >
                          <option value="center">{t('panCenter', lang)}</option>
                          <option value="left_to_right">{t('panLeftToRight', lang)}</option>
                          <option value="right_to_left">{t('panRightToLeft', lang)}</option>
                          <option value="top_to_bottom">{t('panTopToBottom', lang)}</option>
                          <option value="bottom_to_top">{t('panBottomToTop', lang)}</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('zoomRateLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{zoomRate}</span>
                        </div>
                        <input
                          type="range"
                          min="0.01"
                          max="0.10"
                          step="0.01"
                          value={zoomRate}
                          onChange={(e) => setZoomRate(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 2. VHS TAPE CONTROLS */}
                  {type === 'vhs-tape' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('chromaticAberrationLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{aberrationStrength}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="3.0"
                          step="0.1"
                          value={aberrationStrength}
                          onChange={(e) => setAberrationStrength(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <SegmentedControl
                        label={t('trackingNoiseLabel', lang)}
                        options={[
                          { value: 'low', label: t('low', lang) || 'Az' },
                          { value: 'medium', label: t('medium', lang) || 'Orta' },
                          { value: 'high', label: t('high', lang) || 'Yüksek' }
                        ]}
                        value={trackingNoise}
                        onChange={setTrackingNoise}
                      />

                      <Switch
                        label={t('scanlineFlickerLabel', lang)}
                        checked={scanlineFlicker}
                        onChange={(e) => setScanlineFlicker(Boolean(e?.target ? e.target.checked : e))}
                      />

                      <Switch
                        label={t('vcrTimestampLabel', lang)}
                        checked={vhsTimestamp}
                        onChange={(e) => setVhsTimestamp(Boolean(e?.target ? e.target.checked : e))}
                      />
                    </>
                  )}

                  {/* 3. GLITCH MASTER CONTROLS */}
                  {type === 'glitch-master' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('glitchIntensityLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{Math.round(glitchIntensity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={glitchIntensity}
                          onChange={(e) => setGlitchIntensity(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('rgbShiftLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{rgbShift}px</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="40"
                          step="1"
                          value={rgbShift}
                          onChange={(e) => setRgbShift(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('sliceRateLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{sliceRate}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="20"
                          step="1"
                          value={sliceRate}
                          onChange={(e) => setSliceRate(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 4. TYPEWRITER CONTROLS */}
                  {type === 'typewriter' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('typewriterTextLabel', lang)}
                        </label>
                        <textarea
                          rows="4"
                          value={typewriterText}
                          onChange={(e) => setTypewriterText(e.target.value)}
                          className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm resize-none"
                        />
                      </div>

                      <SegmentedControl
                        label={t('cursorStyleLabel', lang)}
                        options={[
                          { value: 'block', label: '█ Block' },
                          { value: 'line', label: '| Line' },
                          { value: 'underscore', label: '_ Under' }
                        ]}
                        value={cursorStyle}
                        onChange={setCursorStyle}
                      />

                      <SegmentedControl
                        label={t('typewriterModeLabel', lang)}
                        options={[
                          { value: 'classic', label: t('typewriterModeClassic', lang) },
                          { value: 'terminal', label: t('typewriterModeTerminal', lang) },
                          { value: 'code', label: t('typewriterModeCode', lang) },
                          { value: 'vintage', label: t('typewriterModeVintage', lang) }
                        ]}
                        value={typewriterMode}
                        onChange={setTypewriterMode}
                      />

                      {/* Paper / Screen Size */}
                      <SegmentedControl
                        label={t('typewriterPaperSizeLabel', lang)}
                        options={[
                          { value: 'normal', label: t('typewriterPaperSizeNormal', lang) },
                          { value: 'large', label: t('typewriterPaperSizeLarge', lang) }
                        ]}
                        value={paperSize}
                        onChange={setPaperSize}
                      />

                      {/* Font Size Scaling */}
                      <SegmentedControl
                        label={t('typewriterFontSizeLabel', lang)}
                        options={[
                          { value: 'small', label: t('typewriterFontSizeSmall', lang) },
                          { value: 'medium', label: t('typewriterFontSizeMedium', lang) },
                          { value: 'large', label: t('typewriterFontSizeLarge', lang) },
                          { value: 'xlarge', label: t('typewriterFontSizeXLarge', lang) }
                        ]}
                        value={typewriterFontSize}
                        onChange={setTypewriterFontSize}
                      />

                      {/* Code File / Tab Name if in Code Mode */}
                      {typewriterMode === 'code' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('typewriterCodeFileNameLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={codeFileName}
                            onChange={(e) => setCodeFileName(e.target.value)}
                            placeholder="main.js"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm font-mono"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between p-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl">
                        <div className="flex flex-col pr-2">
                          <span className="text-sm font-medium text-white flex items-center gap-2">
                            <Volume2 size={16} className="text-[#F5B301]" />
                            {t('typewriterSoundLabel', lang)}
                          </span>
                          <span className="text-xs text-zinc-400 mt-0.5">
                            {t('typewriterSoundDesc', lang)}
                          </span>
                        </div>
                        <Switch
                          checked={audioFxEnabled}
                          onChange={handleAudioToggle}
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('typingSpeedLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{typingSpeed} cps</span>
                        </div>
                        <input
                          type="range"
                          min="5"
                          max="40"
                          step="1"
                          value={typingSpeed}
                          onChange={(e) => setTypingSpeed(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 5. SCANLINE CRT CONTROLS */}
                  {type === 'scanline' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('scanlineDensityLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{scanlineDensity}px</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="12"
                          step="1"
                          value={scanlineDensity}
                          onChange={(e) => setScanlineDensity(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('phosphorGlowLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{Math.round(phosphorGlow * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={phosphorGlow}
                          onChange={(e) => setPhosphorGlow(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 6. ASCII MATRIX CONTROLS */}
                  {type === 'ascii' && (
                    <>
                      <SegmentedControl
                        label={t('colorPaletteLabel', lang)}
                        options={[
                          { value: 'matrixGreen', label: 'Matrix' },
                          { value: 'cyberNeon', label: 'Cyber' },
                          { value: 'retroAmber', label: 'Amber' },
                          { value: 'trueColor', label: 'Real' }
                        ]}
                        value={asciiTheme}
                        onChange={setAsciiTheme}
                      />

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('charGridSizeLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{asciiResolution}px</span>
                        </div>
                        <input
                          type="range"
                          min="6"
                          max="20"
                          step="1"
                          value={asciiResolution}
                          onChange={(e) => setAsciiResolution(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 7. ECHO MOTION CONTROLS */}
                  {type === 'echo' && (
                    <>
                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('echoLayersLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{echoCount}</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="1"
                          value={echoCount}
                          onChange={(e) => setEchoCount(parseInt(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm font-medium text-gray-400 mb-1">
                          <span>{t('motionTrailDecayLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{Math.round(echoDecay * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.3"
                          max="0.95"
                          step="0.05"
                          value={echoDecay}
                          onChange={(e) => setEchoDecay(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </>
                  )}

                  {/* 8. GOOGLE SEARCH CONTROLS */}
                  {type === 'gsearch' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('gsearchQueryLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="e.g. How to make viral videos?"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('gsearchUrlLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={searchUrl}
                          onChange={(e) => setSearchUrl(e.target.value)}
                          placeholder="e.g. https://animationmaker.m0s.space › effects"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('gsearchHeadlineLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={searchHeadline}
                          onChange={(e) => setSearchHeadline(e.target.value)}
                          placeholder="e.g. AnimationMaker — Pro Video Tools"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('gsearchSnippetLabel', lang)}
                        </label>
                        <textarea
                          rows="3"
                          value={searchSnippet}
                          onChange={(e) => setSearchSnippet(e.target.value)}
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm resize-none"
                        />
                      </div>

                      <SegmentedControl
                        label={t('gsearchThemeLabel', lang)}
                        options={[
                          { value: 'dark', label: 'Dark Mode' },
                          { value: 'light', label: 'Light Mode' }
                        ]}
                        value={searchTheme}
                        onChange={setSearchTheme}
                      />
                    </>
                  )}

                  {/* 9. DOCUMENT SPOTLIGHT CONTROLS */}
                  {type === 'spotlight' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('spotlightSourceLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={spotlightSource}
                          onChange={(e) => setSpotlightSource(e.target.value)}
                          placeholder="e.g. NATURE • Research Article"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('spotlightDateLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={spotlightDate}
                          onChange={(e) => setSpotlightDate(e.target.value)}
                          placeholder="e.g. OCTOBER 2024 • ISSUE 8192"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('spotlightHeadlineLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={spotlightHeadline}
                          onChange={(e) => setSpotlightHeadline(e.target.value)}
                          placeholder="e.g. Quantum Coherence Discovered in Room Temperature Macromolecules"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('spotlightSnippetLabel', lang)}
                        </label>
                        <textarea
                          rows="4"
                          value={spotlightSnippet}
                          onChange={(e) => setSpotlightSnippet(e.target.value)}
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('spotlightHighlightLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={spotlightHighlight}
                          onChange={(e) => setSpotlightHighlight(e.target.value)}
                          placeholder="Exact words or phrase to highlight"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <SegmentedControl
                        label={t('spotlightFormatLabel', lang)}
                        options={[
                          { value: 'standard', label: t('spotlightFormatStandard', lang) },
                          { value: 'a4', label: '📄 ' + t('spotlightFormatA4', lang) },
                          { value: 'expanded', label: t('spotlightFormatExpanded', lang) }
                        ]}
                        value={spotlightPaperFormat}
                        onChange={setSpotlightPaperFormat}
                      />

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-sm font-medium text-gray-400">
                            {t('spotlightFontSizeLabel', lang)}
                          </label>
                          <span className="text-xs font-mono text-[#F5B301] bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700 font-bold">
                            {spotlightFontSize}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="38"
                          step="1"
                          value={spotlightFontSize}
                          onChange={(e) => setSpotlightFontSize(Number(e.target.value))}
                          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#F5B301]"
                        />
                      </div>

                      <SegmentedControl
                        label={t('spotlightColorLabel', lang)}
                        options={[
                          { value: 'yellow', label: '🟡 ' + t('spotlightColorYellow', lang) },
                          { value: 'cyan', label: '🔵 ' + t('spotlightColorCyan', lang) },
                          { value: 'green', label: '🟢 ' + t('spotlightColorGreen', lang) },
                          { value: 'pink', label: '🔴 ' + t('spotlightColorPink', lang) }
                        ]}
                        value={spotlightColor}
                        onChange={setSpotlightColor}
                      />

                      <SegmentedControl
                        label={t('spotlightThemeLabel', lang)}
                        options={[
                          { value: 'archival', label: t('spotlightThemeArchival', lang) },
                          { value: 'modern', label: t('spotlightThemeModern', lang) },
                          { value: 'dark', label: t('spotlightThemeDark', lang) }
                        ]}
                        value={spotlightTheme}
                        onChange={setSpotlightTheme}
                      />
                    </>
                  )}

                  {/* 10. LATEX MATH & SCIENCE FORMULA CONTROLS */}
                  {type === 'formula' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          {t('formulaPresetLabel', lang)}
                        </label>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[
                            { name: "Euler's Identity", latex: "e^{i\\pi} + 1 = 0", desc: "The most beautiful theorem in mathematics" },
                            { name: "Einstein Mass-Energy", latex: "E = \\gamma m c^2 = \\frac{m c^2}{\\sqrt{1 - v^2/c^2}}", desc: "Equivalence of mass and energy" },
                            { name: "Gaussian Integral", latex: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}", desc: "Fundamental probability distribution" },
                            { name: "Schrödinger Wave", latex: "i\\hbar \\frac{\\partial}{\\partial t}\\Psi = \\hat{H}\\Psi", desc: "Quantum wave function equation" },
                            { name: "Maxwell-Faraday", latex: "\\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}", desc: "Electromagnetic induction law" },
                            { name: "Bayes' Theorem", latex: "P(A|B) = \\frac{P(B|A)P(A)}{P(B)}", desc: "Conditional probability inference" }
                          ].map((preset, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => {
                                setFormulaTitle(preset.name.toUpperCase());
                                setFormulaLatex(preset.latex);
                                setFormulaDesc(preset.desc);
                              }}
                              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs font-mono text-cyan-300 text-left truncate transition-colors"
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('formulaTitleLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={formulaTitle}
                          onChange={(e) => setFormulaTitle(e.target.value)}
                          placeholder="e.g. EULER'S IDENTITY"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('formulaLatexLabel', lang)}
                        </label>
                        <textarea
                          rows="3"
                          value={formulaLatex}
                          onChange={(e) => setFormulaLatex(e.target.value)}
                          placeholder="e.g. \int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-cyan-300 font-mono text-sm resize-none"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('formulaDescLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={formulaDesc}
                          onChange={(e) => setFormulaDesc(e.target.value)}
                          placeholder="e.g. The most beautiful equation in mathematics"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <SegmentedControl
                        label={t('formulaThemeLabel', lang)}
                        options={[
                          { value: 'blackboard', label: t('formulaThemeBlackboard', lang) },
                          { value: 'blueprint', label: t('formulaThemeBlueprint', lang) },
                          { value: 'quantum', label: t('formulaThemeQuantum', lang) },
                          { value: 'clean', label: t('formulaThemeClean', lang) }
                        ]}
                        value={formulaTheme}
                        onChange={setFormulaTheme}
                      />

                      <SegmentedControl
                        label={t('formulaGlowLabel', lang)}
                        options={[
                          { value: 'cyan', label: 'Cyan' },
                          { value: 'gold', label: 'Gold' },
                          { value: 'purple', label: 'Purple' },
                          { value: 'emerald', label: 'Emerald' }
                        ]}
                        value={formulaGlow}
                        onChange={setFormulaGlow}
                      />
                    </>
                  )}

                  {/* 11. TIMELINE CONTROLS */}
                  {type === 'timeline' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('timelineTitleLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={timelineTitle}
                          onChange={(e) => setTimelineTitle(e.target.value)}
                          placeholder="e.g. THE CHRONICLES OF MODERN AGE"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('timelineEventsLabel', lang)}
                        </label>
                        <textarea
                          rows="5"
                          value={timelineEvents}
                          onChange={(e) => setTimelineEvents(e.target.value)}
                          placeholder="1969 | Moon Landing | Description..."
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white font-mono text-xs resize-none leading-relaxed"
                        />
                        <p className="text-[11px] text-gray-500 mt-1">
                          {t('timelineFormatHelp', lang)}
                        </p>
                      </div>

                      {/* Milestone Start and End Range Selection */}
                      <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-800/60 border border-zinc-700/60 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('timelineStartMilestoneLabel', lang)}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={timelineStartMilestone}
                            onChange={(e) => setTimelineStartMilestone(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm font-bold text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('timelineEndMilestoneLabel', lang)}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={timelineEndMilestone}
                            onChange={(e) => setTimelineEndMilestone(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm font-bold text-center"
                          />
                        </div>
                      </div>

                      {/* Visual Line Style */}
                      <SegmentedControl
                        label={t('timelineStyleLabel', lang)}
                        options={[
                          { value: 'ruler', label: t('timelineStyleRuler', lang) },
                          { value: 'minimal', label: t('timelineStyleMinimal', lang) },
                          { value: 'neonPulse', label: t('timelineStyleNeonPulse', lang) },
                          { value: 'documentary', label: t('timelineStyleDoc', lang) }
                        ]}
                        value={timelineStyle}
                        onChange={setTimelineStyle}
                      />

                      {/* Camera Zoom Scale */}
                      <div>
                        <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                          <span>{t('timelineZoomLabel', lang)}</span>
                          <span className="text-yellow-400 font-mono">{timelineZoom.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.80"
                          max="1.30"
                          step="0.05"
                          value={timelineZoom}
                          onChange={(e) => setTimelineZoom(parseFloat(e.target.value))}
                          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <SegmentedControl
                        label={t('timelineThemeLabel', lang)}
                        options={[
                          { value: 'cyberDark', label: t('timelineThemeCyberDark', lang) },
                          { value: 'documentary', label: t('timelineThemeDocumentary', lang) },
                          { value: 'minimalWhite', label: t('timelineThemeMinimalWhite', lang) },
                          { value: 'emeraldBio', label: t('timelineThemeEmeraldBio', lang) }
                        ]}
                        value={timelineTheme}
                        onChange={setTimelineTheme}
                      />
                    </>
                  )}

                  {/* 12. EVENT TREE CONTROLS */}
                  {type === 'tree' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('treeRootTitleLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={treeRootTitle}
                          onChange={(e) => setTreeRootTitle(e.target.value)}
                          placeholder="e.g. INDUSTRIAL REVOLUTION"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('treeRootSubtitleLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={treeRootSubtitle}
                          onChange={(e) => setTreeRootSubtitle(e.target.value)}
                          placeholder="e.g. KEY TURNING POINT • 18TH CENTURY"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-sm font-medium text-gray-400">
                            {t('treeBranchesLabel', lang)}
                          </label>
                        </div>
                        <textarea
                          rows="5"
                          value={treeBranches}
                          onChange={(e) => setTreeBranches(e.target.value)}
                          placeholder="Branch Title | Consequence Description | Metric Badge"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white font-mono text-xs resize-none leading-relaxed"
                        />
                        <button
                          type="button"
                          onClick={() => setTreeBranches(prev => prev + (prev.endsWith('\n') ? '' : '\n\n') + (lang === 'tr' ? "=== 2. DİJİTAL ÇAĞ | 20. YÜZYIL ===\nMikroçipler | Silikon Vadisi hesaplama gücü | 100M+ İşlemci\nİnternet Ağı | Küresel bilgi ağı | 5B+ Kullanıcı" : "=== 2. DIGITAL AGE | 20TH CENTURY ===\nMicrochips | Silicon Valley computing surge | 100M+ CPUs\nWorld Wide Web | Global internet connectivity | 5B+ Users"))}
                          className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold flex items-center gap-1 mt-1.5 transition-colors cursor-pointer"
                        >
                          {t('addMultiRoot', lang)}
                        </button>
                      </div>

                      <SegmentedControl
                        label={t('treeConnectorStyleLabel', lang)}
                        options={[
                          { value: 'bezierCurve', label: t('treeConnectorBezier', lang) },
                          { value: 'circuit', label: t('treeConnectorCircuit', lang) },
                          { value: 'straightLaser', label: t('treeConnectorLaser', lang) }
                        ]}
                        value={treeConnectorStyle}
                        onChange={setTreeConnectorStyle}
                      />

                      <SegmentedControl
                        label={t('treeThemeLabel', lang)}
                        options={[
                          { value: 'voxGold', label: t('treeThemeVoxGold', lang) },
                          { value: 'neonCyber', label: t('treeThemeNeonCyber', lang) },
                          { value: 'cleanSlate', label: t('treeThemeCleanSlate', lang) }
                        ]}
                        value={treeTheme}
                        onChange={setTreeTheme}
                      />
                    </>
                  )}

                  {/* 13. STAT COUNTER CONTROLS */}
                  {type === 'counter' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('counterHeadlineLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={counterHeadline}
                          onChange={(e) => setCounterHeadline(e.target.value)}
                          placeholder="e.g. GLOBAL CLEAN ENERGY CAPACITY"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('counterSubtitleLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={counterSubtitle}
                          onChange={(e) => setCounterSubtitle(e.target.value)}
                          placeholder="e.g. INTERNATIONAL ENERGY AGENCY • 1990 - 2024"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('counterVal1Label', lang)}
                          </label>
                          <input
                            type="number"
                            value={counterVal1}
                            onChange={(e) => setCounterVal1(Number(e.target.value))}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('counterLabel1Label', lang)}
                          </label>
                          <input
                            type="text"
                            value={counterLabel1}
                            onChange={(e) => setCounterLabel1(e.target.value)}
                            placeholder="Current Label"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('counterVal2Label', lang)}
                          </label>
                          <input
                            type="number"
                            value={counterVal2}
                            onChange={(e) => setCounterVal2(Number(e.target.value))}
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('counterLabel2Label', lang)}
                          </label>
                          <input
                            type="text"
                            value={counterLabel2}
                            onChange={(e) => setCounterLabel2(e.target.value)}
                            placeholder="Baseline Label"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-1">
                            {t('counterPrefixLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={counterPrefix}
                            onChange={(e) => setCounterPrefix(e.target.value)}
                            placeholder="$ / €"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-1">
                            {t('counterSuffixLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={counterSuffix}
                            onChange={(e) => setCounterSuffix(e.target.value)}
                            placeholder="GW / % / B"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-xs text-center font-bold text-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-400 mb-1">
                            {t('counterTrendLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={counterTrendTag}
                            onChange={(e) => setCounterTrendTag(e.target.value)}
                            placeholder="+340% ↗"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-xs text-center"
                          />
                        </div>
                      </div>

                      <Switch
                        label={t('counterShowGaugesLabel', lang)}
                        checked={counterShowGauges}
                        onChange={(e) => setCounterShowGauges(Boolean(e?.target ? e.target.checked : e))}
                      />

                      <SegmentedControl
                        label={t('counterThemeLabel', lang)}
                        options={[
                          { value: 'financial', label: t('counterThemeFinancial', lang) },
                          { value: 'cyberMetric', label: t('counterThemeCyberMetric', lang) },
                          { value: 'warningRed', label: t('counterThemeWarningRed', lang) },
                          { value: 'slateClean', label: t('counterThemeSlateClean', lang) }
                        ]}
                        value={counterTheme}
                        onChange={setCounterTheme}
                      />
                    </>
                  )}

                  {/* 13. Paper Cutout Settings Panel */}
                  {type === 'paper' && (
                    <>
                      {/* Photo & Media Upload & Framing Controls */}
                      <div className="p-3.5 bg-zinc-800/70 border border-zinc-700/80 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                            <ImageIcon size={14} />
                            {t('paperImageSectionLabel', lang)}
                          </span>
                          {file && (
                            <button
                              type="button"
                              onClick={() => {
                                setFile(null);
                                sourceMediaRef.current = null;
                              }}
                              className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                              title={t('paperRemoveImageLabel', lang)}
                            >
                              <Trash2 size={12} />
                              <span>{t('paperRemoveImageLabel', lang)}</span>
                            </button>
                          )}
                        </div>

                        {file ? (
                          <div className="flex items-center justify-between p-2 bg-zinc-900/80 border border-zinc-700 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-xs text-zinc-300 font-medium truncate font-mono">
                                🖼️ {file.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-yellow-400 font-semibold px-2.5 py-1 rounded border border-zinc-600 transition-colors flex-shrink-0 cursor-pointer"
                            >
                              {t('paperChangeImageLabel', lang)}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 px-3 bg-zinc-900/80 hover:bg-zinc-700/60 border border-dashed border-yellow-500/50 hover:border-yellow-400 rounded-lg text-xs font-semibold text-yellow-400 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                          >
                            <Upload size={14} />
                            <span>{t('paperUploadImageLabel', lang)}</span>
                          </button>
                        )}

                        {file && (
                          <div className="space-y-3 pt-1 border-t border-zinc-700/60">
                            {/* Framing Style */}
                            <SegmentedControl
                              label={t('paperImageFitLabel', lang)}
                              options={[
                                { value: 'cover', label: t('paperImageFitCover', lang) },
                                { value: 'contain', label: t('paperImageFitContain', lang) }
                              ]}
                              value={paperImageFit}
                              onChange={setPaperImageFit}
                            />

                            {/* Photo Height Ratio */}
                            <div>
                              <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                                <span>{t('paperImageHeightLabel', lang)}</span>
                                <span className="text-yellow-400 font-mono">{Math.round(paperImageHeight * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.18"
                                max="0.55"
                                step="0.01"
                                value={paperImageHeight}
                                onChange={(e) => setPaperImageHeight(parseFloat(e.target.value))}
                                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                              />
                            </div>

                            {/* Photo Scale / Zoom */}
                            <div>
                              <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                                <span>{t('paperImageScaleLabel', lang)}</span>
                                <span className="text-yellow-400 font-mono">{paperImageScale.toFixed(2)}x</span>
                              </div>
                              <input
                                type="range"
                                min="0.60"
                                max="2.50"
                                step="0.05"
                                value={paperImageScale}
                                onChange={(e) => setPaperImageScale(parseFloat(e.target.value))}
                                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                              />
                            </div>

                            {/* Photo Vertical Pan */}
                            <div>
                              <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                                <span>{t('paperImagePanYLabel', lang)}</span>
                                <span className="text-yellow-400 font-mono">
                                  {paperImagePanY === 0 ? '0' : (paperImagePanY > 0 ? `+${Math.round(paperImagePanY * 100)}%` : `${Math.round(paperImagePanY * 100)}%`)}
                                </span>
                              </div>
                              <input
                                type="range"
                                min="-1.0"
                                max="1.0"
                                step="0.05"
                                value={paperImagePanY}
                                onChange={(e) => setPaperImagePanY(parseFloat(e.target.value))}
                                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('paperHeadlineLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={paperHeadline}
                          onChange={(e) => setPaperHeadline(e.target.value)}
                          placeholder="e.g. CLASSIFIED DOSSIER LEAKED"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('paperSnippetLabel', lang)}
                        </label>
                        <textarea
                          rows={3}
                          value={paperSnippet}
                          onChange={(e) => setPaperSnippet(e.target.value)}
                          placeholder="Excerpt / Body text..."
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-sm resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('paperSourceTagLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={paperSourceTag}
                            onChange={(e) => setPaperSourceTag(e.target.value)}
                            placeholder="ARCHIVES • FILE #741"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('paperDateTagLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={paperDateTag}
                            onChange={(e) => setPaperDateTag(e.target.value)}
                            placeholder="OCTOBER 1974"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent text-white text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('paperHighlightLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={paperHighlight}
                          onChange={(e) => setPaperHighlight(e.target.value)}
                          placeholder="e.g. strategic projects"
                          className="w-full p-2.5 bg-zinc-800 border border-amber-500/50 rounded-md focus:ring-2 focus:ring-amber-400 text-amber-200 text-sm"
                        />
                      </div>

                      <SegmentedControl
                        label={t('paperThemeLabel', lang)}
                        options={[
                          { value: 'vintage', label: t('paperThemeVintage', lang) },
                          { value: 'noir', label: t('paperThemeNoir', lang) },
                          { value: 'neonNote', label: t('paperThemeNeonNote', lang) },
                          { value: 'cardstock', label: t('paperThemeCardstock', lang) }
                        ]}
                        value={paperTheme}
                        onChange={setPaperTheme}
                      />

                      <SegmentedControl
                        label={t('paperTornStyleLabel', lang)}
                        options={[
                          { value: 'rippedEdge', label: t('paperStyleRipped', lang) },
                          { value: 'polaroid', label: t('paperStylePolaroid', lang) },
                          { value: 'stampTicket', label: t('paperStyleTicket', lang) }
                        ]}
                        value={paperTornStyle}
                        onChange={setPaperTornStyle}
                      />

                      <SegmentedControl
                        label={t('paperTapeColorLabel', lang)}
                        options={[
                          { value: 'washiGold', label: t('paperTapeWashiGold', lang) },
                          { value: 'hazardStripe', label: t('paperTapeHazard', lang) },
                          { value: 'crimsonRed', label: t('paperTapeCrimson', lang) },
                          { value: 'clearMatte', label: t('paperTapeClear', lang) }
                        ]}
                        value={paperTapeColor}
                        onChange={setPaperTapeColor}
                      />

                      <Switch
                        label={t('paperJitterLabel', lang)}
                        checked={paperJitter}
                        onChange={(e) => setPaperJitter(Boolean(e?.target ? e.target.checked : e))}
                      />
                    </>
                  )}

                  {/* 14. AI Target & Subject Tracker HUD Settings Panel */}
                  {type === 'tracking' && (
                    <>
                      {/* Media Image / Subject Framing Box */}
                      <div className="p-3 bg-zinc-800/60 border border-cyan-500/40 rounded-xl space-y-3 shadow-inner">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                            <span>🎯</span>
                            <span>{t('trackingImageSectionLabel', lang)}</span>
                          </label>
                          {file && (
                            <button
                              type="button"
                              onClick={() => {
                                setFile(null);
                                if (sourceMediaRef.current) sourceMediaRef.current = null;
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                              className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors cursor-pointer"
                            >
                              {t('trackingRemoveMediaLabel', lang)}
                            </button>
                          )}
                        </div>

                        {file ? (
                          <div className="flex items-center justify-between p-2 bg-zinc-900/80 border border-zinc-700 rounded-lg">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="text-xs text-zinc-300 font-medium truncate font-mono">
                                📷 {file.name}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-cyan-400 font-semibold px-2.5 py-1 rounded border border-zinc-600 transition-colors flex-shrink-0 cursor-pointer"
                            >
                              {t('trackingChangeMediaLabel', lang)}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 px-3 bg-zinc-900/80 hover:bg-zinc-700/60 border border-dashed border-cyan-500/50 hover:border-cyan-400 rounded-lg text-xs font-semibold text-cyan-400 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm font-mono"
                          >
                            <Upload size={14} />
                            <span>{t('trackingUploadMediaLabel', lang)}</span>
                          </button>
                        )}

                        {/* Image Framing & Zoom Sliders */}
                        <div className="space-y-3 pt-2 border-t border-zinc-700/60">
                          {/* Subject Zoom */}
                          <div>
                            <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                              <span>{t('trackingImageScaleLabel', lang)}</span>
                              <span className="text-cyan-400 font-mono font-bold">{trackingImageScale.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.70"
                              max="3.00"
                              step="0.05"
                              value={trackingImageScale}
                              onChange={(e) => setTrackingImageScale(parseFloat(e.target.value))}
                              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            />
                          </div>

                          {/* Horizontal Pan X */}
                          <div>
                            <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                              <span>{t('trackingImagePanXLabel', lang)}</span>
                              <span className="text-cyan-400 font-mono font-bold">
                                {trackingImagePanX === 0 ? '0' : (trackingImagePanX > 0 ? `+${Math.round(trackingImagePanX * 100)}%` : `${Math.round(trackingImagePanX * 100)}%`)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-1.0"
                              max="1.0"
                              step="0.02"
                              value={trackingImagePanX}
                              onChange={(e) => setTrackingImagePanX(parseFloat(e.target.value))}
                              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            />
                          </div>

                          {/* Vertical Pan Y */}
                          <div>
                            <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                              <span>{t('trackingImagePanYLabel', lang)}</span>
                              <span className="text-cyan-400 font-mono font-bold">
                                {trackingImagePanY === 0 ? '0' : (trackingImagePanY > 0 ? `+${Math.round(trackingImagePanY * 100)}%` : `${Math.round(trackingImagePanY * 100)}%`)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-1.0"
                              max="1.0"
                              step="0.02"
                              value={trackingImagePanY}
                              onChange={(e) => setTrackingImagePanY(parseFloat(e.target.value))}
                              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            />
                          </div>

                          {/* Reticle Box Scale */}
                          <div>
                            <div className="flex justify-between text-xs font-medium text-gray-400 mb-1">
                              <span>{t('trackingBoxScaleLabel', lang)}</span>
                              <span className="text-cyan-400 font-mono font-bold">{trackingBoxScale.toFixed(2)}x</span>
                            </div>
                            <input
                              type="range"
                              min="0.60"
                              max="1.80"
                              step="0.05"
                              value={trackingBoxScale}
                              onChange={(e) => setTrackingBoxScale(parseFloat(e.target.value))}
                              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('trackingTargetLabelLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={trackingTargetLabel}
                          onChange={(e) => setTrackingTargetLabel(e.target.value)}
                          placeholder="[TARGET: SUBJECT 09]"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-cyan-400 text-cyan-300 font-mono text-sm font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('trackingCategoryLabel', lang)}
                          </label>
                          <input
                            type="text"
                            value={trackingCategory}
                            onChange={(e) => setTrackingCategory(e.target.value)}
                            placeholder="FACIAL BIOMETRICS"
                            className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-cyan-400 text-white text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">
                            {t('trackingConfidenceLabel', lang)}: <span className="text-cyan-400 font-mono font-bold">{trackingConfidence}%</span>
                          </label>
                          <input
                            type="range"
                            min="50"
                            max="99.9"
                            step="0.1"
                            value={trackingConfidence}
                            onChange={(e) => setTrackingConfidence(Number(e.target.value))}
                            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 mt-2"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t('trackingCoordinatesLabel', lang)}
                        </label>
                        <input
                          type="text"
                          value={trackingCoordinates}
                          onChange={(e) => setTrackingCoordinates(e.target.value)}
                          placeholder="LAT: 37.7749° N | LON: 122.4194° W"
                          className="w-full p-2.5 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-cyan-400 text-zinc-300 font-mono text-xs"
                        />
                      </div>

                      <SegmentedControl
                        label={t('trackingHudThemeLabel', lang)}
                        options={[
                          { value: 'cyberCyan', label: t('hudThemeCyan', lang) },
                          { value: 'tacticalAmber', label: t('hudThemeAmber', lang) },
                          { value: 'crimsonAlert', label: t('hudThemeCrimson', lang) },
                          { value: 'matrixEmerald', label: t('hudThemeEmerald', lang) }
                        ]}
                        value={trackingHudTheme}
                        onChange={setTrackingHudTheme}
                      />

                      <SegmentedControl
                        label={t('trackingReticleStyleLabel', lang)}
                        options={[
                          { value: 'cornerBrackets', label: t('reticleStyleCorners', lang) },
                          { value: 'circularSniper', label: t('reticleStyleSniper', lang) },
                          { value: 'fullHud', label: t('reticleStyleFullHud', lang) }
                        ]}
                        value={trackingReticleStyle}
                        onChange={setTrackingReticleStyle}
                      />

                      <Switch
                        label={t('trackingScanBeamLabel', lang)}
                        checked={trackingScanBeam}
                        onChange={(e) => setTrackingScanBeam(Boolean(e?.target ? e.target.checked : e))}
                      />

                      <Switch
                        label={t('trackingLockAnimLabel', lang)}
                        checked={trackingLockAnimation}
                        onChange={(e) => setTrackingLockAnimation(Boolean(e?.target ? e.target.checked : e))}
                      />
                    </>
                  )}

                  {/* Thematic Audio FX Switch (VHS, Scanline, Glitch) */}
                  {['vhs-tape', 'scanline', 'glitch-master'].includes(type) && (
                    <Switch
                      label={t('thematicAudioLabel', lang)}
                      checked={audioFxEnabled}
                      onChange={(e) => setAudioFxEnabled(Boolean(e?.target ? e.target.checked : e))}
                    />
                  )}

                  {/* 1080p High Quality Switch */}
                  <Switch
                    label={t('highQualityLabel', lang) || 'Yüksek Kalite (1080p)'}
                    checked={hdOutput}
                    onChange={handleToggleHdOutput}
                  />

                  {/* Turbo Fast Render Switch */}
                  <Switch
                    label={t('fastRenderLabel', lang) || 'Hızlı Render (Turbo Mod)'}
                    checked={fastRender}
                    onChange={handleToggleFastRender}
                  />

                </div>

                {/* Video Format (Aspect Ratio) matching MatchCutTool */}
                <div className="border-t border-zinc-700 pt-4 flex-shrink-0">
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('formatLabel', lang) || 'Video Formatı'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['16:9', '9:16', '1:1'].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormatPreset(fmt)}
                        className={`p-2 rounded-md font-semibold transition-colors ${
                          formatPreset === fmt
                            ? 'bg-accent text-white ring-2 ring-offset-2 ring-offset-zinc-900 ring-accent'
                            : 'bg-zinc-700 hover:bg-zinc-600'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Action Button matching MatchCutTool */}
                <button
                  type="button"
                  onClick={startDeviceRender}
                  disabled={status === 'processing' || status === 'uploading'}
                  className="w-full bg-[#F5B301] text-black font-extrabold py-3.5 px-4 rounded-lg hover:bg-yellow-400 hover:text-black transition-all shadow-lg shadow-yellow-500/20 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed mt-4 flex-shrink-0 flex items-center justify-center gap-2 cursor-pointer text-sm sm:text-base"
                >
                  {status === 'processing' || status === 'uploading' ? (
                    <>
                      <RotateCcw className="animate-spin" size={18} />
                      <span>{t('generatingButton', lang) || 'Oluşturuluyor...'}</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} fill="currentColor" />
                      <span>{t('generateButton', lang) || 'Videoyu Oluştur'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Video Preview Area (Matching Preview.jsx) */}
          <div className="flex-1 flex flex-col h-auto lg:h-full min-h-[400px] lg:min-h-0">
            <div className="w-full h-full bg-zinc-900/50 backdrop-blur-sm border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300 relative overflow-hidden">
              
              {/* Generating / Processing State */}
              {(status === 'processing' || status === 'uploading') && (
                <div className="w-full max-w-md text-center">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    {status === 'uploading' ? t('uploadingStatus', lang) : (t('generatingTitle', lang) || 'Video Oluşturuluyor...')}
                  </h3>
                  <div className="w-full bg-zinc-800 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-zinc-400 to-zinc-600 h-2.5 rounded-full transition-all duration-150"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-400 mt-2 font-mono">{Math.round(progress)}%</p>
                </div>
              )}

              {/* Completed Video State */}
              {status === 'completed' && resultUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                  <div className={`w-full h-[calc(100%-60px)] flex items-center justify-center ${formatPreset === '9:16' ? 'max-w-xs' : ''}`}>
                    <video controls autoPlay loop src={resultUrl} className="max-w-full max-h-full object-contain rounded-md shadow-2xl" />
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={resultUrl}
                      download={`${type}_${Date.now()}.mp4`}
                      className="flex-shrink-0 bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all flex items-center gap-2"
                    >
                      <Download size={16} />
                      {t('downloadButton', lang) || 'İndir (MP4)'}
                    </a>
                    <button
                      onClick={() => { setResultUrl(''); setStatus('idle'); }}
                      className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-lg transition-colors text-sm"
                    >
                      {t('editAgain', lang)}
                    </button>
                  </div>
                </div>
              )}

              {/* Idle / Live Canvas Preview State */}
              {status !== 'completed' && status !== 'processing' && status !== 'uploading' && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <div className={`w-full flex-1 flex items-center justify-center min-h-0 ${
                    formatPreset === '9:16' ? 'max-w-xs' : (formatPreset === '1:1' ? 'max-w-md' : 'w-full')
                  }`}>
                    <canvas
                      ref={canvasRef}
                      width={formatPreset === '16:9' ? 1280 : (formatPreset === '9:16' ? 720 : 1080)}
                      height={formatPreset === '16:9' ? 720 : (formatPreset === '9:16' ? 1280 : 1080)}
                      className="max-h-full max-w-full object-contain rounded-md shadow-2xl gpu-layer"
                    />
                  </div>

                  {/* Media Uploader Controls (docked at preview bottom) */}
                  {!isGenerativeTool && (
                    <div className="w-full max-w-md mt-4 flex flex-col items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-md text-sm font-semibold transition-colors text-zinc-200 flex items-center justify-center gap-2 truncate shadow"
                      >
                        <Upload size={16} />
                        {file ? file.name : (
                          type === 'gsearch' ? t('uploadKnowledgePanelImage', lang) : t('uploadMediaPrompt', lang)
                        )}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={type === 'ken-burns' ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,image/jpeg,image/png,image/webp"}
                        className="hidden"
                      />
                      {file && file.type.startsWith('video/') && (
                        <div className="flex items-center justify-between w-full text-xs font-mono text-emerald-400 px-1 mt-0.5">
                          <span className="flex items-center gap-1.5">
                            <Volume2 size={13} />
                            {t('originalAudioIncluded', lang)}
                          </span>
                          {fileDuration && (
                            <span className="text-zinc-400">
                              {t('sourceVideoPrefix', lang)} {formatDuration(Math.round(fileDuration))}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="mt-3 w-full max-w-md bg-red-950/40 border border-red-500/40 p-2.5 rounded-lg text-red-400 text-xs font-medium text-center">
                      {errorMsg}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </main>
      </motion.div>
    </div>
  );
}
