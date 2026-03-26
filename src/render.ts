import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia} from '@remotion/renderer';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REMOTION_COMPOSITION_ID} from './Root';
import type {RenderPayload} from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const entryPoint = path.join(projectRoot, 'src', 'index.ts');

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

  assertValidLineTimes(payload);

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
  const inputProps = await loadPayload(payloadPath);

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
