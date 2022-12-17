import { Wallet, BigNumber, constants } from 'ethers';
import { expect } from 'chai';
import { deployments, ethers } from 'hardhat';
import { USDC_TOKEN } from './utils/constants';
import { mwei, latest, tokenProviderQuick, getEventArgs } from './utils/utils';

describe('BetWorldCupFactory', function () {
  let owner: Wallet;
  let user: Wallet;
  let betWorldCupFactory: any;
  let betWorldCup: any;
  let period: any;
  let bettingToken: any;
  let redShareToken: any;
  let blueShareToken: any;
  let redPlayer: any;
  let bluePlayer: any;

  const setupTest = deployments.createFixture(async ({ deployments, ethers }, options) => {
    await deployments.fixture(''); // ensure you start from a fresh deployments
    [owner, user] = await (ethers as any).getSigners();

    bettingToken = await ethers.getContractAt('IERC20', USDC_TOKEN);
    const provider = await tokenProviderQuick(bettingToken.address);
    await bettingToken.connect(provider).transfer(owner.address, mwei('1000'));
    await bettingToken.connect(provider).transfer(user.address, mwei('1000'));

    betWorldCupFactory = await (await ethers.getContractFactory('BetWorldCupFactory')).deploy();
    await betWorldCupFactory.deployed();
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    // setupTest will use the evm_snapshot to reset environment for speed up testing
    await setupTest();
  });
  describe('normal', function () {
    it('create BWC', async function () {
      await bettingToken.connect(owner).approve(betWorldCupFactory.address, constants.MaxUint256);

      const now = await latest();
      period = BigNumber.from(300); // 1 min
      const bettingEndTime = now.add(period);
      const receipt = await betWorldCupFactory.createBWC('France', 'England', bettingToken.address, bettingEndTime);
      const args = await getEventArgs(receipt, 'NewBetWorldCup');
      betWorldCup = await ethers.getContractAt('BetWorldCup', args.newBwc);

      redPlayer = await betWorldCup.redPlayer();
      bluePlayer = await betWorldCup.bluePlayer();

      redShareToken = await ethers.getContractAt('IERC20', redPlayer.shareToken);
      blueShareToken = await ethers.getContractAt('IERC20', bluePlayer.shareToken);

      expect(await redShareToken.balanceOf(betWorldCupFactory.address)).to.be.eq(0);
      expect(await blueShareToken.balanceOf(betWorldCupFactory.address)).to.be.eq(0);
      expect(await redShareToken.balanceOf(owner.address)).to.be.eq(1);
      expect(await blueShareToken.balanceOf(owner.address)).to.be.eq(1);
      expect(await betWorldCup.bettingEndTime()).to.be.eq(bettingEndTime);
      expect(await betWorldCupFactory.count()).to.be.eq(1);
      expect(await betWorldCupFactory.BWCs(0)).to.be.eq(betWorldCup.address);
    });
  });
});
