export { analyzeFile, evidenceToText } from "./analyze/index.js";
export { planWithClaude, DEFAULT_MODEL } from "./agent/claude.js";
export { planOffline } from "./plan/offline.js";
export { expandBrief, addModule, removeModule, addTool, removeTool, validateBlueprint, BriefSchema } from "./plan/expand.js";
export { generate } from "./generate/index.js";
export { BlueprintSchema, type Blueprint } from "./blueprint/schema.js";
export type { Brief } from "./blueprint/brief.js";
export { MODULE_DEFS } from "./catalog/modules.js";
export { TOOLS, CATEGORIES } from "./catalog/tools.js";
