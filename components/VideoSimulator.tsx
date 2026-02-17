import React, { useState } from 'react';
import { Play, Pause, Maximize2 } from 'lucide-react';

interface VideoSimulatorProps {
  onPlayStateChange: (isPlaying: boolean) => void;
}

const VideoSimulator: React.FC<VideoSimulatorProps> = ({ onPlayStateChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    const newState = !isPlaying;
    setIsPlaying(newState);
    onPlayStateChange(newState);
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-slate-800 shadow-2xl group">
      {/* Background/Thumbnail */}
      <img 
        src="https://picsum.photos/800/450" 
        alt="Video content" 
        className={`h-full w-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-80' : 'opacity-40'}`}
      />
      
      {/* Overlay UI */}
      <div className="absolute inset-0 flex items-center justify-center">
        {!isPlaying && (
          <button 
            onClick={togglePlay}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-transform hover:scale-110 hover:bg-white/20"
          >
            <Play fill="white" className="ml-1 text-white" size={32} />
          </button>
        )}
      </div>

      {/* Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-4 pt-10 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="mb-2 h-1 w-full rounded-full bg-slate-700">
          <div className="h-full w-1/3 rounded-full bg-orange-500"></div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-orange-400">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <span className="text-xs font-medium text-slate-300">04:20 / 12:45</span>
          </div>
          <button className="text-white hover:text-orange-400">
            <Maximize2 size={20} />
          </button>
        </div>
      </div>

      <div className="absolute top-4 left-4 rounded bg-black/50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md">
        Demo Player
      </div>
    </div>
  );
};

export default VideoSimulator;
