import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const USDC = '0x466595626333c55fa7d7Ad6265D46bA5fDbBDd99';
const Timestamp = 1671033600; // 20221215

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy('BetWorldCup', {
    from: deployer,
    args: ['RED', 'BLUE', USDC, Timestamp],
    log: true,
  });
};

export default func;

func.tags = ['BetWorldCup'];
