/**
 * n8n Code node (JavaScript)
 *
 * Input JSON expected:
 * {
 *   "lines": ["You think you need luck.", "You don't.", ...],
 *   "transcript": {
 *     "segments": [
 *       {
 *         "words": [
 *           {"text": "You", "start_time": 0.159, "end_time": 0.28},
 *           {"text": " ", "start_time": 0.28, "end_time": 0.439},
 *           {"text": "think", "start_time": 0.439, "end_time": 0.819}
 *         ]
 *       }
 *     ]
 *   },
 *   "endPaddingSec": 0.16 // optional
 * }
 *
 * Output JSON:
 * {
 *   "cues": [{"text":"...","start":0.159,"end":1.939}],
 *   "lineStartTimesMs": [159, ...],
 *   "lineDurationsMs": [1780, ...],
 *   "lineStartTimesUnit": "ms"
 * }
 */

const END_PADDING_DEFAULT = 0.16;

const toSeconds = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value > 1000 ? value / 1000 : value;
};

const normalizeToken = (token) =>
  String(token)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '');

const lineTokens = (line) =>
  String(line)
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

const flattenTranscriptWords = (transcript) => {
  const hasSegmentWords = Array.isArray(transcript?.segments)
    && transcript.segments.some((segment) => Array.isArray(segment.words));

  const wordPool = hasSegmentWords
    ? transcript.segments.flatMap((segment) => segment.words || [])
    : (Array.isArray(transcript?.words) ? transcript.words : []);

  return wordPool
    .map((word) => {
      const text = String(word?.text ?? '');
      const start = toSeconds(word?.start_time ?? word?.start);
      const end = toSeconds(word?.end_time ?? word?.end);

      return {
        text,
        normalized: normalizeToken(text),
        start,
        end,
      };
    })
    .filter((word) => word.text.trim() !== '' && word.normalized !== '' && word.start !== null && word.end !== null)
    .map((word) => ({
      text: word.text,
      normalized: word.normalized,
      start: word.start,
      end: Math.max(word.end, word.start + 0.001),
    }));
};

const mapScriptLinesToTranscriptCues = ({ lines, transcript, endPaddingSec }) => {
  const words = flattenTranscriptWords(transcript);

  if (!words.length) {
    throw new Error('Transcript has no valid timestamped words in segments[].words[] or words[].');
  }

  let cursor = 0;

  return lines.map((line) => {
    const tokens = lineTokens(line);

    if (!tokens.length) {
      const anchor = words[Math.min(cursor, words.length - 1)];
      return {
        text: line,
        start: anchor.start,
        end: anchor.end + endPaddingSec,
      };
    }

    const matchedIndices = [];

    for (const token of tokens) {
      let found = -1;

      for (let i = cursor; i < words.length; i++) {
        if (words[i].normalized === token) {
          found = i;
          break;
        }
      }

      if (found === -1) {
        break;
      }

      matchedIndices.push(found);
      cursor = found + 1;
    }

    if (!matchedIndices.length) {
      const fallback = words[Math.min(cursor, words.length - 1)];
      return {
        text: line,
        start: fallback.start,
        end: fallback.end + endPaddingSec,
      };
    }

    const first = words[matchedIndices[0]];
    const last = words[matchedIndices[matchedIndices.length - 1]];

    return {
      text: line,
      start: first.start,
      end: last.end + endPaddingSec,
    };
  });
};

return $input.all().map((item) => {
  const payload = item.json || {};
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  const transcript = payload.transcript || null;
  const endPaddingSec = typeof payload.endPaddingSec === 'number'
    ? payload.endPaddingSec
    : END_PADDING_DEFAULT;

  if (!lines.length) {
    throw new Error('`lines` must be a non-empty array.');
  }

  if (!transcript) {
    throw new Error('`transcript` JSON is required.');
  }

  const cues = mapScriptLinesToTranscriptCues({ lines, transcript, endPaddingSec });

  return {
    json: {
      ...payload,
      cues,
      lineStartTimesMs: cues.map((cue) => Math.floor(cue.start * 1000)),
      lineDurationsMs: cues.map((cue) => Math.max(1, Math.floor((cue.end - cue.start) * 1000))),
      lineStartTimesUnit: 'ms',
    },
  };
});
