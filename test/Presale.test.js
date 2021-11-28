const { ethers } = require('hardhat')
const { expect } = require('chai')
const { BigNumber } = require('@ethersproject/bignumber')

describe('Presale', () => {
  // Large number for approval for DAI
  const largeApproval = '100000000000000000000000000000000'

  // Ethereum 0 address, used when toggling changes in treasury
  const zeroAddress = '0x0000000000000000000000000000000000000000'

  let // Used as default deployer for contracts, asks as owner of contracts.
    deployer,
    // Used as the default user for deposits and trade. Intended to be the default regular user.
    depositor,
    clam,
    pCoon,
    exercisePreCoon,
    dai,
    treasury

  beforeEach(async () => {
    ;[deployer, depositor] = await ethers.getSigners()

    firstEpochTime = (await deployer.provider.getBlock()).timestamp - 100

    const COON = await ethers.getContractFactory('CunoroCoonERC20')
    clam = await COON.deploy()
    await clam.setVault(deployer.address)

    const DAI = await ethers.getContractFactory('DAI')
    dai = await DAI.deploy(0)

    const PreCunoroCoonERC20 = await ethers.getContractFactory(
      'PreCunoroCoonERC20'
    )
    pCoon = await PreCunoroCoonERC20.deploy()

    const Treasury = await ethers.getContractFactory('CunoroTreasury')
    treasury = await Treasury.deploy(
      clam.address,
      dai.address,
      zeroAddress,
      zeroAddress,
      0
    )

    const CoonCirculatingSupply = await ethers.getContractFactory(
      'CoonCirculatingSupply'
    )
    const clamCirculatingSupply = await CoonCirculatingSupply.deploy(
      deployer.address
    )
    await clamCirculatingSupply.initialize(clam.address)

    const ExercisePreCoon = await ethers.getContractFactory('ExercisePreCoon')
    exercisePreCoon = await ExercisePreCoon.deploy(
      pCoon.address,
      clam.address,
      dai.address,
      treasury.address,
      clamCirculatingSupply.address
    )

    await clam.setVault(treasury.address)

    // queue and toggle deployer reserve depositor
    await treasury.queue('0', deployer.address)
    await treasury.toggle('0', deployer.address, zeroAddress)

    await treasury.queue('0', exercisePreCoon.address)
    await treasury.toggle('0', exercisePreCoon.address, zeroAddress)

    await dai.approve(treasury.address, largeApproval)
    await dai.approve(exercisePreCoon.address, largeApproval)
    await pCoon.approve(exercisePreCoon.address, largeApproval)

    // mint 1,000,000 DAI for testing
    await dai.mint(
      deployer.address,
      BigNumber.from(100 * 10000).mul(BigNumber.from(10).pow(18))
    )

    // mint 250,000 COON for testing
    treasury.deposit(
      BigNumber.from(50 * 10000).mul(BigNumber.from(10).pow(18)),
      dai.address,
      BigNumber.from(25 * 10000).mul(BigNumber.from(10).pow(9))
    )
  })

  describe('exercise', () => {
    it('should get reverted', async () => {
      await exercisePreCoon.setTerms(
        deployer.address,
        BigNumber.from(30000).mul(BigNumber.from(10).pow(18)),
        10 * 10000 // 10%
      )

      await expect(
        exercisePreCoon.exercise(
          BigNumber.from(30000).mul(BigNumber.from(10).pow(18))
        )
      ).to.be.revertedWith('Not enough vested')
    })

    it('should get clam', async () => {
      await exercisePreCoon.setTerms(
        deployer.address,
        BigNumber.from(30000).mul(BigNumber.from(10).pow(18)),
        10 * 10000 // 10%
      )

      await expect(() =>
        exercisePreCoon.exercise(
          BigNumber.from(10000).mul(BigNumber.from(10).pow(18))
        )
      ).to.changeTokenBalance(
        clam,
        deployer,
        BigNumber.from(10000).mul(BigNumber.from(10).pow(9))
      )
      expect(await dai.balanceOf(deployer.address)).to.eq(
        BigNumber.from(490000).mul(BigNumber.from(10).pow(18))
      )
      expect(await pCoon.balanceOf(deployer.address)).to.eq(
        '999990000000000000000000000'
      )
    })
  })
})
