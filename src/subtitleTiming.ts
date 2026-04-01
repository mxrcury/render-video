export type SubtitleTiming = {
  lineStartTimesMs: number[];
  lineDurationsMs: number[];
  totalDurationMs: number;
};

const BASE_DURATION_MS = 2200;
const PER_WORD_MS = 550;
const INTER_LINE_PAUSE_MS = 350;
const MIN_LINE_DURATION_MS = 2600;
const MAX_LINE_DURATION_MS = 7600;
const IMPACT_LINE_BONUS_MS = 1400;

const IMPACT_LINES = new Set(['decide.', 'start.', 'now.', 'go.', 'act.', 'begin.']);

const countWords = (line: string) => {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isImpactLine = (line: string) => IMPACT_LINES.has(line.trim().toLowerCase());

export const generateSubtitleTiming = (lines: string[]): SubtitleTiming => {
  const safeLines = lines.length > 0 ? lines : [''];

  let cursorMs = 0;
  const lineStartTimesMs: number[] = [];
  const lineDurationsMs: number[] = [];

  safeLines.forEach((line, index) => {
    const words = countWords(line);
    const impactBonus = isImpactLine(line) ? IMPACT_LINE_BONUS_MS : 0;
    const rawDuration = BASE_DURATION_MS + words * PER_WORD_MS + impactBonus;
    const lineDurationMs = clamp(rawDuration, MIN_LINE_DURATION_MS, MAX_LINE_DURATION_MS);

    lineStartTimesMs.push(cursorMs);
    lineDurationsMs.push(lineDurationMs);

    const pause = index === safeLines.length - 1 ? 0 : INTER_LINE_PAUSE_MS;
    cursorMs += lineDurationMs + pause;
  });

  return {
    lineStartTimesMs,
    lineDurationsMs,
    totalDurationMs: cursorMs,
  };
};
