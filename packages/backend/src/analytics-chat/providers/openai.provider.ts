import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { AnalyticsToolsService } from '../analytics-tools.service';
import { AIProvider, ChatOptions, ChatResponse, ChatStreamChunk } from '../interfaces/ai-provider.interface';
import { QUINN_DEEPSEEK_SYSTEM_PROMPT } from '../quinn-deepseek-system-prompt';

export class OpenAIProvider implements AIProvider {
    private readonly logger = new Logger(OpenAIProvider.name);
    public readonly id = 'openai';

    constructor(
        private readonly client: OpenAI,
        private readonly toolsService: AnalyticsToolsService
    ) { }

    async *chatStream(options: ChatOptions): AsyncGenerator<ChatStreamChunk> {
        const { model, messages, tools, systemPrompt, maxIterations = 5 } = options;
        const toolsUsed: string[] = [];

        // Adapt Tools
        const openaiTools = tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema
            }
        }));

        // Construct Messages (Stateless API: requires full history)
        // DeepSeek/OpenAI expects system prompt first, then history
        const apiMessages = [
            { role: 'system', content: `${QUINN_DEEPSEEK_SYSTEM_PROMPT}\n\n${systemPrompt}` },
            ...messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        let fullResponse = '';
        let runLoop = true;
        let iterations = 0;

        // We need to keep tracking the current context within this stream session
        // to handle multi-turn tool usage efficiently
        let currentContextMessages: any[] = [...apiMessages];

        while (runLoop && iterations < maxIterations) {
            iterations++;

            const stream = await this.client.chat.completions.create({
                model: model,
                messages: currentContextMessages as any,
                tools: openaiTools.length > 0 ? openaiTools as any : undefined,
                stream: true,
            });

            let toolCalls: any[] = [];
            let chunkContent = '';

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                if (delta?.content) {
                    chunkContent += delta.content;
                    fullResponse += delta.content;
                    yield { type: 'text', content: delta.content };
                }
                if (delta?.tool_calls) {
                    for (const tc of delta.tool_calls) {
                        if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', function: { name: '', arguments: '' } };
                        if (tc.id) toolCalls[tc.index].id += tc.id;
                        if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                        if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                }
            }

            // If no tool calls, we are done
            if (toolCalls.length === 0) {
                runLoop = false;
                break;
            }

            // Process Tool Calls
            this.logger.log(`[OpenAIProvider] Processing ${toolCalls.length} tool calls (Iteration ${iterations})`);

            const assistantMessage = {
                role: 'assistant',
                content: chunkContent || null,
                tool_calls: toolCalls.map(tc => ({
                    id: tc.id,
                    type: 'function',
                    function: tc.function
                }))
            };

            currentContextMessages.push(assistantMessage as any);

            for (const tc of toolCalls) {
                const name = tc.function.name;
                const argsString = tc.function.arguments;
                let args = {};
                try { args = JSON.parse(argsString); } catch (e) { this.logger.error(`Failed to parse args for ${name}`); }

                this.logger.log(`[OpenAIProvider] Executing tool: ${name}`);
                toolsUsed.push(name);
                yield { type: 'tool', content: { name: name, status: 'executing' } };

                // Execute Tool
                // Note: we don't have direct access to cache here easily unless passed in, 
                // asking the service to handle execution might be better, but for now we execute directly if service is injected
                // Ideally, toolsService handles caching internally or we pass a callback.
                // For refactor simplicity, we assume toolsService is passed in.

                let result: any;
                try {
                    result = await this.toolsService.executeTool(name, args);
                } catch (e) {
                    result = { success: false, error: e.message };
                }

                const content = result.success && result.data?.error
                    ? JSON.stringify({ ...result.data, note: `Error: ${result.data.error}` })
                    : JSON.stringify(result.success ? result : { error: result.error });

                yield { type: 'tool', content: { name: name, status: 'complete' } };

                currentContextMessages.push({
                    tool_call_id: tc.id,
                    role: 'tool',
                    name: name,
                    content: content
                } as any);
            }

            this.logger.log(`[OpenAIProvider] Sending tool results to model`);
            yield { type: 'text', content: '\n\n' };
        }

        yield {
            type: 'done',
            content: {
                toolsUsed,
                modelUsed: model,
            },
        };
    }

    async chat(options: ChatOptions): Promise<ChatResponse> {
        const { model, messages, tools, systemPrompt, maxIterations = 5 } = options;
        const toolsUsed: string[] = [];
        const toolResults: any[] = [];

        const openaiTools = tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.input_schema,
            },
        }));

        const apiMessages = [
            { role: 'system', content: `${QUINN_DEEPSEEK_SYSTEM_PROMPT}\n\n${systemPrompt}` },
            ...messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        ];

        let currentContextMessages: any[] = [...apiMessages];
        let finalContent = '';
        let iterations = 0;

        while (iterations < maxIterations) {
            iterations++;
            const response = await this.client.chat.completions.create({
                model: model,
                messages: currentContextMessages as any,
                tools: openaiTools.length > 0 ? openaiTools as any : undefined,
            });

            const msg = response.choices[0].message;
            finalContent = msg.content || '';
            if (finalContent) {
                // In non-streaming, we might want to accumulate or just take the final
                // For simplicity, we usually take the final, but if tools run, we might want intermediate thoughts?
                // Typically we care about the *final* answer after tools. 
            }

            if (!msg.tool_calls || msg.tool_calls.length === 0) {
                break;
            }

            // Add assistant message to history
            currentContextMessages.push(msg);

            // Process tools
            for (const tc of msg.tool_calls as any[]) {
                this.logger.log(`[OpenAIProvider] Executing tool: ${tc.function.name} with args: ${tc.function.arguments}`);
                toolsUsed.push(tc.function.name);
                let args = {};
                try { args = JSON.parse(tc.function.arguments); } catch (e) { this.logger.error('Args parse error'); }

                let result: any;
                try {
                    result = await this.toolsService.executeTool(tc.function.name, args);
                } catch (e) {
                    this.logger.error(`Tool execution error: ${e.message}`);
                    result = { success: false, error: e.message };
                }

                if (!result) {
                    result = { success: false, error: 'Tool execution failed silently (null result)' };
                }

                this.logger.debug(`[OpenAIProvider] Tool ${tc.function.name} result data keys: ${JSON.stringify(Object.keys(result?.data || {}))}`);

                toolResults.push({
                    toolName: tc.function.name,
                    data: result
                });

                const content = JSON.stringify(result.success ? result : { error: result.error });

                currentContextMessages.push({
                    tool_call_id: tc.id,
                    role: 'tool',
                    name: tc.function.name,
                    content: content
                } as any);
            }
        }

        this.logger.log(`[OpenAIProvider] Chat loop finished. Total tools used: ${toolsUsed.length}`);

        return {
            content: finalContent,
            toolsUsed,
            toolResults
        };
    }
}
