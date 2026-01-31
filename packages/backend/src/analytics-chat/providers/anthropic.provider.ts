import { Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AnalyticsToolsService } from '../analytics-tools.service';
import { AIProvider, ChatOptions, ChatResponse, ChatStreamChunk } from '../interfaces/ai-provider.interface';
import { QUINN_BASE_SYSTEM_PROMPT } from '../quinn-system-prompt';

export class AnthropicProvider implements AIProvider {
    private readonly logger = new Logger(AnthropicProvider.name);
    public readonly id = 'anthropic';

    constructor(
        private readonly client: Anthropic,
        private readonly toolsService: AnalyticsToolsService
    ) { }

    async *chatStream(options: ChatOptions): AsyncGenerator<ChatStreamChunk> {
        const { model, messages, tools, systemPrompt, maxIterations = 5 } = options;
        const toolsUsed: string[] = [];

        const systemBlocks = [
            { type: 'text' as const, text: QUINN_BASE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
            { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
        ];

        const apiMessages = messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));

        let fullResponse = '';
        let stream = await this.client.messages.stream({
            model: model,
            max_tokens: 2048,
            system: systemBlocks as any,
            tools: tools as any,
            messages: apiMessages,
        });

        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullResponse += text;
                yield { type: 'text', content: text };
            }
        }

        let finalMessage = await stream.finalMessage();
        let iterations = 0;

        while (finalMessage.stop_reason === 'tool_use' && iterations < maxIterations) {
            iterations++;
            const toolUseBlocks = finalMessage.content.filter((b) => b.type === 'tool_use');
            const toolResultsForFollowUp: Array<{ id: string; content: string }> = [];

            this.logger.log(`[AnthropicProvider] Processing ${toolUseBlocks.length} tool calls`);

            for (const toolUse of toolUseBlocks) {
                if (toolUse.type !== 'tool_use') continue;

                this.logger.log(`[AnthropicProvider] Executing tool: ${toolUse.name}`);
                toolsUsed.push(toolUse.name);
                yield { type: 'tool', content: { name: toolUse.name, status: 'executing' } };

                let result: any;
                try {
                    result = await this.toolsService.executeTool(toolUse.name, toolUse.input as any);
                } catch (e) {
                    result = { success: false, error: e.message };
                }

                const toolResultContent =
                    result.success && result.data?.error
                        ? JSON.stringify({
                            ...result.data,
                            note: `Service reported an error. Tell the user: ${result.data.error}`,
                        })
                        : JSON.stringify(result.success ? result : { error: result.error });

                toolResultsForFollowUp.push({ id: toolUse.id, content: toolResultContent });

                yield { type: 'tool', content: { name: toolUse.name, status: 'complete' } };
            }

            yield { type: 'text', content: '\n\n' };

            this.logger.log(`[AnthropicProvider] Sending tool results`);

            const nextStream = await this.client.messages.stream({
                model: model,
                max_tokens: 2048,
                system: systemBlocks as any,
                tools: tools as any,
                messages: [
                    ...apiMessages,
                    { role: 'assistant', content: finalMessage.content },
                    {
                        role: 'user',
                        content: toolResultsForFollowUp.map((tr) => ({
                            type: 'tool_result' as const,
                            tool_use_id: tr.id,
                            content: tr.content,
                        })),
                    },
                ],
            });

            stream = nextStream;

            for await (const chunk of nextStream) {
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    const text = chunk.delta.text;
                    fullResponse += text;
                    yield { type: 'text', content: text };
                }
            }

            finalMessage = await nextStream.finalMessage();
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

        const systemBlocks = [
            { type: 'text' as const, text: QUINN_BASE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
            { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
        ];

        const apiMessages = messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
        }));

        let response = await this.client.messages.create({
            model: model,
            max_tokens: 2048,
            system: systemBlocks as any,
            tools: tools as any,
            messages: apiMessages,
        });

        let finalContent = '';
        const textBlocks = response.content.filter(b => b.type === 'text');
        if (textBlocks.length > 0) {
            finalContent = textBlocks.map(b => b.text).join('');
        }

        let iterations = 0;
        const messagesWithToolTurns: any[] = [...apiMessages];

        while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
            iterations++;
            const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
            const turnToolResults: any[] = [];

            for (const toolUse of toolUseBlocks) {
                if (toolUse.type !== 'tool_use') continue;
                toolsUsed.push(toolUse.name);

                this.logger.log(`[AnthropicProvider] Executing tool: ${toolUse.name} with input: ${JSON.stringify(toolUse.input)}`);
                let result: any;
                try {
                    result = await this.toolsService.executeTool(toolUse.name, toolUse.input as any);
                } catch (e) {
                    result = { success: false, error: e.message };
                }

                this.logger.debug(`[AnthropicProvider] Tool ${toolUse.name} result: ${JSON.stringify(result).slice(0, 500)}`);

                toolResults.push({
                    toolName: toolUse.name,
                    data: result
                });

                turnToolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(result.success ? result : { error: result.error })
                });
            }

            messagesWithToolTurns.push(
                { role: 'assistant', content: response.content },
                { role: 'user', content: turnToolResults }
            );

            response = await this.client.messages.create({
                model: model,
                max_tokens: 2048,
                system: systemBlocks as any,
                tools: tools as any,
                messages: messagesWithToolTurns
            });

            const nextText = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
            if (nextText) {
                finalContent += nextText;
            }
        }

        return {
            content: finalContent,
            toolsUsed,
            toolResults
        };
    }
}
