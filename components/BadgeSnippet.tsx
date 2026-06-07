'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';

interface BadgeSnippetProps {
  projectId: string;
  score: number;
}

export default function BadgeSnippet({ projectId, score }: BadgeSnippetProps) {
  const badgeUrl = `/api/badge?projectId=${encodeURIComponent(projectId)}`;
  const fullBadgeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${badgeUrl}`;
  const repoUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const markdownSnippet = `[![AI Readiness](${fullBadgeUrl})](${repoUrl})`;
  const htmlSnippet = `<img src="${fullBadgeUrl}" alt="AI Readiness" />`;

  const [copiedField, setCopiedField] = useState<'markdown' | 'html' | null>(null);

  async function copyToClipboard(text: string, field: 'markdown' | 'html') {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback: select text in pre element
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Badge Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center p-4 bg-muted rounded-md">
            <img
              src={badgeUrl}
              alt={`AI Readiness: ${score}/100`}
              className="h-5"
            />
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">Markdown</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(markdownSnippet, 'markdown')}
                  className="h-7 px-2"
                >
                  {copiedField === 'markdown' ? (
                    <><Check className="h-3.5 w-3.5 mr-1" />Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>
                  )}
                </Button>
              </div>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
                <code>{markdownSnippet}</code>
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">HTML</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(htmlSnippet, 'html')}
                  className="h-7 px-2"
                >
                  {copiedField === 'html' ? (
                    <><Check className="h-3.5 w-3.5 mr-1" />Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5 mr-1" />Copy</>
                  )}
                </Button>
              </div>
              <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
                <code>{htmlSnippet}</code>
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}