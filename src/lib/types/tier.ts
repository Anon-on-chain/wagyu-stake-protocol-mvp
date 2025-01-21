export interface TierEntity {
  tier: string;               // e.g. "supplier", "merchant", etc.
  tier_name: string;          // Display name e.g. "Supplier", "Merchant"
  weight: string;             // Reward multiplier e.g. "1.0", "1.05"
  staked_up_to_percent: string; // Max percentage for this tier e.g. "0.5", "2.5"
}

export interface TierProgress {
  currentTier: TierEntity;
  nextTier?: TierEntity;
  prevTier?: TierEntity;
  progress: number;          // Progress towards next tier (0-100)
  requiredForCurrent: number;  // Amount needed to maintain current tier
  totalStaked: string;        // Total amount in pool
  stakedAmount: string;       // User's staked amount as a token string
  currentStakedAmount: number; // User's staked amount as a number
  symbol: string;             // Token symbol (e.g. "WAX")

  // Amount calculations
  rawAmountForNext?: number;     // Base amount needed for next tier without fees or buffer
  totalAmountForNext?: number;   // Total amount needed including fees
  additionalAmountNeeded?: number; // How much more needed after fees
  bufferedAmount?: number;       // Amount needed with buffer (set by user)
  
  // Fee info
  feeRate: number;          // Current fee rate (e.g. 0.003 for 0.3%)
  feeAmount?: number;       // Fee that would be taken on next stake
}

export type TierVariant = 
  | 'supplier' 
  | 'merchant' 
  | 'trader' 
  | 'marketmkr' 
  | 'exchange';

// Type for the order of tier progression
export const TIER_PROGRESSION = [
  'supplier',
  'merchant', 
  'trader',
  'marketmkr',
  'exchange'
] as const;

export type TierProgressionType = typeof TIER_PROGRESSION[number];