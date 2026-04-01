import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia} from '@remotion/renderer';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REMOTION_COMPOSITION_ID} from './Root';
import {buildSubtitleTimingFromTranscript} from './transcriptTiming';
import type {RenderPayload} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const entryPoint = path.join(projectRoot, 'src', 'index.ts');

const loadJsonFile = async <T>(filePath: string): Promise<T> => {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents) as T;
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

  if (payload.lineDurationsMs) {
    if (!Array.isArray(payload.lineDurationsMs)) {
      throw new Error('Invalid payload. lineDurationsMs must be an array of numbers.');
    }

    if (payload.lineDurationsMs.length !== payload.lines.length) {
      throw new Error('Invalid payload. lineDurationsMs length must match lines length.');
    }
  }
};

const loadPayload = async (payloadFile: string): Promise<RenderPayload> => {
  const payload = await loadJsonFile<RenderPayload>(payloadFile);

  if (!payload.background || !payload.voice || !payload.music || !Array.isArray(payload.lines)) {
    throw new Error('Invalid payload. Expected background, voice, music, and lines[].');
  }

  assertValidLineTimes(payload);

  return payload;
};

const withTranscriptTiming = async (payload: RenderPayload): Promise<RenderPayload> => {
  const hasManualTiming =
    Array.isArray(payload.lineStartTimesMs) &&
    payload.lineStartTimesMs.length === payload.lines.length;

  if (hasManualTiming) {
    return payload;
  }

  if (!payload.voiceTranscript) {
    throw new Error(
      'Subtitle timing is missing. Provide lineStartTimesMs or voiceTranscript with timestamp data.',
    );
  }

  const transcriptPath = path.resolve(process.cwd(), payload.voiceTranscript);
  const transcript = await loadJsonFile<unknown>(transcriptPath);

  return {
    ...payload,
    ...buildSubtitleTimingFromTranscript(payload.lines, transcript as never),
  };
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
  const inputProps = await withTranscriptTiming(payload);

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
