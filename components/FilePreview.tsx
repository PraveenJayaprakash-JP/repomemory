'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileCode, AlertCircle } from 'lucide-react';
import type { GeneratedFile } from '@/lib/types';

interface FilePreviewProps {
  files: GeneratedFile[];
}

export default function FilePreview({ files }: FilePreviewProps) {
  const [activeTab, setActiveTab] = useState(files[0]?.fileName ?? '');

  if (files.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted mb-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            No generated files yet. Run generation first.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeFile = files.find((f) => f.fileName === activeTab);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Generated Files</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0 mb-4">
            {files.map((f) => (
              <TabsTrigger
                key={f.fileName}
                value={f.fileName}
                className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm border border-transparent data-[state=active]:border-border transition-default"
              >
                {f.fileName}
              </TabsTrigger>
            ))}
          </TabsList>
          <Separator className="mb-4" />
          {files.map((f) => (
            <TabsContent key={f.fileName} value={f.fileName} className="mt-0">
              <div className="relative">
                <pre className="bg-muted/80 p-4 rounded-lg overflow-auto max-h-[28rem] text-sm leading-relaxed border">
                  <code className="font-mono text-xs">{f.content}</code>
                </pre>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
