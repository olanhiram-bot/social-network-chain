import hre from 'hardhat';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function main() {
  const idRegistry = process.env.SOCIAL_ID_REGISTRY_ADDRESS;
  if (!idRegistry) throw new Error('SOCIAL_ID_REGISTRY_ADDRESS is required');
  const Badge = await hre.ethers.getContractFactory('SocialBadge');
  const badge = await Badge.deploy(idRegistry);
  await badge.waitForDeployment();
  const deployment = { network: hre.network.name, chainId: Number((await hre.ethers.provider.getNetwork()).chainId), socialBadge: await badge.getAddress(), idRegistry };
  await mkdir('deployments', { recursive: true });
  await writeFile(join('deployments', `${hre.network.name}-badges.json`), `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(deployment);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
