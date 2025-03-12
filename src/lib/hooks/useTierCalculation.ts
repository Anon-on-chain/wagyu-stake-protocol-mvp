// src/lib/hooks/useTierCalculation.ts

import { useMemo } from 'react';
import { TierEntity, TierProgress } from '../types/tier';
import { StakedEntity } from '../types/staked';
import { PoolEntity } from '../types/pool';
import { parseTokenString } from '../utils/tokenUtils';
import { calculateTierProgress, determineTier } from '../utils/tierUtils';

/**
 * Hook for calculating tier progress information
 * Provides tier information based on a user's staked amount and pool data
 */
export function useTierCalculation(
  stakedData: StakedEntity | undefined,
  poolData: PoolEntity | undefined,
  tiers: TierEntity[]
): TierProgress | null {
  return useMemo(() => {
    if (!stakedData || !poolData || !tiers.length) {
      console.log('Cannot calculate tier: missing required data');
      return null;
    }
    
    try {
      console.log('Calculating tier data with:', {
        stakedQuantity: stakedData.staked_quantity,
        poolTotal: poolData.total_staked_quantity,
        tier: stakedData.tier
      });
      
      // Calculate tier progress
      const progress = calculateTierProgress(
        stakedData.staked_quantity,
        poolData.total_staked_quantity,
        tiers
      );
      
      if (!progress) return null;
      
      // Check if the backend tier doesn't match what we calculate
      // This can happen right after a stake operation
      if (progress.currentTier.tier !== stakedData.tier) {
        console.warn(`Tier mismatch detected: stakedData.tier=${stakedData.tier}, progress.currentTier.tier=${progress.currentTier.tier}`);
        
        // Find the user's claimed tier in our tier list
        const userTier = tiers.find(t => t.tier === stakedData.tier);
        
        if (userTier) {
          // Sort tiers to find next/prev tiers relative to user's claimed tier
          const sortedTiers = [...tiers].sort((a, b) => 
            parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
          );
          
          const userTierIndex = sortedTiers.findIndex(t => t.tier === stakedData.tier);
          
          if (userTierIndex !== -1) {
            // Find next tier
            const nextTierIndex = userTierIndex + 1;
            const nextTier = nextTierIndex < sortedTiers.length 
              ? sortedTiers[nextTierIndex] 
              : undefined;
              
            // Find prev tier
            const prevTierIndex = userTierIndex - 1;
            const prevTier = prevTierIndex >= 0 
              ? sortedTiers[prevTierIndex] 
              : undefined;
              
            // Calculate current tier percentage
            const { amount: stakedValue } = parseTokenString(stakedData.staked_quantity);
            const { amount: totalValue } = parseTokenString(poolData.total_staked_quantity);
            const stakedPercent = (stakedValue / totalValue) * 100;
            
            // Get tier thresholds for progress calculation
            const userTierThreshold = parseFloat(userTier.staked_up_to_percent);
            const nextTierThreshold = nextTier ? parseFloat(nextTier.staked_up_to_percent) : 100;
            
            // Calculate progress within current tier
            let tierProgress = 0;
            if (nextTier) {
              const rangeSize = nextTierThreshold - userTierThreshold;
              tierProgress = rangeSize > 0
                ? ((stakedPercent - userTierThreshold) / rangeSize) * 100
                : 100;
              tierProgress = Math.min(100, Math.max(0, tierProgress));
            } else {
              tierProgress = 100; // At max tier
            }
            
            // Create adjusted tier progress with user's actual tier
            // Make a copy of progress and override specific properties
            return {
              ...progress,
              currentTier: userTier,
              nextTier,
              prevTier,
              progress: tierProgress
            };
          }
        }
      }
      
      // Return original progress if no adjustment needed
      return progress;
    } catch (error) {
      console.error('Error in useTierCalculation:', error);
      return null;
    }
  }, [
    stakedData?.staked_quantity, 
    stakedData?.tier,
    poolData?.total_staked_quantity,
    poolData?.pool_id,
    tiers
  ]);
}