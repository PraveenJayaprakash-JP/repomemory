import * as vscode from 'vscode';
import { getScannedProjects, getScanById } from './store';

export class RepoMemoryProvider implements vscode.TreeDataProvider<RepoMemoryItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<RepoMemoryItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: RepoMemoryItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RepoMemoryItem): Thenable<RepoMemoryItem[]> {
    if (!element) {
      return Promise.resolve(this.getRootItems());
    }
    if (element.type === 'projects') {
      return Promise.resolve(this.getProjectItems());
    }
    if (element.type === 'project') {
      return Promise.resolve(this.getProjectDetailItems(element));
    }
    return Promise.resolve([]);
  }

  private getRootItems(): RepoMemoryItem[] {
    const projects = new RepoMemoryItem(
      'Scanned Projects',
      vscode.TreeItemCollapsibleState.Expanded,
      'projects'
    );
    const scanAction = new RepoMemoryItem(
      'Scan a Repository',
      vscode.TreeItemCollapsibleState.None,
      'action',
      {
        command: 'repomemory.scan',
        title: 'Scan Repository',
      }
    );
    const dashboardAction = new RepoMemoryItem(
      'Open Dashboard',
      vscode.TreeItemCollapsibleState.None,
      'action',
      {
        command: 'repomemory.openDashboard',
        title: 'Open Dashboard',
      }
    );
    return [projects, scanAction, dashboardAction];
  }

  private getProjectItems(): RepoMemoryItem[] {
    const projects = getScannedProjects();
    if (projects.length === 0) {
      return [new RepoMemoryItem(
        'No scans yet. Click "Scan a Repository" to begin.',
        vscode.TreeItemCollapsibleState.None,
        'empty'
      )];
    }
    return projects.map((p) => {
      const score = p.latestScore !== null ? `${p.latestScore}/100` : '—';
      const label = `${p.repoName}  (${score})`;
      const item = new RepoMemoryItem(
        label,
        vscode.TreeItemCollapsibleState.Collapsed,
        'project',
        {
          command: 'repomemory.openDashboard',
          title: 'Open',
          arguments: [p.latestScanId],
        }
      );
      item.tooltip = `${p.folderPath}\nLanguage: ${p.language}\nFramework: ${p.framework}\nScore: ${score}`;
      item.contextValue = 'project';
      item.id = p.id;

      // Set icon based on score
      if (p.latestScore !== null) {
        if (p.latestScore >= 80) item.iconPath = new vscode.ThemeIcon('pass');
        else if (p.latestScore >= 60) item.iconPath = new vscode.ThemeIcon('info');
        else if (p.latestScore >= 30) item.iconPath = new vscode.ThemeIcon('warning');
        else item.iconPath = new vscode.ThemeIcon('error');
      }

      return item;
    });
  }

  private getProjectDetailItems(project: RepoMemoryItem): RepoMemoryItem[] {
    const projects = getScannedProjects();
    const p = projects.find((p) => p.id === project.id);
    if (!p) return [];

    const items: RepoMemoryItem[] = [];

    items.push(new RepoMemoryItem(
      `Path: ${p.folderPath}`,
      vscode.TreeItemCollapsibleState.None,
      'detail'
    ));

    if (p.latestScore !== null) {
      items.push(new RepoMemoryItem(
        `Score: ${p.latestScore}/100 (${p.latestBadge})`,
        vscode.TreeItemCollapsibleState.None,
        'detail'
      ));
    }

    items.push(new RepoMemoryItem(
      `${p.language}${p.framework !== 'None' ? ` / ${p.framework}` : ''}`,
      vscode.TreeItemCollapsibleState.None,
      'detail'
    ));

    if (p.latestScanId) {
      const scan = getScanById(p.latestScanId);
      if (scan) {
        items.push(new RepoMemoryItem(
          `Files: ${scan.snapshot.fileCount}`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ));
        items.push(new RepoMemoryItem(
          `Size: ${(scan.snapshot.totalSizeBytes / 1024 / 1024).toFixed(1)} MB`,
          vscode.TreeItemCollapsibleState.None,
          'detail'
        ));
      }

      const generateItem = new RepoMemoryItem(
        'Generate Context Pack',
        vscode.TreeItemCollapsibleState.None,
        'action',
        {
          command: 'repomemory.generate',
          title: 'Generate Context Pack',
          arguments: [p.latestScanId],
        }
      );
      generateItem.iconPath = new vscode.ThemeIcon('sparkle');
      items.push(generateItem);
    }

    return items;
  }
}

export class RepoMemoryItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'projects' | 'project' | 'detail' | 'action' | 'empty',
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
  }
}
