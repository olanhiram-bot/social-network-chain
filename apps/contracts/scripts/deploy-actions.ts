import hre from 'hardhat';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const ActionRegistry = await hre.ethers.getContractFactory('SocialActionRegistry');
  const actions = await ActionRegistry.deploy();
  await actions.waitForDeployment();

  const deployment = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    actionRegistry: await actions.getAddress(),
  };

  await mkdir('deployments', { recursive: true });
  await writeFile(
    join('deployments', `${hre.network.name}-actions.json`),
    `${JSON.stringify(deployment, null, 2)}\n`,
  );

  console.log(deployment);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
