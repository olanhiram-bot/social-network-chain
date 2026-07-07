import hre from 'hardhat';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const idRegistry = process.env.ID_REGISTRY_ADDRESS;
  if (!idRegistry) {
    throw new Error('ID_REGISTRY_ADDRESS is required');
  }

  const StorageRegistry = await hre.ethers.getContractFactory('SocialStorageRegistry');
  const storage = await StorageRegistry.deploy(idRegistry, 0n);
  await storage.waitForDeployment();

  const deployment = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    idRegistry,
    storageRegistry: await storage.getAddress(),
  };

  await mkdir('deployments', { recursive: true });
  await writeFile(
    join('deployments', `${hre.network.name}-storage.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );

  console.log(deployment);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
