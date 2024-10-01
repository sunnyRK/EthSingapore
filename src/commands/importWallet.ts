import { Context } from 'telegraf';
import { ethers } from 'ethers';
import { encrypt } from '../utils/cryptoUtils';
import { saveUserWallet } from '../storage';

export const handleImportWallet = async (ctx: Context, privateKey: string) => {
  try {
    // Validate the private key
    if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
      throw new Error('Invalid private key format');
    }

    const wallet = new ethers.Wallet(privateKey);
    const encryptedPrivateKey = encrypt(privateKey);

    // Save the wallet information
    const userId = ctx.from?.id;
    if (userId) {
      saveUserWallet(userId, { address: wallet.address, encryptedPrivateKey });
    }

    await ctx.reply(`Wallet imported successfully:

Address: ${wallet.address}

IMPORTANT:
1. Never share your private key with anyone.
2. We have encrypted and stored your private key securely.
3. You can use this wallet for future transactions.`);
  } catch (error) {
    console.error('Error importing wallet:', error);
    await ctx.reply('Invalid private key. Please check and try again.');
  }
};