// src/lib/utils/tierUtils.ts - Simplified Direct Fix

import { TierEntity, TierProgress } from '../types/tier';
import { parseTokenString } from './tokenUtils';
import { TIER_CONFIG } from '../config/tierConfig';

// Fee rate from contract (0.3%)
const FEE_RATE = 0.003;

/**
 * Calculate the percentage of the pool that a user has staked
 */
export const calculateStakedPercent = (stakedAmount: string, totalStaked: string): number => {
  try {
    const { amount: stakedValue } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    if (totalValue === 0) return 0;
    return (stakedValue / totalValue) * 100;
  } catch (error) {
    console.error('Error calculating staked percentage:', error);
    return 0;
  }
};

/**
 * Find the appropriate tier based on staked percentage
 */
export const determineTier = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[]
): TierEntity => {
  try {
    // Calculate staked percentage
    const stakedPercent = calculateStakedPercent(stakedAmount, totalStaked);
    console.log(`Tier calc: ${stakedPercent.toFixed(4)}% of pool`);
    
    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Start with lowest tier
    let selectedTier = sortedTiers[0];
    
    // Find the highest tier where user's percentage is > threshold
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      
      // If user percentage is below this threshold
      if (stakedPercent <= tierThreshold) {
        // We found the boundary - use previous tier
        return selectedTier;
      }
      
      // Otherwise, update selected tier and continue checking
      selectedTier = sortedTiers[i];
    }
    
    // If we've gone through all tiers, return the highest tier
    return selectedTier;
  } catch (error) {
    console.error('Error determining tier:', error);
    return tiers[0];
  }
};

/**
 * Calculates EXACT amount needed to reach the next tier - NO PREDICTION
 * This only calculates for the immediate next tier
 */
export function calculateAmountForNextTier(
  stakedAmount: string,
  totalStaked: string,
  currentTier: TierEntity,
  nextTier: TierEntity,
  decimals: number = 8
): number {
  try {
    // Get current stake and total pool
    const { amount: currentStake } = parseTokenString(stakedAmount);
    const { amount: poolTotal } = parseTokenString(totalStaked);
    
    // Get the next tier threshold as a decimal (e.g., 0.5% = 0.005)
    const nextThreshold = parseFloat(nextTier.staked_up_to_percent) / 100;
    
    // Calculate exact amount needed to reach next tier threshold
    // Formula: (nextThreshold * (poolTotal - currentStake)) / (1 - nextThreshold)
    const amountForNextTier = (nextThreshold * poolTotal - currentStake) / (1 - nextThreshold);
    
    // Account for fee - if we stake X, only (1-fee)*X gets credited
    const withFee = amountForNextTier > 0 ? amountForNextTier / (1 - FEE_RATE) : 0;
    
    // Add a small buffer to ensure tier change (avoiding floating point issues)
    const withBuffer = withFee * 1.01;
    
    // Round to proper decimals
    const multiplier = Math.pow(10, decimals);
    return Math.ceil(withBuffer * multiplier) / multiplier;
  } catch (error) {
    console.error('Error calculating amount for next tier:', error);
    return 0;
  }
}

/**
 * Calculates tier progress
 */
export const calculateTierProgress = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[]
): TierProgress | null => {
  try {
    const { amount: stakedValue, symbol, decimals } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    if (isNaN(stakedValue) || isNaN(totalValue) || totalValue === 0) {
      return null;
    }

    // Calculate current percentage
    const stakedPercent = (stakedValue / totalValue) * 100;
    
    // Determine current tier based on percentage
    const currentTier = determineTier(stakedAmount, totalStaked, tiers);
    
    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    if (currentTierIndex === -1) {
      console.warn('Could not find current tier in sorted tiers');
      return null;
    }
    
    // Next tier is the next in sorted array
    const nextTierIndex = currentTierIndex + 1;
    const nextTier = nextTierIndex < sortedTiers.length 
      ? sortedTiers[nextTierIndex] 
      : undefined;
    
    // Previous tier
    const prevTierIndex = currentTierIndex - 1;
    const prevTier = prevTierIndex >= 0 
      ? sortedTiers[prevTierIndex] 
      : undefined;

    // Get tier thresholds
    const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
    const nextTierThreshold = nextTier ? parseFloat(nextTier.staked_up_to_percent) : 100;
    
    // Calculate progress percentage toward next tier
    let progress = 0;
    if (nextTier) {
      const rangeSize = nextTierThreshold - currentTierThreshold;
      progress = rangeSize > 0 
        ? ((stakedPercent - currentTierThreshold) / rangeSize) * 100
        : 100;
      progress = Math.min(100, Math.max(0, progress)); // Clamp between 0-100
    } else {
      progress = 100; // At max tier
    }

    // Calculate amount needed for next tier
    let totalAmountForNext: number | undefined;
    let additionalAmountNeeded: number | undefined;

    if (nextTier) {
      // Calculate additional amount needed for next tier
      additionalAmountNeeded = calculateAmountForNextTier(
        stakedAmount,
        totalStaked,
        currentTier,
        nextTier,
        decimals
      );
      
      // Total needed is current + additional
      totalAmountForNext = stakedValue + additionalAmountNeeded;
    }

    // Calculate safe unstake amount
    let safeUnstakeAmount = 0;
    if (prevTier) {
      // Keep enough to stay above previous tier threshold
      const prevTierThreshold = parseFloat(prevTier.staked_up_to_percent) / 100;
      const minimumAmount = (prevTierThreshold * totalValue) / (1 - prevTierThreshold);
      safeUnstakeAmount = Math.max(0, stakedValue - minimumAmount);
      
      // Add small safety margin
      safeUnstakeAmount *= 0.95;
    } else {
      // At lowest tier, can unstake almost everything
      safeUnstakeAmount = Math.max(0, stakedValue - 0.00000001);
    }
    
    // Round to appropriate number of decimal places
    const multiplier = Math.pow(10, decimals);
    const safeUnstakeRounded = Math.floor(safeUnstakeAmount * multiplier) / multiplier;

    return {
      currentTier,
      nextTier,
      prevTier,
      progress,
      requiredForCurrent: 0, // Not needed
      totalStaked,
      stakedAmount,
      currentStakedAmount: stakedValue,
      symbol,
      totalAmountForNext,
      additionalAmountNeeded,
      weight: parseFloat(currentTier.weight),
      safeUnstakeAmount: safeUnstakeRounded
    };
  } catch (error) {
    console.error('Error in calculateTierProgress:', error);
    return null;
  }
};

export const getTierDisplayName = (tierKey: string): string => {
  return TIER_CONFIG[tierKey.toLowerCase()]?.displayName || tierKey;
};

export const getTierWeight = (tierKey: string): string => {
  return TIER_CONFIG[tierKey.toLowerCase()]?.weight || '1.0';
};

export const getTierConfig = (tier: string) => {
  const config = TIER_CONFIG[tier.toLowerCase()] || TIER_CONFIG.a;
  return config.style
    ? {
        ...config.style,
        icon: config.icon
      }
    : {
        color: 'text-slate-500',
        bgColor: 'bg-slate-500/10',
        borderColor: 'border-slate-500/20',
        progressColor: 'bg-slate-500',
        icon: config.icon
      };
};

export const isTierUpgradeAvailable = (
  stakedAmount: string,
  totalStaked: string,
  currentTier: TierEntity,
  tiers: TierEntity[]
): boolean => {
  try {
    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    
    // Already at max tier?
    if (currentTierIndex >= sortedTiers.length - 1) {
      return false;
    }
    
    // Calculate where user should be based on current percentages
    const actualTier = determineTier(stakedAmount, totalStaked, tiers);
    const actualTierIndex = sortedTiers.findIndex(t => t.tier === actualTier.tier);
    
    // If actual tier would be higher than current, upgrade is available
    return actualTierIndex > currentTierIndex;
  } catch (error) {
    console.error('Error checking tier upgrade availability:', error);
    return false;
  }
};