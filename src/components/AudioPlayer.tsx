'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react'

export interface AudioPlayerHandle {
  seek: (sec: number) => void
}

interface AudioPlayerProps {
  src: string
}

const RATES = [1, 1.25, 1.5, 2, 0.75]

function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer({ src }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)

  useImperativeHandle(ref, () => ({
    seek(sec: number) {
      const audio = audioRef.current
      if (!audio) return
      audio.currentTime = sec
      audio.play().catch(() => {})
    },
  }))

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  function skip(delta: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.min(Math.max(audio.currentTime + delta, 0), duration || Infinity)
  }

  function cycleRate() {
    const audio = audioRef.current
    if (!audio) return
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    audio.playbackRate = next
    setRate(next)
  }

  return (
    <div className="px-5 py-3 bg-white">
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
        <span>{formatTime(current)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(e) => {
          const t = Number(e.target.value)
          if (audioRef.current) audioRef.current.currentTime = t
          setCurrent(t)
        }}
        className="w-full accent-[#378ADD] mb-2"
      />

      <div className="flex items-center justify-between px-2">
        <button onClick={() => skip(-15)} className="text-gray-400 active:text-gray-600">
          <RotateCcw size={20} />
        </button>
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-[#378ADD] text-white flex items-center justify-center active:opacity-80"
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button onClick={() => skip(15)} className="text-gray-400 active:text-gray-600">
          <RotateCw size={20} />
        </button>
        <button onClick={cycleRate} className="text-[13px] text-gray-500 font-medium w-10 text-right">
          {rate}x
        </button>
      </div>
    </div>
  )
})

export default AudioPlayer
