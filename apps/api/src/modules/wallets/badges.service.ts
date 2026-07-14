import { ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Contract, JsonRpcProvider, Wallet, isAddress, keccak256, toUtf8Bytes } from 'ethers';

const abi = ['function grant(uint256 id, bytes32 badge, string uri)', 'function revoke(uint256 id, bytes32 badge)'] as const;
const badges = new Set(['EARLY_MEMBER', 'VERIFIED_CREATOR', 'LIVE_HOST', 'TRUSTED_MODERATOR']);

@Injectable()
export class BadgesService {
  async update(email: string, socialId: string, badge: string, grant: boolean, uri = '') {
    const moderators = (process.env.MODERATOR_EMAILS ?? '').split(',').map((item) => item.trim().toLowerCase());
    if (!moderators.includes(email.toLowerCase())) throw new ForbiddenException('Moderator access required');
    const name = badge.trim().toUpperCase();
    if (!badges.has(name) || !/^\d+$/.test(socialId)) throw new UnprocessableEntityException('Invalid badge or social id');
    const address = process.env.SOCIAL_BADGE_ADDRESS;
    const rpc = process.env.SOCIAL_BADGE_RPC_URL ?? process.env.SOCIAL_ACTION_RPC_URL;
    const key = process.env.SOCIAL_BADGE_OWNER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
    if (!address || !isAddress(address) || !rpc || !key) throw new UnprocessableEntityException('Social badge service is not configured');
    const contract = new Contract(address, abi, new Wallet(key, new JsonRpcProvider(rpc)));
    const tx = grant ? await contract.grant(BigInt(socialId), keccak256(toUtf8Bytes(name)), uri) : await contract.revoke(BigInt(socialId), keccak256(toUtf8Bytes(name)));
    return { transactionHash: tx.hash, badge: name, granted: grant };
  }
}
