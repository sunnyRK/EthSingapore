import { Context } from 'telegraf';
import { chains } from '../constants/chains';
import { tokens } from '../constants/tokens';
import { getTokenBalance } from '../utils/tokenBalance';
import { ethers } from 'ethers';

export const handleCheckBalance = async (ctx: Context, address: string) => {
  if (!ethers.isAddress(address)) {
    await ctx.reply('Invalid Ethereum address. Please check and try again.');
    return;
  }

  let response = 'Balance:\n\n';

  try {
    for (const chain of Object.values(chains)) {
      response += `${chain.name}:\n`;

      for (const token of Object.values(tokens)) {
        const balance = await getTokenBalance(chain, token, address);
        response += `${balance}\n`;
      }
      response += '\n';
    }

    await ctx.reply(response);
  } catch (error) {
    console.error('Error checking balance:', error);
    await ctx.reply('An error occurred while checking the balance. Please try again later.');
  }
};