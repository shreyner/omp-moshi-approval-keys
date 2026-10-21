import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import moshiApprovalKeys, {
  APPROVE_KEY,
  type ApprovalEventLike,
  DENY_KEY,
  type ExtensionContextLike,
  type TerminalInputHandler,
} from "../src/index";

type Handler = (event: ApprovalEventLike, ctx: ExtensionContextLike) => void;

/** A fake host: the extension's handlers and its input listeners. */
function host(hasUI = true) {
  const handlers = new Map<string, Handler>();
  const listeners = new Set<TerminalInputHandler>();
  const ctx: ExtensionContextLike = {
    hasUI,
    ui: {
      onTerminalInput: (handler) => {
        listeners.add(handler);
        return () => listeners.delete(handler);
      },
    },
  };
  moshiApprovalKeys({ on: (event, handler) => handlers.set(event, handler) });
  return {
    listeners,
    request: (toolCallId: string) => handlers.get("tool_approval_requested")!({ toolCallId }, ctx),
    resolve: (toolCallId: string) => handlers.get("tool_approval_resolved")!({ toolCallId }, ctx),
    /** What the focused component receives, chained like pi-tui's TUI input dispatch. */
    press(data: string): string {
      let current = data;
      for (const listener of listeners) {
        const result = listener(current);
        if (result?.consume) {
          return "";
        }
        if (result?.data !== undefined) {
          current = result.data;
        }
      }
      return current;
    },
  };
}

test("y/n answer only while an approval waits", () => {
  const omp = host();
  expect(omp.press("y")).toBe("y");

  omp.request("call_1");
  expect(omp.press("y")).toBe(APPROVE_KEY);
  expect(omp.press("n")).toBe(DENY_KEY);
  expect(omp.press("x")).toBe("x");

  omp.resolve("call_1");
  expect(omp.listeners.size).toBe(0);
  expect(omp.press("y")).toBe("y");
});

test("headless sessions register no listener", () => {
  const omp = host(false);
  omp.request("call_1");
  expect(omp.listeners.size).toBe(0);
});

const OMP_TUI = join(homedir(), ".bun/install/global/node_modules/@oh-my-pi/pi-tui/src");

test.skipIf(!existsSync(join(OMP_TUI, "overlays/approval-dialog.ts")))(
  "the installed omp approval dialog takes the mapped keys",
  async () => {
    const { initTheme } = await import(join(OMP_TUI, "theme/theme.ts"));
    const { APPROVE_ARM_MS, ApprovalDialogComponent } = await import(
      join(OMP_TUI, "overlays/approval-dialog.ts")
    );
    await initTheme();

    const answer = async (data: string, draft = "") => {
      const omp = host();
      omp.request("call_1");
      let result = "pending";
      const dialog = new ApprovalDialogComponent(
        "Allow tool: session_move",
        { onApprove: () => (result = "approve"), onDeny: () => (result = "deny") },
        {
          draft: {
            hasDraft: () => draft.length > 0,
            handleInput: (key: string) => (draft += key),
          },
        },
      );
      await Bun.sleep(APPROVE_ARM_MS + 50);
      dialog.handleInput(omp.press(data));
      return { draft, result };
    };

    expect(await answer("y")).toEqual({ draft: "", result: "approve" });
    expect(await answer("n")).toEqual({ draft: "", result: "deny" });
    // A draft is left as it was, and the answer still goes through.
    expect(await answer("y", "wip")).toEqual({ draft: "wip", result: "approve" });
    expect(await answer("n", "wip")).toEqual({ draft: "wip", result: "deny" });
  },
);
