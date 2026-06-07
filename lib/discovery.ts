// RepoMemory — Architecture Discovery Engine
// Analyzes a ProjectSnapshot to detect modules, services, data flows,
// and tech stack without AST parsing — pure keyword/path matching.

import type { ProjectSnapshot } from './types';
import type { ArchitectureGraph } from './graph';

// ─── Public types (new rich report) ───────────────────────────

export interface DiscoveredModule {
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'infrastructure' | 'library' | 'tool';
  files: string[];
  technology: string;
  description: string;
}

export interface DiscoveredService {
  name: string;
  type: 'api' | 'worker' | 'cron' | 'webhook';
  endpoints: string[];
  dependencies: string[];
}

export interface DiscoveredDataFlow {
  from: string;
  to: string;
  type: 'api-call' | 'event' | 'data-import' | 'function-call';
}

export interface ArchitectureReport {
  summary: string;
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    infrastructure: string[];
    testing: string[];
  };
  modules: DiscoveredModule[];
  services: DiscoveredService[];
  dataFlows: DiscoveredDataFlow[];
  recommendations: string[];
}

// ─── Legacy type (kept for MCP backward compat) ──────────────

export interface ArchitectureDiscovery {
  summary: string;
  modules: { name: string; path: string; type: DiscoveredModule['type'] | 'testing' | 'other'; description: string }[];
  dataFlow: string[];
  entryPoints: string[];
  keyPatterns: string[];
}

// ─── Directory → module type mapping ─────────────────────────

const MODULE_TYPE_MAP: Record<string, DiscoveredModule['type']> = {
  // Frontend
  app: 'frontend', pages: 'frontend', components: 'frontend', ui: 'frontend',
  views: 'frontend', layouts: 'frontend', screens: 'frontend', widgets: 'frontend',
  styles: 'frontend', public: 'frontend', assets: 'frontend', static: 'frontend',
  // Backend
  api: 'backend', server: 'backend', routes: 'backend', controllers: 'backend',
  services: 'backend', middleware: 'backend', handlers: 'backend', resolvers: 'backend',
  actions: 'backend', trpc: 'backend',
  // Database
  db: 'database', database: 'database', models: 'database', entities: 'database',
  repositories: 'database', migrations: 'database', seeds: 'database',
  prisma: 'database', drizzle: 'database', schemas: 'database',
  // Infrastructure
  infra: 'infrastructure', infrastructure: 'infrastructure', deploy: 'infrastructure',
  docker: 'infrastructure', k8s: 'infrastructure', terraform: 'infrastructure',
  ansible: 'infrastructure', ci: 'infrastructure', '.github': 'infrastructure',
  scripts: 'infrastructure',
  // Library / shared
  lib: 'library', utils: 'library', helpers: 'library', hooks: 'library',
  stores: 'library', contexts: 'library', config: 'library',
  constants: 'library', types: 'library', interfaces: 'library',
  // Tooling
  bin: 'tool', tools: 'tool',
};

// ─── Tech stack detection from package.json ──────────────────

interface TechDetection {
  frontend: string[];
  backend: string[];
  database: string[];
  infrastructure: string[];
  testing: string[];
}

const FRONTEND_DEPS: Record<string, string> = {
  react: 'React', 'react-dom': 'React', next: 'Next.js', vue: 'Vue',
  '@vue/cli-service': 'Vue CLI', nuxt: 'Nuxt', angular: 'Angular',
  '@angular/core': 'Angular', svelte: 'Svelte', '@sveltejs/kit': 'SvelteKit',
  '@remix-run/react': 'Remix', '@solid-js/router': 'SolidJS',
  tailwindcss: 'Tailwind CSS', '@radix-ui/react': 'Radix UI',
  'styled-components': 'Styled Components', '@emotion/react': 'Emotion',
  '@chakra-ui/react': 'Chakra UI', '@mui/material': 'Material UI',
  antd: 'Ant Design', 'framer-motion': 'Framer Motion',
  'react-query': 'React Query', '@tanstack/react-query': 'TanStack Query',
  zustand: 'Zustand', redux: 'Redux', '@reduxjs/toolkit': 'Redux Toolkit',
  jotai: 'Jotai', recoil: 'Recoil', mobx: 'MobX',
  'react-hook-form': 'React Hook Form', zod: 'Zod', yup: 'Yup',
  'react-router-dom': 'React Router', '@tanstack/router': 'TanStack Router',
};

const BACKEND_DEPS: Record<string, string> = {
  express: 'Express', fastify: 'Fastify', hono: 'Hono', koa: 'Koa',
  '@nestjs/core': 'NestJS', '@hono/node-server': 'Hono Node',
  '@trpc/server': 'tRPC', graphql: 'GraphQL', '@apollo/server': 'Apollo Server',
  'socket.io': 'Socket.IO', ws: 'ws', bull: 'BullMQ', '@bull-board/api': 'Bull Board',
  agenda: 'Agenda', 'node-cron': 'node-cron', '@fastify/cron': 'Fastify Cron',
  ioredis: 'Redis', '@upstash/redis': 'Upstash Redis',
  '@aws-sdk/client-s3': 'AWS S3', '@aws-sdk/client-sqs': 'AWS SQS',
  '@aws-sdk/client-lambda': 'AWS Lambda',
  stripe: 'Stripe', '@sendgrid/mail': 'SendGrid',
  resend: 'Resend', nodemailer: 'Nodemailer',
};

const DATABASE_DEPS: Record<string, string> = {
  prisma: 'Prisma', '@prisma/client': 'Prisma', 'drizzle-orm': 'Drizzle ORM',
  mongoose: 'MongoDB', mongodb: 'MongoDB', pg: 'PostgreSQL',
  'node-postgres': 'PostgreSQL', mysql2: 'MySQL', mysql: 'MySQL',
  'better-sqlite3': 'SQLite', sqlite3: 'SQLite',
  '@supabase/supabase-js': 'Supabase', '@neondatabase/serverless': 'Neon',
  '@planetscale/database': 'PlanetScale', '@libsql/client': 'Turso',
  typeorm: 'TypeORM', knex: 'Knex.js', sequelize: 'Sequelize',
  '@redis/client': 'Redis', redis: 'Redis',
  '@elastic/elasticsearch': 'Elasticsearch',
};

const INFRA_DEPS: Record<string, string> = {
  docker: 'Docker', 'docker-compose': 'Docker Compose',
  kubernetes: 'Kubernetes', '@kubernetes/client-node': 'Kubernetes',
  'aws-cdk': 'AWS CDK', '@pulumi/pulumi': 'Pulumi',
  serverless: 'Serverless Framework', '@vercel/node': 'Vercel',
  '@cloudflare/workers-types': 'Cloudflare Workers',
};

const TESTING_DEPS: Record<string, string> = {
  vitest: 'Vitest', jest: 'Jest', mocha: 'Mocha', jasmine: 'Jasmine',
  playwright: 'Playwright', '@playwright/test': 'Playwright',
  cypress: 'Cypress', '@testing-library/react': 'Testing Library',
  '@testing-library/jest-dom': 'Testing Library',
  pytest: 'pytest', unittest: 'unittest',
};

function detectTechStack(packageJson: Record<string, unknown> | null): TechDetection {
  const result: TechDetection = {
    frontend: [], backend: [], database: [], infrastructure: [], testing: [],
  };
  if (!packageJson) return result;

  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined ?? {}),
    ...(packageJson.devDependencies as Record<string, string> | undefined ?? {}),
  };
  const depNames = new Set(Object.keys(deps).map(d => d.toLowerCase()));

  function scanMap(map: Record<string, string>, target: keyof TechDetection): void {
    for (const [pkg, name] of Object.entries(map)) {
      if (depNames.has(pkg) || depNames.has(pkg.toLowerCase())) {
        if (!result[target].includes(name)) result[target].push(name);
      }
    }
  }

  scanMap(FRONTEND_DEPS, 'frontend');
  scanMap(BACKEND_DEPS, 'backend');
  scanMap(DATABASE_DEPS, 'database');
  scanMap(INFRA_DEPS, 'infrastructure');
  scanMap(TESTING_DEPS, 'testing');

  return result;
}

// ─── Module detection from directory structure ────────────────

function detectModules(snapshot: ProjectSnapshot, tech: TechDetection): DiscoveredModule[] {
  const modules: DiscoveredModule[] = [];
  const noisy = new Set(snapshot.noisyDirs);

  // Group topFiles by top-level directory
  const dirFiles = new Map<string, string[]>();
  const rootFiles: string[] = [];

  for (const f of snapshot.topFiles) {
    const normalized = f.replace(/\\/g, '/');
    const parts = normalized.split('/');
    if (parts.some(p => noisy.has(p))) continue;

    if (parts.length <= 1) {
      rootFiles.push(f);
      continue;
    }

    const topDir = parts[0];
    if (!dirFiles.has(topDir)) dirFiles.set(topDir, []);
    dirFiles.get(topDir)!.push(f);
  }

  // Create module per top-level directory
  for (const [dirName, files] of dirFiles) {
    const moduleType = MODULE_TYPE_MAP[dirName.toLowerCase()] ?? 'library';
    const techForModule = techForModuleType(moduleType, tech);

    modules.push({
      name: dirName,
      type: moduleType,
      files: files.slice(0, 20),
      technology: techForModule,
      description: describeModule(dirName, moduleType, files.length),
    });
  }

  // Handle root-level files as a "root" module
  if (rootFiles.length > 0) {
    modules.push({
      name: '(root)',
      type: 'library',
      files: rootFiles.slice(0, 10),
      technology: tech.backend.length > 0 ? tech.backend.join(', ') : snapshot.language,
      description: `Root configuration and entry files (${rootFiles.length} files)`,
    });
  }

  return modules;
}

function techForModuleType(type: DiscoveredModule['type'], tech: TechDetection): string {
  switch (type) {
    case 'frontend': return tech.frontend.length > 0 ? tech.frontend.join(', ') : 'Unknown';
    case 'backend': return tech.backend.length > 0 ? tech.backend.join(', ') : 'Node.js';
    case 'database': return tech.database.length > 0 ? tech.database.join(', ') : 'Unknown';
    case 'infrastructure': return tech.infrastructure.length > 0 ? tech.infrastructure.join(', ') : 'Docker';
    case 'tool': return 'Scripts/Tooling';
    default: return 'Shared libraries';
  }
}

function describeModule(name: string, type: DiscoveredModule['type'], fileCount: number): string {
  const typeLabel: Record<DiscoveredModule['type'], string> = {
    frontend: 'Frontend UI',
    backend: 'Backend API',
    database: 'Data layer',
    infrastructure: 'Infrastructure config',
    library: 'Shared library',
    tool: 'Tooling/scripts',
  };
  return `${typeLabel[type]} module with ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
}

// ─── Service detection ───────────────────────────────────────

function detectServices(snapshot: ProjectSnapshot, tech: TechDetection): DiscoveredService[] {
  const services: DiscoveredService[] = [];
  const files = snapshot.topFiles.map(f => f.replace(/\\/g, '/'));

  // API routes detection
  const apiPatterns = [
    { dir: 'api/', type: 'api' as const },
    { dir: 'app/api/', type: 'api' as const },
    { dir: 'pages/api/', type: 'api' as const },
    { dir: 'routes/', type: 'api' as const },
    { dir: 'src/routes/', type: 'api' as const },
  ];

  const apiEndpoints: string[] = [];
  for (const pattern of apiPatterns) {
    for (const f of files) {
      if (f.includes(pattern.dir) && (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.py'))) {
        const route = f.split(pattern.dir)[1]?.replace(/\.\w+$/, '') ?? '';
        if (route) apiEndpoints.push(`/${route}`);
      }
    }
  }

  if (apiEndpoints.length > 0) {
    services.push({
      name: 'API Server',
      type: 'api',
      endpoints: [...new Set(apiEndpoints)].slice(0, 30),
      dependencies: tech.database,
    });
  }

  // Worker / background job detection
  const workerPatterns = ['worker', 'queue', 'job', 'bull', 'agenda', 'cron'];
  const workerFiles = files.filter(f =>
    workerPatterns.some(p => f.toLowerCase().includes(p))
  );
  if (workerFiles.length > 0 || tech.backend.some(b => ['BullMQ', 'Agenda'].includes(b))) {
    services.push({
      name: 'Background Worker',
      type: 'worker',
      endpoints: [],
      dependencies: tech.database,
    });
  }

  // Cron job detection
  const cronPatterns = ['cron', 'scheduled', 'scheduler'];
  const cronFiles = files.filter(f =>
    cronPatterns.some(p => f.toLowerCase().includes(p))
  );
  if (cronFiles.length > 0) {
    services.push({
      name: 'Cron Scheduler',
      type: 'cron',
      endpoints: [],
      dependencies: [],
    });
  }

  // Webhook detection
  const webhookPatterns = ['webhook', 'stripe-webhook', 'github-webhook'];
  const webhookFiles = files.filter(f =>
    webhookPatterns.some(p => f.toLowerCase().includes(p))
  );
  if (webhookFiles.length > 0) {
    services.push({
      name: 'Webhook Handler',
      type: 'webhook',
      endpoints: webhookFiles.slice(0, 10),
      dependencies: [],
    });
  }

  // If no services detected but backend tech exists, add a default API service
  if (services.length === 0 && (tech.backend.length > 0 || snapshot.framework !== 'None')) {
    services.push({
      name: 'Application Server',
      type: 'api',
      endpoints: [],
      dependencies: tech.database,
    });
  }

  return services;
}

// ─── Data flow detection ──────────────────────────────────────

function detectDataFlows(
  modules: DiscoveredModule[],
  services: DiscoveredService[],
  tech: TechDetection,
): DiscoveredDataFlow[] {
  const flows: DiscoveredDataFlow[] = [];

  // Frontend → Backend API
  const frontend = modules.find(m => m.type === 'frontend');
  const backend = modules.find(m => m.type === 'backend');
  if (frontend && backend) {
    flows.push({ from: frontend.name, to: backend.name, type: 'api-call' });
  }

  // Frontend → API service
  const apiService = services.find(s => s.type === 'api');
  if (frontend && apiService && !backend) {
    flows.push({ from: frontend.name, to: apiService.name, type: 'api-call' });
  }

  // Backend → Database
  const dbModule = modules.find(m => m.type === 'database');
  if (backend && dbModule) {
    flows.push({ from: backend.name, to: dbModule.name, type: 'function-call' });
  } else if (apiService && dbModule) {
    flows.push({ from: apiService.name, to: dbModule.name, type: 'function-call' });
  }

  // Service → Database dependencies
  for (const svc of services) {
    if (svc.dependencies.length > 0 && dbModule) {
      const alreadyExists = flows.some(
        f => f.from === svc.name && f.to === dbModule.name
      );
      if (!alreadyExists) {
        flows.push({ from: svc.name, to: dbModule.name, type: 'function-call' });
      }
    }
  }

  // Worker → Backend (event-driven)
  const worker = services.find(s => s.type === 'worker');
  if (worker && apiService) {
    flows.push({ from: worker.name, to: apiService.name, type: 'event' });
  }

  // Infrastructure → services
  const infra = modules.find(m => m.type === 'infrastructure');
  if (infra && services.length > 0) {
    for (const svc of services.slice(0, 3)) {
      flows.push({ from: infra.name, to: svc.name, type: 'data-import' });
    }
  }

  // Data import flows from library modules
  const libraries = modules.filter(m => m.type === 'library');
  for (const lib of libraries.slice(0, 2)) {
    if (apiService) {
      flows.push({ from: lib.name, to: apiService.name, type: 'function-call' });
    }
  }

  return flows;
}

// ─── Recommendations ──────────────────────────────────────────

function generateRecommendations(
  snapshot: ProjectSnapshot,
  tech: TechDetection,
  modules: DiscoveredModule[],
  services: DiscoveredService[],
): string[] {
  const recs: string[] = [];

  // Missing testing
  if (tech.testing.length === 0) {
    recs.push('No testing framework detected — consider adding Vitest or Jest');
  }

  // Missing database for backend
  if (tech.backend.length > 0 && tech.database.length === 0) {
    recs.push('Backend detected without a database — consider adding a data layer');
  }

  // No infrastructure config
  if (!snapshot.keyFiles.dockerFile && !snapshot.keyFiles.ciConfig && tech.infrastructure.length === 0) {
    recs.push('No Dockerfile or CI config found — consider adding containerization and CI/CD');
  }

  // No env example
  if (!snapshot.keyFiles.envExample) {
    recs.push('No .env.example found — add one to document required environment variables');
  }

  // Large module — suggest splitting
  for (const mod of modules) {
    if (mod.files.length > 50) {
      recs.push(`Module "${mod.name}" has ${mod.files.length} files — consider splitting into sub-modules`);
    }
  }

  // No auth detected
  const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null ?? {};
  const allDepKeys = [
    ...Object.keys((pkg as Record<string, unknown>).dependencies as Record<string, string> ?? {}),
    ...Object.keys((pkg as Record<string, unknown>).devDependencies as Record<string, string> ?? {}),
  ];
  const hasAuth = allDepKeys.some(k =>
    k.includes('auth') || k.includes('clerk') || k.includes('lucia')
  );
  if (tech.backend.length > 0 && !hasAuth) {
    recs.push('No authentication library detected — consider adding auth for API endpoints');
  }

  // Monorepo without workspace config
  if (modules.filter(m => m.type === 'frontend').length > 1 && modules.filter(m => m.type === 'backend').length > 1) {
    recs.push('Multiple frontend/backend modules detected — consider a monorepo tool like Turborepo or Nx');
  }

  // No services detected
  if (services.length === 0) {
    recs.push('No clear service boundaries detected — consider organizing code into distinct services');
  }

  return recs;
}

// ─── Main discovery function (new rich report) ────────────────

export function discoverArchitecture(snapshot: ProjectSnapshot): ArchitectureReport {
  const tech = detectTechStack(snapshot.keyFiles.packageJson);
  const modules = detectModules(snapshot, tech);
  const services = detectServices(snapshot, tech);
  const dataFlows = detectDataFlows(modules, services, tech);
  const recommendations = generateRecommendations(snapshot, tech, modules, services);

  // Build summary
  const summaryParts: string[] = [];
  if (snapshot.framework && snapshot.framework !== 'None' && snapshot.framework !== 'Unknown') {
    summaryParts.push(`${snapshot.framework} project`);
  } else {
    summaryParts.push(`${snapshot.language} project`);
  }
  summaryParts.push(`${snapshot.fileCount} files across ${modules.length} module${modules.length !== 1 ? 's' : ''}`);
  if (tech.database.length > 0) {
    summaryParts.push(`using ${tech.database.join(' + ')}`);
  }
  if (services.length > 0) {
    summaryParts.push(`${services.length} service${services.length !== 1 ? 's' : ''}`);
  }

  return {
    summary: summaryParts.join(', '),
    techStack: tech,
    modules,
    services,
    dataFlows,
    recommendations,
  };
}

// ─── Legacy function (kept for MCP backward compat) ──────────

export function discoverArchitectureLegacy(
  snapshot: ProjectSnapshot,
  graph: ArchitectureGraph,
): ArchitectureDiscovery {
  // Derive top-level modules from file tree
  const topLevelDirs = [...new Set(
    snapshot.topFiles
      .map((f) => f.replace(/\\/g, '/').split('/')[0])
      .filter((d): d is string => !!d && !d.startsWith('.')),
  )];

  const modules: ArchitectureDiscovery['modules'] = topLevelDirs.map((dir) => {
    const type = MODULE_TYPE_MAP[dir.toLowerCase()] ?? 'other';
    const descriptions: Record<string, string> = {
      frontend: 'UI components, pages, and client-side logic',
      backend: 'API routes, server logic, and middleware',
      database: 'Data models, schemas, and migrations',
      infrastructure: 'Deployment, CI/CD, and infrastructure config',
      testing: 'Test suites and test utilities',
      library: 'Shared utilities, hooks, and configuration',
      other: 'Project-specific module',
    };
    return {
      name: dir,
      path: dir,
      type: type === 'tool' ? 'other' : type,
      description: descriptions[type] ?? descriptions.other,
    };
  });

  // Derive data flow from graph edges
  const dataFlow: string[] = graph.edges
    .filter((e) => e.label)
    .map((e) => `${e.source} → ${e.target} (${e.label})`);

  // If no labeled edges, synthesize from node connections
  if (dataFlow.length === 0 && graph.edges.length > 0) {
    for (const edge of graph.edges.slice(0, 10)) {
      dataFlow.push(`${edge.source} → ${edge.target}`);
    }
  }

  // Derive entry points from key files
  const entryPoints: string[] = [];
  const pkg = snapshot.keyFiles.packageJson as Record<string, unknown> | null;
  if (pkg && typeof pkg.scripts === 'object' && pkg.scripts !== null) {
    const scripts = pkg.scripts as Record<string, string>;
    if (scripts.dev) entryPoints.push(`npm run dev → ${scripts.dev}`);
    if (scripts.start) entryPoints.push(`npm run start → ${scripts.start}`);
    if (scripts.build) entryPoints.push(`npm run build → ${scripts.build}`);
  }
  if (snapshot.keyFiles.dockerFile) entryPoints.push('Docker (Dockerfile present)');
  if (snapshot.keyFiles.ciConfig) entryPoints.push('CI pipeline configured');

  // Derive key patterns from framework and language
  const keyPatterns: string[] = [];
  if (snapshot.framework !== 'None' && snapshot.framework !== 'Unknown') {
    keyPatterns.push(`${snapshot.framework} framework conventions`);
  }
  if (snapshot.language === 'TypeScript' || snapshot.language === 'JavaScript') {
    keyPatterns.push('Node.js ecosystem');
  }
  if (modules.some((m) => m.type === 'frontend') && modules.some((m) => m.type === 'backend')) {
    keyPatterns.push('Full-stack architecture');
  }
  if (modules.some((m) => m.type === 'database')) {
    keyPatterns.push('Database layer present');
  }
  if (snapshot.existingClaudeMd) {
    keyPatterns.push('AI context file (CLAUDE.md) present');
  }

  // Build summary
  const moduleTypes = [...new Set(modules.map((m) => m.type))];
  const summaryParts: string[] = [
    `${snapshot.repoName} is a ${snapshot.language} project using ${snapshot.framework}`,
    `with ${snapshot.fileCount} files across ${modules.length} top-level modules`,
    `(${moduleTypes.join(', ')}).`,
  ];
  if (graph.nodes.length > 0) {
    summaryParts.push(`Architecture graph contains ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
  }

  return {
    summary: summaryParts.join(' '),
    modules,
    dataFlow,
    entryPoints,
    keyPatterns,
  };
}