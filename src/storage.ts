interface UserWallet {
    address: string;
    encryptedPrivateKey: string;
  }

  const userWallets: Map<number, UserWallet> = new Map();

  export const saveUserWallet = (userId: number, wallet: UserWallet) => {
    userWallets.set(userId, wallet);
  };

  export const getUserWallet = (userId: number): UserWallet | undefined => {
    return userWallets.get(userId);
  };