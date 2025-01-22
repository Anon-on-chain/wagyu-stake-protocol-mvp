import { useMemo } from 'react';
import { TierEntity, TierProgress } from '../types/tier';
import { StakedEntity } from '../types/staked';
import { PoolEntity } from '../types/pool';
import { parseTokenString } from '../utils/tokenUtils';

const FEE_RATE = 0.003; // 0.3% fee as per contract
const PRECISION = 100000000; // 8 decimal places for WAX

export function useTierCalculation(
  stakedData: StakedEntity | undefined,
  poolData: PoolEntity | undefined,
  tiers: TierEntity[]
): TierProgress | null {
  return useMemo(() => {
    if (!stakedData || !poolData || !tiers.length) {
      return null;
    }

    try {
      const { amount: stakedAmount } = parseTokenString(stakedData.staked_quantity);
      const { amount: totalStaked } = parseTokenString(poolData.total_staked_quantity);

      if (totalStaked === 0) {
        return {
          currentTier: tiers[0],
          progress: 0,
          nextTier: tiers[1],
          prevTier: undefined,
          stakedAmount: stakedData.staked_quantity,
          totalStaked: poolData.total_staked_quantity,
          currentStakedAmount: stakedAmount,
          requiredForCurrent: 0,
          symbol: 'WAX',
          feeRate: FEE_RATE,
          feeAmount: 0,
          rawAmountForNext: 0,
          totalAmountForNext: 0,
          additionalAmountNeeded: 0
        };
      }

      // Calculate percentage with 8 decimal precision
      const stakedPercent = (stakedAmount / totalStaked) * 100;

      // Sort tiers by staked percentage requirement
      const sortedTiers = [...tiers].sort((a, b) => 
        parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
      );

      // Find current tier
      let currentTier = sortedTiers[0];
      let currentTierIndex = 0;

      for (let i = 0; i < sortedTiers.length; i++) {
        if (stakedPercent <= parseFloat(sortedTiers[i].staked_up_to_percent)) {
          currentTier = i > 0 ? sortedTiers[i - 1] : sortedTiers[0];
          currentTierIndex = i > 0 ? i - 1 : 0;
          break;
        }
        if (i === sortedTiers.length - 1) {
          currentTier = sortedTiers[i];
          currentTierIndex = i;
        }
      }

      // Get next and previous tiers
      const nextTier = currentTierIndex < sortedTiers.length - 1 
        ? sortedTiers[currentTierIndex + 1] 
        : undefined;
      const prevTier = currentTierIndex > 0 
        ? sortedTiers[currentTierIndex - 1] 
        : undefined;

      // Calculate progress percentage
      let progress = 100;
      if (nextTier) {
        const range = parseFloat(nextTier.staked_up_to_percent) - parseFloat(currentTier.staked_up_to_percent);
        progress = ((stakedPercent - parseFloat(currentTier.staked_up_to_percent)) / range) * 100;
      }

      // Calculate required amounts
      const requiredForCurrent = Math.round((parseFloat(currentTier.staked_up_to_percent) * totalStaked) / 100);
      
      // Calculate next tier amounts with fee
      let rawAmountForNext: number | undefined;
      let totalAmountForNext: number | undefined;
      let additionalAmountNeeded: number | undefined;
      let feeAmount: number | undefined;

      if (nextTier) {
        // Base amount needed before fees
        rawAmountForNext = Math.round((parseFloat(nextTier.staked_up_to_percent) * totalStaked) / 100);
        
        if (stakedAmount < rawAmountForNext) {
          // Calculate base amount needed
          const baseAmountNeeded = rawAmountForNext - stakedAmount;
          // Calculate fee amount
          feeAmount = Math.round(baseAmountNeeded * FEE_RATE / (1 - FEE_RATE));
          // Total amount needed including fee
          additionalAmountNeeded = baseAmountNeeded + feeAmount;
          totalAmountForNext = rawAmountForNext + feeAmount;
        } else {
          feeAmount = 0;
          additionalAmountNeeded = 0;
          totalAmountForNext = rawAmountForNext;
        }
      }

      return {
        currentTier,
        nextTier,
        prevTier,
        progress: Math.min(Math.max(0, progress), 100),
        stakedAmount: stakedData.staked_quantity,
        totalStaked: poolData.total_staked_quantity,
        currentStakedAmount: stakedAmount,
        requiredForCurrent,
        symbol: 'WAX',
        rawAmountForNext,
        totalAmountForNext,
        additionalAmountNeeded,
        feeRate: FEE_RATE,
        feeAmount: feeAmount || 0
      };

    } catch (error) {
      console.error('Error calculating tier:', error);
      return null;
    }
  }, [stakedData, poolData, tiers]);
}