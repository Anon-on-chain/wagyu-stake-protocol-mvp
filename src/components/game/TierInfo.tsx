// src/components/game/TierInfo.tsx
import React, { useEffect, useState } from 'react';
import { BarChart, Scale, ArrowBigUp, Gauge, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TIER_CONFIG, TIER_KEYS } from '@/lib/config/tierConfig';
import { cn } from '@/lib/utils';
import { getTierConfig, getTierDisplayName } from '@/lib/utils/tierUtils';
import { useContractData } from '@/lib/hooks/useContractData';
import { TierEntity } from '@/lib/types/tier';

interface TierInfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TierInfo: React.FC<TierInfoProps> = ({
  open,
  onOpenChange,
}) => {
  const { fetchData } = useContractData();
  const [tiers, setTiers] = useState<TierEntity[]>([]);
  
  // Load tiers data when component mounts
  useEffect(() => {
    const loadTiers = async () => {
      try {
        const data = await fetchData();
        if (data?.tiers) {
          // Sort tiers by percentage threshold
          const sortedTiers = [...data.tiers].sort((a, b) => 
            parseFloat(a.staked_up_to_percent) - parseFloat(b.staked_up_to_percent)
          );
          setTiers(sortedTiers);
        }
      } catch (error) {
        console.error('Failed to load tiers for info dialog:', error);
      }
    };
    
    if (open) {
      loadTiers();
    }
  }, [fetchData, open]);

  // Process tiers to include range information
  const processedTiers = tiers.map((tier, index, array) => {
    const currentThreshold = parseFloat(tier.staked_up_to_percent);
    const prevThreshold = index > 0 ? parseFloat(array[index-1].staked_up_to_percent) : 0;
    
    return {
      ...tier,
      range: `${prevThreshold.toFixed(2)}% - ${currentThreshold.toFixed(2)}%`,
    };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700/50 max-h-[85vh] md:max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="bg-slate-900 pb-4">
          <DialogTitle className="text-purple-200">
            Understanding Level Statistics
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 text-slate-200 overflow-y-auto flex-1 pr-2">
          {/* Important Notice */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <AlertCircle className="w-4 h-4" />
              <span className="font-semibold">Important Note</span>
            </div>
            <p className="text-sm text-slate-300">
              All displayed numbers should be used as guides only. The farm's total stake can change rapidly, 
              causing displayed data to be slightly behind real-time conditions.
            </p>
          </div>

          {/* Tier Level Table */}
          <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
            <h3 className="font-semibold mb-3 text-purple-300 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Level Multipliers and Ranges
            </h3>
            <div className="overflow-y-auto max-h-[250px] pr-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-700/30">
                    <th className="py-2 pl-2">Level</th>
                    <th className="py-2">Stake Range</th>
                    <th className="py-2 text-right pr-2">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {processedTiers.map((tier) => {
                    const tierKey = tier.tier.toLowerCase();
                    const tierExists = TIER_KEYS.includes(tierKey);
                    const config = getTierConfig(tierKey);
                    const TierIcon = config.icon;
                    
                    return (
                      <tr 
                        key={tier.tier}
                        className="border-t border-slate-700/30 hover:bg-slate-700/20"
                      >
                        <td className="py-2 pl-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1 rounded-lg", config.bgColor)}>
                              <TierIcon className={cn("w-3 h-3", config.color)} />
                            </div>
                            <span className={config.color}>
                              {tier.tier_name || getTierDisplayName(tierKey)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-slate-300">{tier.range}</td>
                        <td className={cn("py-2 text-right pr-2 font-medium", config.color)}>
                          {parseFloat(tier.weight).toFixed(3)}x
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-purple-300 flex items-center gap-2">
              <BarChart className="w-4 h-4" />
              Progress Bar
            </h3>
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex gap-2">
                <span>•</span>
                <span>Shows your progress within the current level</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Percentage increases as you stake more tokens</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Updates dynamically as total farm weight changes</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-purple-300 flex items-center gap-2">
              <Scale className="w-4 h-4" />
              Safe Unstake Amount
            </h3>
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex gap-2">
                <span>•</span>
                <span>Maximum amount you can unstake while keeping current level</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Automatically calculated based on total farm weight</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Helps prevent accidental level loss</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Updates as farm conditions change</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-purple-300 flex items-center gap-2">
              <ArrowBigUp className="w-4 h-4" />
              Level Requirements
            </h3>
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex gap-2">
                <span>•</span>
                <span>Total needed: Minimum tokens required for next level</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Additional needed: Extra tokens you must stake to advance</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Based on your percentage of total farm weight</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Calculated using preset weight + all staked tokens</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2 text-purple-300 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Level Rewards
            </h3>
            <ul className="space-y-1 text-sm text-slate-300">
              <li className="flex gap-2">
                <span>•</span>
                <span>Each level has unique reward multiplier</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Multiplier applies to your claim power</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Higher levels earn proportionally more rewards</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Multiplier shown in top right (e.g., 1.110x)</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { TierInfoProps };
export { TierInfo };
export default TierInfo;