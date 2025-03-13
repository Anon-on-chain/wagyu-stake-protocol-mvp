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
  progress: number;             // Progress percentage within the tier (0-100%)
  requiredForCurrent: number;   // Minimum tokens needed to maintain current tier
  totalStaked: string;          // Total staked in the entire pool
  stakedAmount: string;         // User's staked amount (raw string)
  currentStakedAmount: number;  // User's staked amount (parsed number)
  symbol: string;               // Token symbol
  
  // Fields for tier amounts
  totalAmountForNext?: number;  // Total amount needed for next tier
  additionalAmountNeeded?: number;  // Additional amount needed with fee adjustment
  weight: number;               // Current tier weight multiplier
  safeUnstakeAmount: number;    // Amount that can be unstaked without changing tier
  
  // New fields to support UI display
  currentThreshold?: number;    // Current tier threshold percentage
  nextThreshold?: number;       // Next tier threshold percentage  
  prevThreshold?: number;       // Previous tier threshold percentage
  stakedPercent?: number;       // User's current percentage of the pool
}

// Type for tier variants (a through v)
export type TierVariant = keyof typeof TIER_CONFIG;