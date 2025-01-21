import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { TierProgress, TierEntity } from '@/lib/types/tier';
import { StakedEntity } from '@/lib/types/staked';
import { getTierConfig, calculateSafeUnstakeAmount, getTierDisplayName, getTierWeight } from '@/lib/utils/tierUtils';
import { formatNumber } from '@/lib/utils/formatUtils';
import { parseTokenString } from '@/lib/utils/tokenUtils';
import { cn } from '@/lib/utils';

interface TierDisplayProps {
  tierProgress?: TierProgress;
  isUpgradeAvailable: boolean;
  isLoading?: boolean;
  stakedData?: StakedEntity;
  totalStaked?: string;
  allTiers?: TierEntity[];
}

export const TierDisplay: React.FC<TierDisplayProps> = ({
  tierProgress,
  isUpgradeAvailable,
  isLoading,
  stakedData,
  totalStaked,
  allTiers
}) => {
  // Buffer state with localStorage persistence
  const [bufferPercent, setBufferPercent] = useState(() => {
    const saved = localStorage.getItem('staking-buffer-percent');
    return saved ? parseFloat(saved) : 5.0; // Default 5%
  });

  // Save buffer to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('staking-buffer-percent', bufferPercent.toString());
  }, [bufferPercent]);

  const safeUnstakeAmount = useMemo(() => {
    if (!stakedData?.staked_quantity || !totalStaked || !allTiers || !tierProgress?.currentTier) {
      return 0;
    }
    return calculateSafeUnstakeAmount(
      stakedData.staked_quantity,
      totalStaked,
      allTiers,
      tierProgress.currentTier
    );
  }, [stakedData, totalStaked, allTiers, tierProgress]);

  // Buffer adjustment handlers
  const adjustBuffer = (delta: number) => {
    const newValue = Number((bufferPercent + delta).toFixed(1));
    if (newValue >= 0 && newValue <= 100) {
      setBufferPercent(newValue);
    }
  };

  const handleBufferInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      setBufferPercent(Number(value.toFixed(1)));
    }
  };

  if (isLoading || !tierProgress || !stakedData) {
    return (
      <Card className="w-full crystal-bg">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-700 rounded w-1/4" />
              <div className="h-4 bg-slate-700 rounded w-1/2" />
              <div className="h-4 bg-slate-700 rounded w-1/3" />
            </div>
          ) : (
            <p className="text-center text-slate-400">No tier data available</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const tierProgression = ['supplier', 'merchant', 'trader', 'marketmkr', 'exchange'];
  const tierConfig = getTierConfig(stakedData.tier);
  const TierIcon = tierConfig.icon;

  const currentTierIndex = tierProgression.indexOf(stakedData.tier.toLowerCase());
  const nextTierName = currentTierIndex < tierProgression.length - 1 
    ? tierProgression[currentTierIndex + 1] 
    : null;
  const nextTierConfig = nextTierName ? getTierConfig(nextTierName) : null;

  const { 
    currentStakedAmount, 
    totalAmountForNext,
    additionalAmountNeeded,
    symbol,
    progress,
  } = tierProgress;

  // Calculate buffered amount needed
  const bufferedAmountNeeded = additionalAmountNeeded 
    ? additionalAmountNeeded * (1 + bufferPercent / 100)
    : undefined;

  const variant = stakedData.tier.toLowerCase().replace(/\s+/g, '') as
    'supplier' | 'merchant' | 'trader' | 'marketmkr' | 'exchange';

  return (
    <Card className="w-full crystal-bg group">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg transition-all", tierConfig.bgColor)}>
              <TierIcon className={cn("w-6 h-6", tierConfig.color)} />
            </div>
            <span className="text-white">{getTierDisplayName(stakedData.tier)}</span>
            {isUpgradeAvailable && (
              <Badge 
                variant={variant}
                className="animate-pulse ml-2 shine-effect"
              >
                Tier Up Ready!
              </Badge>
            )}
          </CardTitle>
          <Badge 
            variant={variant}
            className="ml-2 transition-all shine-effect"
          >
            {`${getTierWeight(stakedData.tier)}x Power`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress 
            value={progress} 
            className="h-2"
            indicatorClassName={cn(
              "transition-all duration-500",
              tierConfig.color.replace('text-', 'bg-')
            )}
          />
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">
              Safe Unstake: {formatNumber(safeUnstakeAmount)} {symbol}
            </span>
            <span className={cn(
              "font-medium",
              isUpgradeAvailable ? "text-green-400" : "text-slate-400"
            )}>
              {progress.toFixed(1)}%
            </span>
          </div>
        </div>

        {nextTierName && typeof bufferedAmountNeeded === 'number' && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400">Progress to {getTierDisplayName(nextTierName)}</p>
              {nextTierConfig && (
                <div className={cn("p-2 rounded-lg", nextTierConfig.bgColor)}>
                  <TierIcon className={cn("w-4 h-4", nextTierConfig.color)} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              {totalAmountForNext && (
                <p className="text-sm text-slate-300">
                  Total needed: {formatNumber(totalAmountForNext)} {symbol}
                </p>
              )}
              <p className={cn(
                "font-medium",
                bufferedAmountNeeded <= 0 ? "text-green-400" : nextTierConfig?.color
              )}>
                {bufferedAmountNeeded <= 0 
                  ? 'Ready to Advance!'
                  : `Need ${formatNumber(bufferedAmountNeeded)} ${symbol} more`
                }
                {bufferPercent > 0 && bufferedAmountNeeded > 0 && (
                  <span className="text-sm text-slate-400 ml-1">
                    (includes {bufferPercent}% buffer)
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                Currently staking {formatNumber(currentStakedAmount)} {symbol}
              </p>

              {/* Buffer controls */}
              <div className="pt-4 mt-2 border-t border-slate-700/50">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={bufferPercent}
                      onChange={handleBufferInput}
                      className="pr-8 bg-slate-800/50 text-white"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                      %
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => adjustBuffer(0.1)}
                      className="p-1 hover:bg-slate-700/50 rounded text-slate-300"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => adjustBuffer(-0.1)}
                      className="p-1 hover:bg-slate-700/50 rounded text-slate-300"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {bufferPercent === 0 
                    ? "No buffer - amount needed may increase as others stake" 
                    : `Adding ${bufferPercent}% extra to account for pool changes`}
                </p>
              </div>
            </div>
          </div>
        )}

        {currentTierIndex === tierProgression.length - 1 && (
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 text-center">
            <p className={cn("text-lg font-medium", tierConfig.color)}>
              Maximum Tier Reached!
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Enjoying maximum staking rewards
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};