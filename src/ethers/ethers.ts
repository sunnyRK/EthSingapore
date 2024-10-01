import { ethers } from "ethers";

import IERC20 from "../../abis/erc20_2.json";
import { chains } from "../constants/chains";

export const getProvider = async (chainName: any): Promise<ethers.JsonRpcProvider | undefined> => {
    try {
        const newprovider: ethers.JsonRpcProvider = new ethers.JsonRpcProvider(chains[chainName].rpcUrl);
        return newprovider;
    } catch (error) {
        console.error("getProvider-error", error);
        return;
    }
};

export const getContractInstance = async (address: any, abi: any, provider: any): Promise<ethers.Contract | undefined> => {
    try {
        const instance = await new ethers.Contract(address, abi, provider);
        return instance;
    } catch (error) {
        console.error("getContractInstance-error", error);
        return;
    }
};

export async function getErc20Data(token: any, address: any, spender: any, provider: any) {
    try {
        if (!address || !spender) {
            return "Invalid addresses";
        }
        const erc20: any = await getContractInstance(token, IERC20, provider);

        const [name, symbol, decimals, totalSupply, balance, allowance] = await Promise.all([
            erc20.name(),
            erc20.symbol(),
            erc20.decimals(),
            erc20.totalSupply(),
            erc20.balanceOf(address),
            erc20.allowance(address, spender),
        ]);
        return { name, symbol, decimals, totalSupply, balance, allowance };
    } catch (error) {
        console.error("ERC20Data-error", error);
    }
}

export const getErc20Balanceof = async (erc20: ethers.Contract, address: string): Promise<any> => {
    try {
        return await erc20.balanceOf(address);
    } catch (error) {
        console.error("getErc20Balanceof-error", error);
        return;
    }
};

export const getErc20Decimals = async (erc20: any): Promise<number | undefined> => {
    try {
        return await erc20.decimals();
    } catch (error) {
        console.error("getErc20Decimals-error", error);
        return;
    }
};

export const getErc20Allownace = async (erc20: any, from: any, spender: any): Promise<any> => {
    try {
        return await erc20.allowance(from, spender);
    } catch (error) {
        console.error("getErc20Allownace-error", error);
        return;
    }
};
