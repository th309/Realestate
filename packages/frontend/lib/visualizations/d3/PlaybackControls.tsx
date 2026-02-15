'use client';

import React from 'react';
import { Play, Pause } from 'lucide-react';

export interface PlaybackControlsProps {
  /** Total number of frames */
  frameCount: number;
  /** Current frame index (0-based) */
  currentFrame: number;
  /** Display date for current frame */
  currentDate: string;
  /** Whether animation is playing */
  isPlaying: boolean;
  /** Current speed in ms per frame */
  speed: number;
  /** Toggle play/pause */
  onTogglePlay: () => void;
  /** Seek to a specific frame */
  onSeek: (frameIndex: number) => void;
  /** Change playback speed */
  onSpeedChange: (speed: number) => void;
  /** Optional className */
  className?: string;
}

export function PlaybackControls({
  frameCount,
  currentFrame,
  currentDate,
  isPlaying,
  speed,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  className = '',
}: PlaybackControlsProps) {
  if (frameCount <= 0) return null;

  return (
    <div className={`flex items-center gap-3 mt-2 px-4 ${className}`}>
      {/* Play / Pause */}
      <button
        type="button"
        onClick={onTogglePlay}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary hover:bg-primary/90 transition-colors"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Speed selector */}
      <select
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
        className="text-sm bg-surface-container border border-outline-variant rounded-md px-2 py-1 text-on-surface"
      >
        <option value={1600}>0.5x</option>
        <option value={800}>1x</option>
        <option value={400}>2x</option>
        <option value={200}>4x</option>
      </select>

      {/* Date label */}
      <span className="text-sm font-semibold text-on-surface min-w-[80px]">
        {currentDate}
      </span>

      {/* Progress scrubber */}
      <input
        type="range"
        min={0}
        max={frameCount - 1}
        value={currentFrame}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 accent-primary"
      />
    </div>
  );
}
