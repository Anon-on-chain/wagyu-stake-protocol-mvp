// src/lib/api.ts
import { PoolEntity } from './types/pool';
import { StakedEntity } from './types/staked';

const API_BASE_URL = 'https://maestrobeatz.servegame.com:3003/kek-staking';

interface APIResponse<T> {
  data: T;
  error?: string;
}

interface PoolsResponse {
  pools: PoolEntity[];
}

interface UserStakingResponse {
  stakingDetails: StakedEntity[];
}

class APIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'APIError';
  }
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new APIError(`API Error: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(error instanceof Error ? error.message : 'Unknown error occurred');
  }
}

export async function fetchPools(): Promise<PoolEntity[]> {
  const response = await fetchAPI<PoolsResponse>('/pools');
  return response.pools;
}

export async function fetchUserStaking(username: string): Promise<StakedEntity[]> {
  if (!username) {
    return [];
  }
  const response = await fetchAPI<UserStakingResponse>(`/user/${username}`);
  return response.stakingDetails;
}

// Add websocket connection for real-time updates if needed
let ws: WebSocket | null = null;

export function connectWebSocket(onMessage: (data: any) => void): void {
  if (ws) {
    ws.close();
  }

  ws = new WebSocket('wss://maestrobeatz.servegame.com:3003/kek-staking/ws');

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('WebSocket message parsing error:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
    // Attempt to reconnect after 5 seconds
    setTimeout(() => connectWebSocket(onMessage), 5000);
  };
}

export function disconnectWebSocket(): void {
  if (ws) {
    ws.close();
    ws = null;
  }
}

// Custom hook for managing stake data
export function useStakingData(username: string | undefined) {
  const [data, setData] = React.useState<{
    pools: PoolEntity[];
    userStakes: StakedEntity[];
  }>({
    pools: [],
    userStakes: []
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const refreshData = React.useCallback(async () => {
    if (!username) return;
    
    setLoading(true);
    try {
      const [pools, userStakes] = await Promise.all([
        fetchPools(),
        fetchUserStaking(username)
      ]);
      
      setData({ pools, userStakes });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [username]);

  React.useEffect(() => {
    refreshData();

    // Set up WebSocket connection
    connectWebSocket((data) => {
      if (data.type === 'pool_update') {
        setData(prev => ({
          ...prev,
          pools: data.pools
        }));
      }
    });

    return () => {
      disconnectWebSocket();
    };
  }, [username]);

  return {
    ...data,
    loading,
    error,
    refresh: refreshData
  };
}
