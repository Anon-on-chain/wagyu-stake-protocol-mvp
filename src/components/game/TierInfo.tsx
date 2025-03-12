// src/components/game/TierInfo.tsx
import React from 'react';
import { BarChart, Scale, ArrowBigUp, Gauge, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TierInfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TierInfo: React.FC<TierInfoProps> = ({
  open,
  onOpenChange,
}) => {
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
                <span>Each level has unique reward multiplier (click ▼ to view all)</span>
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