import { expect, assert } from 'chai';
import { BigNumber, Signer, constants } from 'ethers';
import { ethers, network } from 'hardhat';
import { USDC_TOKEN, WETH_TOKEN, WMATIC_TOKEN, QUICKSWAP_FACTORY, SUSHISWAP_FACTORY } from './constants';
const hre = require('hardhat');

export function expectEqWithinBps(actual: BigNumber, expected: BigNumber, bps: number = 1, exponent: number = 4) {
  const base = BigNumber.from(10).pow(exponent);
  const upper = expected.mul(base.add(BigNumber.from(bps))).div(base);
  const lower = expected.mul(base.sub(BigNumber.from(bps))).div(base);
  expect(actual).to.be.lte(upper);
  expect(actual).to.be.gte(lower);
}

export function ether(num: any) {
  return ethers.utils.parseUnits(num, 'ether');
}

export function mwei(num: any) {
  return ethers.utils.parseUnits(num, 6);
}

export function getCallData(artifact: any, name: string, params: any) {
  return artifact.interface.encodeFunctionData(name, params);
}

export function getCallActionData(ethValue: any, artifact: any, funcName: string, params: any) {
  return ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [ethValue, getCallData(artifact, funcName, params)]);
}

export async function impersonateAndInjectEther(address: string) {
  _impersonateAndInjectEther(address);
  return await (ethers as any).getSigner(address);
}

export function simpleEncode(_func: string, params: any) {
  const func = 'function ' + _func;
  const abi = [func];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(_func, params);

  return data;
}

export async function getEventArgs(receipt: any, event: string) {
  let args: any;
  const result = await receipt.wait();
  result.events.forEach((element: any) => {
    if (element.event === event) {
      args = element.args;
    }
  });

  return args;
}

export function asciiToHex32(s: string) {
  // Right Pad
  return ethers.utils.formatBytes32String(s);
}

export async function balanceDelta(addr: string, b: BigNumber) {
  return (await ethers.provider.getBalance(addr)).sub(b);
}

export function getFuncSig(artifact: any, name: string) {
  return artifact.interface.getSighash(name);
}

export async function tokenProviderQuick(token0 = USDC_TOKEN, token1 = WETH_TOKEN, factoryAddress = QUICKSWAP_FACTORY) {
  if (token0 === WETH_TOKEN) {
    token1 = USDC_TOKEN;
  }
  return _tokenProviderUniLike(token0, token1, factoryAddress);
}

export async function maticProviderWmatic() {
  // Impersonate wmatic
  await hre.network.provider.send('hardhat_impersonateAccount', [WMATIC_TOKEN]);
  return await (ethers as any).getSigner(WMATIC_TOKEN);

  // return WMATIC_TOKEN;
}

export async function tokenProviderSushi(token0 = USDC_TOKEN, token1 = WETH_TOKEN, factoryAddress = SUSHISWAP_FACTORY) {
  if (token0 === WETH_TOKEN) {
    token1 = USDC_TOKEN;
  }
  return _tokenProviderUniLike(token0, token1, factoryAddress);
}

export async function _tokenProviderUniLike(token0: string, token1: string, factoryAddress: string) {
  const factory = await ethers.getContractAt('IUniswapV2Factory', factoryAddress);

  const pair = await factory.getPair(token0, token1);
  await _impersonateAndInjectEther(pair);
  return await (ethers as any).getSigner(pair);
}

export async function _impersonateAndInjectEther(address: string) {
  // Impersonate pair
  await hre.network.provider.send('hardhat_impersonateAccount', [address]);

  // Inject 1 ether
  await hre.network.provider.send('hardhat_setBalance', [address, '0xde0b6b3a7640000']);
}

export async function sendEther(sender: Signer, to: string, value: BigNumber) {
  await sender.sendTransaction({
    to: to,
    value: value,
  });
}

export function mulPercent(num: any, percentage: any) {
  return BigNumber.from(num).mul(BigNumber.from(percentage)).div(BigNumber.from(100));
}

export function padRightZero(s: string, length: any) {
  for (let i = 0; i < length; i++) {
    s = s + '0';
  }
  return s;
}

export function calcSqrt(y: BigNumber) {
  let z = BigNumber.from(0);
  if (y.gt(3)) {
    z = y;
    let x = y.div(BigNumber.from(2)).add(BigNumber.from(1));
    while (x.lt(z)) {
      z = x;
      x = y.div(x).add(x).div(BigNumber.from(2));
    }
  } else if (!y.eq(0)) {
    z = BigNumber.from(1);
  }

  return z;
}

export async function latest() {
  return BigNumber.from((await ethers.provider.getBlock(await ethers.provider.getBlockNumber())).timestamp);
}

export async function getTimestampByTx(tx: any) {
  return BigNumber.from((await ethers.provider.getBlock((await tx.wait()).blockNumber)).timestamp);
}

export function decimal6(amount: any) {
  return BigNumber.from(amount).mul(BigNumber.from('1000000'));
}

export function decimal6To18(amount: any) {
  return amount.mul(ether('1')).div(mwei('1'));
}

export function decimal18To6(amount: any) {
  return amount.mul(mwei('1')).div(ether('1'));
}

export async function increaseNextBlockTimeBy(interval: number) {
  const blockNumber = await ethers.provider.getBlockNumber();
  let block = null;
  for (let i = 0; block == null; i++) {
    block = await ethers.provider.getBlock(blockNumber - i);
  }
  await network.provider.send('evm_setNextBlockTimestamp', [block.timestamp + interval]);
  await network.provider.send('evm_mine', []);
}

export async function expectRevert(sender: Signer, to: any, data: any, value: any, expectRevertMsg: string) {
  try {
    await sender.sendTransaction({
      to: to,
      data: data,
      value: value,
    });
    assert.fail('Expected transaction to be reverted');
  } catch (e) {
    const error = e as any;
    const message = error instanceof Object && 'message' in error ? error.message : JSON.stringify(error);
    expect(message).to.include(expectRevertMsg);
  }
}
