# 0state CLI

The terminal client for [0state](https://0state.website) — a political
organization governed by the miners of [frankcoin](https://frankcoin.website).
Membership and voting are earned by mining; the vote is non-transferable.

## Install

    git clone https://github.com/maxtindall/0state
    cd 0state/cli && npm install && npm link

`npm link` exposes a global `0state` command. If your shell can't find it after
linking, run the client directly with `node 0state.mjs <command>`.

## Use

    0state status                     # the organization, and your standing
    0state join                       # become a member (requires having mined)
    0state proposals                  # open questions and weighted tallies
    0state propose "<title>" --body "…"
    0state vote <id> yes|no|abstain   # your weighted vote

Signing uses your local Solana keypair (default `~/.config/solana/id.json`,
override with `--key PATH`); nothing is custodied. Devnet by default
(`--rpc URL` to change). You must have mined frankcoin first — see
[frankcoin.website](https://frankcoin.website).
