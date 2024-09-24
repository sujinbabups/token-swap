import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract, parseUnits, formatUnits } from 'ethers';
import abi from '../scdata/Swap.json'
import deployedAddress from '../scdata/deployed_addresses.json'

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const SWAP_CONTRACT_ABI = abi.abi;
const SWAP_CONTRACT_ADDRESS = deployedAddress.SwapModuleTokenSwap;

const Swap = () => {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('');
  const [exchangeRate, setExchangeRate] = useState('0');
  const [newExchangeRate, setNewExchangeRate] = useState('');

  const [tokenDecimals, setTokenDecimals] = useState({});

  const debugContractCall = async (contract, methodName, ...args) => {
    try {
      const result = await contract[methodName](...args);
      console.log(`${methodName} successful:`, result);
      return result;
    } catch (error) {
      console.error(`${methodName} failed:`, error);
      throw error;
    }
  };

  const tokens = {
    GT: "0x7873a7923350E60eFF9cE2673C2b713C992Db3E1",
    ET: "0x3BCe90B2d61432351321acAb9777f17E6f11e720",
    NewToken: "0xf8e81D47203A594245E36C48e151709F0C19fBe8"
  };
  const DEFAULT_DECIMALS = {
    GT: 18,
    ET: 18,
    NewToken: 18
  };

  useEffect(() => {
    if (window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      setProvider(provider);
    }
  }, []);

  const connectWallet = async () => {
    if (provider) {
      try {
        const accounts = await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        setSigner(signer);
        setAccount(accounts[0]);
        console.log("Address:", accounts);
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      }
    }
  };

  const checkAllowance = async (tokenAddress, amount) => {
    if (!signer || !account) return false;
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
    const allowance = await tokenContract.allowance(account, SWAP_CONTRACT_ADDRESS);
    console.log(`Allowance for ${tokenAddress}: ${formatUnits(allowance, 18)}`);
    return BigInt(allowance) >= BigInt(parseUnits(amount, 18));
  };

  const checkBalance = async (tokenAddress, amount) => {
    if (!signer || !account) return false;
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
    const balance = await tokenContract.balanceOf(account);
    console.log(`Balance for ${tokenAddress}: ${formatUnits(balance, 18)}`);
    return BigInt(balance) >= BigInt(parseUnits(amount, 18));
  };

  const getTokenDecimals = async (tokenAddress, tokenSymbol) => {
    if (!signer) return DEFAULT_DECIMALS[tokenSymbol] || 18;
    
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
    try {
      if (typeof tokenContract.decimals === 'function') {
        const decimals = await tokenContract.decimals();
        return decimals;
      } else {
        console.log(`Decimals function not available for ${tokenSymbol}. Using default.`);
        return DEFAULT_DECIMALS[tokenSymbol] || 18;
      }
    } catch (error) {
      console.error("Error fetching token decimals:", error);
      return DEFAULT_DECIMALS[tokenSymbol] || 18;
    }
  };

  const handleFromTokenChange = async (e) => {
    const selectedToken = e.target.value;
    setFromToken(selectedToken);
    if (signer && tokens[selectedToken]) {
      const tokenContract = new Contract(tokens[selectedToken], ERC20_ABI, signer);
      const balance = await tokenContract.balanceOf(account);
      const decimals = await getTokenDecimals(tokens[selectedToken], selectedToken);
      setTokenDecimals(prev => ({ ...prev, [selectedToken]: decimals }));
      setBalance(formatUnits(balance, decimals));
    }
    if (toToken) {
      updateExchangeRate(selectedToken, toToken);
    }
  };


  const handleToTokenChange = (e) => {
    const selectedToken = e.target.value;
    setToToken(selectedToken);
    if (fromToken) {
      updateExchangeRate(fromToken, selectedToken);
    }
  };

  const updateExchangeRate = async (from, to) => {
    if (signer && tokens[from] && tokens[to]) {
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI, signer);
      try {
        const rate = await swapContract.getExchangeRate(tokens[from], tokens[to]);
        const formattedRate = formatUnits(rate, 18);
        console.log("Raw rate:", rate.toString());
        console.log("Formatted rate:", formattedRate);
        setExchangeRate(formattedRate);
      } catch (error) {
        console.error("Failed to fetch exchange rate:", error);
        setExchangeRate('0');
      }
    }
  };

  const handleSetExchangeRate = async () => {
    if (!signer || !fromToken || !toToken || !newExchangeRate) {
      alert("Please connect wallet, select tokens, and enter a new rate");
      return;
    }

    try {
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI, signer);
      const tx = await swapContract.setExchangeRate(
        tokens[fromToken],
        tokens[toToken],
        parseUnits(newExchangeRate, 18)
      );
      await tx.wait();
      alert("Exchange rate set successfully!");
      updateExchangeRate(fromToken, toToken);
    } catch (error) {
      console.error("Failed to set exchange rate:", error);
      alert("Failed to set exchange rate. Check console for details.");
    }
  };

  const approveToken = async (tokenAddress, amount) => {
    if (!signer) {
      alert("Please connect your wallet first.");
      return;
    }
    
    try {
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, signer);
      const decimals = tokenDecimals[fromToken] || await getTokenDecimals(tokenAddress, fromToken);
      const approvalAmount = parseUnits(amount, decimals);
      
      console.log(`Approving ${amount} tokens...`);
      const approvalTx = await tokenContract.approve(SWAP_CONTRACT_ADDRESS, approvalAmount);
      await approvalTx.wait();
      
      console.log("Approval successful!");
      alert("Token approval successful. You can now proceed with the swap.");
    } catch (error) {
      console.error("Approval failed:", error);
      alert("Token approval failed. Please try again.");
    }
  };
  const handleSwap = async () => {
    if (!signer || !fromToken || !toToken || !amount) return;

    try {
      const fromTokenAddress = tokens[fromToken];
      const toTokenAddress = tokens[toToken];
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI, signer);

      const fromDecimals = tokenDecimals[fromToken] || await getTokenDecimals(fromTokenAddress, fromToken);
      const toDecimals = tokenDecimals[toToken] || await getTokenDecimals(toTokenAddress, toToken);

      // Check exchange rate
      const rate = await swapContract.getExchangeRate(fromTokenAddress, toTokenAddress);
      console.log(`Exchange rate: ${formatUnits(rate, 18)}`);
      if (rate.toString() === '0') {
        alert("Exchange rate not set. Please set the rate before swapping.");
        return;
      }

      // Check allowance
      const hasAllowance = await checkAllowance(fromTokenAddress, amount);
      if (!hasAllowance) {
        const userConfirmed = window.confirm("Insufficient allowance. Do you want to approve the contract to spend your tokens?");
        if (userConfirmed) {
          await approveToken(fromTokenAddress, amount);
        } else {
          return;
        }
      }

      // Check balance
      const hasBalance = await checkBalance(fromTokenAddress, amount);
      if (!hasBalance) {
        alert("Insufficient balance. Please check your token balance.");
        return;
      }

      // Convert amount to wei
      const amountInWei = parseUnits(amount, fromDecimals);

      // Estimate gas
      const gasEstimate = await swapContract.swap.estimateGas(fromTokenAddress, toTokenAddress, amountInWei);
      console.log(`Estimated gas: ${gasEstimate.toString()}`);

      // Perform swap
      const swapTx = await swapContract.swap(fromTokenAddress, toTokenAddress, amountInWei, {
        gasLimit: gasEstimate * BigInt(12) / BigInt(10) // Add 20% buffer to gas estimate
      });
      await swapTx.wait();

      alert("Swap successful!");
      updateExchangeRate(fromToken, toToken);
    } catch (error) {
      console.error("Swap failed:", error);
      if (error.reason) {
        alert(`Swap failed: ${error.reason}`);
      } else if (error.data && error.data.message) {
        alert(`Swap failed: ${error.data.message}`);
      } else {
        alert("Swap failed. Check console for details.");
      }
    }
  };



  return (
    <div className="bg-gradient-to-r from-gray-500 to-blue-900 text-yellow-300 min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-blue-800 rounded-lg shadow-lg border-2 border-yellow-500">
        <h2 className="text-3xl font-bold text-center mb-6 text-yellow-300">Swap Your Tokens</h2>

        <div className="mb-6">
          <button onClick={connectWallet} className="w-full bg-blue-600 hover:bg-blue-500 text-lg py-2 rounded-lg font-semibold text-yellow-300 transition duration-300">
            {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : "Connect to MetaMask"}
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-base font-bold mb-2 text-yellow-400">From Token</label>
          <select 
            onChange={handleFromTokenChange}
            className="w-full bg-blue-700 text-yellow-300 p-3 rounded-lg border border-yellow-500 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Select Token</option>
            <option value="GT">GT</option>
            <option value="ET">ET</option>
            <option value="NewToken">NewToken</option>
          </select>
          {balance && <p className="mt-2">Balance: {balance} {fromToken}</p>}
        </div>

        <div className="mb-6">
          <label className="block text-base font-bold mb-2 text-yellow-400">To Token</label>
          <select 
            onChange={handleToTokenChange}
            className="w-full bg-blue-700 text-yellow-300 p-3 rounded-lg border border-yellow-500 focus:outline-none appearance-none cursor-pointer"
          >
            <option value="">Select Token</option>
            <option value="GT">GT</option>
            <option value="ET">ET</option>
            <option value="NewToken">NewToken</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-base font-bold mb-2 text-yellow-400">Amount to Swap</label>
          <input
            type="number"
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-blue-700 text-yellow-300 p-3 rounded-lg border border-yellow-500 focus:outline-none"
            placeholder="Enter amount to swap"
          />
        </div>

        {fromToken && toToken && (
          <div className="mb-6 text-center">
            <p>Current Exchange Rate: 1 {fromToken} = {parseFloat(exchangeRate).toFixed(6)} {toToken}</p>
            <input
              type="number"
              value={newExchangeRate}
              onChange={(e) => setNewExchangeRate(e.target.value)}
              className="w-full bg-blue-700 text-yellow-300 p-3 rounded-lg border border-yellow-500 focus:outline-none mt-2"
              placeholder="Enter new exchange rate"
            />
            <button 
              onClick={handleSetExchangeRate}
              className="w-full bg-green-500 hover:bg-green-400 text-lg py-2 rounded-lg font-semibold text-blue-900 transition duration-300 mt-2"
            >
              Set New Exchange Rate
            </button>
          </div>
        )}

<button 
        onClick={handleSwap}
        className="w-full bg-yellow-500 hover:bg-yellow-400 text-lg py-3 rounded-lg font-semibold text-blue-900 transition duration-300 relative overflow-hidden group mb-4"
      >
        <span className="relative z-10 text-lg font-bold">
          Swap Tokens
        </span>
        <div className="absolute inset-0 h-full w-full bg-yellow-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
      </button>

      <button 
        onClick={() => approveToken(tokens[fromToken], amount)}
        className="w-full bg-green-500 hover:bg-green-400 text-lg py-3 rounded-lg font-semibold text-blue-900 transition duration-300"
      >
        Approve Tokens
      </button>
    </div>
    </div>
  );
};

export default Swap;