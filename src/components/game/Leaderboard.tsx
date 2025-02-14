import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { TierBadge } from '../ui/TierBadge';
import { calculateTimeLeft, formatTimeLeft } from '../../lib/utils/dateUtils';
import { parseTokenString } from '../../lib/utils/tokenUtils';
import { useContractData } from '../../lib/hooks/useContractData';
import { StakedEntity } from '../../lib/types/staked';
import { getTierWeight, getTierConfig, getTierDisplayName } from '../../lib/utils/tierUtils';
import { cn } from '@/lib/utils';

interface ExtendedStakeEntity extends StakedEntity {
  calculatedWeight: number;
  weightPercentage: string;
}

export const Leaderboard: React.FC = () => {
  const { fetchData, loading, error } = useContractData();
  const [leaderboardData, setLeaderboardData] = useState<ExtendedStakeEntity[]>([]);
  const [totalWeight, setTotalWeight] = useState<string>('0.00000000 WAX');
  const [isLoading, setIsLoading] = useState(false);

  const calculateWeight = (amount: string, tier: string): number => {
    const { amount: stakedAmount } = parseTokenString(amount);
    const tierWeight = parseFloat(getTierWeight(tier));
    return parseFloat((stakedAmount * tierWeight).toFixed(8));
  };

  const calculateWeightPercentage = (weight: number): string => {
    const { amount: totalWeightAmount } = parseTokenString(totalWeight);
    return ((weight / totalWeightAmount) * 100).toFixed(2);
  };

  const loadLeaderboardData = async () => {
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      const data = await fetchData();
      if (data?.stakes && data?.pools) {
        const pool = data.pools[0]; // Assuming first pool
        const poolTotalWeight = pool?.total_staked_weight || '0.00000000 WAX';
        setTotalWeight(poolTotalWeight);

        // Calculate weights for each stake
        const stakesWithWeights = data.stakes.map(stake => {
          const calculatedWeight = calculateWeight(stake.staked_quantity, stake.tier);
          return {
            ...stake,
            calculatedWeight,
            weightPercentage: calculateWeightPercentage(calculatedWeight)
          };
        });

        // Sort by calculated weight
        const sortedStakes = stakesWithWeights.sort((a, b) => (
          b.calculatedWeight - a.calculatedWeight
        ));

        setLeaderboardData(sortedStakes);
      }
    } catch (err) {
      console.error('Failed to load leaderboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadLeaderboardData();
  }, []);

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(loadLeaderboardData, 120000);
    return () => clearInterval(interval);
  }, []);

  const renderClaimStatus = (cooldownEnd: string) => {
    const timeLeft = calculateTimeLeft(cooldownEnd);
    if (timeLeft <= 0) {
      return (
        <div className="bg-green-500/20 text-green-500 px-2 py-1 rounded-lg text-xs font-medium animate-pulse">
          Ready to Claim
        </div>
      );
    }
    return (
      <span className="text-slate-400">
        {formatTimeLeft(timeLeft)}
      </span>
    );
  };

  if (loading) {
    return (
      <Card className="w-full crystal-bg group">
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-800/30 rounded-lg border border-slate-700/50 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full crystal-bg group">
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-4 text-red-400 text-center">
            {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full crystal-bg group">
      <CardHeader>
        <CardTitle>Top Stakers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 transition-all">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-slate-700/30 border-b border-slate-700/50">
                <TableHead className="text-slate-300">Rank</TableHead>
                <TableHead className="text-slate-300">Account</TableHead>
                <TableHead className="text-slate-300">Tier</TableHead>
                <TableHead className="text-right text-slate-300">Staked Amount</TableHead>
                <TableHead className="text-right text-slate-300">Weight</TableHead>
                <TableHead className="text-right text-slate-300">Share</TableHead>
                <TableHead className="text-right text-slate-300">Next Claim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboardData.map((entry, index) => {
                const tierConfig = getTierConfig(entry.tier);
                const TierIcon = tierConfig.icon;
                const { amount, symbol } = parseTokenString(entry.staked_quantity);
                const style = tierConfig;

                return (
                  <TableRow 
                    key={`${entry.pool_id}-${index}`}
                    className="hover:bg-slate-700/30 transition-all border-b border-slate-700/50 last:border-0"
                  >
                    <TableCell className="font-medium text-slate-200">
                      #{index + 1}
                    </TableCell>
                    <TableCell className="text-slate-200">
                      {entry.owner}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("p-2 rounded-lg transition-all", style.bgColor)}>
                          <TierIcon className={cn("w-4 h-4", style.color)} />
                        </div>
                        <span className={style.color}>
                          {getTierDisplayName(entry.tier)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-200">
                      {`${Number(amount).toFixed(8)} ${symbol}`}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-200">
                      {`${entry.calculatedWeight.toFixed(8)} ${symbol}`}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-200">
                      {`${entry.weightPercentage}%`}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderClaimStatus(entry.cooldown_end_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default Leaderboard;