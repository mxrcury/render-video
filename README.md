# Remotion vertical motivation renderer

A small production-ready Remotion pipeline that renders a 1080x1920 motivational short from a JSON payload.

## Project structure

```text
.
├── package.json
├── payload.example.json
├── public/
│   ├── background.png
│   ├── music.mp3
│   └── voice.mp3
├── remotion.config.ts
├── src/
│   ├── index.ts
│   ├── media.ts
│   ├── Root.tsx
│   ├── VerticalMotivationVideo.tsx
│   ├── render.ts
│   └── types.ts
└── tsconfig.json
```

Add your input assets into `public/` using the filenames referenced by the JSON payload. The payload supports `background.png`, `public/background.png`, and `/public/background.png` style paths for local files.

## Payload format

```json
{
  "background": "background.png",
  "voice": "voice.mp3",
  "music": "music.mp3",
  "lines": [
    "Comfort is a slow tax.",
    "You pay every day.",
    "Small compromises compound.",
    "Excuses turn into habits.",
    "Time doesn't ask permission.",
    "Comfort or growth.",
    "Discipline accumulates quietly.",
    "Small pain. Lasting value.",
    "Decide."
  ],
  "lineStartTimesMs": [0, 1300, 2600, 3900, 5300, 6700, 7900, 9300, 10600]
}
```

### Subtitle sync

- `lineStartTimesMs` is optional but recommended for precise subtitle sync.
- When provided, each subtitle appears exactly at its timestamp (milliseconds from voice start).
- `lineStartTimesMs.length` must match `lines.length` and be sorted ascending.
- If omitted, captions are split evenly across the total video duration.

## Install

```bash
npm install
```

## Render a video

```bash
npm run render -- payload.example.json out/motivation-short.mp4
```

The renderer will:

- bundle the Remotion project,
- read the payload,
- calculate the composition duration from the narration audio,
- render the vertical MP4 via `renderMedia()`.

## Notes

- The background can be an image or a video file and should exist in `public/`.
- Captions are centered and shown one line at a time.
- Each caption line gets a subtle fade and upward motion.
- Music is mixed at low volume beneath the narration.
