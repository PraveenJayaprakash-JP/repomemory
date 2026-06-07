'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ScanCompare from '@/components/ScanCompare';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Scan } from '@/lib/types';

function CompareSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-9 w-9 bg-muted rounded-md animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><CardContent className="py-8"><div className="h-20 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
        <Card><CardContent className="py-8"><div className="h-20 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
      </div>
      <Card><CardContent className="py-8"><div className="h-40 w-full bg-muted rounded animate-pulse" /></CardContent></Card>
    </div>
  );
}

export default function ComparePageWrapper() {
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <ComparePage />
    </Suspense>
  );
}

function ComparePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [scan1, setScan1] = useState<Scan | null>(null);
  const [scan2, setScan2] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const scanId1 = searchParams.get('scanId1');
      const scanId2 = searchParams.get('scanId2');

      if (!scanId2) {
        toast.error('Missing scan ID parameter');
        router.push('/');
        return;
      }

      try {
        // Fetch scan2 (the newer/current scan)
        const res2 = await fetch(`/api/scan/${scanId2}`);
        const data2 = await res2.json();
        if (!data2.ok) throw new Error(data2.error || 'Scan not found');
        const newerScan: Scan = data2.data;
        setScan2(newerScan);

        if (scanId1) {
          // Explicit older scan provided
          const res1 = await fetch(`/api/scan/${scanId1}`);
          const data1 = await res1.json();
          if (!data1.ok) throw new Error(data1.error || 'Previous scan not found');
          setScan1(data1.data);
        } else {
          // Auto-find previous scan for same project
          const scansRes = await fetch(`/api/scans?projectId=${encodeURIComponent(newerScan.projectId)}`);
          const scansData = await scansRes.json();
          if (!scansData.ok) throw new Error(scansData.error || 'Failed to load scans');

          const scansList: { id: string; createdAt: string }[] = scansData.data.scans;
          // Scans are sorted ascending by date from the API
          const currentIdx = scansList.findIndex(s => s.id === newerScan.id);
          if (currentIdx > 0) {
            const prevId = scansList[currentIdx - 1].id;
            const res1 = await fetch(`/api/scan/${prevId}`);
            const data1 = await res1.json();
            if (!data1.ok) throw new Error(data1.error || 'Previous scan not found');
            setScan1(data1.data);
          } else {
            toast.error('No previous scan found for this project');
            router.push(`/audit/${newerScan.id}`);
            return;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load scans';
        toast.error(message);
        router.push('/');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams, router]);

  if (loading) return <CompareSkeleton />;
  if (!scan1 || !scan2) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Scan Comparison</h1>
          <p className="text-sm text-muted-foreground">
            Comparing scans for <span className="font-medium">{scan2.snapshot.repoName}</span>
          </p>
        </div>
      </div>

      <ScanCompare scan1={scan1} scan2={scan2} />
    </div>
  );
}