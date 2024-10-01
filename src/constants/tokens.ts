export interface Token {
    symbol: string;
    name: string;
    decimals: number;
    addresses: Partial<Record<string, string>>;
  }

  export const tokens: Record<string, Token> = {
    ETH: {
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      addresses: {
        base: 'native',
      },
    },
    MATIC: {
      symbol: 'MATIC',
      name: 'Polygon',
      decimals: 18,
      addresses: {
        polygon: 'native',
      },
    },
    WETH: {
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      decimals: 18,
      addresses: {
        base: '0x4200000000000000000000000000000000000006',
        polygon: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      },
    },
    USDC: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      addresses: {
        base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      },
    },
    USDT: {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      addresses: {
        polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      },
    },
    DAI: {
        symbol: 'DAI',
        name: 'DAI',
        decimals: 18,
        addresses: {
          base: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // Not yet available on Base, using a placeholder
        },
      },
  };