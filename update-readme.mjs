import { readFileSync, writeFileSync } from 'fs';

let readme = readFileSync('README.md', 'utf-8');

const gifSection = `## Demo

<div align="center">
  <img src="https://raw.githubusercontent.com/PraveenJayaprakash-JP/repomemory/master/public/screenshots/demo.gif" alt="RepoMemory Demo" width="720">
  <p><em>Scan to Generate in 5 seconds</em></p>
</div>

---

`;

const screenshotHeading = '## 📸 Screenshots';
if (readme.includes('🎥 Demo')) {
  console.log('Already has demo section');
} else {
  readme = readme.replace(screenshotHeading, gifSection + screenshotHeading);
  writeFileSync('README.md', readme);
  console.log('README updated with demo GIF');
}
