# omp-moshi-approval-keys

An [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) extension that lets
[Moshi](https://getmoshi.app) answers from the phone resolve omp tool approval dialogs.

> Status: personal workaround for a moshi-hook bug. Not affiliated with oh-my-pi or Moshi.

## Problem

moshi-hook 0.4.35 answers an omp tool approval by typing a bare `y` (Approve) or `n` (Deny) into
the agent's pane. The omp approval dialog (18.11+) sends printable keys to the composer beneath
it, so the letter lands as a draft and the dialog keeps waiting. The draft also turns the next
`Enter` on the computer into "Deny and send message", with the letter sent to the agent.

## What it does

While an approval waits (`tool_approval_requested` until `tool_approval_resolved`), a
`ctx.ui.onTerminalInput` listener rewrites the key before the dialog sees it:

| Key | Becomes | Dialog action |
|---|---|---|
| `y` | `Ctrl+Q` | approve this call (default `app.approval.approve` chord) |
| `n` | `Esc` | deny |

Every other key passes through unchanged. The dialog handles both keys before it looks at the
composer, so they answer even when the composer holds a draft, and the draft stays as it was.

## Install

```sh
git clone https://github.com/shreyner/omp-moshi-approval-keys.git
```

Add the entry point to `~/.omp/agent/config.yml`, then restart omp sessions:

```yaml
extensions:
  - /path/to/omp-moshi-approval-keys/src/index.ts
```

To try it in one session first: `omp -e /path/to/omp-moshi-approval-keys/src/index.ts`.

Tested with omp 18.12.5, moshi-hook 0.4.35 and herdr 0.9.5 on macOS.

## Limits

- While an approval waits, a lowercase Latin `y`/`n` always answers it, so neither letter can be
  typed into a steering message until the dialog closes.
- `Ctrl+Q` is the default approve chord. If you rebind `app.approval.approve` in
  `keybindings.yml`, keep `Ctrl+Q` in it or change `APPROVE_KEY`.
- Interactive TUI only: RPC and ACP modes have no `onTerminalInput`.

Remove the extension once moshi-hook answers omp approvals with the dialog's own keys. Until
then it is harmless if Moshi switches to `Esc`/`Ctrl+Q`: those keys pass through untouched.

## Checks

```sh
bun install
bun run test    # the last test drives the approval dialog of the installed omp; skipped without one
bun run check   # tsc + biome
```

## License

[MIT](LICENSE)
