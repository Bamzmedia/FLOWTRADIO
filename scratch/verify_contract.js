const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc-gel.inkonchain.com');
  const endpointAddr = '0x05ec92d78ed421f3d3ada77ffde167106565974e';
  
  // ERC-1967 implementation slot
  const implSlot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const implBytes = await provider.getStorage(endpointAddr, implSlot);
  console.log('Impl storage:', implBytes);
  const implAddr = ethers.getAddress('0x' + implBytes.slice(26));
  console.log('Implementation address:', implAddr);

  const implCode = await provider.getCode(implAddr);
  console.log('Impl code length:', implCode.length);

  const sel1 = ethers.id('depositCollateral(bytes12,uint32,uint128)').slice(2, 10);
  const sel2 = ethers.id('depositCollateral(bytes32,uint32,uint128)').slice(2, 10);
  const selRef1 = ethers.id('depositCollateralWithReferral(bytes12,uint32,uint128,string)').slice(2, 10);
  const selRef2 = ethers.id('depositCollateralWithReferral(bytes32,uint32,uint128,string)').slice(2, 10);

  console.log('depositCollateral(bytes12,uint32,uint128):', sel1, implCode.includes(sel1));
  console.log('depositCollateral(bytes32,uint32,uint128):', sel2, implCode.includes(sel2));
  console.log('depositCollateralWithReferral(bytes12,uint32,uint128,string):', selRef1, implCode.includes(selRef1));
  console.log('depositCollateralWithReferral(bytes32,uint32,uint128,string):', selRef2, implCode.includes(selRef2));
}

main().catch(console.error);
