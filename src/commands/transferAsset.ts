import { Context } from 'telegraf';
import { ethers } from 'ethers';
import { getUserWallet } from '../storage';
import { tokens } from '../constants/tokens';
import { chains } from '../constants/chains';
import { decrypt } from '../utils/cryptoUtils';
import { Markup } from 'telegraf';

export interface TransferState {
  ticker: string;
  recipient: string;
  amount: string;
}

export const transferStates: Map<number, TransferState> = new Map();

export const transferAssetKeyboard = Markup.inlineKeyboard(
  Object.keys(tokens).map(ticker => [Markup.button.callback(ticker, `transfer_${ticker}`)])
);

export const confirmTransferKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Confirm', 'confirm_transfer')],
  [Markup.button.callback('Cancel', 'cancel_transfer')]
]);

export const handleTransferAsset = async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('Unable to identify user. Please try again.');
    return;
  }

  const userWallet = getUserWallet(userId);
  if (!userWallet) {
    await ctx.reply('You need to create or import a wallet first.');
    return;
  }

  transferStates.set(userId, { ticker: '', recipient: '', amount: '' });

  await ctx.reply('Please select the asset you want to transfer:', transferAssetKeyboard);
};

export const handleTransferTicker = async (ctx: Context) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('Unable to identify user. Please try again.');
      return;
    }

    const cbQuery = ctx.callbackQuery;
    if (!cbQuery || !('data' in cbQuery)) {
      await ctx.reply('Invalid selection. Please try again.');
      return;
    }

    const ticker = cbQuery.data.split('_')[1];
    const transferState: TransferState = { ticker, recipient: '', amount: '' };
    transferStates.set(userId, transferState);
  };

  export const handleTransferRecipient = async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId || !ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Unable to process request. Please try again.');
      return;
    }

    const recipient = ctx.message.text;
    if (!ethers.isAddress(recipient)) {
      await ctx.reply('Invalid Ethereum address. Please enter a valid address:');
      return;
    }

    const transferState = transferStates.get(userId);
    if (!transferState) {
      await ctx.reply('Transfer process not initiated. Please start over.');
      return;
    }

    transferState.recipient = recipient;
    transferStates.set(userId, transferState);

    await ctx.reply(`Recipient set to ${recipient}. Now, please enter the amount to transfer:`);
  };
export const handleTransferAmount = async (ctx: Context): Promise<TransferState | undefined> => {
  const userId = ctx.from?.id;
  if (!userId || !ctx.message || !('text' in ctx.message)) {
    await ctx.reply('Unable to process request. Please try again.');
    return;
  }

  const amount = ctx.message.text;
  if (isNaN(Number(amount)) || Number(amount) <= 0) {
    await ctx.reply('Invalid amount. Please enter a positive number:');
    return;
  }

  const transferState = transferStates.get(userId);
  if (!transferState) {
    await ctx.reply('Transfer process not initiated. Please start over.');
    return;
  }

  transferState.amount = amount;
  transferStates.set(userId, transferState);

  await ctx.reply(`Please confirm the transfer:
Ticker: ${transferState.ticker}
Recipient: ${transferState.recipient}
Amount: ${transferState.amount}`, confirmTransferKeyboard);

  return transferState;
};


export const handleConfirmTransfer = async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('Unable to identify user. Please try again.');
    return;
  }

  const transferState = transferStates.get(userId);
  const userWallet = getUserWallet(userId);
  if (!transferState || !userWallet) {
    await ctx.reply('Transfer process not initiated or wallet not found. Please start over.');
    return;
  }

  try {
    const token = tokens[transferState.ticker];
    const chain = chains['polygon']; // Assuming Polygon for this example
    const tokenAddress = token.addresses['polygon'];

    if (!tokenAddress || tokenAddress === 'native') {
      await ctx.reply('Token not supported on this chain.');
      return;
    }

    const privateKey = decrypt(userWallet.encryptedPrivateKey);
    const wallet = new ethers.Wallet(privateKey, chain.provider);

    const tokenContract = new ethers.Contract(tokenAddress, [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)'
    ], wallet);

    const decimals = await tokenContract.decimals();
    const amount = ethers.parseUnits(transferState.amount, decimals);

    const tx = await tokenContract.transfer(transferState.recipient, amount);
    await tx.wait();

    await ctx.reply(`Transfer successful!
Transaction hash: ${tx.hash}`);

  } catch (error) {
    console.error('Error during transfer:', error);
    await ctx.reply('An error occurred during the transfer. Please try again later.');
  } finally {
    transferStates.delete(userId);
  }
};

export const handleCancelTransfer = async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (userId) {
    transferStates.delete(userId);
  }
  await ctx.reply('Transfer cancelled. What would you like to do next?');
};