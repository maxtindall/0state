# 0state × bitchat — offline, on-chain governance

**Goal:** let members propose and vote with **no internet** — signing on their
own device, propagating hand-to-hand over a Bluetooth mesh, and settling
on-chain whenever any peer next touches the network. Governance that survives a
blackout.

[bitchat](https://github.com/permissionlesstech/bitchat) is an open-source
decentralised messenger with two transports: a **Bluetooth-LE mesh** (fully
offline, ~300 m/hop, multi-hop relay, Noise-encrypted) and a **Nostr** bridge
(used when any peer has connectivity). No accounts, no servers.

## The primitive (already built)
A Solana transaction normally expires with its ~60-second blockhash — useless if
it can't reach an RPC promptly. 0state's CLI solves this with a **durable
nonce**: a vote signed offline stays valid **indefinitely** until relayed.

```
0state nonce-init                 # one-time (online): create your durable nonce
0state vote <id> yes --offline    # signs a never-expiring vote -> prints an envelope
0state relay <envelope>           # any peer with connectivity submits it
```

The signed transaction is **self-authenticating** (a bad actor can't alter the
vote without breaking the signature) and **single-use** (the nonce advance +
ballot PDA prevent replay). Relaying is therefore **permissionless and
trustless** — any peer may carry and submit it.

## Message envelope
A governance message on the mesh is just the signed transaction, tagged so peers
and relays recognise it:

```
0state:tx:1:<base64-signed-transaction>
```

- `0state` — namespace · `tx` — a relayable transaction · `1` — format version.
- The payload is exactly what `--offline` prints. Proposals, votes, and treasury
  executions all travel the same way.

## Architecture
```
  offline member                bitchat BLE mesh                 online peer
  ┌────────────┐   envelope   ┌───────────────────┐  envelope   ┌───────────┐
  │ sign vote  │ ───────────▶ │ device ⇄ device ⇄ │ ──────────▶ │ relay ⇒   │ ⇒ Solana
  │ (durable   │  (Bluetooth) │  … multi-hop …    │ (BLE/Nostr) │ 0state RPC │
  │  nonce)    │              └───────────────────┘             └───────────┘
  └────────────┘
```
The vote crosses any number of offline hops, then the first peer with
connectivity (directly, or via bitchat's Nostr bridge) relays it to the chain.

## Two integration paths
1. **Companion relay — buildable now.** A daemon (`mesh-relay.mjs`) that watches
   an inbox for envelopes — a directory bitchat/native code drops received
   messages into, or a Nostr topic bitchat bridges to — and submits each to
   Solana. This bridges the mesh to the chain without touching bitchat itself.
2. **Native fork — mobile dev.** Extend the bitchat app (Swift/iOS,
   Kotlin/Android) with a governance surface: list open proposals, sign a vote
   on-device with the durable nonce, emit it as a `0state:tx:` envelope on the
   mesh, and relay when online. This is a native BLE + on-device-signing effort,
   scoped separately.

## Security model
- **Integrity/authenticity:** ed25519 signature over the transaction — relays
  and hops are dumb carriers; tampering invalidates it.
- **No expiry:** durable nonce keeps the vote valid across an arbitrary offline
  delay.
- **No double-spend:** ballot PDA (one per proposal+voter) and the nonce advance
  make each envelope single-use.
- **Membership still enforced on-chain:** only a wallet with a frankcoin `Proof`
  can produce a vote the program will accept, no matter how it travelled.
- **Privacy:** votes are public on settlement (as all on-chain votes are); the
  mesh only affects *transport*, not confidentiality of the ballot.

## Roadmap
1. ✅ CLI durable-nonce offline signing + relay (the transport-agnostic core).
2. ▶ `mesh-relay.mjs` companion daemon (inbox → chain; dir today, Nostr next).
3. ☐ Native bitchat governance fork (on-device signing + `0state:tx:` on the mesh).
