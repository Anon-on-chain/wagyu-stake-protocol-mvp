import { TierEntity, TierProgress } from '../types/tier';
import { parseTokenString } from './tokenUtils';
import { TIER_CONFIG } from '../config/tierConfig';

const FEE_RATE = 0.003; // 0.3% fee as per contract
const PRECISION = 100000000; // 8 decimal places for WAX

// Helper function to apply precision based on token's decimals
const applyPrecision = (value: number, decimals: number): number => {
  const precision = Math.pow(10, decimals);
  return Math.round(value * precision) / precision;
};

// Determine which tier a user is in based on their staked percentage
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

    // Find first tier where threshold is >= staked percentage (lower_bound)
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      if (tierThreshold >= stakedPercent) {
        return sortedTiers[i];
      }
    }

    // If no tier found (exceeded all thresholds), return highest tier
    return sortedTiers[sortedTiers.length - 1];
  } catch (error) {
    console.error('Error determining tier:', error);
    return tiers[0];
  }
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

// Calculate safe unstake amount that won't drop to a lower tier
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

    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    // Find current tier index
    const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTier.tier);
    
    // For lowest tier, can unstake everything
    if (currentTierIndex <= 0) {
      return applyWaxPrecision(stakedValue);
    }

    // Get the previous tier's threshold - need to stay above this to maintain current tier
    const prevTierThreshold = parseFloat(sortedTiers[currentTierIndex - 1].staked_up_to_percent);
    const minRequired = (prevTierThreshold * totalValue) / 100;

    // Calculate how much we can unstake while staying above previous tier's threshold
    const safeAmount = Math.max(0, stakedValue - minRequired);
    
    return applyWaxPrecision(safeAmount);
  } catch (error) {
    console.error('Error calculating safe unstake amount:', error);
    return 0;
  }
};

// Calculate all tier progress and related amounts
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

    // Calculate staked percentage
    const stakedPercent = Math.min((stakedValue / totalValue) * 100, 100);

    // Sort tiers by percentage threshold
    const sortedTiers = [...tiers].sort((a, b) => 
      parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
    );

    // Find exact tier based on staked percentage
    let currentTier = sortedTiers[sortedTiers.length - 1]; // Default to max tier
    let progress = 0;
    let currentTierIndex = sortedTiers.length - 1;

    // Find the tier where stake percentage is in its range
    for (let i = 0; i < sortedTiers.length; i++) {
      const tierThreshold = parseFloat(sortedTiers[i].staked_up_to_percent);
      
      if (stakedPercent <= tierThreshold) {
        currentTier = sortedTiers[i];
        currentTierIndex = i;
        
        // Calculate exact progress within this tier
        const lowerThreshold = i > 0 ? parseFloat(sortedTiers[i - 1].staked_up_to_percent) : 0;
        const range = tierThreshold - lowerThreshold;
        
        if (range > 0) {
          progress = ((stakedPercent - lowerThreshold) / range) * 100;
          // Ensure progress is between 0 and 100 with high precision
          progress = Math.min(100, Math.max(0, progress));
        }
        break;
      }
    }

    // Get adjacent tiers for level progression
    const nextTier = currentTierIndex < sortedTiers.length - 1 
      ? sortedTiers[currentTierIndex + 1] 
      : undefined;
    const prevTier = currentTierIndex > 0 
      ? sortedTiers[currentTierIndex - 1] 
      : undefined;

    // Calculate amounts for next tier
    let totalAmountForNext: number | undefined;
    let additionalAmountNeeded: number | undefined;

    if (nextTier) {
      const currentThreshold = parseFloat(currentTier.staked_up_to_percent);
      const targetPercentage = currentThreshold + 0.00001; // Just slightly over threshold
      
      // Calculate the minimum total staked amount needed to exceed current tier
      // If we stake amount x:
      // 1. Total pool becomes: totalValue + x*(1-FEE_RATE)
      // 2. Our staked amount becomes: stakedValue + x*(1-FEE_RATE)
      // 3. We need: (stakedValue + x*(1-FEE_RATE)) / (totalValue + x*(1-FEE_RATE)) > targetPercentage/100
      
      // Solving for x:
      // (stakedValue + x*(1-FEE_RATE)) > (targetPercentage/100)(totalValue + x*(1-FEE_RATE))
      // stakedValue + x*(1-FEE_RATE) > (targetPercentage/100)*totalValue + (targetPercentage/100)*x*(1-FEE_RATE)
      // x*(1-FEE_RATE) - (targetPercentage/100)*x*(1-FEE_RATE) > (targetPercentage/100)*totalValue - stakedValue
      // x*(1-FEE_RATE)*(1 - targetPercentage/100) > (targetPercentage/100)*totalValue - stakedValue
      // x > ((targetPercentage/100)*totalValue - stakedValue) / ((1-FEE_RATE)*(1 - targetPercentage/100))
      
      const targetAmount = (targetPercentage/100) * totalValue;
      const denominator = (1-FEE_RATE) * (1 - targetPercentage/100);
      
      if (denominator !== 0) {
        // Calculate amount needed including fee compensation
        const amountNeeded = (targetAmount - stakedValue) / denominator;
        
        if (amountNeeded > 0) {
          totalAmountForNext = applyWaxPrecision(targetAmount);
          additionalAmountNeeded = applyWaxPrecision(Math.max(0, amountNeeded));
        } else {
          additionalAmountNeeded = 0;
        }
      }
    }

    // Calculate required amount for current tier
    const currentTierThreshold = parseFloat(currentTier.staked_up_to_percent);
    const requiredForCurrent = applyWaxPrecision((currentTierThreshold * totalValue) / 100);

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
      totalAmountForNext,
      additionalAmountNeeded
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

// Check if tier upgrade is available
export const isTierUpgradeAvailable = (
  stakedAmount: string,
  totalStaked: string,
  currentTier: TierEntity,
  tiers: TierEntity[]
): boolean => {
  try {
    const { amount: stakedValue } = parseTokenString(stakedAmount);
    const { amount: totalValue } = parseTokenString(totalStaked);
    
    if (totalValue === 0) return false;

    // Calculate staked percentage
    const stakedPercent = Math.min((stakedValue / totalValue) * 100, 100);
    
    // Find current tier's "staked up to" percentage
    const currentThreshold = parseFloat(currentTier.staked_up_to_percent);
    
    // If we exceed current tier's threshold, upgrade is available
    return stakedPercent > currentThreshold;
  } catch (error) {
    console.error('Error checking tier upgrade availability:', error);
    return false;
  }
};