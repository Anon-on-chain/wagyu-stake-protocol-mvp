import { TierEntity, TierProgress } from '../types/tier';
import { parseTokenString } from './tokenUtils';
import { TIER_CONFIG } from '../config/tierConfig';

// Dynamic fee rate from contract
const FEE_RATE = 0.003; // 0.3% fee as per contract

/**
 * Helper function to apply precision based on token decimals
 */
const applyPrecision = (value: number, decimals: number = 8): number => {
  if (decimals <= 0) return Math.round(value);
  const precision = Math.pow(10, decimals);
  return Math.floor(value * precision) / precision;
};

/**
 * Determine the tier a user belongs to based on their staked percentage
 * This is the fundamental function that all other tier calculations should use
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
      const sortedTiers = [...tiers].sort((a, b) => 
        parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
      );
      console.log('Edge case: empty pool or no stake, returning lowest tier');
      return sortedTiers[0];
    }

    // Calculate user's stake percentage
    const stakedPercent = (stakedValue / totalValue) * 100;
    
    // Debug logs
    console.log(`Tier calculation: ${stakedValue.toFixed(8)} is ${stakedPercent.toFixed(4)}% of ${totalValue.toFixed(8)}`);

    // Sort tiers by percentage threshold (ascending)
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    // Find the appropriate tier where user's percentage is <= threshold
    let currentTier = sortedTiers[0]; // Default to lowest tier
    
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      
      if (stakedPercent <= tierThreshold) {
        // Found the first tier where threshold >= percentage
        if (i > 0) {
          // User is in the previous tier
          currentTier = sortedTiers[i-1];
          console.log(`User in tier: ${currentTier.tier} (${stakedPercent.toFixed(4)}% <= ${tierThreshold}%)`);
        } else {
          // User is in the lowest tier
          currentTier = sortedTiers[0];
          console.log(`User in lowest tier: ${currentTier.tier} (${stakedPercent.toFixed(4)}% <= ${tierThreshold}%)`);
        }
        return currentTier;
      }
    }
    
    // If user's percentage exceeds all thresholds, return highest tier
    currentTier = sortedTiers[sortedTiers.length - 1];
    console.log(`User in highest tier: ${currentTier.tier} (${stakedPercent.toFixed(4)}% > all thresholds)`);
    return currentTier;
  } catch (error) {
    console.error('Error determining tier:', error);
    if (tiers.length > 0) {
      const sortedTiers = [...tiers].sort((a, b) => 
        parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
      );
      return sortedTiers[0];
    }
    throw new Error('No tier data available');
  }
};

/**
 * Get styling configuration for a tier
 */
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

/**
 * Calculate how much a user can safely unstake without dropping more than one tier level
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

    // Calculate current percentage in the pool
    const stakedPercent = (stakedValue / totalValue) * 100;
    console.log(`Safe unstake calc: ${stakedValue.toFixed(8)} is ${stakedPercent.toFixed(4)}% of ${totalValue.toFixed(8)}`);

    // Sort tiers by percentage threshold (ascending)
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    
    // Handle edge case of invalid tier
    if (currentTierIndex === -1) {
      console.warn(`Current tier ${currentTier.tier} not found in tier list`);
      return 0;
    }
    
    // For lowest tier, can unstake almost everything
    if (currentTierIndex === 0) {
      return Math.max(0, stakedValue - 0.00000001);
    }
    
    // Get the previous tier's threshold (one tier down)
// Get the previous tier's threshold (one tier down)
const prevTierIndex = currentTierIndex - 1;
const prevTier = sortedTiers[prevTierIndex];
const prevTierThreshold = parseFloat(prevTier.staked_up_to_percent) / 100;

// Add a buffer to the previous tier's threshold
const BUFFER_PERCENT = 0.05; // 5% buffer
const targetPercentage = prevTierThreshold + BUFFER_PERCENT;

// Calculate safe unstake amount using the formula:
// (S - X) / (T - X) = targetPercentage
// Solved for X: X = (S - targetPercentage * T) / (1 - targetPercentage)
const rawSafeUnstakeAmount = (stakedValue - targetPercentage * totalValue) / (1 - targetPercentage);

// Ensure it's not negative and apply precision
const safeUnstakeAmount = Math.max(0, applyPrecision(rawSafeUnstakeAmount, decimals));

console.log(`Safe unstake calculation:`, {
  currentTier: currentTier.tier_name || currentTier.tier,
  prevTier: prevTier.tier_name || prevTier.tier,
  currentStake: stakedValue.toFixed(decimals),
  prevTierThreshold: (prevTierThreshold * 100).toFixed(4) + '%',
  targetPercentage: (targetPercentage * 100).toFixed(4) + '%',
  safeUnstakeAmount: safeUnstakeAmount.toFixed(decimals)
});

return safeUnstakeAmount;
  } catch (error) {
    console.error('Error calculating safe unstake amount:', error);
    return 0;
  }
};

/**
 * Calculate tier progress and related metrics
 * This function determines a user's progress toward the next tier
 * and calculates how much more they need to stake to reach it
 */
// tierUtils.ts

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

    // Calculate current percentage (with high precision)
    const stakedPercent = (stakedValue / totalValue) * 100;
    console.log(`[TierCalc] ${stakedValue.toFixed(8)} is ${stakedPercent.toFixed(6)}% of ${totalValue.toFixed(8)}`);
    
    // Use determineTier to get current tier consistently
    const currentTier = determineTier(stakedAmount, totalStaked, tiers);
    console.log(`[TierCalc] Current tier: ${currentTier.tier} (${currentTier.weight}x)`);
    
    // Sort tiers by percentage threshold (ascending)
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );
    
    // Find current tier index in sorted array
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    if (currentTierIndex === -1) {
      console.warn(`[TierCalc] Could not find current tier ${currentTier.tier} in sorted tiers`);
      return null;
    }
    
    // Next tier is next in sorted array (if available)
    const nextTierIndex = currentTierIndex + 1;
    const nextTier = nextTierIndex < sortedTiers.length 
      ? sortedTiers[nextTierIndex] 
      : undefined;
    console.log(`[TierCalc] Next tier: ${nextTier ? nextTier.tier : 'None (at highest tier)'}`);
    
    // Previous tier is previous in sorted array (if available)
    const prevTierIndex = currentTierIndex - 1;
    const prevTier = prevTierIndex >= 0 
      ? sortedTiers[prevTierIndex] 
      : undefined;

    // Get tier thresholds (as percentages)
    const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
    const nextTierThreshold = nextTier ? parseFloat(nextTier.staked_up_to_percent) : 100;
    
    // Calculate progress toward next tier with high precision
    let progress = 0;
    
    if (nextTier) {
      // Calculate range between current tier threshold and next tier threshold
      const rangeSize = nextTierThreshold - currentTierThreshold;
      
      if (rangeSize > 0) {
        progress = ((stakedPercent - currentTierThreshold) / rangeSize) * 100;
        progress = Math.min(100, Math.max(0, progress)); // Clamp to 0-100 range
      }
      console.log(`[TierCalc] Progress: ${progress.toFixed(2)}% to ${nextTier.tier} (${stakedPercent.toFixed(6)}% between ${currentTierThreshold}% and ${nextTierThreshold}%)`);
    } else {
      // At max tier
      progress = 100;
      console.log(`[TierCalc] At max tier (${currentTier.tier})`);
    }

// Calculate amount needed for next tier with precise decimal math
let totalAmountForNext: number | undefined;
let additionalAmountNeeded: number | undefined;

if (nextTier) {
  // Calculate total amount needed for next tier threshold plus 5% buffer
  const nextTierThresholdDecimal = nextTierThreshold / 100; 
  const BUFFER_PERCENT = 0.05; // 5% buffer
  const targetPercentage = nextTierThresholdDecimal + BUFFER_PERCENT;
  
  if (targetPercentage < 1) {
    // Calculate additional amount needed using the correct formula:
    // (S + X) / (T + X) = targetPercentage
    // Solved for X: X = (S - targetPercentage * T) / (targetPercentage - 1)
    const rawAdditionalNeeded = (stakedValue - targetPercentage * totalValue) / (targetPercentage - 1);
    
    // Ensure it's not negative and apply precision
    additionalAmountNeeded = Math.max(0, applyPrecision(rawAdditionalNeeded, decimals));
    
    // Calculate total amount needed
    totalAmountForNext = stakedValue + additionalAmountNeeded;
    
    // Adjust for fee if needed (0.3% fee)
    if (additionalAmountNeeded > 0) {
      const FEE_RATE = 0.003;
      additionalAmountNeeded = applyPrecision(additionalAmountNeeded / (1 - FEE_RATE), decimals);
    }
    
    console.log(`[TierCalc] Need ${additionalAmountNeeded.toFixed(decimals)} ${symbol} more to reach ${nextTier.tier} with 5% buffer`);
  } else {
    // Edge case: if targetPercentage is >= 100%
    totalAmountForNext = undefined;
    additionalAmountNeeded = undefined;
  }
}

    // Calculate required amount for current tier with high precision
    const prevTierThreshold = prevTier ? parseFloat(prevTier.staked_up_to_percent) / 100 : 0;
    const requiredForCurrent = prevTierThreshold * totalValue;

    // Calculate safe unstake amount
    const safeUnstakeAmount = Math.max(0, stakedValue - requiredForCurrent);
    console.log(`[TierCalc] Safe unstake: ${safeUnstakeAmount.toFixed(8)} ${symbol}`);

    // Return comprehensive tier progress information
    return {
      currentTier,
      nextTier,
      prevTier,
      progress,
      requiredForCurrent,
      totalStaked,
      stakedAmount,
      currentStakedAmount: stakedValue,
      symbol,
      totalAmountForNext,
      additionalAmountNeeded,
      weight: parseFloat(currentTier.weight),
      safeUnstakeAmount // Add this field to the TierProgress interface
    };
  } catch (error) {
    console.error('Error in calculateTierProgress:', error);
    return null;
  }
};

/**
 * Get display name for a tier
 */
export const getTierDisplayName = (tierKey: string): string => {
  return TIER_CONFIG[tierKey.toLowerCase()]?.displayName || tierKey;
};

/**
 * Get weight multiplier for a tier
 */
export const getTierWeight = (tierKey: string): string => {
  return TIER_CONFIG[tierKey.toLowerCase()]?.weight || '1.0';
};

/**
 * Check if a user can upgrade to a higher tier
 * This occurs when their percentage stake would put them in a higher tier
 * than the one they're currently assigned
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
    
    // If already at max tier, cannot upgrade
    if (currentTierIndex >= sortedTiers.length - 1) {
      return false;
    }
    
    // Determine tier based on actual staked percentage
    const actualTier = determineTier(stakedAmount, totalStaked, tiers);
    
    // If actual tier is higher than current tier, upgrade is available
    const actualTierIndex = sortedTiers.findIndex(t => t.tier === actualTier.tier);
    
    const canUpgrade = actualTierIndex > currentTierIndex;
    console.log(`Tier upgrade available: ${canUpgrade} (current: ${currentTier.tier}, actual: ${actualTier.tier})`);
    
    return canUpgrade;
  } catch (error) {
    console.error('Error checking tier upgrade availability:', error);
    return false;
  }
};