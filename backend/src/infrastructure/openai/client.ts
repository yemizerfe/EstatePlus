import OpenAI from 'openai';

import { config } from '../../config';
import { logger } from '../../shared/utils/logger';

let openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!config.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set — AI features disabled');
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  maxTokens = config.OPENAI_MAX_TOKENS,
): Promise<string | null> {
  const client = getOpenAI();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content ?? null;
  } catch (err) {
    logger.error({ msg: 'OpenAI request failed', err });
    return null;
  }
}

export async function structuredCompletion<T>(
  messages: ChatMessage[],
  schema: string,
  maxTokens = 1024,
): Promise<T | null> {
  const client = getOpenAI();
  if (!client) return null;

  const systemMessage: ChatMessage = {
    role: 'system',
    content: `You are a structured data extraction assistant. 
Respond ONLY with valid JSON matching this schema: ${schema}
Do not include any explanation or markdown — pure JSON only.`,
  };

  try {
    const response = await client.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages: [systemMessage, ...messages],
      max_tokens: maxTokens,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Strip markdown code fences if present
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.error({ msg: 'OpenAI structured completion failed', err });
    return null;
  }
}
