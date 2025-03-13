// src/lib/utils/tierUtils.ts
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
    
    // Find the highest tier where user's percentage is <= threshold
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      
      // If user percentage is below this threshold
      if (stakedPercent <= tierThreshold) {
        // We found the boundary - use previous tier if we're not at the first tier
        if (i > 0) {
          return sortedTiers[i-1];
        }
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
 * Calculate how much a user can safely unstake without dropping a tier
 */
export const calculateSafeUnstakeAmount = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[],
  currentTier: TierEntity
): number => {
  try {
    const { amount: stakedValue, decimals } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    if (totalValue === 0 || stakedValue === 0) return 0;

    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    
    // At lowest tier, can unstake almost everything
    if (currentTierIndex <= 0) {
      return Math.max(0, stakedValue - 0.00000001);
    }
    
    // Get the previous tier's threshold
    const prevTierIndex = currentTierIndex - 1;
    const prevTier = sortedTiers[prevTierIndex];
    const prevTierThreshold = parseFloat(prevTier.staked_up_to_percent) / 100;
    
    // Calculate minimum amount needed to maintain current tier
    // Formula: minimum = (prevThreshold * totalValue) / (1 - prevThreshold)
    let minimumAmount;
    
    if (prevTierThreshold < 1) {
      minimumAmount = (prevTierThreshold * totalValue) / (1 - prevTierThreshold);
    } else {
      // Edge case if threshold is 100%
      minimumAmount = stakedValue; // Can't unstake anything
    }
    
    // Calculate safe unstake amount
    const safeAmount = Math.max(0, stakedValue - minimumAmount);
    
    // Apply a 5% safety margin
    const withMargin = safeAmount * 0.95;
    
    // Round to proper decimals
    const multiplier = Math.pow(10, decimals);
    return Math.floor(withMargin * multiplier) / multiplier;
  } catch (error) {
    console.error('Error calculating safe unstake amount:', error);
    return 0;
  }
};

/**
 * Calculates the exact amount needed to reach the next tier using LP formula
 * This accounts for how adding tokens changes the total pool amount
 */
// Update the calculateAmountForNextTier function in tierUtils.ts
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
    
    // Get the LOWER threshold for the next tier (which is the current tier's upper threshold)
    // This is the minimum percentage needed to move to the next tier
    const targetThreshold = parseFloat(currentTier.staked_up_to_percent) / 100;
    
    // Add a tiny bit to ensure we cross the threshold
    const effectiveThreshold = targetThreshold + 0.0001;
    
    // Log calculation inputs for debugging
    console.log('Tier boundary calculation:', {
      currentStake,
      poolTotal,
      currentTierUpperThreshold: currentTier.staked_up_to_percent,
      nextTierLowerThreshold: currentTier.staked_up_to_percent,
      effectiveThreshold
    });
    
    // Calculate using the LP-style formula to determine how much to add
    // to reach just above the current tier's upper threshold
    const amountForNextTier = (effectiveThreshold * poolTotal - currentStake) / (1 - effectiveThreshold);
    
    // Apply staking fee (0.3%)
    const withFee = amountForNextTier > 0 ? amountForNextTier / (1 - FEE_RATE) : 0;
    
    // Add a small buffer (1%) to ensure tier change
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
    const safeUnstakeAmount = calculateSafeUnstakeAmount(
      stakedAmount,
      totalStaked,
      tiers,
      currentTier
    );

    return {
      currentTier,
      nextTier,
      prevTier,
      progress,
      requiredForCurrent: 0, // Not needed anymore
      totalStaked,
      stakedAmount,
      currentStakedAmount: stakedValue,
      symbol,
      totalAmountForNext,
      additionalAmountNeeded,
      weight: parseFloat(currentTier.weight),
      safeUnstakeAmount
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