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
 * This is the mathematically correct tier based on current pool state
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
    let currentTier = sortedTiers[0];
    
    // Find the highest tier where user's percentage is <= threshold
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      
      // If user percentage exceeds this tier's threshold, move to the next tier
      if (stakedPercent > tierThreshold) {
        if (i < sortedTiers.length - 1) {
          currentTier = sortedTiers[i + 1];
        } else {
          // At highest tier already
          currentTier = sortedTiers[i];
          break;
        }
      } else {
        // Found the tier where user percentage <= threshold
        break;
      }
    }
    
    return currentTier;
  } catch (error) {
    console.error('Error determining tier:', error);
    return tiers[0];
  }
};

/**
 * Get tier thresholds for a specific tier
 * Returns object containing lower and upper thresholds
 */
export const getTierThresholds = (
  tierKey: string,
  tiers: TierEntity[]
): { lower: number; upper: number } => {
  // Sort tiers by threshold
  const sortedTiers = [...tiers].sort((a, b) => 
    parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
  );
  
  // Find the index of the given tier
  const tierIndex = sortedTiers.findIndex(t => t.tier === tierKey);
  
  if (tierIndex === -1) {
    console.warn(`Tier ${tierKey} not found in tier list`);
    return { lower: 0, upper: 100 };
  }
  
  // Get lower threshold (previous tier's upper threshold)
  const lowerThreshold = tierIndex > 0 
    ? parseFloat(sortedTiers[tierIndex - 1].staked_up_to_percent) 
    : 0;
  
  // Get upper threshold
  const upperThreshold = parseFloat(sortedTiers[tierIndex].staked_up_to_percent);
  
  return { lower: lowerThreshold, upper: upperThreshold };
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

    // Get tier thresholds
    const { lower: lowerThreshold } = getTierThresholds(currentTier.tier, tiers);
    
    // Convert to decimal
    const thresholdDecimal = lowerThreshold / 100;
    
    // Calculate minimum amount needed to maintain current tier
    // Formula: minimum = (threshold * totalValue) / (1 - threshold)
    let minimumNeeded;
    
    if (thresholdDecimal < 1) {
      minimumNeeded = (thresholdDecimal * totalValue) / (1 - thresholdDecimal);
    } else {
      // Edge case if threshold is 100%
      minimumNeeded = stakedValue; // Can't unstake anything
    }
    
    // Calculate safe unstake amount
    const safeAmount = Math.max(0, stakedValue - minimumNeeded);
    
    // Apply a safety margin
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
export function calculateAmountForNextTier(
  stakedAmount: string,
  totalStaked: string,
  currentTier: TierEntity,
  nextTier: TierEntity,
  decimals: number = 8,
  tiers: TierEntity[] = []
): number {
  try {
    // Get current stake and total pool
    const { amount: currentStake } = parseTokenString(stakedAmount);
    const { amount: poolTotal } = parseTokenString(totalStaked);
    
    // Get tier thresholds directly (don't rely on complex functions)
    // Get the current tier's upper threshold, which is the next tier's lower threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    
    // Current tier's upper threshold is what we need to reach for the next tier
    const upperThreshold = parseFloat(currentTier.staked_up_to_percent);
    
    // Convert to decimal and add small margin
    const targetThreshold = (upperThreshold / 100) + 0.00001;
    
    // Log calculation inputs for debugging
    console.log('Tier calculation:', {
      currentStake,
      poolTotal,
      currentTierUpperThreshold: parseFloat(currentTier.staked_up_to_percent),
      nextTierUpperThreshold: upperThreshold,
      targetThreshold: targetThreshold * 100 + '%'
    });
    
    // Calculate using the LP formula:
    // If we add X tokens, we want (currentStake + X) / (poolTotal + X) >= threshold
    // Solving for X: X >= (threshold * poolTotal - currentStake) / (1 - threshold)
    const amountNeeded = (targetThreshold * poolTotal - currentStake) / (1 - targetThreshold);
    
    // Apply staking fee (0.3%)
    const withFee = amountNeeded > 0 ? amountNeeded / (1 - FEE_RATE) : 0;
    
    // Add a small buffer (1%) to ensure tier change due to rounding
    const withBuffer = withFee * 1.01;
    
    console.log('Calculated amounts:', {
      amountNeeded,
      withFee,
      withBuffer
    });
    
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

    // Get tier thresholds for current tier
    const thresholds = getTierThresholds(currentTier.tier, tiers);
    const lowerThreshold = thresholds.lower;
    const upperThreshold = thresholds.upper;
    
    // For next tier, we need to directly get the lower threshold
    // The lower threshold is the upper threshold of the current tier
    const nextTierLowerThreshold = upperThreshold; // This is the key fix
    
    // Calculate progress percentage within current tier's range
    let progress = 0;
    if (upperThreshold > lowerThreshold) {
      // Calculate progress within the current tier's range
      progress = ((stakedPercent - lowerThreshold) / (upperThreshold - lowerThreshold)) * 100;
      
      // Ensure progress is in valid range
      progress = Math.min(100, Math.max(0, progress));
    } else {
      progress = 100; // Handle edge case
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
        decimals,
        tiers
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
      requiredForCurrent: 0, // Not used anymore
      totalStaked,
      stakedAmount,
      currentStakedAmount: stakedValue,
      symbol,
      totalAmountForNext,
      additionalAmountNeeded,
      weight: parseFloat(currentTier.weight),
      safeUnstakeAmount,
      // Add threshold values for easy reference
      currentThreshold: upperThreshold,
      nextThreshold: nextTierLowerThreshold,
      prevThreshold: lowerThreshold,
      stakedPercent: stakedPercent
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
    // Calculate mathematically correct tier
    const calculatedTier = determineTier(stakedAmount, totalStaked, tiers);
    
    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find tier indices
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    const calculatedTierIndex = sortedTiers.findIndex(t => t.tier === calculatedTier.tier);
    
    // If calculated tier is higher than current tier, upgrade is available
    return calculatedTierIndex > currentTierIndex;
  } catch (error) {
    console.error('Error checking tier upgrade availability:', error);
    return false;
  }
};