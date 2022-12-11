import { Wallet, BigNumber, constants } from 'ethers';
import { expect } from 'chai';
import { deployments, network } from 'hardhat';
import { USDC_TOKEN } from './utils/constants';
import { mwei, latest, ether, tokenProviderQuick } from './utils/utils';

describe('BetWorldCup', function () {
  let owner: Wallet;
  let user: Wallet;
  let other: Wallet;
  let betWorldCup: any;
  let period: any;
  let bettingToken: any;
  let redShareToken: any;
  let blueShareToken: any;
  let redPlayer: any;
  let bluePlayer: any;

  const setupTest = deployments.createFixture(async ({ deployments, ethers }, options) => {
    await deployments.fixture(''); // ensure you start from a fresh deployments
    [owner, user, other] = await (ethers as any).getSigners();

    bettingToken = await ethers.getContractAt('IERC20', USDC_TOKEN);

    const now = await latest();
    period = BigNumber.from(300); // 1 min
    betWorldCup = await (
      await ethers.getContractFactory('BetWorldCup')
    ).deploy('France', 'England', bettingToken.address, now.add(period));
    await betWorldCup.deployed();

    const provider = await tokenProviderQuick(bettingToken.address);
    await bettingToken.connect(provider).transfer(user.address, mwei('1000'));
    await bettingToken.connect(provider).transfer(other.address, mwei('1000'));
    await bettingToken.connect(user).approve(betWorldCup.address, constants.MaxUint256);
    await bettingToken.connect(other).approve(betWorldCup.address, constants.MaxUint256);

    redPlayer = await betWorldCup.redPlayer();
    bluePlayer = await betWorldCup.bluePlayer();

    redShareToken = await ethers.getContractAt('IERC20', redPlayer.shareToken);
    blueShareToken = await ethers.getContractAt('IERC20', bluePlayer.shareToken);
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    // setupTest will use the evm_snapshot to reset environment for speed up testing
    await setupTest();
  });
  describe('normal', function () {
    describe('bet', function () {
      it('betRed', async function () {
        const betAmount = mwei('100');
        const bettingTokenBefore = await bettingToken.balanceOf(user.address);
        expect(await redShareToken.balanceOf(user.address)).to.be.eq(0);

        const receipt = await betWorldCup.connect(user).betRed(betAmount);
        await expect(receipt).to.emit(betWorldCup, 'Bet').withArgs('RED', user.address, betAmount);
        expect(await redShareToken.balanceOf(user.address)).to.be.eq(betAmount);
        expect(await bettingToken.balanceOf(user.address)).to.be.eq(bettingTokenBefore.sub(betAmount));
        expect(await betWorldCup.redOdds()).to.be.eq(ether('1'));
        expect(await betWorldCup.blueOdds()).to.be.eq(constants.MaxUint256);
        expect(await betWorldCup.blueBetting()).to.be.eq(0);
        expect(await betWorldCup.redBetting()).to.be.eq(betAmount);
      });

      it('betBlue', async function () {
        const betAmount = mwei('100');
        const bettingTokenBefore = await bettingToken.balanceOf(user.address);
        expect(await blueShareToken.balanceOf(user.address)).to.be.eq(0);

        const receipt = await betWorldCup.connect(user).betBlue(betAmount);
        await expect(receipt).to.emit(betWorldCup, 'Bet').withArgs('BLUE', user.address, betAmount);
        expect(await blueShareToken.balanceOf(user.address)).to.be.eq(betAmount);
        expect(await bettingToken.balanceOf(user.address)).to.be.eq(bettingTokenBefore.sub(betAmount));
        expect(await betWorldCup.blueOdds()).to.be.eq(ether('1'));
        expect(await betWorldCup.redOdds()).to.be.eq(constants.MaxUint256);
        expect(await betWorldCup.redBetting()).to.be.eq(0);
        expect(await betWorldCup.blueBetting()).to.be.eq(betAmount);
      });

      it('both bet', async function () {
        const betBlueAmount = mwei('100');
        await betWorldCup.connect(user).betBlue(betBlueAmount);

        const betRedAmount = betBlueAmount.div(2);
        await betWorldCup.connect(user).betRed(betRedAmount);

        expect(await betWorldCup.blueOdds()).to.be.eq(ether('1.5'));
        expect(await betWorldCup.redOdds()).to.be.eq(ether('3'));
        expect(await betWorldCup.blueBetting()).to.be.eq(betBlueAmount);
        expect(await betWorldCup.redBetting()).to.be.eq(betRedAmount);
      });

      it('should revert: Exceeded betting time', async function () {
        // const stalePeriod = await chainlink.stalePeriod();
        await network.provider.send('evm_increaseTime', [period.toNumber()]);
        await network.provider.send('evm_mine', []);

        // Prepare action data
        const betAmount = mwei('100');

        // Execution
        await expect(betWorldCup.connect(user).betBlue(betAmount)).to.be.revertedWith('Exceeded betting time');
      });
    });

    describe('submit', function () {
      beforeEach(async function () {
        const blueBetAmount = mwei('10');
        const redBetAmount = blueBetAmount.div(BigNumber.from(2));
        await betWorldCup.connect(user).betBlue(blueBetAmount);
        await betWorldCup.connect(user).betRed(redBetAmount);
      });
      it('red is winner', async function () {
        // Over submit time
        await network.provider.send('evm_increaseTime', [period.toNumber() + 3 * 60 * 60]);
        await network.provider.send('evm_mine', []);

        const receipt = await betWorldCup.connect(owner).submitMatchResult(true);
        await expect(receipt).to.emit(betWorldCup, 'SubmitMatchResult').withArgs(redPlayer);

        const winner = await betWorldCup.winner();
        expect(winner.name).to.be.eq(redPlayer.name);
        expect(await betWorldCup.matchResultSubmitted()).to.be.true;
        await expect(blueShareToken.connect(other).transfer(user.address, BigNumber.from(1))).to.be.revertedWith(
          'ERC20Pausable: token transfer while paused'
        );
      });

      it('blue is winner', async function () {
        // Over submit time
        await network.provider.send('evm_increaseTime', [period.toNumber() + 3 * 60 * 60]);
        await network.provider.send('evm_mine', []);

        const receipt = await betWorldCup.connect(owner).submitMatchResult(false);
        await expect(receipt).to.emit(betWorldCup, 'SubmitMatchResult').withArgs(bluePlayer);

        const winner = await betWorldCup.winner();
        expect(winner.name).to.be.eq(bluePlayer.name);
        expect(await betWorldCup.matchResultSubmitted()).to.be.true;
        await expect(redShareToken.connect(other).transfer(user.address, BigNumber.from(1))).to.be.revertedWith(
          'ERC20Pausable: token transfer while paused'
        );
      });

      it('should revert: match may not over yet', async function () {
        await expect(betWorldCup.connect(owner).submitMatchResult(false)).to.be.revertedWith('Match may not over yet');
      });

      it('should revert: already submitted', async function () {
        // Over submit time
        await network.provider.send('evm_increaseTime', [period.toNumber() + 3 * 60 * 60]);
        await network.provider.send('evm_mine', []);
        await betWorldCup.connect(owner).submitMatchResult(false);
        await expect(betWorldCup.connect(owner).submitMatchResult(false)).to.be.revertedWith('Submitted');
      });

      it('should revert: not owner submit', async function () {
        await expect(betWorldCup.connect(user).submitMatchResult(false)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });

    describe('claim', function () {
      let redBetAmount: BigNumber;
      let blueBetAmount: BigNumber;
      let base: BigNumber;

      describe('1.x reward', function () {
        beforeEach(async function () {
          blueBetAmount = mwei('10');
          redBetAmount = blueBetAmount.mul(BigNumber.from(2));
          base = ether('1');
          await betWorldCup.connect(user).betBlue(blueBetAmount);
          await betWorldCup.connect(user).betRed(redBetAmount);
          await network.provider.send('evm_increaseTime', [period.toNumber() + 3 * 60 * 60]);
          await network.provider.send('evm_mine', []);
          await betWorldCup.connect(owner).submitMatchResult(true);
        });

        it('claim part reward', async function () {
          await redShareToken.connect(user).approve(betWorldCup.address, constants.MaxUint256);
          const userBetTokenBefore = await bettingToken.balanceOf(user.address);
          const totalShareBefore = await redShareToken.totalSupply();

          const partialReward = redBetAmount.div(BigNumber.from(3));
          const expectReward = blueBetAmount.add(redBetAmount).mul(partialReward).mul(base).div(base.mul(redBetAmount));
          const receipt = await betWorldCup.connect(user).claimReward(partialReward);
          await expect(receipt).to.emit(betWorldCup, 'Claim').withArgs(user.address, partialReward, expectReward);
          expect(await bettingToken.balanceOf(user.address)).to.be.eq(userBetTokenBefore.add(expectReward));
          expect(await redShareToken.totalSupply()).to.be.eq(totalShareBefore.sub(partialReward));
          expect(await redShareToken.balanceOf(betWorldCup.address)).to.be.eq(0);
        });

        it('claim total reward', async function () {
          await redShareToken.connect(user).approve(betWorldCup.address, constants.MaxUint256);
          const userBetTokenBefore = await bettingToken.balanceOf(user.address);
          const totalShareBefore = await redShareToken.totalSupply();
          const partialReward = redBetAmount;
          const expectReward = blueBetAmount.add(redBetAmount).mul(partialReward).mul(base).div(base.mul(redBetAmount));
          const receipt = await betWorldCup.connect(user).claimReward(partialReward);
          await expect(receipt).to.emit(betWorldCup, 'Claim').withArgs(user.address, partialReward, expectReward);
          expect(await bettingToken.balanceOf(user.address)).to.be.eq(userBetTokenBefore.add(expectReward));

          expect(await redShareToken.totalSupply()).to.be.eq(totalShareBefore.sub(partialReward));
          expect(await redShareToken.balanceOf(betWorldCup.address)).to.be.eq(0);
        });
      });

      describe('above 2.x reward', function () {
        beforeEach(async function () {
          blueBetAmount = mwei('10');
          redBetAmount = blueBetAmount.div(BigNumber.from(3));
          base = ether('1');
          await betWorldCup.connect(user).betBlue(blueBetAmount);
          await betWorldCup.connect(user).betRed(redBetAmount);
          await network.provider.send('evm_increaseTime', [period.toNumber() + 3 * 60 * 60]);
          await network.provider.send('evm_mine', []);
          await betWorldCup.connect(owner).submitMatchResult(true);
        });

        it('claim part reward', async function () {
          await redShareToken.connect(user).approve(betWorldCup.address, constants.MaxUint256);
          const userBetTokenBefore = await bettingToken.balanceOf(user.address);
          const totalShareBefore = await redShareToken.totalSupply();

          const partialReward = redBetAmount.div(BigNumber.from(3));
          const expectReward = blueBetAmount.add(redBetAmount).mul(partialReward).mul(base).div(base.mul(redBetAmount));
          const receipt = await betWorldCup.connect(user).claimReward(partialReward);
          await expect(receipt).to.emit(betWorldCup, 'Claim').withArgs(user.address, partialReward, expectReward);
          expect(await bettingToken.balanceOf(user.address)).to.be.eq(userBetTokenBefore.add(expectReward));
          expect(await redShareToken.totalSupply()).to.be.eq(totalShareBefore.sub(partialReward));
          expect(await redShareToken.balanceOf(betWorldCup.address)).to.be.eq(0);
        });

        it('claim total reward', async function () {
          await redShareToken.connect(user).approve(betWorldCup.address, constants.MaxUint256);
          const userBetTokenBefore = await bettingToken.balanceOf(user.address);
          const totalShareBefore = await redShareToken.totalSupply();
          const partialReward = redBetAmount;
          const expectReward = blueBetAmount.add(redBetAmount).mul(partialReward).mul(base).div(base.mul(redBetAmount));
          const receipt = await betWorldCup.connect(user).claimReward(partialReward);
          await expect(receipt).to.emit(betWorldCup, 'Claim').withArgs(user.address, partialReward, expectReward);
          expect(await bettingToken.balanceOf(user.address)).to.be.eq(userBetTokenBefore.add(expectReward));
          expect(await redShareToken.totalSupply()).to.be.eq(totalShareBefore.sub(partialReward));
          expect(await redShareToken.balanceOf(betWorldCup.address)).to.be.eq(0);
        });
      });

      describe('should revert', function () {
        beforeEach(async function () {
          blueBetAmount = mwei('10');
          redBetAmount = blueBetAmount;
          base = ether('1');
          await betWorldCup.connect(user).betBlue(blueBetAmount);
          await betWorldCup.connect(user).betRed(redBetAmount);
          await network.provider.send('evm_increaseTime', [period.toNumber() + 3 * 60 * 60]);
          await network.provider.send('evm_mine', []);
        });

        it('should revert: not submit result yet', async function () {
          const partialReward = redBetAmount;
          await expect(betWorldCup.connect(other).claimReward(partialReward)).to.be.revertedWith(
            'Not submit match result yet'
          );
        });

        it('should revert: insufficient betting amount', async function () {
          await betWorldCup.connect(owner).submitMatchResult(true);
          await redShareToken.connect(other).approve(betWorldCup.address, constants.MaxUint256);
          const partialReward = redBetAmount;
          await expect(betWorldCup.connect(other).claimReward(partialReward)).to.be.revertedWith(
            'ERC20: transfer amount exceeds balance'
          );
        });
      });
    });
  });
});
