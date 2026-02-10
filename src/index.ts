export type { Env } from "./types";
export { ConfigAssistantDO } from "./do/config_assistant_do";

import handler from "./worker/handler";

export default handler;
