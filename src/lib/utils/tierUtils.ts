// src/lib/utils/tierUtils.ts - Enhanced for accurate projection

import { TierEntity, TierProgress } from '../types/tier';
import { parseTokenString } from './tokenUtils';
import { TIER_CONFIG } from '../config/tierConfig';

// Fee rate from contract (0.3%)
const FEE_RATE = 0.003;

/**
 * Determines the tier based on staked percentage
 * This is the fundamental function for tier calculation
 */
export const determineTier = (
  stakedAmount: string,
  totalStaked: string,
  tiers: TierEntity[]
): TierEntity => {
  try {
    const { amount: stakedValue } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);

    // Handle edge cases
    if (totalValue === 0 || stakedValue === 0) {
      const lowestTier = [...tiers].sort((a, b) => 
        parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
      )[0];
      return lowestTier;
    }

    // Calculate percentage with precise decimal handling
    const stakedPercent = (stakedValue / totalValue) * 100;
    
    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    // Find the last tier where user's percentage is > threshold
    let currentTier = sortedTiers[0]; // Default to lowest tier
    
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      
      if (stakedPercent <= tierThreshold) {
        // Found the first tier where user's percentage is <= threshold
        if (i > 0) {
          // User is in the previous tier (last one where percentage > threshold)
          currentTier = sortedTiers[i-1];
        } else {
          // User is in the lowest tier
          currentTier = sortedTiers[0];
        }
        return currentTier;
      }
    }
    
    // If user's percentage exceeds all thresholds, return highest tier
    return sortedTiers[sortedTiers.length - 1];
  } catch (error) {
    console.error('Error determining tier:', error);
    return tiers[0];
  }
};

/**
 * Calculates how much MORE a user must stake to reach the next tier
 * This is the key function that was causing issues
 */
export const calculateRequiredForNextTier = (
  currentStakedAmount: number,
  totalPoolAmount: number,
  currentTier: TierEntity,
  nextTier: TierEntity | undefined,
  decimals: number = 8
): { totalNeeded: number, additionalNeeded: number } => {
  // If already at max tier or no next tier
  if (!nextTier) {
    return { totalNeeded: currentStakedAmount, additionalNeeded: 0 };
  }

  const currentThreshold = parseFloat(currentTier.staked_up_to_percent) / 100;
  const nextThreshold = parseFloat(nextTier.staked_up_to_percent) / 100;
  
  // Calculate the target total supply after our new stake
  // This is crucial - we need to account for how our stake changes the total pool
  
  // Calculate what portion of the pool we need to achieve new tier %
  // For tier threshold T and pool amount P, we need staked amount S where:
  // S / (P + S) = T
  // Solving for S: S = T * P / (1 - T)
  
  // Important: Include the FEE_RATE in the calculation
  // If there's a 0.3% fee, we need to stake more to reach the same effective amount
  
  let totalAmountNeeded = 0;
  
  // Avoid division by zero if nextThreshold is 1 (100%)
  if (nextThreshold < 1) {
    totalAmountNeeded = (nextThreshold * totalPoolAmount) / (1 - nextThreshold);
  } else {
    // If next threshold is 100%, would need infinite stake (practically impossible)
    totalAmountNeeded = Number.MAX_SAFE_INTEGER;
  }
  
  // Calculate additional amount needed above current stake
  let additionalRaw = Math.max(0, totalAmountNeeded - currentStakedAmount);
  
  // Account for the fee - if we stake X, only (1-fee)*X gets credited
  // So we need to stake X/(1-fee) to get X credited
  const additionalWithFee = additionalRaw > 0 
    ? additionalRaw / (1 - FEE_RATE) 
    : 0;
  
  // Round to appropriate number of decimal places
  const multiplier = Math.pow(10, decimals);
  totalAmountNeeded = Math.ceil(totalAmountNeeded * multiplier) / multiplier;
  const additionalNeeded = Math.ceil(additionalWithFee * multiplier) / multiplier;
  
  return { totalNeeded: totalAmountNeeded, additionalNeeded };
};

/**
 * Calculates tier progress and safely answers "how much more to next tier?"
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

    // Calculate current percentage with precise decimals
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
    
    // Previous tier is previous in sorted array
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

    // Calculate amount needed for next tier with CORRECTED calculation
    // This is where the main fix happens
    let totalAmountForNext: number | undefined;
    let additionalAmountNeeded: number | undefined;

    if (nextTier) {
      const calculation = calculateRequiredForNextTier(
        stakedValue, 
        totalValue, 
        currentTier, 
        nextTier,
        decimals
      );
      
      totalAmountForNext = calculation.totalNeeded;
      additionalAmountNeeded = calculation.additionalNeeded;
    }

    // Calculate safe unstake amount
    const prevTierThreshold = prevTier ? parseFloat(prevTier.staked_up_to_percent) / 100 : 0;
    
    // For the safe unstake calculation, first determine min amount needed to maintain current tier
    const requiredForCurrent = (prevTierThreshold * totalValue) / (1 - prevTierThreshold);
    const safeUnstakeAmount = Math.max(0, stakedValue - requiredForCurrent);
    
    // Round to appropriate number of decimal places
    const multiplier = Math.pow(10, decimals);
    const safeUnstakeRounded = Math.floor(safeUnstakeAmount * multiplier) / multiplier;

    return {
      currentTier,
      nextTier,
      prevTier,
      progress,
      requiredForCurrent: prevTierThreshold * totalValue,
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

/**
 * Determines if a user can upgrade to next tier
 */
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

// Helper functions
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