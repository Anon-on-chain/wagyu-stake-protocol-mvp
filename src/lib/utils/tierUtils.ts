// src/lib/utils/tierUtils.ts
import { TierEntity, TierProgress, TierVariant } from '../types/tier';
import { Store, Building2, TrendingUp, BarChart3 } from 'lucide-react';
import { parseTokenString } from './tokenUtils';
import { cn } from '@/lib/utils';
import { DEFAULT_TIERS } from '../config/tiers';

const FEE_RATE = 0.003; // 0.3% fee as per contract
const PRECISION = 100000000; // 8 decimal places for WAX

// Define the progression type
type TierProgressionType = typeof TIER_PROGRESSION[number];

// Tier progression order matching contract
const TIER_PROGRESSION = ['supplier', 'merchant', 'trader', 'marketmkr', 'exchange'] as const;

// Sort tiers to match progression
const sortTiersByProgression = (tiers: TierEntity[]): TierEntity[] => {
  return [...tiers].sort((a, b) => {
    const aIndex = TIER_PROGRESSION.indexOf(a.tier.toLowerCase() as TierProgressionType);
    const bIndex = TIER_PROGRESSION.indexOf(b.tier.toLowerCase() as TierProgressionType);
    return aIndex - bIndex;
  });
};

// Helper function for tier matching
const findMatchingTier = (tierKey: string): TierEntity | undefined => {
  const normalizedTierKey = tierKey.toLowerCase().trim();
  return DEFAULT_TIERS.find(t => t.tier.toLowerCase() === normalizedTierKey);
};

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
      const lowestTier = sortTiersByProgression(tiers)[0];
      return lowestTier;
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

// Calculate safe unstake amount that won't drop tier (WITHOUT fee consideration)
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

    // Calculate minimum amount needed using integer arithmetic
    const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
    const minRequiredRaw = (currentTierThreshold * totalValue) / 100;
    const minRequired = applyWaxPrecision(minRequiredRaw);

    // Calculate maximum safe unstake amount (without fee since fee is for staking only)
    const safeAmount = Math.max(0, stakedValue - minRequired);

    return applyWaxPrecision(safeAmount);
  } catch (error) {
    console.error('Error calculating safe unstake amount:', error);
    return 0;
  }
};



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

    // Always return a consistent object structure with all required properties
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
      feeRate: FEE_RATE, // Always include feeRate
      feeAmount: feeAmount || 0 // Provide default of 0 for feeAmount
    };
  } catch (error) {
    console.error('Error in calculateTierProgress:', error);
    return null;
  }
};