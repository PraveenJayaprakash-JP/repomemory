'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';

interface ExportButtonProps {
  scanId: string;
  disabled?: boolean;
}

export default function ExportButton({ scanId, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    setSuccess(false);
    try {
      const response = await fetch(`/api/export?scanId=${encodeURIComponent(scanId)}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `repomemory-pack-${scanId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleExport} 
      disabled={disabled || loading} 
      variant="outline"
      className="transition-default"
    >
      {loading ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparing...</>
      ) : success ? (
        <><CheckCircle2 className="h-4 w-4 mr-2 text-[var(--score-excellent)]" />Downloaded</>
      ) : (
        <><Download className="h-4 w-4 mr-2" />Export ZIP</>
      )}
    </Button>
  );
}
