// src/lib/types/tier.ts
import { TIER_CONFIG } from '../config/tierConfig';

export interface TierEntity {
  tier: string;               
  tier_name: string;          
  weight: string;             
  staked_up_to_percent: string;
}

export interface TierProgress {
  currentTier: TierEntity;
  nextTier?: TierEntity;
  prevTier?: TierEntity;
  progress: number;
  requiredForCurrent: number;
  totalStaked: string;
  stakedAmount: string;
  currentStakedAmount: number;
  symbol: string;  
  // Fields for tier amounts
  totalAmountForNext?: number;  // Total amount needed for next tier
  additionalAmountNeeded?: number;  // Additional amount needed with fee adjustment
  weight: number;
  safeUnstakeAmount: number; // Amount that can be unstaked without changing tier
}

// Type for tier variants (a through v)
export type TierVariant = keyof typeof TIER_CONFIG;