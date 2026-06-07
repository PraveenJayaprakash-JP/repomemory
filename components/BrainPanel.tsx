'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Brain, Plus, Search, Trash2, ChevronDown, ChevronUp, FileText, Loader2 } from 'lucide-react';
import type { BrainEntry, BrainEntryType, ProjectBrain } from '@/lib/brain';

const TYPE_CONFIG: Record<BrainEntryType, { label: string; emoji: string; color: string }> = {
  decision: { label: 'Decisions', emoji: '🏗️', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  lesson: { label: 'Lessons', emoji: '💡', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  techdebt: { label: 'Tech Debt', emoji: '⚠️', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  bug: { label: 'Bugs', emoji: '🐛', color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

interface BrainPanelProps {
  folderPath: string;
}

export default function BrainPanel({ folderPath }: BrainPanelProps) {
  const [brain, setBrain] = useState<ProjectBrain | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BrainEntry[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<BrainEntryType>('decision');
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formRefs, setFormRefs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadBrain = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brain?folderPath=${encodeURIComponent(folderPath)}`);
      const data = await res.json();
      if (data.ok) {
        setBrain(data.data.brain);
      } else {
        toast.error(data.error ?? 'Failed to load brain');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [folderPath]);

  useEffect(() => {
    loadBrain();
  }, [loadBrain]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(`/api/brain/search?folderPath=${encodeURIComponent(folderPath)}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.ok) {
        setSearchResults(data.data.entries);
      }
    } catch {
      toast.error('Search failed');
    }
  };

  const handleAdd = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath,
          entry: {
            type: addType,
            title: formTitle.trim(),
            description: formDescription.trim(),
            author: formAuthor.trim() || undefined,
            tags: formTags ? formTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
            references: formRefs ? formRefs.split(',').map((r) => r.trim()).filter(Boolean) : [],
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Entry added');
        setAddDialogOpen(false);
        resetForm();
        loadBrain();
      } else {
        toast.error(data.error ?? 'Failed to add entry');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/brain?id=${encodeURIComponent(id)}&folderPath=${encodeURIComponent(folderPath)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.ok) {
        toast.success('Entry removed');
        loadBrain();
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/brain?folderPath=${encodeURIComponent(folderPath)}&summary=true`);
      const data = await res.json();
      if (data.ok) {
        setSummary(data.data.summary);
      } else {
        toast.error(data.error ?? 'Failed to generate summary');
      }
    } catch {
      toast.error('Failed to generate summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormAuthor('');
    setFormTags('');
    setFormRefs('');
  };

  const openAddDialog = (type: BrainEntryType) => {
    setAddType(type);
    resetForm();
    setAddDialogOpen(true);
  };

  const getEntriesForType = (type: BrainEntryType): BrainEntry[] => {
    if (!brain) return [];
    const key = type === 'techdebt' ? 'techDebt' : type === 'decision' ? 'decisions' : type === 'lesson' ? 'lessons' : 'bugs';
    return brain[key];
  };

  const renderEntry = (entry: BrainEntry) => {
    const isExpanded = expandedId === entry.id;
    const config = TYPE_CONFIG[entry.type];

    return (
      <Card key={entry.id} size="sm" className="transition-default hover:shadow-sm">
        <CardContent className="py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{entry.title}</span>
                <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
                {entry.author && <span className="text-xs text-muted-foreground">by {entry.author}</span>}
              </div>
              {entry.tags.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
              {!isExpanded && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{entry.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDelete(entry.id)}
                aria-label="Delete entry"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {isExpanded && (
            <div className="mt-3 space-y-2">
              <p className="text-sm whitespace-pre-wrap">{entry.description}</p>
              {entry.references.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">References:</span>{' '}
                  {entry.references.map((r, i) => (
                    <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs mr-1">{r}</code>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = (type: BrainEntryType) => {
    const config = TYPE_CONFIG[type];
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <span className="text-2xl mb-2">{config.emoji}</span>
        <p className="text-sm text-muted-foreground">No {config.label.toLowerCase()} recorded yet</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => openAddDialog(type)}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add {type === 'techdebt' ? 'Tech Debt' : config.label.slice(0, -1)}
        </Button>
      </div>
    );
  };

  if (loading && !brain) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading project brain...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayEntries = searchResults ?? null;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search brain entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={handleSearch} disabled={!searchQuery.trim()}>
          <Search className="h-4 w-4 mr-1" />Search
        </Button>
        {searchResults && (
          <Button variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Search results */}
      {displayEntries && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Search Results ({displayEntries.length})</h3>
          {displayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries match your search.</p>
          ) : (
            displayEntries.map(renderEntry)
          )}
        </div>
      )}

      {/* Tabs for each type */}
      {!displayEntries && (
        <Tabs defaultValue="decision">
          <TabsList variant="line" className="flex-wrap h-auto gap-1">
            {Object.entries(TYPE_CONFIG).map(([type, config]) => {
              const count = brain ? getEntriesForType(type as BrainEntryType).length : 0;
              return (
                <TabsTrigger key={type} value={type} className="gap-1.5 px-2 py-1 text-xs sm:text-sm">
                  <span>{config.emoji}</span>
                  {config.label}
                  {count > 0 && (
                    <Badge variant="secondary" className="text-xs ml-1">{count}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.entries(TYPE_CONFIG).map(([type, config]) => {
            const entries = brain ? getEntriesForType(type as BrainEntryType) : [];
            return (
              <TabsContent key={type} value={type} className="space-y-3 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{config.emoji} {config.label}</h3>
                  <Button variant="outline" size="sm" onClick={() => openAddDialog(type as BrainEntryType)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add
                  </Button>
                </div>
                {entries.length === 0
                  ? renderEmptyState(type as BrainEntryType)
                  : entries.map(renderEntry)
                }
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Generate Summary */}
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleGenerateSummary} disabled={summaryLoading}>
          {summaryLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Generate Brain Summary
        </Button>
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-muted-foreground" />
              Brain Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-lg overflow-auto max-h-96">
              {summary}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Add Entry Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {TYPE_CONFIG[addType].emoji} {addType === 'techdebt' ? 'Tech Debt' : TYPE_CONFIG[addType].label.slice(0, -1)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <Input
                placeholder="Enter title..."
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea
                className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[80px] resize-y"
                placeholder="Describe the decision, lesson, debt, or bug..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Author</label>
              <Input
                placeholder="Your name (optional)"
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Tags</label>
              <Input
                placeholder="comma, separated, tags"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">References</label>
              <Input
                placeholder="file paths, commit hashes (comma separated)"
                value={formRefs}
                onChange={(e) => setFormRefs(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <DialogClose className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-sm font-medium hover:bg-muted hover:text-foreground">
              Cancel
            </DialogClose>
            <Button onClick={handleAdd} disabled={submitting || !formTitle.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Add Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}