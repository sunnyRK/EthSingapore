import { ethers } from "ethers";
import { chains } from "../constants/chains";
import { getContractInstance, getProvider } from "../ethers/ethers";
import IStarGateRouter from "../../abis/IStarGateRouter.json";

// ERC20 ABI for the approve function
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
];

interface ApproveParams {
  tokenAddress: string;
  spender: string;
  amount: any;
  chainName: string;
  wallet: ethers.Wallet;
}

interface ApproveCalldataParams {
  tokenAddress: string;
  spender: string;
  amount: any;
}

export async function generateApproveCalldata({
  tokenAddress,
  spender,
  amount,
}: ApproveCalldataParams): Promise<string> {
  // Create a contract instance (we don't need a signer for this)
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    ethers.getDefaultProvider()
  );

  // Generate the calldata
  const calldata = tokenContract.interface.encodeFunctionData("approve", [
    spender,
    BigInt(1e8),
  ]);

  return calldata;
}

export async function generateTransferCalldata(from: string, to: string, amount: any) {
  const erc20Interface = new ethers.Interface([
    "function transfer(address sender, uint256 amount) public returns (bool)"
  ]);
  console.log("[to, amount]", [to, amount])

  return erc20Interface.encodeFunctionData("transfer", [to, amount]);
}

export async function generateTransferFromCalldata(from: string, to: string, amount: any) {
  const erc20Interface = new ethers.Interface([
    "function transferFrom(address sender, address recipient, uint256 amount) public returns (bool)"
  ]);
  console.log("[from, to, amount]", [from, to, amount])

  return erc20Interface.encodeFunctionData("transferFrom", [from, to, amount]);
}


export async function approve({
  tokenAddress,
  spender,
  amount,
  chainName,
  wallet,
}: ApproveParams): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(chains[chainName].rpcUrl);
    const connectedWallet = wallet.connect(provider);

    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      connectedWallet
    );

    // Check current allowance
    const currentAllowance = await tokenContract.allowance(
      wallet.address,
      spender
    );

    // If current allowance is less than the required amount, send an approve transaction
    if (currentAllowance.lt(amount)) {
      console.log(`Approving ${spender} to spend ${amount} tokens...`);
      const approveTx = await tokenContract.approve(spender, amount);
      const receipt = await approveTx.wait();

      console.log(
        `Approval transaction confirmed. Hash: ${receipt.transactionHash}`
      );
      return true;
    } else {
      console.log("Sufficient allowance already exists.");
      return true;
    }
  } catch (error) {
    console.error("Error in approve function:", error);
    return false;
  }
}

// Function to generate deposit (supply) calldata
export function generateDepositCalldata(
  assetAddress: any,
  amount: any,
  onBehalfOf: any,
  referralCode = 0
) {
  // ABIs for Aave V3 supply (deposit) and withdraw functions
  const depositAbi =
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)";
  const iface = new ethers.Interface([depositAbi]);
  console.log("supply", [
    assetAddress,
    ethers.parseUnits(amount.toString(), 6), // Assuming 18 decimals, adjust if needed
    onBehalfOf,
    referralCode,
  ])
  const calldata = iface.encodeFunctionData("supply", [
    assetAddress,
    ethers.parseUnits(amount.toString(), 6), // Assuming 18 decimals, adjust if needed
    onBehalfOf,
    referralCode,
  ]);
  return calldata;
}
// Function to generate withdraw calldata
export function generateWithdrawCalldata(
  assetAddress: any,
  amount: any,
  toAddress: any
) {
  const withdrawAbi =
    "function withdraw(address asset, uint256 amount, address to)";
  const iface = new ethers.Interface([withdrawAbi]);
  console.log("Withdraw: ", [
    assetAddress,
    ethers.parseUnits(amount.toString(), 6), // Assuming 18 decimals, adjust if needed
    toAddress,
  ])
  const calldata = iface.encodeFunctionData("withdraw", [
    assetAddress,
    ethers.parseUnits(amount.toString(), 6), // Assuming 18 decimals, adjust if needed
    toAddress,
  ]);
  return calldata;
}

export async function generateBridgeCalldata(
  tokenOut: any,
  amount: any,
  user: any,
  contractAddress: any,
  extraOrShareToken: any,
  depositData: any
) {
  const ADDRESS_ZERO =
    "0x0000000000000000000000000000000000000000";
  const BYTES_ZERO =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const ZERO_ADDRESS = ADDRESS_ZERO;
  const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
  const abi = new ethers.AbiCoder();

  let data = abi.encode(
    [
      "bool",
      "address",
      "bytes",
      "uint256",
      "uint256",
      "address",
      "address",
      "address",
      "bytes",
    ],
    [
      false, // isSwap on to side
      tokenOut, // dai polygon
      BYTES_ZERO, // Swap Call data if swap on to side
      BigInt("0"),
      amount, //swapData?.amountOutprice,
      contractAddress, // contractAddress
      user,
      extraOrShareToken, // extraOrShareToken,
      depositData,
    ]
  );

  // console.log(data)


  const provider = await getProvider("polygon");
  const stargateRouter = await getContractInstance(
    "0xeCc19E177d24551aA7ed6Bc6FE566eCa726CC8a9",
    IStarGateRouter,
    provider
  );
  if (!stargateRouter) return;

  const lzParams = {
    dstGasForCall: BigInt("800000"),
    dstNativeAmount: 0,
    dstNativeAddr: "0x",
  };

  const _functionType = 1;

  //   const packedToAddress = ethers..solidityPack(["address"], [toChainPing]);
  const packedToAddress =
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    ["0x77a90ebb0C950cACe0fD4ce5274efac305C9a7e4"]
  ); // ChainPing
  // console.log("packedToAddress", packedToAddress)
  let quoteData = await stargateRouter.quoteLayerZeroFee(
    "184",
    _functionType,
    "0x77a90ebb0C950cACe0fD4ce5274efac305C9a7e4",
    data,
    lzParams
  );
  console.log("quoteData", quoteData)

  let stargateTx = await stargateRouter.swap.populateTransaction(
    "184",
    1,
    1,
    user,
    amount,
    0,
    lzParams,
    "0x77a90ebb0C950cACe0fD4ce5274efac305C9a7e4",
    data,
    { value: ethers.parseEther("1") }
  );
  console.log("stargateTx", stargateTx)

  // const provider1 = new ethers.JsonRpcProvider(
  //   "https://polygon-mainnet.infura.io/v3/84cd968624274e52bf521dcf7a8d81a1"
  // );
  // const decryptedPrivateKey = decrypt(userWallet?.encryptedPrivateKey);
  // const wallet = new ethers.Wallet("", provider);
  // const transaction = await wallet.sendTransaction(stargateTx);
  // const tx = await transaction.wait();
  // console.log("tx: ", tx)

  if (!stargateTx?.value) return;
  return {
    to: stargateTx.to?.toString(),
    data: stargateTx.data?.toString(),
    value: ethers.parseEther("1")
    // value: BigInt(stargateTx.value?.toString()),
  };
}
