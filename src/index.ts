// Moshi's TUI bridge (moshi-hook 0.4.35) answers an omp tool approval from the phone with a bare
// "y" or "n". The omp approval dialog (18.11+) routes printable keys into the composer beneath
// it, so the answer lands there as text and the dialog keeps waiting. While an approval waits, this
// extension turns those letters into the dialog's own keys. Both keys act before the dialog looks
// at the composer, so they answer even over a draft; y/n can't be typed into one meanwhile.

/** Ctrl+Q: the default `app.approval.approve` chord. */
export const APPROVE_KEY = "\x11";
/** Esc: denies the pending call. */
export const DENY_KEY = "\x1b";

export type TerminalInputHandler = (
  data: string,
) => { consume?: boolean; data?: string } | undefined;

export interface ExtensionContextLike {
  hasUI: boolean;
  ui: {
    onTerminalInput(handler: TerminalInputHandler): () => void;
  };
}

export interface ApprovalEventLike {
  toolCallId: string;
}

export interface ExtensionApiLike {
  on(
    event: "tool_approval_requested" | "tool_approval_resolved",
    handler: (event: ApprovalEventLike, ctx: ExtensionContextLike) => void,
  ): void;
}

export default function moshiApprovalKeys(omp: ExtensionApiLike): void {
  const listeners = new Map<string, () => void>();

  omp.on("tool_approval_requested", (event, ctx) => {
    // Headless subagents draw no dialog to answer.
    if (!ctx.hasUI) {
      return;
    }
    const unsubscribe = ctx.ui.onTerminalInput((data) => {
      if (data === "y") {
        return { data: APPROVE_KEY };
      }
      if (data === "n") {
        return { data: DENY_KEY };
      }
      return undefined;
    });
    listeners.set(event.toolCallId, unsubscribe);
  });

  // Fired on every outcome (approve, deny, abort), so no listener outlives its dialog.
  omp.on("tool_approval_resolved", (event) => {
    listeners.get(event.toolCallId)?.();
    listeners.delete(event.toolCallId);
  });
}
