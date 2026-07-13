# Social Network Contracts

Minimal Farcaster-style contract layer:

- `SocialIdRegistry`: assigns a portable social id to one wallet.
- `SocialKeyRegistry`: registers app signer keys for an id.
- `SocialStorageRegistry`: tracks paid storage windows.

Deploy requires:

```bash
SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm --filter contracts deploy:sepolia
ARBITRUM_SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm --filter contracts deploy:arbitrum-sepolia
```

No private keys should be committed.

## Action anchoring from the API

`SocialActionRegistry` stores only action hashes and public metadata. Content,
media and private messages stay off-chain. Configure the API with:

```bash
SOCIAL_ACTION_RPC_URL=https://your-sepolia-rpc
SOCIAL_ACTION_REGISTRY_ADDRESS=0x2eCD7a3245DD03973E190896bE6A5b07B0eE6d06
SOCIAL_ACTION_PUBLIC_URL=https://your-web-app.example
```

The API submits an app-signer transaction after recording each signed action.
Anchoring failures are tracked off-chain in `ChainAnchor` and do not discard the
social action.
