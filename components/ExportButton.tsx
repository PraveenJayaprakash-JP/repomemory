'use client';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Loader2, CheckCircle2 } from 'lucide-react';

interface ExportButtonProps {
  scanId: string;
  disabled?: boolean;
}

export default function ExportButton({ scanId, disabled }: ExportButtonProps) {
  const handleExport = async () => {
    await toast.promise(
      (async () => {
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
      })(),
      {
        loading: 'Preparing export...',
        success: 'Export ready — download started',
        error: (err) => err instanceof Error ? err.message : 'Export failed',
      }
    );
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled}
      variant="outline"
      className="transition-default"
    >
      <Download className="h-4 w-4 mr-2" />Export ZIP
    </Button>
  );
}
