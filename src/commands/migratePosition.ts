import { Context } from "telegraf";
import { ethers } from "ethers";
import { chains } from "../constants/chains";
import {
  generateWithdrawCalldata,
  generateApproveCalldata,
  generateBridgeCalldata,
  generateDepositCalldata,
  generateTransferFromCalldata,
} from "../actions/calldataGenerators";
import { decrypt } from "../utils/cryptoUtils";

// Multicall contract details
const MULTICALL_ABI = [
  "function multicall(tuple(address target, bytes callData, uint256 value)[] calls) payable",
];
const MULTICALL_ADDRESS = "0x5175963c90714a8d28669edd1b96d054b42cb2e8"
//  "0xD6F3459d99F73df0296C39659501134f64a44801";
// "0x5175963c90714a8d28669edd1b96d054b42cb2e8"; // Replace with your deployed contract address

const AUSDC_ADDRESS = "0x625E7708f30cA75bfd92586e17077590C60eb4cD";

async function checkAllowanceAndBalance(
  userAddress: string,
  amount: string,
  provider: ethers.Provider
) {
  const erc20Interface = new ethers.Interface([
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
  ]);

  const aUsdcContract = new ethers.Contract(
    AUSDC_ADDRESS,
    erc20Interface,
    provider
  );

  const allowance = await aUsdcContract.allowance(
    userAddress,
    MULTICALL_ADDRESS
  );
  const balance = await aUsdcContract.balanceOf(userAddress);

  const amountBigInt = ethers.parseUnits(amount, 6); // Assuming aUSDC has 6 decimals

  if (allowance < amountBigInt) {
    throw new Error(
      `Insufficient allowance. Current: ${ethers.formatUnits(
        allowance,
        6
      )}, Required: ${amount}`
    );
  }

  if (balance < amountBigInt) {
    throw new Error(
      `Insufficient balance. Current: ${ethers.formatUnits(
        balance,
        6
      )}, Required: ${amount}`
    );
  }
}

export interface MigrationState {
  fromNetwork: string;
  toNetwork: string;
  protocol: string;
  token: string;
  amount: string;
}

export const migrationStates = new Map<number, Partial<MigrationState>>();

async function generateApprovalTransaction(userAddress: string, amount: any) {
  const erc20Interface = new ethers.Interface([
    "function approve(address spender, uint256 amount) public returns (bool)",
  ]);

  return {
    to: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
    data: erc20Interface.encodeFunctionData("approve", [
      MULTICALL_ADDRESS,
      amount,
    ]),
    value: "0",
  };
}

export async function handleMigratePosition(
  ctx: Context,
  migrationState: MigrationState,
  userWallet: any
) {
  try {
    const provider = new ethers.JsonRpcProvider(
      "https://polygon-mainnet.infura.io/v3/84cd968624274e52bf521dcf7a8d81a1"
    );

    // // // // Step 1: Generate and send approval transaction
    const approvalTx = await generateApprovalTransaction(
      userWallet.address,
      ethers.parseUnits(migrationState.amount.toString(), 6)
    );
    await ctx.reply(
      "Sending approval transaction. Please confirm in your wallet..."
    );
    const approvalReceipt = await sendTransaction(userWallet, approvalTx);
    await ctx.reply(
      `Approval transaction confirmed. Hash: ${approvalReceipt?.hash}`
    );

    await checkAllowanceAndBalance(
      userWallet.address,
      migrationState.amount,
      provider
    );

    // Step 2: Generate migration calldata and execute multicall
    const calldataArray = await generateMigrationCalldata(
      migrationState,
      userWallet.address
    );
    await ctx.reply(
      "Migration calldata generated. Preparing to execute the multicall transaction..."
    );
    const multicallReceipt = await executeMulticall(
      ctx,
      calldataArray,
      userWallet
    );
  //   await ctx.reply(
  //     `Multicall transaction confirmed! Hash: ${multicallReceipt.hash}`
  //   );
  // } catch (error) {
  //   console.error("Error in migration process:", error);
  //   await ctx.reply(
  //     "An error occurred during the migration process. Please try again."
  //   );
  } finally {
    const userId = ctx.from?.id;
    if (userId) {
      migrationStates.delete(userId);
    }
  }
}

async function sendTransaction(userWallet: any, tx: any) {
  const provider = new ethers.JsonRpcProvider(
    "https://polygon-mainnet.infura.io/v3/84cd968624274e52bf521dcf7a8d81a1"
  );
  const decryptedPrivateKey = decrypt(userWallet?.encryptedPrivateKey);
  const wallet = new ethers.Wallet(decryptedPrivateKey, provider);
  const transaction = await wallet.sendTransaction(tx);
  return await transaction.wait();
}

async function generateMigrationCalldata(
  migrationState: MigrationState,
  userAddress: string
) {
  const calldataArray = [];

  // 2. Generate transferFrom calldata to move aUSDC to multicall contract
  const transferFromCalldata = await generateTransferFromCalldata(
    userAddress,
    MULTICALL_ADDRESS,
    ethers.parseUnits(migrationState.amount.toString(), 6)
  );
  calldataArray.push({
    to: "0x625E7708f30cA75bfd92586e17077590C60eb4cD",
    data: transferFromCalldata,
    value: "0",
  });

  // 1. Generate withdraw calldata
  const withdrawCalldata = generateWithdrawCalldata(
    migrationState.token,
    migrationState.amount,
    MULTICALL_ADDRESS
  );
  calldataArray.push({
    to: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    data: withdrawCalldata,
    value: "0",
  });

  // 2. Generate approve calldata for Stargate Router
  const stargateRouterAddress = "0xeCc19E177d24551aA7ed6Bc6FE566eCa726CC8a9"; // Polygon Stargate Router
  const approveCalldata = await generateApproveCalldata({
    tokenAddress: migrationState.token,
    spender: stargateRouterAddress,
    amount: ethers.parseUnits(migrationState.amount.toString(), 7),
  });
  calldataArray.push({
    to: migrationState.token,
    data: approveCalldata,
    value: "0",
  });

  // 3. Generate deposit calldata for the destination chain
  const depositCalldata = generateDepositCalldata(
    // migrationState.token,
    "0x4c80e24119cfb836cdf0a6b53dc23f04f7e652ca",
    migrationState.amount,
    userAddress
  );

  // 4. Generate bridge calldata
  const bridgeCalldata = await generateBridgeCalldata(
    migrationState.token,
    ethers.parseUnits(migrationState.amount, 6), // Assuming 18 decimals, adjust if needed
    userAddress,
    "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    ethers.ZeroAddress,
    depositCalldata
  );

  if (bridgeCalldata) {
    calldataArray.push(bridgeCalldata);
  } else {
    throw new Error("Failed to generate bridge calldata");
  }
  // console.log("calldataArray: ", calldataArray);

  return calldataArray;
}

async function executeMulticall(
  ctx: Context,
  calldataArray: any[],
  userWallet: any
): Promise<ethers.TransactionReceipt | any> {
  const provider = new ethers.JsonRpcProvider(
    "https://polygon-mainnet.infura.io/v3/84cd968624274e52bf521dcf7a8d81a1"
  );
  const decryptedPrivateKey = decrypt(userWallet.encryptedPrivateKey);
  const wallet = new ethers.Wallet(decryptedPrivateKey, provider);

  const multicallAbi = [
    "function multicall(tuple(address target, bytes callData, uint256 value)[] memory calls) payable returns (bytes[] memory results)",
  ];

  const multicallAndSwapAbi = [
    "function multicallAndSwap(tuple(address target, bytes callData, uint256 value)[] memory calls, uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, tuple(uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable",
  ];

  const multicallContract = new ethers.Contract(
    MULTICALL_ADDRESS,
    multicallAbi,
    wallet
  );
  // console.log("calldataArray: ", calldataArray)

  // Prepare the calls array for the multicall function
  const calls = calldataArray.map((call) => ({
    target: call.to,
    callData: call.data,
    value: ethers.parseEther(call.value.toString()),
  }));
  console.log("calls: ", calls);

  const lzParams = {
    dstGasForCall: BigInt("800000"),
    dstNativeAmount: 0,
    dstNativeAddr: "0x",
  };
  const data =
    "0x9fbf10fc00000000000000000000000000000000000000000000000000000000000000b8000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000008acf3088e8922e9ec462b1d592b5e6aa63b8d2d500000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000001a000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000000c3500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001477a90ebb0c950cace0fd4ce5274efac305c9a7e4000000000000000000000000000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002791bca1f2de4661ed88a30c99a7a9449aa841740000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e8000000000000000000000000a238dd80c259a72e81d7e4664a9801593f98d1c50000000000000000000000008acf3088e8922e9ec462b1d592b5e6aa63b8d2d500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000084617ba0370000000000000000000000004c80e24119cfb836cdf0a6b53dc23f04f7e652ca00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000008acf3088e8922e9ec462b1d592b5e6aa63b8d2d5000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  // Estimate gas for the multicall transaction
  // const gasEstimate = await multicallContract.multicallAndSwap.estimateGas(
  //   calls,
  //   184, 1, 1, "0x8Acf3088E8922e9Ec462B1D592B5e6aa63B8d2D5", BigInt(1000), lzParams, "0x77a90ebb0C950cACe0fD4ce5274efac305C9a7e4", data,
  //   {
  //   value: ethers.parseEther("1"),
  //   }
  // );

  const _to = ethers.hexlify(ethers.toUtf8Bytes("0x77a90ebb0C950cACe0fD4ce5274efac305C9a7e4"));

  // Execute the multicall transaction
  const tx = await multicallContract.multicall.populateTransaction(
    // calls,
    // 184,
    // 1,
    // 1,
    // "0x8Acf3088E8922e9Ec462B1D592B5e6aa63B8d2D5",
    // BigInt(1000),
    // lzParams,
    // _to,
    // calls[3].callData,
    // {
    //   value: BigInt("1000000000000000000"),
    // }
    calls, {
    // gasLimit: (gasEstimate * BigInt(1200)) / BigInt(100), // Add 20% buffer to gas estimate
    value: ethers.parseEther("1"), // Adjust if you need to send ETH with the transaction
    }
  );
  console.log("data++ ", tx)

  // await ctx.reply("Multicall transaction sent. Waiting for confirmation...");

  // return await tx.wait();
}

// async function executeMulticall(ctx: Context, calldataArray: any[], userWallet: any) {
//   try {
//     const provider = new ethers.JsonRpcProvider("https://polygon-mainnet.infura.io/v3/84cd968624274e52bf521dcf7a8d81a1");
//     console.log("provider: ", provider, userWallet)
//     const decryptedPrivateKey = decrypt(userWallet.encryptedPrivateKey);
//     console.log("decryptedPrivateKey: ", decryptedPrivateKey)
//     const wallet = new ethers.Wallet(decryptedPrivateKey, provider);
//     console.log("wallet: ", wallet)

//     const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, wallet);
//     console.log("multicallContract: ", multicallContract)

//     // Prepare the calls array for the multicall function
//     const calls = calldataArray.map(call => ({
//       target: call.to,
//       callData: call.data,
//       value: ethers.parseEther(call.value.toString())
//     }));

//     // Estimate gas for the multicall transaction
//     const gasEstimate = await multicallContract.multicall.estimateGas(calls, { value: ethers.parseEther("0") });

//     // Execute the multicall transaction
//     const tx = await multicallContract.multicall(calls, {
//       gasLimit: gasEstimate * BigInt(120) / BigInt(100), // Add 20% buffer to gas estimate
//       value: ethers.parseEther("0") // Adjust if you need to send ETH with the transaction
//     });

//     await ctx.reply("Transaction sent. Waiting for confirmation...");

//     const receipt = await tx.wait();

//     await ctx.reply(`Transaction confirmed! Hash: ${receipt.hash}`);
//   } catch (error) {
//     console.error("Error executing multicall:", error);
//     await ctx.reply("An error occurred while executing the transaction. Please try again.");
//   }
// }

// import { ethers } from "ethers";
// import { chains } from "../constants/chains";
// import { getContractInstance, getProvider } from "../ethers/ethers";
// import {
//   generateWithdrawCalldata,
//   generateApproveCalldata,
//   generateBridgeCalldata,
//   generateDepositCalldata,
// } from "./calldataGenerators";

// interface MigratePositionParams {
//   fromNetwork: string;
//   toNetwork: string;
//   protocol: string;
//   token: string;
//   amount: string;
//   userAddress: string;
// }

// async function migratePosition({
//   fromNetwork,
//   toNetwork,
//   protocol,
//   token,
//   amount,
//   userAddress,
// }: MigratePositionParams) {
//   const calldataArray = [];

//   // 1. Generate withdraw calldata
//   const withdrawCalldata = generateWithdrawCalldata(token, amount, userAddress);
//   calldataArray.push({
//     to: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // polygon aave v3
//     data: withdrawCalldata,
//     value: "0",
//   });

//   // 2. Generate approve calldata for Stargate Router
//   const stargateRouterAddress = "0xeCc19E177d24551aA7ed6Bc6FE566eCa726CC8a9"; // Polygon Stargate Router
//   const approveCalldata = await generateApproveCalldata({
//     tokenAddress: token,
//     spender: stargateRouterAddress,
//     amount,
//   });
//   calldataArray.push({
//     to: token,
//     data: approveCalldata,
//     value: "0",
//   });

//   // 3. Generate deposit calldata for the destination chain
//   const depositCalldata = generateDepositCalldata(token, amount, userAddress);

//   // 4. Generate bridge calldata
//   const bridgeCalldata = await generateBridgeCalldata(
//     token,
//     ethers.parseUnits(amount, 6), // Assuming 18 decimals, adjust if needed
//     userAddress,
//     "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // base aave v3
//     ethers.ZeroAddress,
//     depositCalldata
//   );

//   if (bridgeCalldata) {
//     calldataArray.push(bridgeCalldata);
//   } else {
//     throw new Error("Failed to generate bridge calldata");
//   }

//   return calldataArray;
// }

// // Example usage in a Telegram bot context
// async function handleMigratePosition(ctx: any) {
//   // Assuming you've already collected user inputs
//   const userInputs = {
//     fromNetwork: "polygon",
//     toNetwork: "base",
//     protocol: "aave",
//     token: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
//     amount: "0.01", // Amount in USDC
//     userAddress: "0x8Acf3088E8922e9Ec462B1D592B5e6aa63B8d2D5", // User's wallet address
//   };

//   try {
//     // ABI for the Multicall contract
//     const MULTICALL_ABI = [
//       "function multicall(tuple(address target, bytes callData, uint256 value)[] calls) payable",
//     ];

//     // Address of the deployed Multicall contract
//     const MULTICALL_ADDRESS = "0x8C14558a1d4866BdaA2b88215c22A6Be38DA99e1"; // Replace with your deployed contract address

//     const calldataArray = await migratePosition(userInputs);

//     // Here you would typically send this calldata array to your multicall contract
//     console.log("Calldata array for migration:", calldataArray);

//     // Assuming you have a way to get the user's private key securely
//     const privateKey = await getPrivateKey(userAddress);
//     const provider = new ethers.JsonRpcProvider(chains.polygon.rpcUrl);
//     const wallet = new ethers.Wallet(privateKey, provider);

//     const multicallContract = new ethers.Contract(
//       MULTICALL_ADDRESS,
//       MULTICALL_ABI,
//       wallet
//     );

//     // Prepare the calls array for the multicall function
//     const calls = calldataArray.map((call) => ({
//       target: call.to,
//       callData: call.data,
//       value: ethers.parseEther(call.value.toString()),
//     }));

//     // Estimate gas for the multicall transaction
//     const gasEstimate = await multicallContract.multicall.estimateGas(calls, {
//       value: ethers.parseEther("0"),
//     });

//     // Execute the multicall transaction
//     const tx = await multicallContract.multicall(calls, {
//       gasLimit: (gasEstimate * BigInt(120)) / BigInt(100), // Add 20% buffer to gas estimate
//       value: ethers.parseEther("0"), // Adjust if you need to send ETH with the transaction
//     });

//     await ctx.reply("Transaction sent. Waiting for confirmation...");

//     const receipt = await tx.wait();

//     await ctx.reply(`Transaction confirmed! Hash: ${receipt.hash}`);
//     // ctx.reply("Migration calldata generated successfully. Ready to execute the transaction.");
//   } catch (error) {
//     console.error("Error generating migration calldata:", error);
//     ctx.reply(
//       "An error occurred while preparing the migration. Please try again."
//     );
//   }
// }
