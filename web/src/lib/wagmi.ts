import {injected} from '@wagmi/core';
import {cookieStorage, createConfig, createStorage, http} from 'wagmi';

import {creditcoinDevnet, creditcoinTestnet, sourceChain} from '@/lib/config/chains';

/**
 * Wallet configuration.
 *
 * Injected connectors only. A hosted connector (WalletConnect, Coinbase) needs a project id and an
 * external relay, which would be one more thing to misconfigure at demo time for no benefit —
 * MetaMask and every browser wallet expose an injected provider.
 *
 * `injected` is imported from `@wagmi/core` rather than the `wagmi/connectors` barrel: that barrel
 * pulls in the Base account connector, whose optional x402 dependencies are unresolvable and break
 * the production build. Importing the one connector we use avoids dragging in the rest.
 *
 * `cookieStorage` keeps the connection readable during SSR so the shell renders in its connected
 * state on first paint rather than flashing a disconnected header.
 */
export const wagmiConfig = createConfig({
  chains: [creditcoinTestnet, creditcoinDevnet, sourceChain],
  connectors: [injected()],
  storage: createStorage({storage: cookieStorage}),
  ssr: true,
  // Keyed explicitly for every chain the config declares. `creditcoin` is selected at build time
  // from a set of networks, so listing all ids keeps the map total regardless of which is active.
  transports: {
    [creditcoinTestnet.id]: http(),
    [creditcoinDevnet.id]: http(),
    [sourceChain.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
