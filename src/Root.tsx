import React from 'react';
import {Composition} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {VerticalMotivationVideo} from './VerticalMotivationVideo';
import {toMediaSource} from './media';
import type {RenderPayload} from './types';

export const REMOTION_COMPOSITION_ID = 'MotivationShort';
const FPS = 30;

const defaultProps: RenderPayload = {
  background: 'background.png',
  voice: 'voice.mp3',
  music: 'music.mp3',
  lines: ['You think you need luck.', 'You don’t.', 'Choose wisely.'],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={REMOTION_COMPOSITION_ID}
      component={VerticalMotivationVideo}
      width={1080}
      height={1920}
      fps={FPS}
      defaultProps={defaultProps}
      durationInFrames={FPS * 6}
      calculateMetadata={async ({props}) => {
        const payload = props as RenderPayload;
        const durationInSeconds = await getAudioDurationInSeconds(toMediaSource(payload.voice));

        return {
          durationInFrames: Math.max(1, Math.ceil(durationInSeconds * FPS)),
          props: payload,
        };
      }}
    />
  );
};
