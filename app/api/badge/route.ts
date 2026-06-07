// GET /api/badge?projectId=xxx — Generate an SVG badge for AI Readiness score

import { NextRequest, NextResponse } from 'next/server';
import { listScans, getProject } from '@/lib/storage';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getBadgeColor(score: number): string {
  if (score >= 80) return '#2ea043'; // green
  if (score >= 60) return '#0969da'; // blue
  if (score >= 30) return '#d29922'; // amber
  return '#cf222e'; // red
}

function getBadgeLabel(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 30) return 'needs work';
  return 'critical';
}

function generateSvg(score: number): string {
  const color = getBadgeColor(score);
  const label = getBadgeLabel(score);
  const scoreText = `${score}/${100} ${label}`;

  // Calculate right-side width based on text length
  const rightWidth = 65;
  const leftWidth = 75;
  const totalWidth = leftWidth + rightWidth;
  const rightX = leftWidth + rightWidth / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h${leftWidth}v20H0z"/>
    <path fill="${escapeXml(color)}" d="M${leftWidth} 0h${rightWidth}v20H${leftWidth}z"/>
    <path fill="url(#b)" d="M0 0h${totalWidth}v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".3">AI Readiness</text>
    <text x="${leftWidth / 2}" y="14">AI Readiness</text>
    <text x="${rightX}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(scoreText)}</text>
    <text x="${rightX}" y="14">${escapeXml(scoreText)}</text>
  </g>
</svg>`;
}

function generateNaSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="120" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <path fill="#555" d="M0 0h75v20H0z"/>
    <path fill="#9ca3af" d="M75 0h45v20H75z"/>
    <path fill="url(#b)" d="M0 0h120v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="37.5" y="15" fill="#010101" fill-opacity=".3">AI Readiness</text>
    <text x="37.5" y="14">AI Readiness</text>
    <text x="97.5" y="15" fill="#010101" fill-opacity=".3">N/A</text>
    <text x="97.5" y="14">N/A</text>
  </g>
</svg>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return new NextResponse(generateNaSvg(), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const project = getProject(projectId);
  if (!project) {
    return new NextResponse(generateNaSvg(), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const scans = listScans(projectId);
  if (scans.length === 0) {
    return new NextResponse(generateNaSvg(), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const latestScan = scans[0]; // listScans returns newest first
  const score = latestScan.audit.totalScore;

  return new NextResponse(generateSvg(score), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}