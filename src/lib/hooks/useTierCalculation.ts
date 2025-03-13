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
            // Calculate current tier percentage
            const { amount: stakedValue } = parseTokenString(stakedData.staked_quantity);
            const { amount: totalValue } = parseTokenString(poolData.total_staked_quantity);
            const stakedPercent = totalValue > 0 ? (stakedValue / totalValue) * 100 : 0;
            
            // Next tier is next in sorted array (if available)
            const nextTierIndex = userTierIndex + 1;
            const nextTier = nextTierIndex < sortedTiers.length 
              ? sortedTiers[nextTierIndex] 
              : undefined;
            
            // Previous tier is previous in sorted array (if available)
            const prevTierIndex = userTierIndex - 1;
            const prevTier = prevTierIndex >= 0 
              ? sortedTiers[prevTierIndex] 
              : undefined;
            
            // Get thresholds
            const prevTierThreshold = prevTier ? parseFloat(prevTier.staked_up_to_percent) : 0;
            const userTierThreshold = parseFloat(userTier.staked_up_to_percent);
            const nextTierThreshold = nextTier ? parseFloat(nextTier.staked_up_to_percent) : 100;
            
            // Calculate progress within the current tier's range
            let adjustedProgress = 0;
            if (nextTier) {
              const currentRange = userTierThreshold - prevTierThreshold;
              const positionInRange = stakedPercent - prevTierThreshold;
              
              if (currentRange > 0) {
                adjustedProgress = (positionInRange / currentRange) * 100;
              }
              
              // Ensure progress is in valid range
              adjustedProgress = Math.min(100, Math.max(0, adjustedProgress));
            } else {
              // At highest tier
              adjustedProgress = 100;
            }
            
            console.log(`Calculated adjusted progress: ${adjustedProgress}%`);
            
            // Recalculate total amount needed and additional amount needed
            let totalAmountForNext = progress.totalAmountForNext;
            let additionalAmountNeeded = progress.additionalAmountNeeded;
            
            // If the calculated tier and the claimed tier are different,
            // we need to recalculate these amounts for the correct tier transition
            if (progress.currentTier.tier !== stakedData.tier && nextTier) {
              try {
                // Import the calculation function directly to avoid circular dependencies
                const { calculateAmountForNextTier } = require('../utils/tierUtils');
                const { decimals } = parseTokenString(stakedData.staked_quantity);
                
                // Recalculate for the user's actual tier
                additionalAmountNeeded = calculateAmountForNextTier(
                  stakedData.staked_quantity,
                  poolData.total_staked_quantity,
                  userTier,
                  nextTier,
                  decimals
                );
                
                totalAmountForNext = stakedValue + additionalAmountNeeded;
              } catch (err) {
                console.error('Error recalculating tier amounts:', err);
                // Keep the original values if calculation fails
              }
            }
            
            return {
              ...progress,
              currentTier: userTier,
              nextTier,
              prevTier,
              progress: adjustedProgress,
              totalAmountForNext,
              additionalAmountNeeded,
              stakedPercent,
              currentThreshold: userTierThreshold,
              nextThreshold: nextTierThreshold,
              prevThreshold: prevTierThreshold
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