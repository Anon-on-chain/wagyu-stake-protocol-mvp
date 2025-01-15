import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { Crown, 
  Sword, 
  Shield, 
  Star, 
  Trophy, 
  Timer, 
  TrendingUp, 
  Gauge, 
  Users, 
  BarChart3 } from 'lucide-react';
import { Name } from '@wharfkit/session';
import { WharfkitContext } from '../lib/wharfkit/context';
import { CONTRACTS } from '../lib/wharfkit/contracts';
import { useContractData } from '../lib/hooks/useContractData';
import { cn } from '@/lib/utils';

// UI Components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";

// Game Components
import { TierDisplay } from './game/TierDisplay';
import { RewardsChart } from './game/RewardsChart';
import { UserStatus } from './game/UserStatus';
import { PoolStats } from './game/PoolStats';
import { ErrorBoundary } from './ErrorBoundary';
import { Leaderboard } from './game/Leaderboard';

// Types
import { PoolEntity } from '../lib/types/pool';
import { StakedEntity } from '../lib/types/staked';
import { TierEntity } from '../lib/types/tier';
import { ConfigEntity } from '../lib/types/config';

// Utils
import { parseTokenString } from '../lib/utils/tokenUtils';
import { calculateTierProgress, isTierUpgradeAvailable } from '../lib/utils/tierUtils';

interface NavItem {
  icon: React.ComponentType<any>;
  label: string;
  id: string;
}

interface GameDataState {
  pools: PoolEntity[];
  stakes: StakedEntity[];
  tiers: TierEntity[];
  config: ConfigEntity | undefined;
}

const GameUI: React.FC = () => {
  const { session, setSession, sessionKit } = useContext(WharfkitContext);
  const [activeTab, setActiveTab] = useState<string>('kingdom');
  const [selectedPool, setSelectedPool] = useState<PoolEntity | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { fetchData, loading } = useContractData();
  const [gameData, setGameData] = useState<GameDataState>({
    pools: [],
    stakes: [],
    tiers: [],
    config: undefined
  });

  const playerStake = useMemo(() => {
    if (!session || !selectedPool) return undefined;
    return gameData.stakes.find(
      stake => stake.owner === session.actor.toString() &&
               stake.pool_id === selectedPool.pool_id
    );
  }, [session, selectedPool, gameData.stakes]);

  const loadData = useCallback(async () => {
    try {
      const data = await fetchData();
      if (data) {
        setGameData({
          pools: data.pools,
          stakes: data.stakes,
          tiers: data.tiers,
          config: data.config
        });

        // Set first pool as default if none selected
        if (data.pools.length > 0 && !selectedPool) {
          setSelectedPool(data.pools[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data');
    }
  }, [fetchData, selectedPool]);

  // Initial data load
  useEffect(() => {
    if (session) {
      loadData();
    } else {
      setGameData({
        pools: [],
        stakes: [],
        tiers: [],
        config: undefined
      });
      setSelectedPool(undefined);
    }
  }, [session, loadData]);

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session) {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, loadData]);

  const handleClaim = async () => {
    if (!session || !selectedPool) return;
    
    try {
      const action = {
        account: Name.from(CONTRACTS.STAKING.NAME),
        name: Name.from('claim'),
        authorization: [session.permissionLevel],
        data: {
          claimer: session.actor,
          pool_id: selectedPool.pool_id
        }
      };

      await session.transact({ actions: [action] });
      
      // Update UI immediately for better UX
      if (playerStake && gameData.config) {
        const newCooldownEnd = new Date(
          Date.now() + gameData.config.cooldown_seconds_per_claim * 1000
        ).toISOString();
        
        setGameData(prev => ({
          ...prev,
          stakes: prev.stakes.map((stake: StakedEntity) =>
            stake.pool_id === playerStake.pool_id && stake.owner === playerStake.owner
              ? {
                  ...stake,
                  cooldown_end_at: newCooldownEnd,
                  last_claimed_at: new Date().toISOString()
                }
              : stake
          )
        }));
      }
      
      await loadData();
    } catch (error) {
      console.error('Claim error:', error);
      setError('Failed to claim rewards');
      await loadData();
    }
  };

  const handleStake = async (amount: string) => {
    if (!session || !selectedPool) return;
    
    try {
      const { symbol } = parseTokenString(selectedPool.total_staked_quantity);
      const formattedAmount = parseFloat(amount).toFixed(8);
      const action = {
        account: Name.from(selectedPool.staked_token_contract),
        name: Name.from('transfer'),
        authorization: [session.permissionLevel],
        data: {
          from: session.actor,
          to: CONTRACTS.STAKING.NAME,
          quantity: `${formattedAmount} ${symbol}`,
          memo: 'stake'
        }
      };

      await session.transact({ actions: [action] });

      // Optimistic update
      if (gameData.config) {
        const newStakedQuantity = playerStake 
          ? (parseFloat(playerStake.staked_quantity) + parseFloat(formattedAmount)).toFixed(8) + ` ${symbol}`
          : `${formattedAmount} ${symbol}`;
          
        const newCooldownEnd = new Date(
          Date.now() + gameData.config.cooldown_seconds_per_claim * 1000
        ).toISOString();
        
        setGameData(prev => ({
          ...prev,
          stakes: playerStake
            ? prev.stakes.map((stake: StakedEntity) =>
                stake.pool_id === selectedPool.pool_id && stake.owner === session?.actor.toString()
                  ? {
                      ...stake,
                      staked_quantity: newStakedQuantity,
                      cooldown_end_at: newCooldownEnd,
                      last_claimed_at: new Date().toISOString()
                    }
                  : stake
              )
            : [...prev.stakes, {
                pool_id: selectedPool.pool_id,
                staked_quantity: newStakedQuantity,
                tier: 'supplier',
                last_claimed_at: new Date().toISOString(),
                cooldown_end_at: newCooldownEnd,
                owner: session.actor.toString()
              }]
        }));
      }

      await loadData();
    } catch (error) {
      console.error('Stake error:', error);
      setError('Failed to stake tokens');
      await loadData();
    }
  };

  const handleUnstake = async (amount: string) => {
    if (!session || !selectedPool || !playerStake) return;
    
    try {
      const { symbol } = parseTokenString(selectedPool.total_staked_quantity);
      const formattedAmount = parseFloat(amount).toFixed(8);
      const action = {
        account: Name.from(CONTRACTS.STAKING.NAME),
        name: Name.from('unstake'),
        authorization: [session.permissionLevel],
        data: {
          claimer: session.actor,
          pool_id: selectedPool.pool_id,
          quantity: `${formattedAmount} ${symbol}`,
        }
      };

      await session.transact({ actions: [action] });

      // Optimistic update
      const newStakedAmount = parseFloat(playerStake.staked_quantity) - parseFloat(formattedAmount);
      
      if (newStakedAmount <= 0) {
        setGameData(prev => ({
          ...prev,
          stakes: prev.stakes.filter((stake: StakedEntity) => 
            stake.pool_id !== playerStake.pool_id || 
            stake.owner !== session?.actor.toString()
          )
        }));
      } else {
        setGameData(prev => ({
          ...prev,
          stakes: prev.stakes.map((stake: StakedEntity) =>
            stake.pool_id === playerStake.pool_id && 
            stake.owner === session?.actor.toString()
              ? {
                  ...stake,
                  staked_quantity: newStakedAmount.toFixed(8) + ` ${symbol}`,
                  cooldown_end_at: new Date(
                    Date.now() + (prev.config?.cooldown_seconds_per_claim ?? 60) * 1000
                  ).toISOString(),
                  last_claimed_at: new Date().toISOString()
                }
              : stake
          )
        }));
      }

      await loadData();
    } catch (error) {
      console.error('Unstake error:', error);
      setError('Failed to unstake tokens');
      await loadData();
    }
  };

  const handleLogin = async () => {
    try {
      const response = await sessionKit.login();
      setSession(response.session);
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to connect wallet');
    }
  };

  const handleLogout = async () => {
    if (session) {
      await sessionKit.logout(session);
      setSession(undefined);
    }
  };

  const navItems: NavItem[] = [
    { icon: Crown, label: 'Kingdom', id: 'kingdom' },
    { icon: Users, label: 'Guild', id: 'guild' },
    { icon: BarChart3, label: 'Leaderboard', id: 'leaderboard' },
    { icon: Sword, label: 'Battle', id: 'battle' },
    { icon: Trophy, label: 'Rewards', id: 'rewards' }
  ];

  // Tier calculations
  // Calculate tier progress and upgrade availability
  const tierProgress = useMemo(() => {
    if (!playerStake || !selectedPool || !gameData.tiers.length) return null;
    try {
      // Use determineTier from tierUtils to get current tier first
      const currentTier = determineTier(
        playerStake.staked_quantity,
        selectedPool.total_staked_quantity,
        gameData.tiers
      );

      // Then calculate full progress
      return calculateTierProgress(
        playerStake.staked_quantity,
        selectedPool.total_staked_quantity,
        gameData.tiers
      );
    } catch (error) {
      console.error('Error calculating tier progress:', error);
      return null;
    }
  }, [playerStake, selectedPool, gameData.tiers]);

  const canUpgradeTier = useMemo(() => {
    if (!tierProgress?.currentTier || !selectedPool || !playerStake) return false;
    return isTierUpgradeAvailable(
      playerStake.staked_quantity,
      selectedPool.total_staked_quantity,
      tierProgress.currentTier,
      gameData.tiers
    );
  }, [tierProgress, selectedPool, playerStake, gameData.tiers]);
  // Render content based on active tab
  const renderContent = () => {
    if (!session && activeTab !== 'leaderboard') {
      return (
        <div className="flex justify-center items-center h-64">
          <p className="text-purple-200">Connect your wallet to start playing</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'kingdom':
        return (
          <div className="space-y-6">
            <div className="crystal-bg rounded-2xl p-6 border border-purple-500/20">
              <h2 className="text-2xl font-bold mb-6 text-purple-200 flex items-center gap-3">
                <Crown className="w-8 h-8 text-purple-500" />
                Select Your Kingdom
              </h2>
              <Select 
                onValueChange={(value) => {
                  try {
                    const pool = gameData.pools.find(p => p.pool_id === parseInt(value));
                    setSelectedPool(pool);
                    setError(null);
                  } catch (error) {
                    console.error('Error selecting pool:', error);
                    setError('Error selecting pool');
                  }
                }}
                value={selectedPool?.pool_id?.toString()}
              >
                <SelectTrigger className="w-full bg-slate-800/30 border-purple-500/20 text-purple-200 h-12">
                  <SelectValue placeholder="Choose your kingdom" />
                </SelectTrigger>
                <SelectContent className="bg-white/5 backdrop-blur-xl border-purple-500/20">
                  <div className="py-2">
                    {gameData.pools.map((pool: PoolEntity) => {
                      try {
                        const { symbol } = parseTokenString(pool.total_staked_quantity);
                        return (
                          <SelectItem 
                            key={pool.pool_id} 
                            value={pool.pool_id.toString()}
                            className="text-purple-100 hover:bg-purple-500/20 focus:bg-purple-500/20 cursor-pointer"
                          >
                            {`${symbol} Kingdom - Realm #${pool.pool_id}`}
                          </SelectItem>
                        );
                      } catch (e) {
                        console.error('Error parsing pool data:', e);
                        return null;
                      }
                    })}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {selectedPool && (
              <ErrorBoundary 
                fallback={<div className="text-red-400">
                  Error loading pool data. Check console for details.
                </div>}
              >
                <div className="space-y-6">
                  <PoolStats poolData={selectedPool} />

                  {tierProgress && (
                    <TierDisplay 
                      tierProgress={tierProgress}
                      isUpgradeAvailable={canUpgradeTier}
                      stakedData={playerStake}
                      totalStaked={selectedPool.total_staked_quantity}
                      allTiers={gameData.tiers}
                    />
                  )}
                  
                  {gameData.config && (
                    <UserStatus 
  stakedData={playerStake}
  config={gameData.config}
  onCooldownComplete={loadData}
  onClaim={handleClaim}
  onUnstake={handleUnstake}
  onStake={handleStake}
  poolSymbol={parseTokenString(selectedPool.total_staked_quantity).symbol}
  tierProgress={tierProgress} // Add this
/>
                  )}

                  <RewardsChart poolData={selectedPool} />
                </div>
              </ErrorBoundary>
            )}
          </div>
        );

      case 'leaderboard':
        return <Leaderboard />;

      case 'guild':
        return (
          <div className="flex justify-center items-center h-64">
            <p className="text-purple-200">Guild features coming soon...</p>
          </div>
        );

      case 'battle':
        return (
          <div className="flex justify-center items-center h-64">
            <p className="text-purple-200">Battle features coming soon...</p>
          </div>
        );

      case 'rewards':
        return (
          <div className="flex justify-center items-center h-64">
            <p className="text-purple-200">Rewards features coming soon...</p>
          </div>
        );

      default:
        return (
          <div className="flex justify-center items-center h-64">
            <p className="text-purple-200">Select a tab to begin</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-slate-900 to-slate-900">
      {/* Header */}
      <div className="relative crystal-bg py-4 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-200 to-purple-400 text-transparent bg-clip-text">
              Stakeland
            </h1>
            
            {session ? (
              <div className="flex items-center gap-4">
                <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-2 px-4 flex items-center gap-2 group">
                  <div className="w-2 h-2 rounded-full bg-green-500 group-hover:animate-pulse" />
                  <span className="text-purple-200 font-medium">
                    {session.actor.toString()}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  className="bg-slate-800/30 border border-slate-700/50 hover:bg-slate-700/50 text-purple-200"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="bg-slate-800/30 border border-slate-700/50 hover:bg-slate-700/50 text-purple-200"
                onClick={handleLogin}
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 pt-6">
        <div className="space-y-6">
          {renderContent()}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 crystal-bg border-t border-purple-500/20">
        <div className="max-w-lg mx-auto">
          <nav className="flex justify-around p-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all",
                  activeTab === item.id 
                    ? "bg-slate-800/50 border border-purple-500/20" 
                    : "hover:bg-slate-800/30",
                  activeTab === item.id 
                    ? "text-purple-200" 
                    : "text-slate-400 hover:text-purple-200"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  activeTab === item.id 
                    ? "text-purple-400" 
                    : "text-slate-500"
                )} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg shadow-lg border border-red-400/50">
          {error}
        </div>
      )}
    </div>
  );
};

export default GameUI;