import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TierBadge } from '@/components/ui/TierBadge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TierProgress, TierEntity } from '@/lib/types/tier';
import { StakedEntity } from '@/lib/types/staked';
import { getTierConfig, calculateSafeUnstakeAmount, getTierDisplayName, getTierWeight } from '@/lib/utils/tierUtils';
import { formatNumber } from '@/lib/utils/formatUtils';
import { cn } from '@/lib/utils';
import { Info, ChevronDown } from 'lucide-react';  // Add ChevronDown
import { TierInfo } from './TierInfo';  // Add new TierInfo component


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
  const [isMultiplierDialogOpen, setMultiplierDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);

  
  const safeUnstakeAmount = React.useMemo(() => {
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

  if (isLoading || !tierProgress || !stakedData) {
    return (
      <Card className="w-full crystal-bg">
        <CardHeader>
          <CardTitle>Level Status</CardTitle>
        </CardHeader>
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

  const tierStyle = getTierConfig(stakedData.tier);
  const TierIcon = tierStyle.icon;

  const { 
    currentStakedAmount, 
    totalAmountForNext,
    additionalAmountNeeded,
    symbol,
    progress,
    nextTier
  } = tierProgress;

  const nextTierStyle = nextTier ? getTierConfig(nextTier.tier) : null;
  const currentMultiplier = parseFloat(getTierWeight(stakedData.tier)).toFixed(3);

  return (
    <>
      <Card className="w-full crystal-bg group">
        <CardHeader>
          <CardTitle>Level Status</CardTitle>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg transition-all", tierStyle.bgColor)}>
                <TierIcon className={cn("w-5 h-5 md:w-6 md:h-6", tierStyle.color)} />
              </div>
              <span className="text-slate-100">{getTierDisplayName(stakedData.tier)}</span>
              {isUpgradeAvailable && (
                <TierBadge 
                  tier={stakedData.tier}
                  animate
                  className="ml-2 shine-effect"
                >
                  Tier Up Ready!
                </TierBadge>
              )}
            </div>
<div className="flex items-center gap-2">
  <span className={cn(
    "text-base font-semibold",
    tierStyle.color
  )}>
    {currentMultiplier}x
  </span>
  <Button
    variant="ghost"
    size="icon"
    className={cn(
      "p-1 hover:bg-slate-800/50",
      tierStyle.bgColor
    )}
    onClick={() => setMultiplierDialogOpen(true)}
  >
    <ChevronDown className={cn("w-4 h-4", tierStyle.color)} />
  </Button>
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8 bg-slate-800/30 hover:bg-slate-700/50"
    onClick={() => setIsInfoDialogOpen(true)}
  >
    <Info className="h-4 w-4 text-purple-400" />
  </Button>
</div>

          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Progress 
              value={progress} 
              className="h-2 bg-slate-800/50"
              indicatorClassName={cn(
                "transition-all duration-500",
                tierStyle.progressColor
              )}
            />
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">
                Safe Unstake: {formatNumber(safeUnstakeAmount)} {symbol}
              </span>
              <span className={cn(
                "font-medium",
                isUpgradeAvailable ? "text-green-400" : "text-slate-300"
              )}>
                {progress.toFixed(1)}%
              </span>
            </div>
          </div>

          {stakedData.tier === 'v' ? (
            <div className="bg-slate-800/30 rounded-lg p-3 md:p-4 border border-slate-700/50">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={cn("p-2 rounded-lg transition-all", tierStyle.bgColor)}>
                  <TierIcon className={cn("w-6 h-6", tierStyle.color)} />
                </div>
                <div className="text-center">
                  <p className={cn("text-lg font-medium", tierStyle.color)}>
                    Maximum Level Achieved!
                  </p>
                  <p className="text-sm text-slate-300">
                    Enjoying {currentMultiplier}x rewards multiplier
                  </p>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-sm text-slate-300">
                  Currently staking {formatNumber(currentStakedAmount)} {symbol}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  You've reached the highest possible tier level
                </p>
              </div>
            </div>
          ) : nextTier && typeof additionalAmountNeeded === 'number' && (
            <div className="bg-slate-800/30 rounded-lg p-3 md:p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-sm">
                  Progress to Level {parseInt(getTierDisplayName(stakedData.tier).split(' ')[1]) + 1}
                </p>
                {nextTierStyle && (
                  <div className={cn("p-2 rounded-lg", nextTierStyle.bgColor)}>
                    <TierIcon className={cn("w-4 h-4", nextTierStyle.color)} />
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
                  "font-medium text-sm",
                  additionalAmountNeeded <= 0 ? "text-green-400" : "text-slate-300"
                )}>
                  {additionalAmountNeeded <= 0 
                    ? 'Ready to Advance!'
                    : `Need ${formatNumber(additionalAmountNeeded)} ${symbol} more`
                  }
                </p>
                <p className="text-xs text-slate-400">
                  Currently staking {formatNumber(currentStakedAmount)} {symbol}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isMultiplierDialogOpen} onOpenChange={setMultiplierDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-100">
          <DialogHeader>
            <DialogTitle>Level Multipliers</DialogTitle>
            <DialogDescription className="text-slate-400">
              Each level provides a different reward multiplier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
            {allTiers?.map((tier) => {
              const config = getTierConfig(tier.tier);
              const TierIcon = config.icon;
              const isCurrentTier = tier.tier === stakedData.tier;
              
              return (
                <div
                  key={tier.tier}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    isCurrentTier ? config.bgColor : "bg-slate-800/30",
                    isCurrentTier ? "border-slate-600" : "border-slate-700/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", config.bgColor)}>
                      <TierIcon className={cn("w-4 h-4", config.color)} />
                    </div>
                    <span className={cn(
                      "font-medium",
                      isCurrentTier ? config.color : "text-slate-300"
                    )}>
                      {getTierDisplayName(tier.tier)}
                    </span>
                  </div>
                  <span className={cn(
                    "font-semibold",
                    isCurrentTier ? config.color : "text-slate-300"
                  )}>
                    {parseFloat(tier.weight).toFixed(3)}x
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <TierInfo 
        open={isInfoDialogOpen}
        onOpenChange={setIsInfoDialogOpen}
      />
    </>
  );
};