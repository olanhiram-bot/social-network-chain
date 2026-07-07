# Social Network Contracts

Minimal Farcaster-style contract layer:

- `SocialIdRegistry`: assigns a portable social id to one wallet.
- `SocialKeyRegistry`: registers app signer keys for an id.
- `SocialStorageRegistry`: tracks paid storage windows.

Deploy requires:

```bash
ARBITRUM_SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=... pnpm --filter contracts deploy:arbitrum-sepolia
```

No private keys should be committed.
