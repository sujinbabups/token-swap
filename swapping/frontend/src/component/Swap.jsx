import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract, parseUnits, formatUnits } from 'ethers'; 

import abi from '../scdata/Swap.json'
import deployedAddress from '../scdata/deployed_addresses.json'
import ERC20_ABI from '../scdata/ERC20.json';

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

  const tokens = {
    GT: "0xC50b8ae9c3234309442be534354F963A4cAd31ca",
    ET: "0xE6a6085DBbbD7f1AE5950B6973Ec9Cc1aDCFcD52",
    NewToken: "0xE6a6085DBbbD7f1AE5950B6973Ec9Cc1aDCFcD53"
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
        console.log("Coneected address:", accounts[0]);
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
        console.log("Raw rate:", rate.toString());
        // The rate is already in the correct format (1e18 represents 1.0)
        const formattedRate = formatUnits(rate, 18);
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
      // Convert the new rate to the contract's expected format
      const rateInWei = parseUnits(newExchangeRate, 18);
      const tx = await swapContract.setExchangeRate(
        tokens[fromToken],
        tokens[toToken],
        rateInWei
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
    if (!signer || !fromToken || !toToken || !amount) {
      alert("Please fill in all fields and connect your wallet.");
      return;
    }
  
    try {
      const fromTokenAddress = tokens[fromToken];
      const toTokenAddress = tokens[toToken];
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, SWAP_CONTRACT_ABI, signer);
  
      // Get token decimals
      const fromDecimals = await getTokenDecimals(fromTokenAddress, fromToken);
      const toDecimals = await getTokenDecimals(toTokenAddress, toToken);
  
      // Convert amount to BigInt using ethers
      const amountInWei = BigInt(parseUnits(amount, fromDecimals));
  
      // Check exchange rate
      const rate = await swapContract.getExchangeRate(fromTokenAddress, toTokenAddress);
      console.log(`Exchange rate: ${formatUnits(rate, 18)}`);
      if (rate.toString() === '0') {
        alert("Exchange rate not set. Please set the rate before swapping.");
        return;
      }
  
      // Check balance 
      const fromTokenContract = new Contract(fromTokenAddress, ERC20_ABI, signer);
      const balance = await fromTokenContract.balanceOf(account);
      const balanceBigInt = BigInt(balance.toString()); // Convert balance to BigInt
      if (balanceBigInt < amountInWei) {
        alert(`Insufficient balance. You have ${formatUnits(balanceBigInt, fromDecimals)} ${fromToken}, but you're trying to swap ${amount} ${fromToken}.`);
        return;
      }
  
      // Check allowance
      const allowance = await fromTokenContract.allowance(account, SWAP_CONTRACT_ADDRESS);
      const allowanceBigInt = BigInt(allowance.toString()); // Convert allowance to BigInt
      if (allowanceBigInt < amountInWei) {
        const userConfirmed = window.confirm(`Insufficient allowance. Current allowance: ${formatUnits(allowanceBigInt, fromDecimals)} ${fromToken}. Do you want to approve ${amount} ${fromToken}?`);
        if (userConfirmed) {
          const approveTx = await fromTokenContract.approve(SWAP_CONTRACT_ADDRESS, amountInWei);
          await approveTx.wait();
          console.log("Approval transaction successful");
        } else {
          return;
        }
      }
  
      // Perform swap
      const swapTx = await swapContract.swap(fromTokenAddress, toTokenAddress, amountInWei);
      await swapTx.wait();
      console.log(swapTx);
  
      alert("Swap successful!");
      updateExchangeRate(fromToken, toToken);
    } catch (error) {
      console.error("Swap failed:", error);
      alert(`Swap failed: ${error.message}`);
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
         placeholder="Enter new rate (e.g., 1.5 for 1:1.5)"
       />
       <p className="text-sm mt-1 text-yellow-200">Enter the rate as a decimal (e.g., 2 means 2 {toToken} per 1 {fromToken})</p>
       <button
         onClick={handleSetExchangeRate}
         className="w-full bg-cyan-300 hover:bg-green-400 text-lg py-2 rounded-lg font-semibold text-blue-900 transition duration-300 mt-2"
       >
         Set New Exchange Rate
       </button>
     </div>
   )}
        <button
          onClick={() => approveToken(tokens[fromToken], amount)}
          className="w-full bg-green-500 hover:bg-green-400 text-lg py-3 rounded-lg font-semibold text-blue-900 transition duration-300"
        >
          Approve Tokens
        </button>
        <br /><br />

        <button
          onClick={handleSwap}
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-lg py-3 rounded-lg font-semibold text-blue-900 transition duration-300 relative overflow-hidden group mb-4"
        >
          <span className="relative z-10 text-lg font-bold">
            Swap Tokens
          </span>
          <div className="absolute inset-0 h-full w-full bg-yellow-400 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
        </button>

        
      </div>
    </div>
  );
};

export default Swap;