import { ethers } from 'ethers';
import { encrypt, decrypt } from './cryptoUtils';

export const createWallet = (): { address: string; encryptedPrivateKey: string } => {
  try {
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    return { address: wallet.address, encryptedPrivateKey };
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw new Error('Failed to create wallet');
  }
};

export const importWallet = (encryptedPrivateKey: string): ethers.Wallet => {
  try {
    const privateKey = decrypt(encryptedPrivateKey);
    return new ethers.Wallet(privateKey);
  } catch (error) {
    console.error('Error importing wallet:', error);
    throw new Error('Failed to import wallet');
  }
};