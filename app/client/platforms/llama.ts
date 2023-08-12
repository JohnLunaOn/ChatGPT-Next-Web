/*
GPT 生成代码：
请续写一个 TypeScript 函数 payload()，需求如下：
- payload 函数中 config 变量的默认值如下
{
  llamaCppServerUrl: "http://127.0.0.1:8888",
  useLlamaCppServer: false,
  username: "User",
  charname: "Bot",
  llamaCppConfig: {
    temperature: 0.5,
    top_p: 0.8,
    max_tokens: 300,
    eps: 1e-6,
    repeat_last_n: 256,
    template: "{{system}}\n\n{{description}}\n\n{{first_message}}\n\n{{input}}"
  }
}
- payload 函数返回值是 LlamaRequestPayload 类型
- 返回值中的 stream = !!options.config.stream
- 返回值中的 temperature, eps, top_p, repeat_last_n, charname, username 从 config.llamaCppConfig 获取
- 返回值中的 prompt 按照以下顺序生成:
prompt = llamaCppConfig.template
1. 查询并打印 prompt 中需要被替换的项目item列表：格式均为{{item}}
2. 每个替换值均应该做 trim 后再替换，如果 trim 后替换值为空需要打印 warning
4. 遍历 options.messages，并将 template 的值逐步替换：
4.1 如果 messages 数组长度小于3，或者前3条消息的role不是"system"，打印错误"{{system}}, {{description}}, {{first_message}} 需要在前3条消息里设定（临时方案）"，并返回空值
4.2 messages 数组的第1条消息的 content 替换 {{system}}
4.3 messages 数组的第2条消息的 content 替换 {{description}}
4.4 messages 数组的第3条消息的 content 替换 {{first_message}}
4.5 从第4条消息开始，如果 role == "system"，忽略该消息
4.6 新建一个 inputString，如果 role == "user"， 拼接 username + ": " + content.trim() + "\n\n"
4.7 如果 role == "assistant"，inputString 拼接 charname + ": " + content.trim() + "\n\n"
4.8 如果最后一个 message.role == "assistant"，并且 content 不为空，打印 warning："最后一条 message 的 role 不应该是 assistant"
4.9 最后将 inputString trim后拼接 "\n\n" + charname + ":" 
5. 使用inputString 替换 {{input}}
6. charname 替换 {{char}}
7. username 替换 {{user}}

以下是已有的代码：
*/

import { useAppConfig } from "@/app/store";
import { ChatOptions } from "../api";

export const OPENAI_ROLES: { [key: string]: string } = {
  SYSTEM: "system",
  USER: "user",
  ASSISTANT: "assistant",
};

export const CHAR_DEFINITIONS: { [key: string]: string } = {
  SYSTEM: "system",
  DESCRIPTION: "description",
  FIRST_MESSAGE: "first_message",
  CHAR: "char",
  USER: "user",
};

export interface LlamaRequestPayload {
  prompt: string;
  stream: boolean;
  temperature: number;
  eps: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  repeat_last_n: number;
  n_predict: number;
  stop: string[];
  charname: string;
  username: string;
  customUrl: string;
}

const LLAMA_API_CHAT_PATH = "/api/llama/completion"; // current server's api path
export function chatPath() {
  return LLAMA_API_CHAT_PATH;
}

// Function to safely replace and trim values in the template
function safeReplace(
  prompt: string,
  item: keyof typeof CHAR_DEFINITIONS,
  value: string,
): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    console.warn(
      `Warning: Replacement for {{${item}}} is empty after trimming.`,
    );
  }
  return prompt.replace(`{{${CHAR_DEFINITIONS[item]}}}`, trimmedValue);
}

export function payload(options: ChatOptions): LlamaRequestPayload | null {
  const config = useAppConfig.getState();
  const stream = !!options.config?.stream;
  const llamaCppConfig = config.llamaCppConfig;
  let prompt = llamaCppConfig.template;

  // Check messages array
  const { messages } = options;
  if (
    messages.length < 3 ||
    messages.slice(0, 3).some((m) => m.role !== OPENAI_ROLES.SYSTEM)
  ) {
    console.error(
      `{${CHAR_DEFINITIONS.SYSTEM}, ${CHAR_DEFINITIONS.DESCRIPTION}, ${CHAR_DEFINITIONS.FIRST_MESSAGE}} need to be set in the first 3 messages (temporary solution)`,
    );
    return null;
  }

  // Replacing system, description, first_message
  prompt = safeReplace(prompt, CHAR_DEFINITIONS.SYSTEM, messages[0].content);
  prompt = safeReplace(
    prompt,
    CHAR_DEFINITIONS.DESCRIPTION,
    messages[1].content,
  );
  prompt = safeReplace(
    prompt,
    CHAR_DEFINITIONS.FIRST_MESSAGE,
    messages[2].content,
  );

  // Concatenate further messages
  let inputString = "";
  for (let i = 3; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === OPENAI_ROLES.SYSTEM) continue;
    if (message.role === OPENAI_ROLES.USER) {
      inputString += `${config.username}: ${message.content.trim()}\n\n`;
    } else if (message.role === OPENAI_ROLES.ASSISTANT) {
      inputString += `${config.charname}: ${message.content.trim()}\n\n`;
    }
  }

  if (messages[messages.length - 1].role === OPENAI_ROLES.ASSISTANT) {
    console.warn("The last message's role should not be assistant");
  }

  inputString = `${inputString.trim()}\n\n${config.charname}:`;
  prompt = safeReplace(prompt, CHAR_DEFINITIONS.CHAR, config.charname);
  prompt = safeReplace(prompt, CHAR_DEFINITIONS.USER, config.username);

  const defaultStops = [
    "</s>",
    `\n${config.charname}:`,
    `\n${config.username}:`,
  ];
  return {
    prompt,
    stream,
    temperature: llamaCppConfig.temperature,
    eps: llamaCppConfig.eps,
    top_p: llamaCppConfig.top_p,
    top_k: llamaCppConfig.top_k,
    repeat_penalty: llamaCppConfig.repeat_penalty,
    repeat_last_n: llamaCppConfig.repeat_last_n,
    n_predict: llamaCppConfig.max_tokens,
    stop: defaultStops,
    charname: config.charname,
    username: config.username,
    customUrl: config.llamaCppServerUrl,
  };
}
