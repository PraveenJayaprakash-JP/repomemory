// RepoMemory — Architecture Knowledge Graph Generator
// Analyzes a ProjectSnapshot to produce a structured dependency graph
// showing module relationships across the codebase.

import type { ProjectSnapshot } from './types';
import type { ArchitectureReport } from './discovery';

export interface GraphNode {
  id: string;
  label: string;
  type: 'framework' | 'module' | 'directory' | 'file' | 'database' | 'service';
  children?: GraphNode[];
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Top-level directory categories ─────────────────────────

const FRONTEND_DIRS = new Set([
  'app', 'pages', 'components', 'ui', 'views', 'layouts',
  'screens', 'widgets', 'modules',
]);

const BACKEND_DIRS = new Set([
  'api', 'server', 'routes', 'controllers', 'services',
  'middleware', 'handlers', 'resolvers', 'actions', 'trpc',
]);

const LIBRARY_DIRS = new Set([
  'lib', 'utils', 'helpers', 'hooks', 'stores', 'contexts',
  'config', 'constants', 'types', 'interfaces', 'schemas',
]);

const DB_DIR_NAMES = new Set([
  'db', 'database', 'models', 'entities', 'repositories',
  'migrations', 'seeds', 'prisma', 'drizzle',
]);

const INFRA_DIRS = new Set([
  'infra', 'infrastructure', 'deploy', 'docker', 'k8s',
  'terraform', 'ansible', 'ci', '.github',
]);

const TEST_DIRS = new Set([
  'tests', 'test', '__tests__', '__mocks__', 'spec',
  'e2e', 'cypress', 'playwright',
]);

// ─── Dependency inference from package.json ─────────────────

interface InferredTech {
  databases: string[];
  auth: string[];
  testing: string[];
  runtime: string[];
}

function inferTechStack(packageJson: Record<string, unknown> | null): InferredTech {
  const result: InferredTech = { databases: [], auth: [], testing: [], runtime: [] };
  if (!packageJson) return result;

  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined ?? {}),
    ...(packageJson.devDependencies as Record<string, string> | undefined ?? {}),
  };
  const depNames = new Set(Object.keys(deps).map(d => d.toLowerCase()));

  // Database detection
  const dbMap: Record<string, string> = {
    prisma: 'Prisma', '@prisma/client': 'Prisma', drizzle: 'Drizzle ORM',
    'drizzle-orm': 'Drizzle ORM', mongoose: 'MongoDB', mongodb: 'MongoDB',
    pg: 'PostgreSQL', 'node-postgres': 'PostgreSQL', mysql2: 'MySQL',
    mysql: 'MySQL', better: 'SQLite', 'better-sqlite3': 'SQLite',
    sqlite3: 'SQLite', '@supabase/supabase-js': 'Supabase',
    '@neondatabase/serverless': 'Neon', '@planetscale/database': 'PlanetScale',
    '@libsql/client': 'Turso', typeorm: 'TypeORM', knex: 'Knex.js',
    mikro: 'MikroORM', sequelize: 'Sequelize',
  };
  for (const [pkg, name] of Object.entries(dbMap)) {
    if (depNames.has(pkg)) result.databases.push(name);
  }

  // Auth detection
  const authMap: Record<string, string> = {
    'next-auth': 'NextAuth.js', '@auth/core': 'Auth.js',
    clerk: 'Clerk', '@clerk/nextjs': 'Clerk', lucia: 'Lucia',
    'better-auth': 'Better Auth', passport: 'Passport.js',
    '@supabase/auth-helpers-nextjs': 'Supabase Auth',
    '@kinde-oss/kinde-auth-nextjs': 'Kinde',
    'firebase-admin': 'Firebase Auth', 'firebase': 'Firebase Auth',
  };
  for (const [pkg, name] of Object.entries(authMap)) {
    if (depNames.has(pkg)) result.auth.push(name);
  }

  // Testing detection
  const testMap: Record<string, string> = {
    vitest: 'Vitest', jest: 'Jest', mocha: 'Mocha', jasmine: 'Jasmine',
    playwright: 'Playwright', '@playwright/test': 'Playwright',
    cypress: 'Cypress', '@testing-library/react': 'Testing Library',
    'pytest': 'pytest',
  };
  for (const [pkg, name] of Object.entries(testMap)) {
    if (depNames.has(pkg)) result.testing.push(name);
  }

  // Runtime / framework helpers
  if (depNames.has('next')) result.runtime.push('Next.js');
  if (depNames.has('react')) result.runtime.push('React');
  if (depNames.has('tailwindcss')) result.runtime.push('Tailwind CSS');
  if (depNames.has('@radix-ui')) result.runtime.push('Radix UI');
  if (depNames.has('shadcn')) result.runtime.push('shadcn/ui');
  if (depNames.has('express')) result.runtime.push('Express');
  if (depNames.has('fastify')) result.runtime.push('Fastify');
  if (depNames.has('hono')) result.runtime.push('Hono');

  return result;
}

// ─── Directory tree parser ──────────────────────────────────

interface DirNode {
  name: string;
  files: string[];
  children: Map<string, DirNode>;
}

function parseDirTree(topFiles: string[], noisyDirs: string[]): DirNode {
  const root: DirNode = { name: '/', files: [], children: new Map() };
  const noisy = new Set(noisyDirs);

  for (const f of topFiles) {
    const parts = f.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.some(p => noisy.has(p))) continue;
    if (parts.length === 0) continue;

    if (parts.length === 1) {
      root.files.push(parts[0]);
      continue;
    }

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const dirName = parts[i];
      if (!current.children.has(dirName)) {
        current.children.set(dirName, { name: dirName, files: [], children: new Map() });
      }
      current = current.children.get(dirName)!;
    }
    current.files.push(parts[parts.length - 1]);
  }

  return root;
}

// ─── Categorize a directory ─────────────────────────────────

type DirCategory = 'frontend' | 'backend' | 'library' | 'database' | 'infra' | 'testing' | 'unknown';

function categorizeDir(name: string): DirCategory {
  const lower = name.toLowerCase();
  if (FRONTEND_DIRS.has(lower)) return 'frontend';
  if (BACKEND_DIRS.has(lower)) return 'backend';
  if (DB_DIR_NAMES.has(lower)) return 'database';
  if (LIBRARY_DIRS.has(lower)) return 'library';
  if (INFRA_DIRS.has(lower)) return 'infra';
  if (TEST_DIRS.has(lower)) return 'testing';
  return 'unknown';
}

// ─── Main builder ───────────────────────────────────────────

export function buildArchitectureGraph(snapshot: ProjectSnapshot, report?: ArchitectureReport): ArchitectureGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const tech = inferTechStack(snapshot.keyFiles.packageJson);

  // ── Framework node ──
  const frameworkLabel = snapshot.framework && snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
    ? snapshot.framework
    : tech.runtime.length > 0
      ? tech.runtime[0]
      : snapshot.language;

  const frameworkNode: GraphNode = {
    id: 'framework',
    label: frameworkLabel,
    type: 'framework',
    children: [],
  };
  nodes.push(frameworkNode);

  // ── Parse directory structure ──
  const dirTree = parseDirTree(snapshot.topFiles, snapshot.noisyDirs);

  // Group top-level dirs by category
  const categories = new Map<DirCategory, DirNode[]>();
  const categoryNames: Record<DirCategory, string> = {
    frontend: 'Frontend',
    backend: 'API / Backend',
    library: 'Libraries / Utils',
    database: 'Database',
    infra: 'Infrastructure',
    testing: 'Testing',
    unknown: 'Other',
  };

  const categoryTypes: Record<DirCategory, GraphNode['type']> = {
    frontend: 'module',
    backend: 'module',
    library: 'module',
    database: 'database',
    infra: 'service',
    testing: 'module',
    unknown: 'module',
  };

  for (const [name, dirNode] of dirTree.children) {
    const cat = categorizeDir(name);
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(dirNode);
  }

  // Root-level files get a special "root files" entry
  if (dirTree.files.length > 0) {
    if (!categories.has('unknown')) categories.set('unknown', []);
    // Represent root files as a synthetic dir node
    categories.get('unknown')!.push({ name: '(root files)', files: dirTree.files, children: new Map() });
  }

  // ── Build category nodes and their directory children ──
  for (const [cat, dirs] of categories) {
    const catId = `cat-${cat}`;
    const catNode: GraphNode = {
      id: catId,
      label: categoryNames[cat],
      type: categoryTypes[cat],
      children: [],
    };
    nodes.push(catNode);

    // Edge: framework → category
    edges.push({ source: frameworkNode.id, target: catId, label: 'contains' });

    for (const dir of dirs) {
      const dirId = `dir-${cat}-${dir.name}`;
      const dirNode: GraphNode = {
        id: dirId,
        label: dir.name,
        type: 'directory',
        children: [],
      };
      nodes.push(dirNode);
      catNode.children!.push(dirNode);
      edges.push({ source: catId, target: dirId, label: 'dir' });

      // Add files within this directory (max 5 representative files)
      const topFiles = dir.files.slice(0, 5);
      for (const file of topFiles) {
        const fileId = `file-${cat}-${dir.name}-${file}`;
        const fileNode: GraphNode = {
          id: fileId,
          label: file,
          type: 'file',
        };
        nodes.push(fileNode);
        dirNode.children!.push(fileNode);
        edges.push({ source: dirId, target: fileId });
      }

      if (dir.files.length > 5) {
        const moreId = `file-${cat}-${dir.name}-more`;
        const moreNode: GraphNode = {
          id: moreId,
          label: `+${dir.files.length - 5} more files`,
          type: 'file',
        };
        nodes.push(moreNode);
        dirNode.children!.push(moreNode);
        edges.push({ source: dirId, target: moreId });
      }

      // Add subdirectories (1 level deep) 
      let subCount = 0;
      for (const [subName, subDir] of dir.children) {
        if (subCount >= 4) {
          const moreId = `dir-${cat}-${dir.name}-more`;
          const moreNode: GraphNode = {
            id: moreId,
            label: `+${dir.children.size - 4} more subdirs`,
            type: 'directory',
          };
          nodes.push(moreNode);
          dirNode.children!.push(moreNode);
          edges.push({ source: dirId, target: moreId });
          break;
        }
        const subId = `dir-${cat}-${dir.name}-${subName}`;
        const subNode: GraphNode = {
          id: subId,
          label: subName,
          type: 'directory',
          children: [],
        };
        nodes.push(subNode);
        dirNode.children!.push(subNode);
        edges.push({ source: dirId, target: subId, label: 'subdir' });

        // Representative file in subdir
        if (subDir.files.length > 0) {
          const subFileId = `file-${cat}-${dir.name}-${subName}-${subDir.files[0]}`;
          const subFileNode: GraphNode = {
            id: subFileId,
            label: subDir.files[0],
            type: 'file',
          };
          nodes.push(subFileNode);
          subNode.children!.push(subFileNode);
          edges.push({ source: subId, target: subFileId });
        }
        if (subDir.files.length > 1) {
          const moreId = `file-${cat}-${dir.name}-${subName}-more`;
          const moreNode: GraphNode = {
            id: moreId,
            label: `+${subDir.files.length - 1} more`,
            type: 'file',
          };
          nodes.push(moreNode);
          subNode.children!.push(moreNode);
          edges.push({ source: subId, target: moreId });
        }

        subCount++;
      }
    }
  }

  // ── Database nodes (from inferred tech) ──
  if (tech.databases.length > 0) {
    const dbCat = nodes.find(n => n.id === 'cat-database');
    for (const db of tech.databases) {
      const dbId = `db-${db.toLowerCase().replace(/\s+/g, '-')}`;
      const dbNode: GraphNode = {
        id: dbId,
        label: db,
        type: 'database',
      };
      nodes.push(dbNode);
      if (dbCat) {
        dbCat.children!.push(dbNode);
        edges.push({ source: dbCat.id, target: dbId, label: 'uses' });
      }
    }
  }

  // ── Testing nodes (from inferred tech) ──
  if (tech.testing.length > 0 || categories.has('testing')) {
    let testCat = nodes.find(n => n.id === 'cat-testing');
    if (!testCat) {
      testCat = { id: 'cat-testing', label: 'Testing', type: 'module', children: [] };
      nodes.push(testCat);
      edges.push({ source: frameworkNode.id, target: 'cat-testing', label: 'contains' });
    }
    for (const t of tech.testing) {
      const testId = `test-${t.toLowerCase().replace(/\s+/g, '-')}`;
      const testNode: GraphNode = { id: testId, label: t, type: 'service' };
      nodes.push(testNode);
      testCat.children!.push(testNode);
      edges.push({ source: testCat.id, target: testId, label: 'uses' });
    }
  }

  // ── Auth nodes ──
  if (tech.auth.length > 0) {
    const backendCat = nodes.find(n => n.id === 'cat-backend');
    for (const a of tech.auth) {
      const authId = `auth-${a.toLowerCase().replace(/\s+/g, '-')}`;
      const authNode: GraphNode = { id: authId, label: a, type: 'service' };
      nodes.push(authNode);
      if (backendCat) {
        backendCat.children!.push(authNode);
        edges.push({ source: backendCat.id, target: authId, label: 'auth' });
      }
    }
  }

  // ── Dockerfile / CI node ──
  if (snapshot.keyFiles.dockerFile || snapshot.keyFiles.ciConfig) {
    let infraCat = nodes.find(n => n.id === 'cat-infra');
    if (!infraCat) {
      infraCat = { id: 'cat-infra', label: 'Infrastructure', type: 'service', children: [] };
      nodes.push(infraCat);
      edges.push({ source: frameworkNode.id, target: 'cat-infra', label: 'contains' });
    }
    if (snapshot.keyFiles.dockerFile) {
      const dockerNode: GraphNode = { id: 'docker', label: 'Dockerfile', type: 'service' };
      nodes.push(dockerNode);
      infraCat.children!.push(dockerNode);
      edges.push({ source: infraCat.id, target: 'docker', label: 'container' });
    }
    if (snapshot.keyFiles.ciConfig) {
      const ciNode: GraphNode = { id: 'ci', label: 'CI Pipeline', type: 'service' };
      nodes.push(ciNode);
      infraCat.children!.push(ciNode);
      edges.push({ source: infraCat.id, target: 'ci', label: 'pipeline' });
    }
  }

  // ── Runtime / framework extras ──
  if (tech.runtime.length > 1) {
    // Add remaining runtime deps under framework
    for (const r of tech.runtime.slice(1)) {
      const rtId = `runtime-${r.toLowerCase().replace(/\s+/g, '-')}`;
      const rtNode: GraphNode = { id: rtId, label: r, type: 'service' };
      nodes.push(rtNode);
      frameworkNode.children!.push(rtNode);
      edges.push({ source: frameworkNode.id, target: rtId, label: 'dep' });
    }
  }

  // ── Enrich with ArchitectureReport if provided ──
  if (report) {
    // Add service nodes from discovery report
    for (const svc of report.services) {
      const svcId = `svc-${svc.name.toLowerCase().replace(/\s+/g, '-')}`;
      // Avoid duplicate nodes
      if (!nodes.some(n => n.id === svcId)) {
        const svcNode: GraphNode = {
          id: svcId,
          label: `${svc.name} (${svc.type})`,
          type: 'service',
        };
        nodes.push(svcNode);
        // Connect service to its category
        const catMap: Record<string, string> = {
          api: 'cat-backend',
          worker: 'cat-backend',
          cron: 'cat-backend',
          webhook: 'cat-backend',
        };
        const targetCat = catMap[svc.type] ?? 'cat-backend';
        const catNode = nodes.find(n => n.id === targetCat);
        if (catNode) {
          catNode.children!.push(svcNode);
          edges.push({ source: targetCat, target: svcId, label: svc.type });
        }
      }
    }

    // Add data flow edges from discovery report
    for (const flow of report.dataFlows) {
      const srcId = `svc-${flow.from.toLowerCase().replace(/\s+/g, '-')}`;
      const tgtId = `svc-${flow.to.toLowerCase().replace(/\s+/g, '-')}`;
      // Only add if both endpoints exist as nodes
      if (nodes.some(n => n.id === srcId) && nodes.some(n => n.id === tgtId)) {
        edges.push({ source: srcId, target: tgtId, label: flow.type });
      }
    }

    // Add tech stack nodes from report
    const allTech = [
      ...report.techStack.frontend,
      ...report.techStack.backend,
      ...report.techStack.database,
      ...report.techStack.infrastructure,
      ...report.techStack.testing,
    ];
    for (const tech of allTech) {
      const techId = `tech-${tech.toLowerCase().replace(/\s+/g, '-')}`;
      if (!nodes.some(n => n.id === techId)) {
        const techNode: GraphNode = { id: techId, label: tech, type: 'service' };
        nodes.push(techNode);
        frameworkNode.children!.push(techNode);
        edges.push({ source: frameworkNode.id, target: techId, label: 'uses' });
      }
    }
  }

  return { nodes, edges };
}

// ─── Summary helpers ────────────────────────────────────────

export interface GraphSummary {
  moduleCount: number;
  dirCount: number;
  fileCount: number;
  framework: string;
  databases: string[];
  testingTools: string[];
}

export function getGraphSummary(snapshot: ProjectSnapshot): GraphSummary {
  const dirTree = parseDirTree(snapshot.topFiles, snapshot.noisyDirs);
  const tech = inferTechStack(snapshot.keyFiles.packageJson);

  // Count unique directories
  const allDirs = new Set<string>();
  function walkDirs(node: DirNode) {
    for (const [name, child] of node.children) {
      allDirs.add(name);
      walkDirs(child);
    }
  }
  walkDirs(dirTree);

  return {
    moduleCount: dirTree.children.size,
    dirCount: allDirs.size,
    fileCount: snapshot.fileCount,
    framework: snapshot.framework !== 'None' && snapshot.framework !== 'Unknown'
      ? snapshot.framework
      : snapshot.language,
    databases: tech.databases,
    testingTools: tech.testing,
  };
}
