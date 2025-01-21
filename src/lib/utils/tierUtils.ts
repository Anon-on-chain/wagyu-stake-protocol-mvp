import { TierEntity, TierProgress, TierProgressionType, TIER_PROGRESSION } from '../types/tier';
import { Store, Building2, TrendingUp, BarChart3 } from 'lucide-react';
import { parseTokenString } from './tokenUtils';
import { cn } from '@/lib/utils';
import { DEFAULT_TIERS } from '../config/tiers';

const FEE_RATE = 0.003; // 0.3% fee as per contract
const PRECISION = 100000000; // 8 decimal places for WAX

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

// Helper function to apply WAX precision
const applyWaxPrecision = (value: number): number => {
  return Math.round(value * PRECISION) / PRECISION;
};

// Helper function for tier matching
const findMatchingTier = (tierKey: string): TierEntity | undefined => {
  const normalizedKey = tierKey.toLowerCase().trim() as TierProgressionType;
  const index = TIER_PROGRESSION.indexOf(normalizedKey);
  return index >= 0 ? DEFAULT_TIERS[index] : undefined;
};

// Export a helper to get tier config with default supplier fallback
export const getTierConfig = (tier: string) => {
  const normalizedTier = tier.toLowerCase().replace(/\s+/g, '') as keyof typeof TIER_CONFIG;
  return TIER_CONFIG[normalizedTier] || TIER_CONFIG.supplier;
};

// Export utilities for tier info
export const getTierDisplayName = (tierKey: string): string => {
  const tier = findMatchingTier(tierKey);
  return tier?.tier_name || tierKey;
};

export const getTierWeight = (tierKey: string): string => {
  const tier = findMatchingTier(tierKey);
  const weight = tier ? parseFloat(tier.weight) : 1.0;
  return weight.toFixed(2);
};

// Export tier determination logic
export const determineTier = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[]
): TierEntity => {
  try {
    const { amount: stakedValue } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);

    // If pool is empty, return lowest tier
    if (totalValue === 0) {
      return tiers[0];
    }

    // Calculate percentage with precise decimal handling
    const stakedPercent = Math.min((stakedValue / totalValue) * 100, 100);

    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    // Find first tier where threshold exceeds staked percentage
    for (const tier of sortedTiers) {
      if (parseFloat(tier.staked_up_to_percent) > stakedPercent) {
        const currentIndex = sortedTiers.indexOf(tier);
        return currentIndex > 0 ? sortedTiers[currentIndex - 1] : sortedTiers[0];
      }
    }

    // If no tier found, use highest tier
    return sortedTiers[sortedTiers.length - 1];
  } catch (error) {
    console.error('Error determining tier:', error);
    return tiers[0];
  }
};

// Export the upgrade check function
export const isTierUpgradeAvailable = (
  currentStaked: string,
  totalStaked: string,
  currentTier: TierEntity,
  tiers: TierEntity[]
): boolean => {
  try {
    const normalizedTier = currentTier.tier.toLowerCase() as TierProgressionType;
    const currentIndex = TIER_PROGRESSION.indexOf(normalizedTier);
    if (currentIndex >= TIER_PROGRESSION.length - 1) return false;
    
    const nextTierKey = TIER_PROGRESSION[currentIndex + 1];
    const nextTier = tiers.find(t => 
      t.tier.toLowerCase() === nextTierKey
    );
    if (!nextTier) return false;

    // Calculate current percentage with contract precision
    const { amount: stakedValue } = parseTokenString(currentStaked);
    const { amount: totalValue } = parseTokenString(totalStaked);
    const stakedPercent = applyWaxPrecision((stakedValue / totalValue) * 100);
    
    // Check if we exceed next tier's threshold
    return stakedPercent > parseFloat(nextTier.staked_up_to_percent);
  } catch (error) {
    console.error('Error checking tier upgrade availability:', error);
    return false;
  }
};

// Calculate safe unstake amount that won't drop tier (without fee consideration)
export const calculateSafeUnstakeAmount = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[],
  currentTier: TierEntity
): number => {
  try {
    const { amount: stakedValue } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    if (totalValue === 0) return 0;

    // Calculate minimum amount needed to maintain tier
    const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
    const minRequiredRaw = (currentTierThreshold * totalValue) / 100;
    const minRequired = applyWaxPrecision(minRequiredRaw);

    // Calculate safe unstake amount (no fee consideration for unstaking)
    const safeAmount = Math.max(0, stakedValue - minRequired);

    return applyWaxPrecision(safeAmount);
  } catch (error) {
    console.error('Error calculating safe unstake amount:', error);
    return 0;
  }
};

// Calculate tier progress matching contract logic
export const calculateTierProgress = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[]
): TierProgress | null => {
  try {
    const { amount: stakedValue, symbol } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    if (isNaN(stakedValue) || isNaN(totalValue) || totalValue === 0) {
      return null;
    }

    // Calculate stake percentage exactly like contract
    const stakedPercent = Math.min((stakedValue / totalValue) * 100, 100);

    // Determine current tier using contract logic
    const currentTier = determineTier(stakedAmount, totalStaked, tiers);

    // Sort tiers for progression calculation
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    const nextTier = currentTierIndex < sortedTiers.length - 1 
      ? sortedTiers[currentTierIndex + 1] 
      : undefined;
    const prevTier = currentTierIndex > 0 
      ? sortedTiers[currentTierIndex - 1] 
      : undefined;

    // Calculate base amounts needed for next tier
    let rawAmountForNext: number | undefined;
    let totalAmountForNext: number | undefined;
    let additionalAmountNeeded: number | undefined;
    let feeAmount: number | undefined;

    if (nextTier) {
      // Calculate raw amount needed before fees
      const nextTierThreshold = parseFloat(nextTier.staked_up_to_percent);
      rawAmountForNext = applyWaxPrecision((nextTierThreshold * totalValue) / 100);
      
      if (stakedValue < rawAmountForNext) {
        // Calculate fee amount
        const baseAmountNeeded = rawAmountForNext - stakedValue;
        feeAmount = applyWaxPrecision(baseAmountNeeded * FEE_RATE / (1 - FEE_RATE));
        
        // Calculate total needed with fee
        additionalAmountNeeded = applyWaxPrecision(baseAmountNeeded + feeAmount);
        totalAmountForNext = applyWaxPrecision(rawAmountForNext + feeAmount);
      } else {
        additionalAmountNeeded = 0;
        totalAmountForNext = rawAmountForNext;
      }
    }

    // Calculate amount needed to maintain current tier
    const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
    const requiredForCurrent = applyWaxPrecision((currentTierThreshold * totalValue) / 100);

    // Calculate progress percentage
    let progress: number;
    if (nextTier) {
      const nextTierThreshold = parseFloat(nextTier.staked_up_to_percent);
      const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
      const range = nextTierThreshold - currentTierThreshold;
      progress = ((stakedPercent - currentTierThreshold) / range) * 100;
    } else {
      progress = 100;
    }

    return {
      currentTier,
      nextTier,
      prevTier,
      progress: Math.min(Math.max(0, progress), 100),
      requiredForCurrent,
      totalStaked,
      stakedAmount,
      currentStakedAmount: stakedValue,
      symbol,
      rawAmountForNext,
      totalAmountForNext,
      additionalAmountNeeded,
      feeRate: FEE_RATE,
      feeAmount: feeAmount || 0
    };
  } catch (error) {
    console.error('Error in calculateTierProgress:', error);
    return null;
  }
};