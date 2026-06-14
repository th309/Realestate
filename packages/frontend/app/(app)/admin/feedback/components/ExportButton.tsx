/**
 * Export Button Component
 * 
 * Exports selected feedback items in IDE-ready formats.
 */

'use client';

import { useState } from 'react';
import { CATEGORY_CONFIG, SEVERITY_CONFIG } from '../../../betatest/types';
import type { FeedbackWithTester } from '../../../betatest/types';

interface ExportButtonProps {
  feedback: FeedbackWithTester[];
}

type ExportFormat = 'markdown' | 'json';

export function ExportButton({ feedback }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const generateMarkdown = (items: FeedbackWithTester[]): string => {
    return items.map((item) => {
      const categoryLabel = CATEGORY_CONFIG[item.category]?.label || item.category;
      const severityLabel = item.severity ? SEVERITY_CONFIG[item.severity]?.label : null;
      
      let md = `# ${categoryLabel}: ${item.title}\n\n`;
      md += `## Context\n`;
      md += `- **Category:** ${categoryLabel}\n`;
      if (severityLabel) md += `- **Severity:** ${severityLabel}\n`;
      md += `- **Status:** ${item.status}\n`;
      if (item.page_url) md += `- **Page URL:** ${item.page_url}\n`;
      if (item.affected_component) md += `- **Affected Component:** ${item.affected_component}\n`;
      md += `- **Submitted by:** ${item.tester?.name || 'Unknown'}\n`;
      md += `- **Date:** ${new Date(item.created_at).toLocaleDateString()}\n\n`;
      
      md += `## Description\n${item.description}\n\n`;
      
      if (item.steps_to_reproduce) {
        md += `## Steps to Reproduce\n${item.steps_to_reproduce}\n\n`;
      }
      
      if (item.expected_behavior) {
        md += `## Expected Behavior\n${item.expected_behavior}\n\n`;
      }
      
      if (item.actual_behavior) {
        md += `## Actual Behavior\n${item.actual_behavior}\n\n`;
      }
      
      if (item.attachments && item.attachments.length > 0) {
        md += `## Attachments\n`;
        item.attachments.forEach((att, i) => {
          md += `- [${att.filename}](${att.url})\n`;
        });
        md += '\n';
      }
      
      // Add suggested investigation paths
      md += `## Suggested Files to Investigate\n`;
      if (item.page_url) {
        const routePath = item.page_url.replace(/^\//, '');
        md += `- \`packages/frontend/app/${routePath || 'page'}.tsx\`\n`;
      }
      if (item.affected_component) {
        md += `- Search for: "${item.affected_component}"\n`;
      }
      md += '\n---\n\n';
      
      return md;
    }).join('');
  };

  const generateJSON = (items: FeedbackWithTester[]): string => {
    const exported = items.map((item) => ({
      id: item.id,
      task_type: item.category,
      priority: item.severity || 'medium',
      title: item.title,
      description: item.description,
      repro_steps: item.steps_to_reproduce?.split('\n').filter(Boolean) || [],
      expected: item.expected_behavior || null,
      actual: item.actual_behavior || null,
      page_url: item.page_url || null,
      affected_component: item.affected_component || null,
      attachments: item.attachments?.map(a => a.url) || [],
      suggested_files: getSuggestedFiles(item),
      submitted_by: item.tester?.name || 'Unknown',
      submitted_at: item.created_at,
    }));
    
    return JSON.stringify(exported, null, 2);
  };

  const getSuggestedFiles = (item: FeedbackWithTester): string[] => {
    const files: string[] = [];
    
    if (item.page_url) {
      const routePath = item.page_url.replace(/^\//, '').replace(/\/$/, '');
      if (routePath) {
        files.push(`packages/frontend/app/${routePath}/page.tsx`);
      } else {
        files.push('packages/frontend/app/page.tsx');
      }
    }
    
    return files;
  };

  const handleExport = (format: ExportFormat) => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      content = generateMarkdown(feedback);
      filename = `feedback-export-${Date.now()}.md`;
      mimeType = 'text/markdown';
    } else {
      content = generateJSON(feedback);
      filename = `feedback-export-${Date.now()}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsOpen(false);
  };

  const handleCopyMarkdown = async () => {
    const content = generateMarkdown(feedback);
    await navigator.clipboard.writeText(content);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80 flex items-center gap-2"
      >
        <span>Export ({feedback.length})</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-surface rounded-xl shadow-lg border border-outline-variant z-50">
            <div className="p-2">
              <button
                onClick={() => handleExport('markdown')}
                className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container rounded-lg flex items-center gap-3"
              >
                <span className="text-lg">📝</span>
                <div>
                  <div className="font-medium">Markdown</div>
                  <div className="text-xs text-on-surface-variant">For Cursor/Claude</div>
                </div>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container rounded-lg flex items-center gap-3"
              >
                <span className="text-lg">{ }</span>
                <div>
                  <div className="font-medium">JSON</div>
                  <div className="text-xs text-on-surface-variant">Structured data</div>
                </div>
              </button>
              <hr className="my-2 border-outline-variant" />
              <button
                onClick={handleCopyMarkdown}
                className="w-full px-4 py-2 text-left text-sm text-on-surface hover:bg-surface-container rounded-lg flex items-center gap-3"
              >
                <span className="text-lg">📋</span>
                <div>
                  <div className="font-medium">Copy to Clipboard</div>
                  <div className="text-xs text-on-surface-variant">Markdown format</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
