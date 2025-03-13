import React, { useState, useEffect, useCallback } from 'react';
import { Timer } from 'lucide-react';
import { Progress } from '../ui/progress';
import { 
  calculateTimeLeft, 
  formatTimeLeft,
  calculateCooldownProgress,
  isActionReady 
} from '../../lib/utils/dateUtils';
import { cn } from '@/lib/utils';

interface CooldownTimerProps {
  cooldownEndAt: string;
  cooldownSeconds: number;
  onComplete?: () => void;
  tierColor?: string;
}

export const CooldownTimer: React.FC<CooldownTimerProps> = ({
  cooldownEndAt,
  cooldownSeconds,
  onComplete,
  tierColor
}) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft(cooldownEndAt));
  const [progress, setProgress] = useState(calculateCooldownProgress(cooldownEndAt, cooldownSeconds));
  
  useEffect(() => {
    setTimeLeft(calculateTimeLeft(cooldownEndAt));
    setProgress(calculateCooldownProgress(cooldownEndAt, cooldownSeconds));
  }, [cooldownEndAt, cooldownSeconds]);

  const updateTimer = useCallback(() => {
    const newTimeLeft = calculateTimeLeft(cooldownEndAt);
    const newProgress = calculateCooldownProgress(cooldownEndAt, cooldownSeconds);
    
    setTimeLeft(newTimeLeft);
    setProgress(newProgress);

    if (newTimeLeft === 0 && timeLeft !== 0) {
      onComplete?.();
    }
  }, [cooldownEndAt, cooldownSeconds, onComplete, timeLeft]);

  useEffect(() => {
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [updateTimer, cooldownEndAt]);

  const ready = isActionReady(cooldownEndAt);

  const statusColor = ready ? 'text-green-400' : (tierColor || 'text-slate-400');
  const progressColor = ready ? 'bg-green-400' : (tierColor?.replace('text-', 'bg-') || 'bg-slate-400');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className={cn(
            statusColor, 
            "transition-colors duration-200 w-4 h-4 md:w-5 md:h-5"
          )} />
          <span className="text-xs md:text-sm text-slate-300">Next Action</span>
        </div>
        <span className={cn(
          "text-xs md:text-sm font-medium transition-colors duration-200",
          statusColor
        )}>
          {formatTimeLeft(timeLeft)}
        </span>
      </div>

<Progress 
  value={progress} 
  className="h-1.5 bg-slate-800/50"
  color={progressColor}
/>
      
      {ready && (
        <p className={cn(
          "text-xs text-center animate-pulse",
          statusColor
        )}>
          Ready for next action!
        </p>
      )}
    </div>
  );
};