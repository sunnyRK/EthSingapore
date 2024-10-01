import { ethers } from "ethers";

import dotenv from "dotenv";

dotenv.config();

export interface Chain {
  name: string;
  rpcUrl: string;
  provider: ethers.JsonRpcProvider;
  nativeSymbol: string;
}

const createChains = (): Record<string, Chain> => {
  const infuraProjectId = "84cd968624274e52bf521dcf7a8d81a1";
  return {
    base: {
      name: "Base",
      rpcUrl: "https://mainnet.base.org",
      provider: new ethers.JsonRpcProvider("https://mainnet.base.org"),
      nativeSymbol: "ETH",
    },
    polygon: {
      name: "Polygon",
      rpcUrl: `https://polygon-mainnet.infura.io/v3/${infuraProjectId}`,
      provider: new ethers.JsonRpcProvider(
        `https://polygon-mainnet.infura.io/v3/${infuraProjectId}`
      ),
      nativeSymbol: "MATIC",
    },
  };
};

export const chains = createChains();
