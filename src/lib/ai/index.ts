/**
 * Public surface for the server-only AI module.
 *
 * These re-exports pull in server-only code; import from here only in server
 * components, route handlers or server actions.
 */

export { isAIEnabled, getVertexModel } from "./vertex";
export { parseResumeWithAI } from "./resume";
