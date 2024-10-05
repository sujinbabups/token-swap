const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenSwap", function () {
  let TokenSwap, tokenSwap, owner, addr1, addr2;
  let Token, token1, token2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy mock tokens for testing
    Token = await ethers.getContractFactory("MockERC20");
    token1 = await Token.deploy("Token1", "TK1");
    await token1.deployed();
    token2 = await Token.deploy("Token2", "TK2");
    await token2.deployed();

    // Deploy TokenSwap contract
    TokenSwap = await ethers.getContractFactory("TokenSwap");
    tokenSwap = await TokenSwap.deploy();
    await tokenSwap.deployed();

    // Mint some tokens to addr1 and approve TokenSwap contract
    await token1.mint(addr1.address, ethers.utils.parseEther("1000"));
    await token1.connect(addr1).approve(tokenSwap.address, ethers.utils.parseEther("1000"));

    // Mint some tokens to TokenSwap contract (simulating liquidity)
    await token2.mint(tokenSwap.address, ethers.utils.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await tokenSwap.owner()).to.equal(owner.address);
    });
  });

  describe("Setting exchange rates", function () {
    it("Should set exchange rate correctly", async function () {
      await tokenSwap.setExchangeRate(token1.address, token2.address, ethers.utils.parseEther("2"));
      expect(await tokenSwap.getExchangeRate(token1.address, token2.address)).to.equal(ethers.utils.parseEther("2"));
    });

    it("Should emit RateSet event", async function () {
      await expect(tokenSwap.setExchangeRate(token1.address, token2.address, ethers.utils.parseEther("2")))
        .to.emit(tokenSwap, "RateSet")
        .withArgs(token1.address, token2.address, ethers.utils.parseEther("2"));
    });

    it("Should revert if non-owner tries to set rate", async function () {
      await expect(tokenSwap.connect(addr1).setExchangeRate(token1.address, token2.address, ethers.utils.parseEther("2")))
        .to.be.revertedWithCustomError(tokenSwap, "OwnableUnauthorizedAccount");
    });
  });

  describe("Swapping tokens", function () {
    beforeEach(async function () {
      await tokenSwap.setExchangeRate(token1.address, token2.address, ethers.utils.parseEther("2"));
    });

    it("Should swap tokens correctly", async function () {
      const swapAmount = ethers.utils.parseEther("10");
      const expectedAmount = ethers.utils.parseEther("20");

      await expect(tokenSwap.connect(addr1).swap(token1.address, token2.address, swapAmount))
        .to.emit(tokenSwap, "Swap")
        .withArgs(addr1.address, token1.address, token2.address, swapAmount, expectedAmount);

      expect(await token2.balanceOf(addr1.address)).to.equal(expectedAmount);
    });

    it("Should revert if exchange rate not set", async function () {
      await expect(tokenSwap.connect(addr1).swap(token2.address, token1.address, ethers.utils.parseEther("10")))
        .to.be.revertedWith("Exchange rate not set");
    });

    it("Should revert if token allowance too low", async function () {
      await token1.connect(addr1).approve(tokenSwap.address, 0);
      await expect(tokenSwap.connect(addr1).swap(token1.address, token2.address, ethers.utils.parseEther("10")))
        .to.be.revertedWith("Token allowance too low");
    });
  });

  describe("Withdrawing tokens", function () {
    it("Should allow owner to withdraw tokens", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      await tokenSwap.withdrawToken(token2.address, withdrawAmount);
      expect(await token2.balanceOf(owner.address)).to.equal(withdrawAmount);
    });

    it("Should revert if non-owner tries to withdraw", async function () {
      await expect(tokenSwap.connect(addr1).withdrawToken(token2.address, ethers.utils.parseEther("100")))
        .to.be.revertedWithCustomError(tokenSwap, "OwnableUnauthorizedAccount");
    });
  });
});
