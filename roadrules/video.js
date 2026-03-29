// =============== DEPENDENCIES ===============
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// =============== CONFIGURATION - ALL SETTINGS AT TOP ===============

// ----- MAIN TOGGLES (Set these to true/false) -----
const TOGGLES = {
  SHOW_QUESTION_PREFIX: true,
  USE_EXTERNAL_AUDIO: true,
  CONVERT_TO_UPPERCASE: true,
  ENABLE_TEXT_STROKE: false,
  ENABLE_TEXT_SHADOW: false,
  SHOW_OPTION_LETTERS: false
};

// ----- QUESTION PREFIX CONFIGURATION -----
const PREFIX_CONFIG = {
  PREFIX_TEXT: "Q",
  SEPARATOR: ".",
  SPACE_AFTER_SEPARATOR: " ",
  INCLUDE_NUMBER: true,
  START_NUMBER: 1,
  PREFIX_FONT_SIZE: 26,
  PREFIX_COLOR: "white",
  PREFIX_BOLD: false,
  SAME_LINE_AS_QUESTION: true
};

// ----- VIDEO DURATION -----
const DURATION_CONFIG = {
  FIXED_DURATION: 5,
  MIN_DURATION: 5,
  MAX_DURATION: 15
};

// ----- QUOTE CONFIGURATION -----
const QUOTE_CONFIG = {
  JSON_FILE: 'amategeko.json',
  MAX_LENGTH: 3000,
  TEXT_FIELDS: ['text'],
  OPTION_FIELDS: ['a', 'b', 'c', 'd'],
  PREVIEW_COUNT: 10
};

// ----- TEXT STYLING CONFIGURATION -----
const TEXT_CONFIG = {
  FONT: 'font/popb.ttf',
  FONT_SIZE: 36,
  TITLE_FONT_SIZE: 26,
  OPTION_FONT_SIZE: 26,
  FONT_COLOR: 'black',
  LINE_SPACING: 40,
  LINE_WIDTHS: {
    QUESTION: 39,
    OPTION: 35,
    PREFIX: 10
  },
  TEXT_Y_OFFSET: -40,
  PARAGRAPH_MARGINS: {
    BETWEEN_QUESTION_AND_OPTIONS: 1,
    BETWEEN_OPTIONS: 0
  },
  ALIGNMENT: {
    MODE: 'left',
    LEFT_MARGIN: 20,
    RIGHT_MARGIN: 30
  },
  STROKE: {
    COLOR: 'black',
    WIDTH: 1
  },
  SHADOW: {
    COLOR: 'black@0.5',
    X: 2,
    Y: 2
  }
};

// ----- DIRECTORY CONFIGURATION -----
const DIR_CONFIG = {
  VIDEO_DIR: 'video',
  MUSIC_DIR: 'song',
  OUTPUT_DIR: 'output',
  ESCAPED_OUTPUT_DIR: 'error',
  TEMP_DIR: 'temp'
};

// ----- PROCESSING CONFIGURATION -----
const PROCESSING_CONFIG = {
  VIDEO_EXTENSIONS: ['.mp4', '.mov', '.mkv'],
  AUDIO_EXTENSIONS: ['.mp3', '.m4a', '.wav'],
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000
};

// ----- FFMPEG CONFIGURATION -----
const FFMPEG_CONFIG = {
  VIDEO_CODEC: 'libx264',
  AUDIO_CODEC: 'aac',
  LOGLEVEL: 'error',
  CRF: 28,
  PRESET: 'slow',
  AUDIO_BITRATE: '128k',
  FASTSTART: true,
  TUNE: null
};

// ----- INSTAGRAM OUTPUT CONFIGURATION -----
const INSTAGRAM_CONFIG = {
  TARGET_WIDTH: 720,
  TARGET_HEIGHT: 1280,
  FRAME_RATE: 30,
  PIXEL_FORMAT: 'yuv420p'
};

// ============= END CONFIGURATION ===============

// =============== STATE VARIABLES ===============
let questionsData = [];
let currentIndex = 0;
let tempIdCounter = 1;
let totalProcessed = 0;
let totalSuccessful = 0;
let totalFailed = 0;
let totalSkipped = 0;
let processedIds = new Set();
let questionCounter = PREFIX_CONFIG.START_NUMBER;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

function log(type, message) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const types = {
    INFO: `${colors.cyan}[INFO]${colors.reset}`,
    SUCCESS: `${colors.green}[SUCCESS]${colors.reset}`,
    WARNING: `${colors.yellow}[WARNING]${colors.reset}`,
    ERROR: `${colors.red}[ERROR]${colors.reset}`,
    PROGRESS: `${colors.blue}[PROGRESS]${colors.reset}`
  };
  console.log(`${timestamp} ${types[type]} ${message}`);
}

// =============== LOAD QUESTIONS ===============
async function loadQuestions() {
  try {
    log('INFO', '🚀 Starting Video Question Generator...');
    log('INFO', `Toggles: Prefix=${TOGGLES.SHOW_QUESTION_PREFIX}, External Audio=${TOGGLES.USE_EXTERNAL_AUDIO}, Uppercase=${TOGGLES.CONVERT_TO_UPPERCASE}, Stroke=${TOGGLES.ENABLE_TEXT_STROKE}, Option Letters=${TOGGLES.SHOW_OPTION_LETTERS}`);
    log('INFO', `Duration mode: ${DURATION_CONFIG.FIXED_DURATION ? `Fixed: ${DURATION_CONFIG.FIXED_DURATION}s` : 'Original video duration'}`);
    log('INFO', `Encoding: CRF=${FFMPEG_CONFIG.CRF}, preset=${FFMPEG_CONFIG.PRESET}, audio=${FFMPEG_CONFIG.AUDIO_BITRATE}`);

    [DIR_CONFIG.VIDEO_DIR, DIR_CONFIG.MUSIC_DIR, DIR_CONFIG.OUTPUT_DIR,
      DIR_CONFIG.ESCAPED_OUTPUT_DIR, DIR_CONFIG.TEMP_DIR].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    log('INFO', `Loading questions from ${QUOTE_CONFIG.JSON_FILE}...`);
    const fileData = fs.readFileSync(QUOTE_CONFIG.JSON_FILE, 'utf8');
    let jsonData = JSON.parse(fileData);

    let rawQuestions = [];
    if (Array.isArray(jsonData)) {
      rawQuestions = jsonData;
    } else {
      throw new Error('Invalid JSON structure - expected an array.');
    }

    questionsData = rawQuestions
      .filter(item => item.text && item.a && item.b)
      .map((item) => {
        const id = item.id ?? `temp_${tempIdCounter++}`;
        return { id, text: item.text, options: { a: item.a, b: item.b, c: item.c, d: item.d }, originalData: item };
      });

    if (questionsData.length === 0) throw new Error('No valid questions found in the JSON file.');

    log('SUCCESS', `✅ Loaded ${questionsData.length} questions.`);
    await askForStartingIndex();
  } catch (err) {
    log('ERROR', `Failed to load questions: ${err.message}`);
    process.exit(1);
  }
}

// =============== ASK FOR STARTING INDEX ONLY ===============
async function askForStartingIndex() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  log('INFO', `Available questions (showing first ${QUOTE_CONFIG.PREVIEW_COUNT}):`);
  for (let i = 0; i < Math.min(QUOTE_CONFIG.PREVIEW_COUNT, questionsData.length); i++) {
    const question = questionsData[i];
    const preview = question.text.length > 40 ? question.text.substring(0, 40) + '...' : question.text;

    let previewText = preview;
    if (TOGGLES.SHOW_QUESTION_PREFIX) {
      let prefixText = PREFIX_CONFIG.PREFIX_TEXT;
      if (PREFIX_CONFIG.INCLUDE_NUMBER) prefixText += (PREFIX_CONFIG.START_NUMBER + i);
      prefixText += PREFIX_CONFIG.SEPARATOR + PREFIX_CONFIG.SPACE_AFTER_SEPARATOR;
      previewText = prefixText + preview;
    }

    console.log(`${colors.cyan}[${i}]${colors.reset} ID: ${question.id} - "${previewText}"`);

    if (TOGGLES.SHOW_OPTION_LETTERS) {
      console.log(`     A) ${question.options.a.substring(0, 30)}...`);
      console.log(`     B) ${question.options.b.substring(0, 30)}...`);
      if (question.options.c) console.log(`     C) ${question.options.c.substring(0, 30)}...`);
      if (question.options.d) console.log(`     D) ${question.options.d.substring(0, 30)}...`);
    } else {
      console.log(`     • ${question.options.a.substring(0, 30)}...`);
      console.log(`     • ${question.options.b.substring(0, 30)}...`);
      if (question.options.c) console.log(`     • ${question.options.c.substring(0, 30)}...`);
      if (question.options.d) console.log(`     • ${question.options.d.substring(0, 30)}...`);
    }
    console.log('');
  }

  if (questionsData.length > QUOTE_CONFIG.PREVIEW_COUNT) {
    log('INFO', `... and ${questionsData.length - QUOTE_CONFIG.PREVIEW_COUNT} more questions.`);
  }

  const startIndex = await new Promise((resolve) => {
    rl.question(`\n📌 Enter starting index (0-${questionsData.length - 1}) or press Enter for 0: `, (answer) => {
      const index = parseInt(answer);
      resolve(!isNaN(index) && index >= 0 && index < questionsData.length ? index : 0);
    });
  });

  currentIndex = startIndex;
  questionCounter = PREFIX_CONFIG.START_NUMBER + startIndex;
  log('INFO', `Starting from index ${startIndex} (Question #${questionCounter})`);
  rl.close();
}

// =============== HELPER FUNCTIONS ===============
function applyTextCase(text) {
  return TOGGLES.CONVERT_TO_UPPERCASE ? String(text).toUpperCase() : String(text);
}

function formatText(text, maxWidth) {
  const words = applyTextCase(text).split(' ');
  let lines = [''];
  words.forEach(word => {
    const lastLine = lines[lines.length - 1];
    if ((lastLine + ' ' + word).length <= maxWidth) {
      lines[lines.length - 1] = `${lastLine} ${word}`.trim();
    } else {
      lines.push(word);
    }
  });
  return lines;
}

function formatTextWithPrefix(prefix, text, maxWidth) {
  const words = (applyTextCase(prefix) + applyTextCase(text)).split(' ');
  let lines = [''];
  words.forEach(word => {
    const lastLine = lines[lines.length - 1];
    if ((lastLine + ' ' + word).length <= maxWidth) {
      lines[lines.length - 1] = `${lastLine} ${word}`.trim();
    } else {
      lines.push(word);
    }
  });
  return lines;
}

function formatQuestionWithOptions(questionObj, questionNumber) {
  const sections = [];

  let prefixText = '';
  if (TOGGLES.SHOW_QUESTION_PREFIX) {
    prefixText = PREFIX_CONFIG.PREFIX_TEXT;
    if (PREFIX_CONFIG.INCLUDE_NUMBER) prefixText += questionNumber;
    prefixText += PREFIX_CONFIG.SEPARATOR + PREFIX_CONFIG.SPACE_AFTER_SEPARATOR;
  }

  if (TOGGLES.SHOW_QUESTION_PREFIX && PREFIX_CONFIG.SAME_LINE_AS_QUESTION) {
    sections.push({
      type: 'question_with_prefix',
      lines: formatTextWithPrefix(prefixText, questionObj.text, TEXT_CONFIG.LINE_WIDTHS.QUESTION),
      fontSize: TEXT_CONFIG.TITLE_FONT_SIZE,
      color: TEXT_CONFIG.FONT_COLOR
    });
  } else {
    if (TOGGLES.SHOW_QUESTION_PREFIX) {
      sections.push({
        type: 'prefix',
        lines: formatText(prefixText, TEXT_CONFIG.LINE_WIDTHS.PREFIX),
        fontSize: PREFIX_CONFIG.PREFIX_FONT_SIZE || TEXT_CONFIG.TITLE_FONT_SIZE,
        color: PREFIX_CONFIG.PREFIX_COLOR
      });
    }
    sections.push({
      type: 'question',
      lines: formatText(questionObj.text, TEXT_CONFIG.LINE_WIDTHS.QUESTION),
      fontSize: TEXT_CONFIG.TITLE_FONT_SIZE,
      color: TEXT_CONFIG.FONT_COLOR
    });
  }

  for (let i = 0; i < TEXT_CONFIG.PARAGRAPH_MARGINS.BETWEEN_QUESTION_AND_OPTIONS; i++) {
    sections.push({ type: 'spacing', lines: [''], fontSize: TEXT_CONFIG.FONT_SIZE });
  }

  const optionKeys = ['a', 'b', 'c', 'd'];
  optionKeys.forEach(key => {
    if (questionObj.options[key]) {
      const optionText = TOGGLES.SHOW_OPTION_LETTERS
        ? `${key.toUpperCase()}. ${questionObj.options[key]}`
        : questionObj.options[key];

      sections.push({
        type: 'option',
        lines: formatText(optionText, TEXT_CONFIG.LINE_WIDTHS.OPTION),
        fontSize: TEXT_CONFIG.OPTION_FONT_SIZE,
        color: TEXT_CONFIG.FONT_COLOR
      });

      const nextKeys = optionKeys.slice(optionKeys.indexOf(key) + 1);
      if (nextKeys.some(k => questionObj.options[k])) {
        for (let i = 0; i < TEXT_CONFIG.PARAGRAPH_MARGINS.BETWEEN_OPTIONS; i++) {
          sections.push({ type: 'spacing', lines: [''], fontSize: TEXT_CONFIG.FONT_SIZE });
        }
      }
    }
  });

  return sections;
}

function escapeFilterText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function getDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
    ).toString();
    return parseFloat(result) || 10;
  } catch {
    return 10;
  }
}

function getXPosition() {
  switch (TEXT_CONFIG.ALIGNMENT.MODE) {
    case 'left':  return TEXT_CONFIG.ALIGNMENT.LEFT_MARGIN;
    case 'right': return `w-${TEXT_CONFIG.ALIGNMENT.RIGHT_MARGIN}-text_w`;
    default:      return '(w-text_w)/2';
  }
}

function buildDrawTextFilter(sections, duration) {
  let totalLines = 0;
  sections.forEach(s => { totalLines += s.lines.length; });

  const totalTextHeight = (totalLines - 1) * TEXT_CONFIG.LINE_SPACING;
  const baseY = `(h-${totalTextHeight})/2${TEXT_CONFIG.TEXT_Y_OFFSET >= 0 ? '+' : ''}${TEXT_CONFIG.TEXT_Y_OFFSET}`;

  let lineCounter = 0;
  const textFilters = [];

  sections.forEach((section) => {
    section.lines.forEach((line) => {
      if (line === '') { lineCounter++; return; }

      const yPos = `${baseY}+${lineCounter * TEXT_CONFIG.LINE_SPACING}`;
      let filter = `drawtext=text='${escapeFilterText(line)}':x=${getXPosition()}:y=${yPos}:fontfile=${TEXT_CONFIG.FONT}:fontsize=${section.fontSize}:fontcolor=${section.color || TEXT_CONFIG.FONT_COLOR}`;

      if (TOGGLES.ENABLE_TEXT_STROKE && TEXT_CONFIG.STROKE.WIDTH > 0) {
        filter += `:borderw=${TEXT_CONFIG.STROKE.WIDTH}:bordercolor=${TEXT_CONFIG.STROKE.COLOR}`;
      }
      if (TOGGLES.ENABLE_TEXT_SHADOW && !TOGGLES.ENABLE_TEXT_STROKE) {
        filter += `:shadowx=${TEXT_CONFIG.SHADOW.X}:shadowy=${TEXT_CONFIG.SHADOW.Y}:shadowcolor=${TEXT_CONFIG.SHADOW.COLOR}`;
      }

      filter += `:enable='between(t,0,${duration})'`;
      textFilters.push(filter);
      lineCounter++;
    });
  });

  return textFilters.join(',');
}

// =============== QUESTION SELECTION ===============
function getNextQuestion() {
  while (currentIndex < questionsData.length) {
    const questionObj = questionsData[currentIndex];
    currentIndex++;

    if (!processedIds.has(questionObj.id) && questionObj.text && questionObj.text.length <= QUOTE_CONFIG.MAX_LENGTH) {
      processedIds.add(questionObj.id);
      return questionObj;
    } else {
      totalSkipped++;
    }
  }
  return null;
}

// =============== SELECT RANDOM AUDIO ===============
function getRandomAudio() {
  const audioFiles = fs.readdirSync(DIR_CONFIG.MUSIC_DIR)
    .filter(f => PROCESSING_CONFIG.AUDIO_EXTENSIONS.some(ext => f.endsWith(ext)));
  if (audioFiles.length === 0) return null;
  return path.join(DIR_CONFIG.MUSIC_DIR, audioFiles[Math.floor(Math.random() * audioFiles.length)]);
}

// =============== BUILD OPTIMIZED ENCODING ARGS ===============
function getEncodingArgs() {
  const args = [
    '-c:v', FFMPEG_CONFIG.VIDEO_CODEC,
    '-crf', FFMPEG_CONFIG.CRF.toString(),
    '-preset', FFMPEG_CONFIG.PRESET,
    '-r', INSTAGRAM_CONFIG.FRAME_RATE.toString()
  ];
  if (FFMPEG_CONFIG.TUNE) args.push('-tune', FFMPEG_CONFIG.TUNE);
  if (FFMPEG_CONFIG.FASTSTART) args.push('-movflags', '+faststart');
  return args;
}

// =============== PROCESS VIDEO ===============
async function processQuestion(questionObj) {
  const currentQuestionNumber = questionCounter++;

  log('PROGRESS', `🎬 Processing question #${totalProcessed + 1} - ID: ${questionObj.id} (Question #${currentQuestionNumber})`);
  let attempt = 0;
  let success = false;
  let outputFilePath = null;
  let tempFilePath = null;

  while (attempt < PROCESSING_CONFIG.MAX_RETRIES && !success) {
    attempt++;
    try {
      const videoFiles = fs.readdirSync(DIR_CONFIG.VIDEO_DIR)
        .filter(f => PROCESSING_CONFIG.VIDEO_EXTENSIONS.some(ext => f.endsWith(ext)));

      if (videoFiles.length === 0) throw new Error('No videos found');

      const videoFile = videoFiles[Math.floor(Math.random() * videoFiles.length)];
      const videoPath = path.join(DIR_CONFIG.VIDEO_DIR, videoFile);
      const videoDuration = getDuration(videoPath);

      let finalDuration;
      if (DURATION_CONFIG.FIXED_DURATION !== null) {
        finalDuration = Math.min(
          Math.max(DURATION_CONFIG.FIXED_DURATION, DURATION_CONFIG.MIN_DURATION),
          DURATION_CONFIG.MAX_DURATION
        );
        log('INFO', `Video: ${videoFile} (${videoDuration.toFixed(2)}s) → Using fixed duration: ${finalDuration.toFixed(2)}s`);
      } else {
        finalDuration = videoDuration;
        log('INFO', `Video: ${videoFile} (${finalDuration.toFixed(2)}s) → Using original duration`);
      }

      const sections = formatQuestionWithOptions(questionObj, currentQuestionNumber);
      const fullText = questionObj.text + Object.values(questionObj.options).join(' ');
      const needsEscaping = /[':\\]/.test(fullText);
      const outputDir = needsEscaping ? DIR_CONFIG.ESCAPED_OUTPUT_DIR : DIR_CONFIG.OUTPUT_DIR;
      const textFilters = buildDrawTextFilter(sections, finalDuration);
      const safeId = String(questionObj.id).replace(/[^a-zA-Z0-9]/g, '_');
      tempFilePath = path.join(DIR_CONFIG.TEMP_DIR, `temp_${safeId}.mp4`);
      outputFilePath = path.join(outputDir, `${safeId}.mp4`);

      let audioSource = null;
      let audioDuration = null;

      if (TOGGLES.USE_EXTERNAL_AUDIO) {
        audioSource = getRandomAudio();
        if (audioSource) {
          audioDuration = getDuration(audioSource);
          log('INFO', `Using external audio: ${path.basename(audioSource)} (${audioDuration.toFixed(2)}s)`);
        } else {
          log('WARNING', 'No audio files found, keeping original video audio');
        }
      }

      const needsAudioLoop = audioSource && audioDuration < finalDuration;

      if (needsAudioLoop) {
        log('INFO', `Audio (${audioDuration.toFixed(2)}s) shorter than video (${finalDuration.toFixed(2)}s), looping audio`);

        const loopArgs = [
          '-y',
          '-loglevel', FFMPEG_CONFIG.LOGLEVEL,
          '-i', videoPath,
          '-filter_complex',
          `[0:v]scale=${INSTAGRAM_CONFIG.TARGET_WIDTH}:${INSTAGRAM_CONFIG.TARGET_HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${INSTAGRAM_CONFIG.TARGET_WIDTH}:${INSTAGRAM_CONFIG.TARGET_HEIGHT},` +
          `format=${INSTAGRAM_CONFIG.PIXEL_FORMAT},setpts=PTS[vscaled];` +
          `[vscaled]${textFilters}[vout];` +
          `amovie=${audioSource}:loop=999999999[audio]`,
          '-map', '[vout]',
          '-map', '[audio]',
          ...getEncodingArgs(),
          '-c:a', FFMPEG_CONFIG.AUDIO_CODEC,
          '-b:a', FFMPEG_CONFIG.AUDIO_BITRATE,
          '-t', finalDuration.toString(),
          '-shortest',
          tempFilePath
        ];

        execSync(`ffmpeg ${loopArgs.map(a => `"${a}"`).join(' ')}`, { stdio: 'inherit' });

      } else {
        const ffmpegArgs = [
          '-y',
          '-loglevel', FFMPEG_CONFIG.LOGLEVEL,
          '-i', videoPath
        ];

        if (audioSource) ffmpegArgs.push('-i', audioSource);

        const filterComplex =
          `[0:v]scale=${INSTAGRAM_CONFIG.TARGET_WIDTH}:${INSTAGRAM_CONFIG.TARGET_HEIGHT}:force_original_aspect_ratio=increase,` +
          `crop=${INSTAGRAM_CONFIG.TARGET_WIDTH}:${INSTAGRAM_CONFIG.TARGET_HEIGHT},` +
          `format=${INSTAGRAM_CONFIG.PIXEL_FORMAT},setpts=PTS[v0];` +
          `[v0]${textFilters}[vout]`;

        ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[vout]');

        if (audioSource) {
          ffmpegArgs.push('-map', '1:a');
        } else {
          ffmpegArgs.push('-map', '0:a?');
        }

        ffmpegArgs.push(...getEncodingArgs());

        if (audioSource) {
          ffmpegArgs.push('-c:a', FFMPEG_CONFIG.AUDIO_CODEC, '-b:a', FFMPEG_CONFIG.AUDIO_BITRATE);
        } else {
          ffmpegArgs.push('-c:a', 'copy');
        }

        if (DURATION_CONFIG.FIXED_DURATION !== null) {
          ffmpegArgs.push('-t', finalDuration.toString());
        }

        ffmpegArgs.push(tempFilePath);
        execSync(`ffmpeg ${ffmpegArgs.map(a => `"${a}"`).join(' ')}`, { stdio: 'inherit' });
      }

      if (fs.existsSync(tempFilePath)) {
        fs.renameSync(tempFilePath, outputFilePath);
        success = true;
        totalSuccessful++;

        const fileSizeKB = Math.round(fs.statSync(outputFilePath).size / 1024);
        const audioType = audioSource
          ? `with external audio (${needsAudioLoop ? 'looped' : 'trimmed'})`
          : 'with original audio';
        log('SUCCESS', `✅ Created: ${path.basename(outputFilePath)} ${audioType} (${finalDuration.toFixed(2)}s) — ${fileSizeKB} KB`);
      } else {
        throw new Error('FFmpeg did not produce output');
      }

    } catch (error) {
      log('ERROR', `Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= PROCESSING_CONFIG.MAX_RETRIES) totalFailed++;
      try { if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch {}
      if (attempt < PROCESSING_CONFIG.MAX_RETRIES) {
        await new Promise(r => setTimeout(r, PROCESSING_CONFIG.RETRY_DELAY));
      }
    }
  }

  return success ? outputFilePath : null;
}

// =============== MAIN EXECUTION LOOP ===============
async function main() {
  try {
    await loadQuestions();

    log('INFO', `🚀 Processing all ${questionsData.length} questions continuously...`);

    let questionObj;
    while ((questionObj = getNextQuestion()) !== null) {
      await processQuestion(questionObj);
      totalProcessed++;
    }

    log('SUCCESS', `✨ Complete! Processed: ${totalProcessed}, Successful: ${totalSuccessful}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`);
  } catch (error) {
    log('ERROR', `Fatal: ${error.message}`);
  }
}

process.on('SIGINT', () => {
  log('WARNING', `\n👋 Interrupted. Stats — Processed: ${totalProcessed}, Successful: ${totalSuccessful}, Failed: ${totalFailed}, Skipped: ${totalSkipped}`);
  process.exit(0);
});

main();