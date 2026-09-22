const { ethers } = require('ethers');

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc-gel.inkonchain.com');
  const usdcAddr = '0x0200c29006150606b650577bbe7b6248f58470c1';
  
  const erc20Abi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ];
  const token = new ethers.Contract(usdcAddr, erc20Abi, provider);
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    token.totalSupply()
  ]);

  console.log('Token name:', name);
  console.log('Token symbol:', symbol);
  console.log('Token decimals:', decimals);
  console.log('Total supply:', totalSupply.toString());
}

main().catch(console.error);
