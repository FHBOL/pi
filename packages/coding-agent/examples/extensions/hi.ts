/**
 * Hi Extension — minimal slash-command demo
 *
 * Shows the smallest useful extension pattern:
 *   1. `export default function (pi: ExtensionAPI)` — entry point
 *   2. `pi.registerCommand(...)` — register `/hi`
 *   3. In the handler, call `pi.sendUserMessage(...)` — talk to the agent
 *
 * How it reaches this code when you type `/hi world` in interactive mode:
 *   InteractiveMode submit
 *     → AgentSession.prompt("/hi world")
 *     → _tryExecuteExtensionCommand()   // packages/coding-agent/src/core/agent-session.ts
 *     → command.handler("world", ctx)   // this file
 *     → pi.sendUserMessage("hi world")  // starts (or queues) an agent turn
 *
 * Extension commands run immediately and do NOT go through the normal LLM
 * prompt path; they own their own follow-up via sendUserMessage / sendMessage.
 *
 * Usage:
 *   pi --extension packages/coding-agent/examples/extensions/hi.ts
 *   /hi
 *   /hi Alice
 *
 * Or copy / symlink into ~/.pi/agent/extensions/ or the project's .pi/extensions/.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("hi", {
		description: "Send a greeting: hi [<args>]",
		handler: async (args, ctx) => {
			const message = args.trim() ? `hi ${args.trim()}` : "hi";

			// Idle: send immediately and start a new agent turn.
			// Busy: queue as follow-up so the current run can finish first.
			if (ctx.isIdle()) {
				pi.sendUserMessage(message);
			} else {
				pi.sendUserMessage(message, { deliverAs: "followUp" });
				ctx.ui.notify(`Queued: ${message}`, "info");
			}
		},
	});
}
