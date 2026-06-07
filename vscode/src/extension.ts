import * as vscode from 'vscode';
import * as path from 'path';
import { RepoMemoryProvider } from './sidebarProvider';
import { loadStore, getScannedProjects } from './store';

let provider: RepoMemoryProvider;

export function activate(context: vscode.ExtensionContext) {
  // Register TreeView provider
  provider = new RepoMemoryProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('repomemorySidebar', provider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('repomemory.scan', async () => {
      const folderUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Scan Repository',
        title: 'Select a repository folder to scan',
      });

      if (!folderUri || folderUri.length === 0) return;
      const folderPath = folderUri[0].fsPath;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Scanning repository...',
          cancellable: false,
        },
        async () => {
          try {
            // Run the RepoMemory scan via CLI
            const { execSync } = require('child_process') as typeof import('child_process');
            const repomemoryPath = path.resolve(__dirname, '..', '..', 'cli', 'src', 'index.ts');

            // Try to use tsx to run the CLI
            let output = '';
            try {
              const buf = execSync(
                `npx tsx "${repomemoryPath}" scan "${folderPath}" --json`,
                { encoding: 'utf-8' as const, timeout: 30000 }
              );
              output = String(buf);
            } catch {
              // Fallback: try running from the project root
              const buf = execSync(
                `npx --yes tsx "${repomemoryPath}" scan "${folderPath}" --json`,
                { encoding: 'utf-8' as const, timeout: 120000 }
              );
              output = String(buf);
            }

            // Parse the JSON from the last line of stderr/stdout
            const lines = output.trim().split('\n');
            const jsonLine = lines.reverse().find((l: string) => l.startsWith('{'));
            if (!jsonLine) throw new Error('Could not parse scan output');

            const result = JSON.parse(jsonLine);
            const badgeEmoji = result.badge === 'excellent' ? '✅' :
              result.badge === 'good' ? '👍' :
              result.badge === 'needs-improvement' ? '⚠️' : '❌';

            vscode.window.showInformationMessage(
              `${badgeEmoji} ${result.repoName}: ${result.totalScore}/100 (${result.badge})`,
              'View Details'
            ).then((selection) => {
              if (selection === 'View Details') {
                showAuditWebview(context, result);
              }
            });

            provider.refresh();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Scan failed: ${message}`);
          }
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repomemory.refresh', () => {
      provider.refresh();
      vscode.window.showInformationMessage('RepoMemory refreshed');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repomemory.openDashboard', (scanId?: string) => {
      const projects = getScannedProjects();
      if (projects.length === 0) {
        vscode.window.showInformationMessage('No scanned projects yet. Use "RepoMemory: Scan Repository" to start.');
        return;
      }

      // Show a quick pick of projects
      const items = projects.map((p) => ({
        label: `${p.repoName}  (${p.latestScore ?? '—'}/100)`,
        description: p.folderPath,
        detail: `${p.language}${p.framework !== 'None' ? ` · ${p.framework}` : ''}`,
        scanId: p.latestScanId,
      }));

      vscode.window.showQuickPick(items, { placeHolder: 'Select a project' }).then((selected) => {
        if (selected) {
          showAuditWebview(context, selected);
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repomemory.generate', async (scanId?: string) => {
      if (!scanId) {
        vscode.window.showErrorMessage('No scan selected');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating context pack...',
          cancellable: false,
        },
        async () => {
          try {
            const store = loadStore();
            if (!store) throw new Error('No store found');

            const scan = store.scans.find((s) => s.id === scanId);
            if (!scan) throw new Error('Scan not found');

            const project = store.projects.find((p) => p.id === scan.projectId);
            if (!project) throw new Error('Project not found');

            const { execSync } = require('child_process') as typeof import('child_process');
            const repomemoryPath = path.resolve(__dirname, '..', '..', 'cli', 'src', 'index.ts');

            execSync(
              `npx tsx "${repomemoryPath}" generate "${project.folderPath}" --apply`,
              { encoding: 'utf-8', timeout: 120000 }
            );

            vscode.window.showInformationMessage('✅ Context pack applied to repository');
            provider.refresh();
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Generation failed: ${message}`);
          }
        }
      );
    })
  );
}

function showAuditWebview(context: vscode.ExtensionContext, data: any) {
  const panel = vscode.window.createWebviewPanel(
    'repomemoryAudit',
    `Audit: ${data.repoName ?? 'RepoMemory'}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const dimensions = data.dimensions ?? [];
  const dimsHtml = dimensions.map((d: any) => {
    const pct = d.maxScore > 0 ? Math.round((d.score / d.maxScore) * 100) : 0;
    const barColor = pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 30 ? '#f59e0b' : '#ef4444';
    return `
      <div class="dimension">
        <div class="dim-header">
          <span>${d.name}</span>
          <span class="dim-score">${d.score}/${d.maxScore}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        ${d.reason ? `<p class="dim-reason">${d.reason}</p>` : ''}
      </div>
    `;
  }).join('');

  const badgeColor = data.badge === 'excellent' ? '#22c55e' :
    data.badge === 'good' ? '#3b82f6' :
    data.badge === 'needs-improvement' ? '#f59e0b' : '#ef4444';

  const totalPct = Math.round((data.totalScore ?? 0));

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; padding: 16px; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); }
  .header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 24px; }
  .score { font-size: 48px; font-weight: 700; }
  .badge { font-size: 14px; padding: 4px 12px; border-radius: 4px; color: white; }
  .summary { margin-bottom: 24px; padding: 12px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 6px; }
  .dimension { margin-bottom: 16px; }
  .dim-header { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
  .dim-score { color: var(--vscode-textPreformat-foreground); }
  .bar-track { height: 8px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }
  .dim-reason { font-size: 11px; color: var(--vscode-descriptionForeground); margin: 4px 0 0; }
</style>
</head>
<body>
  <div class="header">
    <span class="score" style="color:${badgeColor}">${data.totalScore}</span>
    <span>/ 100</span>
    <span class="badge" style="background:${badgeColor}">${data.badge}</span>
  </div>
  <div class="summary">${data.summary ?? ''}</div>
  ${dimsHtml}
</body>
</html>`;
}

export function deactivate() {}
