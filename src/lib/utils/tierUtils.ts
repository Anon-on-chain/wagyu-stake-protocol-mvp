import { TierEntity, TierProgress } from '../types/tier';
import { Store, Building2, TrendingUp, BarChart3 } from 'lucide-react';
import { parseTokenString } from './tokenUtils';
import { cn } from '@/lib/utils';

// Tier configuration with styling and icons
export const TIER_CONFIG = {
  supplier: {
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    progressColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/20',
    icon: Store,
  },
  merchant: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    progressColor: 'bg-blue-500',
    borderColor: 'border-blue-500/20',
    icon: Building2,
  },
  trader: {
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    progressColor: 'bg-purple-500',
    borderColor: 'border-purple-500/20',
    icon: TrendingUp,
  },
  marketmkr: {
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    progressColor: 'bg-amber-500',
    borderColor: 'border-amber-500/20',
    icon: BarChart3,
  },
  exchange: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    progressColor: 'bg-red-500',
    borderColor: 'border-red-500/20',
    icon: Building2,
  },
} as const;

function sortTiers(tiers: TierEntity[]): TierEntity[] {
  return [...tiers].sort((a, b) => 
    parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
  );
}

/**
 * Calculates tier progress exactly matching contract behavior
 */
export const calculateTierProgress = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[]
): TierProgress | null => {
  try {
    const stakedValue = parseTokenString(stakedAmount);
    const totalValue = parseTokenString(totalStaked);
    
    if (isNaN(stakedValue.amount) || isNaN(totalValue.amount) || totalValue.amount === 0) {
      return null;
    }

    // Calculate percentage exactly like contract
    let stakedPercent = (stakedValue.amount / totalValue.amount) * 100;
    stakedPercent = Math.min(stakedPercent, 100);

    // Sort tiers by percentage ascending
    const sortedTiers = sortTiers(tiers);

    // Find current tier using contract's lower_bound logic
    const tierIndex = sortedTiers.findIndex(
      tier => parseFloat(tier.staked_up_to_percent) >= stakedPercent
    );

    if (tierIndex === -1) {
      // Beyond all thresholds, use highest tier
      const highestTier = sortedTiers[sortedTiers.length - 1];
      const prevTier = sortedTiers[sortedTiers.length - 2];
      
      return {
        currentTier: highestTier,
        progress: 100,
        requiredForCurrent: parseFloat(highestTier.staked_up_to_percent) * totalValue.amount / 100,
        totalStaked,
        stakedAmount,
        currentStakedAmount: stakedValue.amount,
        symbol: stakedValue.symbol,
        prevTier,
        nextTier: undefined,
        totalAmountForNext: undefined,
        additionalAmountNeeded: undefined
      };
    }

    const currentTier = sortedTiers[tierIndex];
    const prevTier = tierIndex > 0 ? sortedTiers[tierIndex - 1] : undefined;
    const nextTier = tierIndex < sortedTiers.length - 1 ? sortedTiers[tierIndex + 1] : undefined;

    // Calculate current tier requirements
    const currentThresholdPercent = parseFloat(currentTier.staked_up_to_percent);
    const prevThresholdPercent = prevTier ? parseFloat(prevTier.staked_up_to_percent) : 0;
    
    // Calculate required amounts
    const requiredForCurrent = (prevThresholdPercent * totalValue.amount) / 100;

    // Calculate next tier requirements if exists
    let totalAmountForNext: number | undefined;
    let additionalAmountNeeded: number | undefined;

    if (nextTier) {
      const nextTierPercent = parseFloat(nextTier.staked_up_to_percent);
      // Calculate exact amount needed for next tier
      totalAmountForNext = (nextTierPercent * totalValue.amount) / 100;
      
      // Calculate additional amount needed
      if (stakedValue.amount < totalAmountForNext) {
        additionalAmountNeeded = totalAmountForNext - stakedValue.amount;
      } else {
        additionalAmountNeeded = 0;
      }
    }

    // Calculate progress
    let progress: number;
    if (prevTier && currentThresholdPercent !== prevThresholdPercent) {
      progress = ((stakedPercent - prevThresholdPercent) / 
                 (currentThresholdPercent - prevThresholdPercent)) * 100;
    } else {
      progress = (stakedPercent / currentThresholdPercent) * 100;
    }

    // Apply WAX precision (8 decimal places)
    const applyPrecision = (value: number) => Math.round(value * 100000000) / 100000000;

    return {
      currentTier,
      nextTier,
      prevTier,
      progress: Math.min(Math.max(0, progress), 100),
      requiredForCurrent: applyPrecision(requiredForCurrent),
      totalStaked,
      stakedAmount,
      currentStakedAmount: stakedValue.amount,
      symbol: stakedValue.symbol,
      totalAmountForNext: totalAmountForNext ? applyPrecision(totalAmountForNext) : undefined,
      additionalAmountNeeded: additionalAmountNeeded ? applyPrecision(additionalAmountNeeded) : undefined
    };
  } catch (error) {
    console.error('Error in calculateTierProgress:', error);
    return null;
  }
};

/**
 * Gets tier styling configuration
 */
export const getTierConfig = (tier: string) => {
  // Normalize contract tier name to match UI config
  const normalizedTier = tier.toLowerCase().replace(/\s+/g, '');
  return TIER_CONFIG[normalizedTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.supplier;
};

/**
 * Gets progress bar color based on completion percentage
 */
export const getProgressColor = (progress: number): string => {
  if (progress < 33) return TIER_CONFIG.supplier.progressColor;
  if (progress < 66) return TIER_CONFIG.marketmkr.progressColor;
  return TIER_CONFIG.exchange.progressColor;
};

/**
 * Checks if user can upgrade to next tier
 */
export const isTierUpgradeAvailable = (
  currentStaked: string,
  totalStaked: string,
  currentTier: TierEntity,
  tiers: TierEntity[]
): boolean => {
  try {
    const { amount: stakedValue } = parseTokenString(currentStaked);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    const stakedPercent = (stakedValue / totalValue) * 100;
    
    // Sort tiers by percentage ascending to match contract
    const sortedTiers = sortTiers(tiers);
    
    const currentTierIndex = sortedTiers.findIndex(
      t => t.tier === currentTier.tier
    );
    
    if (currentTierIndex < sortedTiers.length - 1) {
      const nextTierThreshold = parseFloat(sortedTiers[currentTierIndex + 1].staked_up_to_percent);
      return stakedPercent >= nextTierThreshold;
    }
    
    return false;
  } catch (error) {
    console.error('Error in isTierUpgradeAvailable:', error);
    return false;
  }
};