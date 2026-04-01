import type {RenderPayload} from './types';

type TranscriptWord = {
  text: string;
  start: number;
  end: number;
};

type TranscriptSegment = {
  text?: string;
  start: number;
  end: number;
};

type TranscriptShape = {
  words?: TranscriptWord[];
  segments?: TranscriptSegment[];
};

const toMs = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return value > 1000 ? Math.floor(value) : Math.floor(value * 1000);
};

const normalizeWords = (words: TranscriptWord[]) =>
  words
    .filter((item) => typeof item.start === 'number' && typeof item.end === 'number')
    .map((item) => ({
      text: item.text,
      startMs: toMs(item.start),
      endMs: Math.max(toMs(item.end), toMs(item.start) + 1),
    }));

const normalizeSegments = (segments: TranscriptSegment[]) =>
  segments
    .filter((item) => typeof item.start === 'number' && typeof item.end === 'number')
    .map((item) => ({
      text: item.text ?? '',
      startMs: toMs(item.start),
      endMs: Math.max(toMs(item.end), toMs(item.start) + 1),
    }));

const wordsInLine = (line: string) => line.trim().split(/\s+/).filter(Boolean).length;

export const buildSubtitleTimingFromTranscript = (
  lines: string[],
  transcript: TranscriptShape,
): Pick<RenderPayload, 'lineStartTimesMs' | 'lineDurationsMs' | 'lineStartTimesUnit'> => {
  if (transcript.segments && transcript.segments.length >= lines.length) {
    const segments = normalizeSegments(transcript.segments).slice(0, lines.length);

    return {
      lineStartTimesMs: segments.map((item) => item.startMs),
      lineDurationsMs: segments.map((item) => Math.max(1, item.endMs - item.startMs)),
      lineStartTimesUnit: 'ms',
    };
  }

  if (transcript.words && transcript.words.length > 0) {
    const words = normalizeWords(transcript.words);
    const lineStartTimesMs: number[] = [];
    const lineDurationsMs: number[] = [];

    let cursor = 0;

    lines.forEach((line) => {
      const count = Math.max(1, wordsInLine(line));
      const slice = words.slice(cursor, cursor + count);

      if (slice.length === 0) {
        throw new Error('Transcript does not contain enough word-level timestamps for all lines.');
      }

      const startMs = slice[0].startMs;
      const endMs = slice[slice.length - 1].endMs;

      lineStartTimesMs.push(startMs);
      lineDurationsMs.push(Math.max(1, endMs - startMs));

      cursor += slice.length;
    });

    return {
      lineStartTimesMs,
      lineDurationsMs,
      lineStartTimesUnit: 'ms',
    };
  }

  throw new Error('Unsupported transcript format. Expected `segments[]` or `words[]` with start/end timestamps.');
};
