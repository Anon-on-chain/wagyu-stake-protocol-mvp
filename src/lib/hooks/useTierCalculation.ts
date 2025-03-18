// src/lib/hooks/useTierCalculation.ts

import { useMemo } from 'react';
import { TierEntity, TierProgress } from '../types/tier';
import { StakedEntity } from '../types/staked';
import { PoolEntity } from '../types/pool';
import { parseTokenString } from '../utils/tokenUtils';
import { calculateTierProgress, determineTier, calculateAmountForNextTier } from '../utils/tierUtils';

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
        contractTier: stakedData.tier
      });
      
      // IMPORTANT: Always use the mathematically calculated tier
      // instead of the contract tier to ensure accuracy
      const progress = calculateTierProgress(
        stakedData.staked_quantity,
        poolData.total_staked_quantity,
        tiers
      );
      
      if (!progress) return null;
      
      // Debugging information about any potential tier mismatches
      if (progress.currentTier.tier !== stakedData.tier) {
        console.warn(
          `Tier mismatch detected: contract tier=${stakedData.tier}, ` +
          `calculated tier=${progress.currentTier.tier} ` +
          `(User has ${progress.stakedPercent?.toFixed(4)}% of pool)`
        );
      }
      
      // We ALWAYS use the calculated tier, ignoring the contract tier
      return progress;
    } catch (error) {
      console.error('Error in useTierCalculation:', error);
      return null;
    }
  }, [
    stakedData?.staked_quantity, 
    // Note: We don't depend on stakedData?.tier anymore as we use calculated tier
    poolData?.total_staked_quantity,
    poolData?.pool_id,
    tiers
  ]);
}