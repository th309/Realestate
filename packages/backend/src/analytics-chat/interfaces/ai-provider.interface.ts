
export interface ChatOptions {
    conversationId: string;
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    tools: any[];
    systemPrompt: string;
    model: string;
    maxIterations?: number;
}

export interface ChatStreamChunk {
    type: 'text' | 'tool' | 'done';
    content: any;
}

export interface ChatResponse {
    content: string;
    toolsUsed: string[];
    toolResults: any[];
    metadata?: any;
}

export interface AIProvider {
    id: string; // 'openai' | 'anthropic'

    chatStream(options: ChatOptions): AsyncGenerator<ChatStreamChunk>;

    chat(options: ChatOptions): Promise<ChatResponse>;
}
