import { ethers } from 'ethers';
import { Chain } from '../constants/chains';
import { Token } from '../constants/tokens';

const erc20Abi = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export const getTokenBalance = async (
  chain: Chain,
  token: Token,
  address: string
): Promise<string> => {
  try {
    const tokenAddress = token.addresses[chain.name.toLowerCase()];

    if (!tokenAddress) {
      return 'Not available on this chain';
    }

    if (tokenAddress === 'native') {
      const balance = await chain.provider.getBalance(address);
      return `${ethers.formatUnits(balance, token.decimals)} ${chain.nativeSymbol}`;
    } else {
      const contract = new ethers.Contract(tokenAddress, erc20Abi, chain.provider);
      const balance = await contract.balanceOf(address);
      return `${ethers.formatUnits(balance, token.decimals)} ${token.symbol}`;
    }
  } catch (error) {
    console.error(`Error fetching ${token.symbol} balance on ${chain.name}:`, error);
    return 'Error';
  }
};