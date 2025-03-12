// src/components/game/TierDisplay.tsx
import React, { useState, useMemo } from 'react';
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
import { parseTokenString } from '@/lib/utils/tokenUtils';
import { cn } from '@/lib/utils';
import { Info, ChevronDown, AlertCircle } from 'lucide-react';
import { TierInfo } from './TierInfo';

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

  // Extract token info
  const tokenInfo = useMemo(() => {
    if (!stakedData?.staked_quantity) return { decimals: 8, symbol: 'TOKEN' };
    return parseTokenString(stakedData.staked_quantity);
  }, [stakedData]);
  
  // Get the safe unstake amount from tierProgress or calculate it manually
  const safeUnstakeAmount = useMemo(() => {
    if (tierProgress?.safeUnstakeAmount !== undefined) {
      return tierProgress.safeUnstakeAmount;
    }
    
    if (!stakedData?.staked_quantity || !totalStaked || !allTiers || !tierProgress?.currentTier) {
      return 0;
    }
    
    // Fallback calculation if tierProgress doesn't include it
    return calculateSafeUnstakeAmount(
      stakedData.staked_quantity,
      totalStaked,
      allTiers,
      tierProgress.currentTier
    );
  }, [stakedData, totalStaked, allTiers, tierProgress]);

  // Find next tier based on tierProgress or by calculating from tierList
  const nextTierKey = useMemo(() => {
    // Use tierProgress.nextTier if available
    if (tierProgress?.nextTier) {
      return tierProgress.nextTier.tier;
    }
    
    // Calculate manually if needed
    if (!stakedData || !allTiers) return null;
    
    // Sort tiers by percentage threshold
    const sortedTiers = [...allTiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === stakedData.tier);
    
    // Return next tier key if available
    if (currentTierIndex >= 0 && currentTierIndex < sortedTiers.length - 1) {
      return sortedTiers[currentTierIndex + 1].tier;
    }
    
    return null;
  }, [stakedData, allTiers, tierProgress]);

  // Process tiers to add percentage ranges for the multiplier dialog
  const processedTiers = useMemo(() => {
    if (!allTiers || allTiers.length === 0) return [];
    
    // First sort tiers by percentage threshold
    const sortedTiers = [...allTiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Then add range information
    return sortedTiers.map((tier, index) => {
      const currentThreshold = parseFloat(tier.staked_up_to_percent);
      const prevThreshold = index > 0 ? parseFloat(sortedTiers[index-1].staked_up_to_percent) : 0;
      
      return {
        ...tier,
        range: `${prevThreshold.toFixed(2)}% - ${currentThreshold.toFixed(2)}%`
      };
    });
  }, [allTiers]);

  if (isLoading || !tierProgress || !stakedData) {
    return (
      <Card className="w-full crystal-bg">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-slate-700 rounded w-1/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
              <div className="h-4 bg-slate-700 rounded w-1/3"></div>
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
    currentTier,
    currentStakedAmount, 
    totalAmountForNext,
    additionalAmountNeeded,
    symbol,
    progress = 0
  } = tierProgress;
  
  // Get next tier from tierProgress or find it manually
  const nextTier = tierProgress.nextTier || (nextTierKey ? allTiers?.find(t => t.tier === nextTierKey) : undefined);
  
  const nextTierStyle = nextTier ? getTierConfig(nextTier.tier) : null;
  const currentMultiplier = parseFloat(getTierWeight(stakedData.tier)).toFixed(3);
  const decimals = tokenInfo.decimals;

  // Format additional needed amount
  const formattedAdditionalNeeded = additionalAmountNeeded !== undefined
    ? formatNumber(additionalAmountNeeded, decimals)
    : '0';
    
  // Format total needed amount
  const formattedTotalNeeded = totalAmountForNext !== undefined
    ? formatNumber(totalAmountForNext, decimals)
    : '0';

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
                tierStyle.color.replace('text-', 'bg-')
              )}
            />
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">
                Safe Unstake: {formatNumber(safeUnstakeAmount, decimals)} {symbol}
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
                  Currently staking {formatNumber(currentStakedAmount, decimals)} {symbol}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  You've reached the highest possible tier level
                </p>
              </div>
            </div>
          ) : nextTier && (
            <div className="bg-slate-800/30 rounded-lg p-3 md:p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-300 text-sm">
                  Progress to {getTierDisplayName(nextTier.tier)}
                </p>
                {nextTierStyle && (
                  <div className={cn("p-2 rounded-lg", nextTierStyle.bgColor)}>
                    <TierIcon className={cn("w-4 h-4", nextTierStyle.color)} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {totalAmountForNext !== undefined && (
                  <p className="text-sm text-slate-300">
                    Total needed: {formattedTotalNeeded} {symbol}
                  </p>
                )}
                <p className={cn(
                  "font-medium text-sm",
                  additionalAmountNeeded !== undefined && additionalAmountNeeded <= 0 
                    ? "text-green-400" 
                    : "text-slate-300"
                )}>
                  {additionalAmountNeeded !== undefined && additionalAmountNeeded <= 0 
                    ? 'Ready to Advance!'
                    : `Need ${formattedAdditionalNeeded} ${symbol} more`
                  }
                </p>
                {additionalAmountNeeded !== undefined && additionalAmountNeeded > 0 && (
                  <div className="bg-amber-500/10 rounded-lg p-2 flex items-start gap-1.5 mt-1">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-200">
                      These estimates account for the 0.3% staking fee and pool changes
                    </p>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Currently staking {formatNumber(currentStakedAmount, decimals)} {symbol}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The updated multiplier dialog with percentage ranges */}
      <Dialog open={isMultiplierDialogOpen} onOpenChange={setMultiplierDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700/50 text-slate-100">
          <DialogHeader>
            <DialogTitle>Level Multipliers</DialogTitle>
            <DialogDescription className="text-slate-400">
              Each level provides a different reward multiplier
            </DialogDescription>
          </DialogHeader>
          
          {/* Table header */}
          <div className="grid grid-cols-12 text-xs text-slate-400 px-3 py-1 border-b border-slate-700/30">
            <div className="col-span-4">Level</div>
            <div className="col-span-5">Stake Range</div>
            <div className="col-span-3 text-right">Multiplier</div>
          </div>
          
          {/* Scrollable tier list */}
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-1 pt-1">
              {processedTiers.map((tier) => {
                const config = getTierConfig(tier.tier);
                const TierIcon = config.icon;
                const isCurrentTier = tier.tier === stakedData.tier;
                
                return (
                  <div
                    key={tier.tier}
                    className={cn(
                      "grid grid-cols-12 items-center p-2 rounded-lg border transition-all",
                      isCurrentTier ? config.bgColor : "bg-slate-800/30",
                      isCurrentTier ? "border-slate-600" : "border-slate-700/50"
                    )}
                  >
                    {/* Level column */}
                    <div className="col-span-4 flex items-center gap-2">
                      <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                        <TierIcon className={cn("w-4 h-4", config.color)} />
                      </div>
                      <span className={cn(
                        "font-medium",
                        isCurrentTier ? config.color : "text-slate-300"
                      )}>
                        {getTierDisplayName(tier.tier)}
                      </span>
                    </div>
                    
                    {/* Percentage range column */}
                    <div className="col-span-5 text-sm text-slate-300">
                      {tier.range}
                    </div>
                    
                    {/* Multiplier column */}
                    <div className={cn(
                      "col-span-3 text-right font-semibold",
                      isCurrentTier ? config.color : "text-slate-300"
                    )}>
                      {parseFloat(tier.weight).toFixed(3)}x
                    </div>
                  </div>
                );
              })}
            </div>
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

export default TierDisplay;