#!/usr/bin/env npx tsx
/**
 * Quinn Per-Test Optimizer
 * 
 * Runs tests one by one, evaluates immediately, and stops on failures (score < 95).
 * Allows for iterative fixing and retesting of individual prompts.
 * 
 * Usage:
 *   npx tsx scripts/quinn-test/optimize-prompts.ts <prompts.txt> --url <backend-url>
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { evaluateResponse, TestResponse, QualityEvaluation } from './evaluate-responses.ts';

const DEFAULT_BACKEND = 'https://backend-production-ee4d.up.railway.app';
const TARGET_SCORE = 95;

function generateConversationId(): string {
    return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function sendMessage(
    baseUrl: string,
    conversationId: string,
    message: string
): Promise<{ durationMs: number; data: any }> {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/analytics/chat/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
    });
    const durationMs = Date.now() - start;
    let data: any;
    try {
        data = await res.json();
    } catch {
        data = { success: false, error: `HTTP ${res.status} (no JSON)` };
    }
    return { durationMs, data };
}

function loadPrompts(path: string): string[] {
    const p = path.startsWith('/') || /^[A-Za-z]:/.test(path) ? path : join(process.cwd(), path);
    if (!existsSync(p)) {
        console.error(`Prompts file not found: ${p}`);
        process.exit(1);
    }
    return readFileSync(p, 'utf-8')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !s.startsWith('#'));
}

async function main() {
    const args = process.argv.slice(2);
    let promptsPath = '';
    let backendUrl = DEFAULT_BACKEND;
    let resumeIndex = 0;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--url' && args[i + 1]) {
            backendUrl = args[++i];
        } else if (args[i] === '--resume' && args[i + 1]) {
            resumeIndex = parseInt(args[++i], 10);
        } else if (!args[i].startsWith('-')) {
            promptsPath = args[i];
        }
    }

    if (!promptsPath) {
        console.error('Usage: npx tsx scripts/quinn-test/optimize-prompts.ts <prompts.txt> [--url <url>] [--resume <index>]');
        process.exit(1);
    }

    const prompts = loadPrompts(promptsPath);
    console.log(`Starting optimization run against: ${backendUrl}`);
    console.log(`Target Score: ${TARGET_SCORE}\n`);

    for (let i = resumeIndex; i < prompts.length; i++) {
        const prompt = prompts[i];
        console.log(`[${i + 1}/${prompts.length}] Testing: "${prompt}"`);

        const conversationId = generateConversationId();
        const { durationMs, data } = await sendMessage(backendUrl, conversationId, prompt);

        const result: TestResponse = {
            prompt,
            success: data.success,
            durationMs,
            toolsUsed: data.toolsUsed ?? [],
            responseText: data.response ?? '',
            structuredData: data.structuredData ?? null,
            error: data.error
        };

        const evaluation = evaluateResponse(result);

        console.log(`  Success: ${evaluation.passes ? '✅' : '❌'}`);
        console.log(`  Score:   ${evaluation.overallScore.toFixed(1)}`);
        console.log(`  Tools:   [${evaluation.toolsUsed.join(', ')}]`);
        console.log(`  Time:    ${durationMs}ms`);

        if (!evaluation.passes) {
            console.log('\n--- FAILURE DETAILS ---');
            console.log(`Issues: ${evaluation.issues.join(', ')}`);
            if (evaluation.noDataWhenNeeded) console.log('⚠️  Critical: No data returned when needed');
            if (evaluation.wrongScoringSystem) console.log('⚠️  Critical: Wrong scoring system used');
            if (evaluation.hallucination) console.log('⚠️  Critical: Hallucinated data in response');
            if (evaluation.incompleteAnswer) console.log('⚠️  Critical: Incomplete answer');
            if (evaluation.dataOmission) console.log('⚠️  Critical: Missing requested parts of prompt');

            console.log('\nResponse:');
            console.log(evaluation.responseText);

            console.log(`\nOptimization stopped at index ${i}. Fix the issue and restart with:`);
            console.log(`npx tsx scripts/quinn-test/optimize-prompts.ts ${promptsPath} --url ${backendUrl} --resume ${i}`);
            process.exit(1);
        }

        console.log('------------------------------------------\n');
    }

    console.log('🎉 All tests passed with score >= 95!');
}

main();
