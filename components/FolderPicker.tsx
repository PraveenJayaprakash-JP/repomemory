'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FolderOpen, Scan, Loader2, AlertCircle } from 'lucide-react';

interface FolderPickerProps {
  onScan: (folderPath: string) => void;
  loading?: boolean;
}

export default function FolderPicker({ onScan, loading }: FolderPickerProps) {
  const [folderPath, setFolderPath] = useState('');
  const [error, setError] = useState('');

  const handleScan = () => {
    const trimmed = folderPath.trim();
    if (!trimmed) {
      setError('Please enter a folder path');
      return;
    }
    setError('');
    onScan(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={folderPath}
            onChange={(e) => { setFolderPath(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            placeholder="Enter absolute path to repo folder, e.g. C:\Users\me\project"
            className="pl-10 font-mono text-sm transition-default"
            disabled={loading}
            aria-invalid={!!error}
            aria-describedby={error ? 'folder-error' : undefined}
          />
        </div>
        <Button onClick={handleScan} disabled={loading || !folderPath.trim()}>
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scanning...</>
          ) : (
            <><Scan className="h-4 w-4 mr-2" />Scan Repo</>
          )}
        </Button>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--score-critical)]" id="folder-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground leading-relaxed">
        Enter the full path to any local repository folder. The tool will scan it read-only — no files will be modified.
      </p>
    </div>
  );
}
