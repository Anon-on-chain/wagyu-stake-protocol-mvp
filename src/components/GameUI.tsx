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
import { Session, SessionKit, Chains, Name } from '@wharfkit/session';
import { WharfkitContext } from '../lib/wharfkit/context';
import { CONTRACTS } from '../lib/wharfkit/contracts';
import { useContractData } from '../lib/hooks/useContractData';
import { useTierCalculation } from '../lib/hooks/useTierCalculation';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/contexts/ToastContext';
import { TierBadge } from './ui/TierBadge';

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
import { 
  calculateTierProgress, 
  isTierUpgradeAvailable,
  determineTier 
} from '../lib/utils/tierUtils';

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

interface ActionTrace {
  act: {
    account: string;
    name: string;
    data: {
      from?: string;
      to?: string;
      quantity?: string;
      [key: string]: any;
    };
  };
  console?: string;
  return_value?: string;
  [key: string]: any;
}

const GameUI: React.FC = () => {
  const { session, setSession, sessionKit } = useContext(WharfkitContext);
  const [activeTab, setActiveTab] = useState<string>('kingdom');
  const [previousTab, setPreviousTab] = useState<string>('kingdom');
  const [selectedPool, setSelectedPool] = useState<PoolEntity | undefined>();
  const { fetchData, loading } = useContractData();
  const { addToast } = useToast();
  const [gameData, setGameData] = useState<GameDataState>({
    pools: [],
    stakes: [],
    tiers: [],
    config: undefined
  });
  const [isProcessingTransaction, setIsProcessingTransaction] = useState<boolean>(false);
  // Add a refresh counter to force re-renders when needed
  const [refreshCounter, setRefreshCounter] = useState(0);

  const loadData = useCallback(async () => {
    try {
      console.log('Loading game data...');
      const data = await fetchData();
      if (data) {
        setGameData({
          pools: data.pools,
          stakes: data.stakes,
          tiers: data.tiers,
          config: data.config
        });

        if (data.pools.length > 0 && !selectedPool) {
          setSelectedPool(data.pools[0]);
        }
        
        // Increment refresh counter on successful data load
        setRefreshCounter(prev => prev + 1);
        console.log('Game data loaded successfully, refresh counter:', refreshCounter + 1);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      addToast({
        type: 'error',
        title: 'Data Load Failed',
        message: 'Failed to load game data. Please try again.'
      });
    }
  }, [fetchData, selectedPool, addToast, refreshCounter]);

  // Update the effect to track processing state
  useEffect(() => {
    if (session && !isProcessingTransaction) {
      // Only reload data when processing finishes or session changes
      loadData();
    }
  }, [session, isProcessingTransaction, loadData]);

  // Visibility change handler to refresh data
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session && !isProcessingTransaction) {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, isProcessingTransaction, loadData]);

  // Improve transaction handling for consistent tier display
  const handleTransactionCompletion = useCallback(async () => {
    console.log('Transaction completed, refreshing data...');
    setIsProcessingTransaction(false);
    
    // Add a slight delay before reloading data to allow backend to update
    setTimeout(() => {
      loadData();
    }, 1000);
    
    // Return to previous tab if needed
    if (previousTab !== activeTab) {
      setActiveTab(previousTab);
    }
  }, [loadData, previousTab, activeTab]);

  const findClaimTransfer = (transaction: any) => {
    const actionTraces = transaction?.response?.processed?.action_traces;
    if (!actionTraces || !Array.isArray(actionTraces)) {
      return undefined;
    }
    
    const claimAction = actionTraces.find(trace => 
      trace.act.account === 'eosio.token' &&
      trace.act.name === 'transfer' && 
      trace.act.data.from === 'test1ngstake' &&
      trace.act.data.memo === 'Token staking reward.'
    );

    return claimAction?.act.data;
  };

const handleStake = async (amount: string) => {
  if (!session || !selectedPool) return;
  
  try {
    setPreviousTab(activeTab);
    setIsProcessingTransaction(true);
    
    // Log current tier before transaction if available
    if (playerStake) {
      console.log(`Current tier before stake: ${playerStake.tier}`);
    }
    
    const { symbol, decimals } = parseTokenString(selectedPool.total_staked_quantity);
    const formattedAmount = parseFloat(amount).toFixed(decimals);
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

    const result = await session.transact({ actions: [action] });
    const claimTransfer = findClaimTransfer(result);

    // Calculate fee (0.3% of staked amount)
    const FEE_RATE = 0.003;
    const stakedAmount = parseFloat(formattedAmount);
    const feeAmount = stakedAmount * FEE_RATE;
    const actualStakedAmount = stakedAmount - feeAmount;
    
    console.log(`Staking ${formattedAmount} ${symbol} with fee: ${feeAmount.toFixed(decimals)} ${symbol}`);
    console.log(`Actual staked amount: ${actualStakedAmount.toFixed(decimals)} ${symbol}`);
    
    // Update local state to reflect changes immediately
    if (selectedPool) {
      // Calculate new pool total (precise calculation)
      const currentPoolTotal = parseFloat(selectedPool.total_staked_quantity);
      const newPoolTotal = currentPoolTotal + actualStakedAmount;
      
      // Create updated pool with new total
      const updatedPool = {
        ...selectedPool,
        total_staked_quantity: `${newPoolTotal.toFixed(decimals)} ${symbol}`
      };
      
      console.log(`Updated pool total: ${currentPoolTotal.toFixed(decimals)} + ${actualStakedAmount.toFixed(decimals)} = ${newPoolTotal.toFixed(decimals)}`);
      
      // Update gameData with updated pool
      setGameData(prev => {
        const updatedPools = prev.pools.map(pool => 
          pool.pool_id === selectedPool.pool_id ? updatedPool : pool
        );
        
        // If player already has a stake, update their stake data
        let updatedStakes = [...prev.stakes];
        if (playerStake) {
          const currentStakeAmount = parseFloat(playerStake.staked_quantity);
          const newStakeAmount = currentStakeAmount + actualStakedAmount;
          
          // Update the player's stake
          updatedStakes = updatedStakes.map(stake => 
            (stake.owner === session.actor.toString() && stake.pool_id === selectedPool.pool_id)
              ? {
                  ...stake,
                  staked_quantity: `${newStakeAmount.toFixed(decimals)} ${symbol}`,
                  // Don't update tier here - let backend determine it
                  last_claimed_at: new Date().toISOString(),
                  cooldown_end_at: new Date(Date.now() + (prev.config?.cooldown_seconds_per_claim || 60) * 1000).toISOString()
                }
              : stake
          );
        } else {
          // Create a new stake entry if player doesn't have one yet
          // This is just a placeholder until backend data loads
          updatedStakes.push({
            pool_id: selectedPool.pool_id,
            staked_quantity: `${actualStakedAmount.toFixed(decimals)} ${symbol}`,
            tier: 'a', // Start with lowest tier
            last_claimed_at: new Date().toISOString(),
            cooldown_end_at: new Date(Date.now() + (prev.config?.cooldown_seconds_per_claim || 60) * 1000).toISOString(),
            owner: session.actor.toString()
          });
        }
        
        return {
          ...prev,
          pools: updatedPools,
          stakes: updatedStakes
        };
      });
      
      // Update selectedPool reference
      setSelectedPool(updatedPool);
    }

    const toastMessage = claimTransfer?.quantity
      ? `Staked ${formattedAmount} ${symbol} and claimed ${claimTransfer.quantity}`
      : `Staked ${formattedAmount} ${symbol}`;

    addToast({
      type: 'success',
      title: 'Stake Successful!',
      message: toastMessage
    });

    // Increment refresh counter to force UI updates
    setRefreshCounter(prev => prev + 1);
    
    await handleTransactionCompletion();
  } catch (error) {
    console.error('Stake error:', error);
    addToast({
      type: 'error',
      title: 'Stake Failed',
      message: 'Failed to stake tokens. Please try again.'
    });
    setIsProcessingTransaction(false);
  }
};

const handleUnstake = async (amount: string) => {
  if (!session || !selectedPool || !playerStake) return;
  
  try {
    setPreviousTab(activeTab);
    setIsProcessingTransaction(true);
    
    // Log current tier before transaction
    console.log(`Current tier before unstake: ${playerStake.tier}`);
    console.log(`Current staked amount: ${playerStake.staked_quantity}`);
    
    const { symbol, decimals } = parseTokenString(selectedPool.total_staked_quantity);
    const formattedAmount = parseFloat(amount).toFixed(decimals);
    const unstakeAmount = parseFloat(formattedAmount);
    
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

    // Update local state to reflect changes immediately
    if (selectedPool && playerStake) {
      // Calculate new values (precise calculation)
      const currentPoolTotal = parseFloat(selectedPool.total_staked_quantity);
      const currentStakedAmount = parseFloat(playerStake.staked_quantity);
      
      const newPoolTotal = Math.max(0, currentPoolTotal - unstakeAmount);
      const newStakedAmount = Math.max(0, currentStakedAmount - unstakeAmount);
      
      console.log(`Unstaking ${unstakeAmount.toFixed(decimals)} ${symbol}`);
      console.log(`Updated pool total: ${currentPoolTotal.toFixed(decimals)} - ${unstakeAmount.toFixed(decimals)} = ${newPoolTotal.toFixed(decimals)}`);
      console.log(`Updated stake amount: ${currentStakedAmount.toFixed(decimals)} - ${unstakeAmount.toFixed(decimals)} = ${newStakedAmount.toFixed(decimals)}`);
      
      // Create updated pool with new total
      const updatedPool = {
        ...selectedPool,
        total_staked_quantity: `${newPoolTotal.toFixed(decimals)} ${symbol}`
      };
      
      // Update gameData with updated pool and stake
      setGameData(prev => {
        // Update the pool
        const updatedPools = prev.pools.map(pool => 
          pool.pool_id === selectedPool.pool_id ? updatedPool : pool
        );
        
        // Update the player's stake or remove it if fully unstaked
        let updatedStakes;
        if (newStakedAmount <= 0) {
          // Remove stake if fully unstaked
          updatedStakes = prev.stakes.filter(stake => 
            !(stake.owner === session.actor.toString() && stake.pool_id === selectedPool.pool_id)
          );
        } else {
          // Update stake with new amount
          updatedStakes = prev.stakes.map(stake => 
            (stake.owner === session.actor.toString() && stake.pool_id === selectedPool.pool_id)
              ? {
                  ...stake,
                  staked_quantity: `${newStakedAmount.toFixed(decimals)} ${symbol}`,
                  // Don't update tier here - let backend determine it
                  last_claimed_at: new Date().toISOString(),
                  cooldown_end_at: new Date(Date.now() + (prev.config?.cooldown_seconds_per_claim || 60) * 1000).toISOString()
                }
              : stake
          );
        }
        
        return {
          ...prev,
          pools: updatedPools,
          stakes: updatedStakes
        };
      });
      
      // Update selectedPool reference
      setSelectedPool(updatedPool);
    }

    addToast({
      type: 'success',
      title: 'Unstake Successful!',
      message: `Unstaked ${formattedAmount} ${symbol}`
    });

    // Increment refresh counter to force UI updates
    setRefreshCounter(prev => prev + 1);
    
    await handleTransactionCompletion();
  } catch (error) {
    console.error('Unstake error:', error);
    addToast({
      type: 'error',
      title: 'Unstake Failed',
      message: 'Failed to unstake tokens. Please try again.'
    });
    setIsProcessingTransaction(false);
  }
};

  const handleClaim = async () => {
    if (!session || !selectedPool) return;
    
    try {
      setPreviousTab(activeTab);
      setIsProcessingTransaction(true);
      
      // Log current tier before claim if available
      if (playerStake) {
        console.log(`Current tier before claim: ${playerStake.tier}`);
      }
      
      const action = {
        account: Name.from(CONTRACTS.STAKING.NAME),
        name: Name.from('claim'),
        authorization: [session.permissionLevel],
        data: {
          claimer: session.actor,
          pool_id: selectedPool.pool_id
        }
      };

      const result = await session.transact({ actions: [action] });
      const claimTransfer = findClaimTransfer(result);

      if (claimTransfer?.quantity) {
        addToast({
          type: 'success',
          title: 'Rewards Claimed',
          message: `${claimTransfer.quantity}`
        });
      }
      
      await handleTransactionCompletion();
    } catch (error) {
      console.error('Claim error:', error);
      addToast({
        type: 'error',
        title: 'Claim Failed',
        message: 'Failed to claim rewards. Please try again.'
      });
      setIsProcessingTransaction(false);
    }
  };

  const memoizedHandlers = useMemo(() => ({
    onClaim: handleClaim,
    onUnstake: handleUnstake,
    onStake: handleStake,
    onCooldownComplete: loadData
  }), [handleClaim, handleUnstake, handleStake, loadData]);

  const playerStake = useMemo(() => {
    if (!session || !selectedPool) return undefined;
    return gameData.stakes.find(
      stake => stake.owner === session.actor.toString() &&
               stake.pool_id === selectedPool.pool_id
    );
  }, [session, selectedPool, gameData.stakes]);

  const handleLogin = async () => {
    try {
      const response = await sessionKit.login();
      setSession(response.session);
    } catch (error) {
      console.error('Login error:', error);
      addToast({
        type: 'error',
        title: 'Login Failed', 
        message: 'Failed to connect wallet. Please try again.'
      });
    }
  };

  const handleLogout = async () => {
    if (session) {
      await sessionKit.logout(session);
      setSession(undefined);
    }
  };

  const navItems: NavItem[] = [
    { icon: Crown, label: 'Farms', id: 'kingdom' },
    { icon: Users, label: 'Guild', id: 'guild' },
    { icon: BarChart3, label: 'Leaderboard', id: 'leaderboard' },
    { icon: Sword, label: 'Battle', id: 'battle' },
    { icon: Trophy, label: 'Rewards', id: 'rewards' }
  ];

  // Use a more resilient tier calculation
  const tierProgress = useTierCalculation(playerStake, selectedPool, gameData.tiers);

  // More robust upgrade check
  const canUpgradeTier = useMemo(() => {
    if (!tierProgress?.currentTier || !selectedPool || !playerStake) return false;
    
    return isTierUpgradeAvailable(
      playerStake.staked_quantity,
      selectedPool.total_staked_quantity,
      tierProgress.currentTier,
      gameData.tiers
    );
  }, [tierProgress, selectedPool, playerStake, gameData.tiers]);

  // Enhanced props with better key tracking for UI components
  const userStatusProps = useMemo(() => ({
    stakedData: playerStake,
    config: gameData.config,
    poolSymbol: selectedPool ? parseTokenString(selectedPool.total_staked_quantity).symbol : '',
    poolQuantity: selectedPool?.total_staked_quantity || '', // Add token quantity for decimals
    tierProgress: tierProgress || undefined,
    isLoading: loading
  }), [playerStake, gameData.config, selectedPool, tierProgress, loading]);

  const renderContent = () => {
    // If processing a transaction, show a loading indicator
    if (isProcessingTransaction) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="loading-spinner" />
          <p className="text-purple-200">Processing transaction...</p>
        </div>
      );
    }

    // If not logged in and not viewing leaderboard, show login prompt
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
              <h2 className="text-lg font-medium mb-4 text-purple-200 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-500" />
                Select Farm
              </h2>
              <Select 
                onValueChange={(value) => {
                  try {
                    const pool = gameData.pools.find(p => p.pool_id === parseInt(value));
                    setSelectedPool(pool);
                  } catch (error) {
                    console.error('Error selecting pool:', error);
                    addToast({
                      type: 'error',
                      title: 'Pool Selection Failed',
                      message: 'Failed to select pool. Please try again.'
                    });
                  }
                }}
                value={selectedPool?.pool_id?.toString()}
              >
                <SelectTrigger className="w-full bg-slate-800/30 border-purple-500/20 text-purple-200 h-12">
                  <SelectValue placeholder="Select Farm" />
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
                            {`${symbol} Farm - Pool #${pool.pool_id}`}
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
<PoolStats 
  key={`pool-${selectedPool.pool_id}-${selectedPool.total_staked_quantity}-${selectedPool.reward_pool.quantity}-${refreshCounter}`}
  poolData={selectedPool}
  userStakedQuantity={playerStake?.staked_quantity}
  userTierWeight={tierProgress?.currentTier?.weight}
  refreshCounter={refreshCounter}
/>

                  {tierProgress && playerStake && (
                    <TierDisplay 
                      key={`tier-${playerStake.tier}-${playerStake.staked_quantity}-${selectedPool.pool_id}-${refreshCounter}`}
                      tierProgress={tierProgress}
                      isUpgradeAvailable={canUpgradeTier}
                      stakedData={playerStake}
                      totalStaked={selectedPool.total_staked_quantity}
                      allTiers={gameData.tiers}
                    />
                  )}

                  {gameData.config && (
                    <UserStatus 
                      key={`user-${playerStake?.tier}-${playerStake?.staked_quantity}-${playerStake?.cooldown_end_at}-${selectedPool.pool_id}-${refreshCounter}`}
                      {...userStatusProps}
                      {...memoizedHandlers}
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

  const BerryFiLogo = () => {
    return (
      <h1 className="flex items-baseline">
        <span className="font-poppins font-black text-lg leading-relaxed py-1 bg-gradient-to-r from-purple-200 to-purple-300 text-transparent bg-clip-text">
          Berry
        </span>
        <span className="font-poppins font-black text-lg leading-relaxed py-1 bg-gradient-to-r from-purple-300 to-purple-400 text-transparent bg-clip-text">
          Fi
        </span>
      </h1>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-slate-900 to-slate-900">
      {/* Header */}
      <div className="relative crystal-bg py-4 border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <BerryFiLogo />
            
            {session ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 p-2 px-4 flex items-center gap-2 group flex-1 sm:flex-initial">
                    <div className="w-2 h-2 rounded-full bg-green-500 group-hover:animate-pulse" />
                    <span className="font-medium text-base text-purple-200">
                      {session.actor.toString()}
                    </span>
                  </div>
                  {playerStake && tierProgress?.currentTier && (
                    <TierBadge 
                      tier={playerStake.tier}
                      showLevel
                      compact
                      className="transition-all shine-effect"
                    />
                  )}
                </div>
                <Button 
                  variant="outline" 
                  className="bg-slate-800/30 border border-slate-700/50 hover:bg-slate-700/50 text-purple-200 text-base w-full sm:w-auto"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="bg-slate-800/30 border border-slate-700/50 hover:bg-slate-700/50 text-purple-200 text-base w-full sm:w-auto"
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
                onClick={() => {
                  if (!isProcessingTransaction) {
                    setActiveTab(item.id);
                  }
                }}
                disabled={isProcessingTransaction}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all",
                  activeTab === item.id 
                    ? "bg-slate-800/50 border border-purple-500/20" 
                    : "hover:bg-slate-800/30",
                  activeTab === item.id 
                    ? "text-purple-200" 
                    : "text-slate-400 hover:text-purple-200",
                  isProcessingTransaction && "opacity-50 cursor-not-allowed"
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
    </div>
  );
};

export default GameUI;