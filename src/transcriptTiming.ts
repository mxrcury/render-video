import type {RenderPayload} from './types';

type TranscriptWord = {
  text: string;
  start?: number;
  end?: number;
  start_time?: number;
  end_time?: number;
};

type TranscriptSegment = {
  text?: string;
  start?: number;
  end?: number;
  start_time?: number;
  end_time?: number;
  words?: TranscriptWord[];
};

type TranscriptShape = {
  words?: TranscriptWord[];
  segments?: TranscriptSegment[];
};

export type SubtitleCue = {
  text: string;
  start: number;
  end: number;
};

const END_PADDING_SEC = 0.16;

const toSeconds = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value > 1000 ? value / 1000 : value;
};

const normalizeToken = (token: string) =>
  token
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '');

const lineTokens = (line: string) =>
  line
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

const flattenTranscriptWords = (transcript: TranscriptShape) => {
  const wordPool = transcript.segments?.some((segment) => Array.isArray(segment.words))
    ? transcript.segments.flatMap((segment) => segment.words ?? [])
    : transcript.words ?? [];

  return wordPool
    .map((word) => {
      const start = toSeconds(word.start_time ?? word.start);
      const end = toSeconds(word.end_time ?? word.end);

      return {
        text: word.text,
        normalized: normalizeToken(word.text),
        start,
        end,
      };
    })
    .filter((word) => word.text.trim() !== '' && word.normalized !== '' && word.start !== null && word.end !== null)
    .map((word) => ({
      text: word.text,
      normalized: word.normalized,
      start: word.start as number,
      end: Math.max(word.end as number, (word.start as number) + 0.001),
    }));
};

export const mapScriptLinesToTranscriptCues = (lines: string[], transcript: TranscriptShape): SubtitleCue[] => {
  const words = flattenTranscriptWords(transcript);

  if (words.length === 0) {
    throw new Error('Transcript does not contain valid timestamped words in segments[].words[] or words[].');
  }

  let cursor = 0;

  return lines.map((line) => {
    const tokens = lineTokens(line);

    if (tokens.length === 0) {
      const anchor = words[Math.min(cursor, words.length - 1)];
      return {
        text: line,
        start: anchor.start,
        end: anchor.end + END_PADDING_SEC,
      };
    }

    const matchedIndices: number[] = [];

    for (const token of tokens) {
      let foundIndex = -1;

      for (let i = cursor; i < words.length; i++) {
        if (words[i].normalized === token) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1) {
        break;
      }

      matchedIndices.push(foundIndex);
      cursor = foundIndex + 1;
    }

    if (matchedIndices.length === 0) {
      const fallback = words[Math.min(cursor, words.length - 1)];
      return {
        text: line,
        start: fallback.start,
        end: fallback.end + END_PADDING_SEC,
      };
    }

    const first = words[matchedIndices[0]];
    const last = words[matchedIndices[matchedIndices.length - 1]];

    return {
      text: line,
      start: first.start,
      end: last.end + END_PADDING_SEC,
    };
  });
};

export const buildSubtitleTimingFromTranscript = (
  lines: string[],
  transcript: TranscriptShape,
): Pick<RenderPayload, 'lineStartTimesMs' | 'lineDurationsMs' | 'lineStartTimesUnit'> => {
  const cues = mapScriptLinesToTranscriptCues(lines, transcript);

  return {
    lineStartTimesMs: cues.map((cue) => Math.floor(cue.start * 1000)),
    lineDurationsMs: cues.map((cue) => Math.max(1, Math.floor((cue.end - cue.start) * 1000))),
    lineStartTimesUnit: 'ms',
  };
};
