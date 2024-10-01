import { Context } from "telegraf";
import { createWallet } from "../utils/wallet";
import { decrypt } from "../utils/cryptoUtils";
import { ethers } from "ethers";
import { saveUserWallet } from "../storage";

export const handleCreateWallet = async (ctx: Context) => {
  try {
    const { address, encryptedPrivateKey } = createWallet();

    const decryptedPrivateKey = decrypt(encryptedPrivateKey);
    const wallet = new ethers.Wallet(decryptedPrivateKey);
    const privateKeyHint = `${decryptedPrivateKey.slice(
      0,
      4
    )}...${decryptedPrivateKey.slice(-4)}`;

    // Save the wallet information
    const userId = ctx.from?.id;
    if (userId) {
      saveUserWallet(userId, { address, encryptedPrivateKey });
    }

    await ctx.reply(`New wallet created:

Address: ${wallet.address}
Private Key Hint: ${privateKeyHint}
Encrypted Private Key: ${decryptedPrivateKey}

IMPORTANT:
1. Never share your full private key with anyone.
2. Store the encrypted private key securely.
3. You'll need the encrypted private key to import your wallet later.`);
  } catch (error) {
    console.error("Error in handleCreateWallet:", error);
    await ctx.reply(
      "An error occurred while creating the wallet. Please try again later."
    );
  }
};
