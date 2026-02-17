import React, { useEffect, useRef, useState } from 'react';

interface MicIndicatorProps {
  isRecording: boolean;
}

const MicIndicator: React.FC<MicIndicatorProps> = ({ isRecording }) => {
  const [levels, setLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (isRecording) {
      startVisualization();
    } else {
      stopVisualization();
    }
    return () => stopVisualization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  const startVisualization = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);

        // Sample 5 frequency bands for the bars
        const barCount = 5;
        const bars: number[] = [];
        const bandSize = Math.floor(data.length / barCount);

        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < bandSize; j++) {
            sum += data[i * bandSize + j];
          }
          bars.push(sum / bandSize / 255);
        }

        setLevels(bars);
        animationRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (e) {
      console.error('Mic indicator: could not access microphone', e);
    }
  };

  const stopVisualization = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setLevels([0, 0, 0, 0, 0]);
  };

  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-[3px] h-8 px-1" title="Рівень звуку мікрофона">
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-red-500"
          style={{
            height: `${Math.max(4, level * 28)}px`,
            opacity: 0.4 + level * 0.6,
            transition: 'height 75ms ease-out, opacity 75ms ease-out',
          }}
        />
      ))}
    </div>
  );
};

export default MicIndicator;
