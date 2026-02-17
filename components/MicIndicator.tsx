import React from 'react';

interface MicIndicatorProps {
  isRecording: boolean;
}

const MicIndicator: React.FC<MicIndicatorProps> = ({ isRecording }) => {
  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-[3px] h-8 px-1" title="Мікрофон активний">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-red-500 animate-pulse"
          style={{
            height: `${10 + Math.random() * 18}px`,
            animationDelay: `${i * 120}ms`,
            animationDuration: `${400 + i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
};

export default MicIndicator;
