import hre from 'hardhat';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('deployer', deployer.address);

  const IdRegistry = await hre.ethers.getContractFactory('SocialIdRegistry');
  const ids = await IdRegistry.deploy();
  await ids.waitForDeployment();

  const KeyRegistry = await hre.ethers.getContractFactory('SocialKeyRegistry');
  const keys = await KeyRegistry.deploy(await ids.getAddress());
  await keys.waitForDeployment();

  const StorageRegistry = await hre.ethers.getContractFactory('SocialStorageRegistry');
  const storage = await StorageRegistry.deploy(await ids.getAddress(), 0n);
  await storage.waitForDeployment();

  const deployment = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    contracts: {
      idRegistry: await ids.getAddress(),
      keyRegistry: await keys.getAddress(),
      storageRegistry: await storage.getAddress(),
    },
  };

  await mkdir('deployments', { recursive: true });
  await writeFile(
    join('deployments', `${hre.network.name}.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );

  console.log({
    idRegistry: await ids.getAddress(),
    keyRegistry: await keys.getAddress(),
    storageRegistry: await storage.getAddress(),
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
