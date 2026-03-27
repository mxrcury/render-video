import {bundle} from '@remotion/bundler';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {getCompositions, renderMedia} from '@remotion/renderer';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REMOTION_COMPOSITION_ID} from './Root';
import type {RenderPayload} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const entryPoint = path.join(projectRoot, 'src', 'index.ts');
const execFileAsync = promisify(execFile);

const toVoiceFilePath = (voice: string) => {
  if (/^https?:\/\//i.test(voice)) {
    return null;
  }

  if (path.isAbsolute(voice) && !voice.startsWith('/public/')) {
    return voice;
  }

  const normalized = voice.replaceAll('\\', '/').replace(/^(\.\/|\/)?public\//i, '');
  return path.resolve(projectRoot, 'public', normalized);
};


const assertValidLineTimes = (payload: RenderPayload) => {
  if (!payload.lineStartTimesMs) {
    return;
  }

  if (!Array.isArray(payload.lineStartTimesMs)) {
    throw new Error('Invalid payload. lineStartTimesMs must be an array of numbers.');
  }

  if (payload.lineStartTimesMs.length !== payload.lines.length) {
    throw new Error('Invalid payload. lineStartTimesMs length must match lines length.');
  }

  if (payload.lineStartTimesUnit && payload.lineStartTimesUnit !== 'ms' && payload.lineStartTimesUnit !== 's') {
    throw new Error("Invalid payload. lineStartTimesUnit must be either 'ms' or 's'.");
  }

  payload.lineStartTimesMs.forEach((time, index) => {
    if (typeof time !== 'number' || Number.isNaN(time) || time < 0) {
      throw new Error(`Invalid payload. lineStartTimesMs[${index}] must be a non-negative number.`);
    }

    if (index > 0 && time < payload.lineStartTimesMs![index - 1]) {
      throw new Error('Invalid payload. lineStartTimesMs must be in ascending order.');
    }
  });
};

const loadPayload = async (payloadFile: string): Promise<RenderPayload> => {
  const payloadContents = await fs.readFile(payloadFile, 'utf8');
  const payload = JSON.parse(payloadContents) as RenderPayload;

  if (!payload.background || !payload.voice || !payload.music || !Array.isArray(payload.lines)) {
    throw new Error('Invalid payload. Expected background, voice, music, and lines[].');
  }

  if (
    payload.autoDetectLineStartTimesFromVoice !== undefined &&
    typeof payload.autoDetectLineStartTimesFromVoice !== 'boolean'
  ) {
    throw new Error('Invalid payload. autoDetectLineStartTimesFromVoice must be a boolean.');
  }

  assertValidLineTimes(payload);

  return payload;
};

const fitStartTimesToLines = ({
  startsInSeconds,
  linesCount,
  durationInSeconds,
}: {
  startsInSeconds: number[];
  linesCount: number;
  durationInSeconds: number;
}) => {
  if (linesCount <= 0) {
    return [];
  }

  const uniqueStarts = Array.from(new Set(startsInSeconds.map((value) => Number(value.toFixed(3))))).sort(
    (a, b) => a - b,
  );

  const withZero = uniqueStarts[0] === 0 ? uniqueStarts : [0, ...uniqueStarts];

  if (withZero.length === linesCount) {
    return withZero;
  }

  if (withZero.length > linesCount) {
    return Array.from({length: linesCount}, (_, index) => {
      const mappedIndex = Math.round((index * (withZero.length - 1)) / Math.max(1, linesCount - 1));
      return withZero[mappedIndex];
    });
  }

  const remaining = linesCount - withZero.length;
  const tailStart = withZero[withZero.length - 1] ?? 0;
  const availableSeconds = Math.max(0.2, durationInSeconds - tailStart);

  const filledTail = Array.from({length: remaining}, (_, index) => {
    const ratio = (index + 1) / (remaining + 1);
    return tailStart + availableSeconds * ratio;
  });

  return [...withZero, ...filledTail];
};

const inferLineStartTimesFromVoice = async ({
  voicePath,
  linesCount,
}: {
  voicePath: string;
  linesCount: number;
}) => {
  const {stderr} = await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-i',
    voicePath,
    '-af',
    'silencedetect=noise=-35dB:d=0.22',
    '-f',
    'null',
    '-',
  ]);

  const matches = Array.from(stderr.matchAll(/silence_end:\s*([0-9]+(?:\.[0-9]+)?)/g));
  const silenceEndStarts = matches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value));

  const durationInSeconds = await getAudioDurationInSeconds(voicePath);
  const fittedStartsInSeconds = fitStartTimesToLines({
    startsInSeconds: [0, ...silenceEndStarts],
    linesCount,
    durationInSeconds,
  });

  return fittedStartsInSeconds.map((seconds) => Math.max(0, Math.floor(seconds * 1000)));
};

const applyAutoDetectedLineStarts = async (payload: RenderPayload): Promise<RenderPayload> => {
  const hasManualLineTimes = Array.isArray(payload.lineStartTimesMs) && payload.lineStartTimesMs.length > 0;
  const shouldAutoDetect = !hasManualLineTimes && payload.autoDetectLineStartTimesFromVoice !== false;

  if (!shouldAutoDetect) {
    return payload;
  }

  try {
    const voicePath = toVoiceFilePath(payload.voice);

    if (!voicePath) {
      return payload;
    }

    const detectedStartsMs = await inferLineStartTimesFromVoice({
      voicePath,
      linesCount: payload.lines.length,
    });

    if (detectedStartsMs.length === payload.lines.length) {
      return {
        ...payload,
        lineStartTimesMs: detectedStartsMs,
        lineStartTimesUnit: 'ms',
      };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn('Auto-detect line timings skipped: ffmpeg is not installed. Using fallback subtitle timing.');
    } else {
      console.warn('Auto-detect line timings skipped due to analysis error. Using fallback subtitle timing.');
    }
  }

  return payload;
};

const main = async () => {
  const payloadArg = process.argv[2];
  const outputArg = process.argv[3] ?? 'out/motivation-short.mp4';

  if (!payloadArg) {
    throw new Error('Usage: npm run render -- <payload.json> [output.mp4]');
  }

  const payloadPath = path.resolve(process.cwd(), payloadArg);
  const outputLocation = path.resolve(process.cwd(), outputArg);
  const payload = await loadPayload(payloadPath);
  const inputProps = await applyAutoDetectedLineStarts(payload);

  await fs.mkdir(path.dirname(outputLocation), {recursive: true});

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  const compositions = await getCompositions(bundleLocation, {
    inputProps,
  });

  const composition = compositions.find((item) => item.id === REMOTION_COMPOSITION_ID);

  if (!composition) {
    throw new Error(`Composition "${REMOTION_COMPOSITION_ID}" not found.`);
  }

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps,
  });

  console.log(`Rendered video to ${outputLocation}`);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
