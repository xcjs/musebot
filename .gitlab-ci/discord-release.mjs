import { readFileSync, writeFileSync } from 'node:fs';

const tag = process.env.CI_COMMIT_TAG;
if (!tag) {
	console.error('CI_COMMIT_TAG is not set. This job should only run on tag pipelines.');
	process.exit(1);
}

const version = tag.replace(/^v/, '');
const mediaWebhook = process.env.DISCORD_MEDIA_WEBHOOK;
const newsWebhook = process.env.DISCORD_NEWS_WEBHOOK;

if (!mediaWebhook || !newsWebhook) {
	console.error('DISCORD_MEDIA_WEBHOOK and DISCORD_NEWS_WEBHOOK CI variables must be set.');
	process.exit(1);
}

function extractChangelog(ver) {
	const content = readFileSync('CHANGELOG.md', 'utf8');
	const escaped = ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(`## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n## \\[|$)`);
	const match = content.match(regex);
	return match ? match[1].trim() : null;
}

function formatForDiscord(markdown) {
	return markdown
		.replace(/^###\s+(.+)$/gm, '**$1**')
		.replace(/^##\s+(.+)$/gm, '**$1**');
}

function truncateForEmbed(text, maxLength = 4096) {
	if (text.length <= maxLength) return text;
	const truncated = text.slice(0, maxLength - 60);
	const lastNewline = truncated.lastIndexOf('\n');
	const cut = lastNewline > 0 ? truncated.slice(0, lastNewline) : truncated;
	return `${cut}\n\n*…truncated — see CHANGELOG.md for the full release notes.*`;
}

const rawChangelog = extractChangelog(version);
if (!rawChangelog) {
	console.error(`No changelog entry found for version ${version} in CHANGELOG.md`);
	process.exit(1);
}

const changelog = formatForDiscord(rawChangelog);
const changelogEmbed = truncateForEmbed(changelog);

const apiV4Url = process.env.CI_API_V4_URL;
const projectId = process.env.CI_PROJECT_ID;
const jobToken = process.env.CI_JOB_TOKEN;
const refName = process.env.CI_COMMIT_REF_NAME;

if (!apiV4Url || !projectId || !jobToken || !refName) {
	console.error('Required GitLab CI environment variables (CI_API_V4_URL, CI_PROJECT_ID, CI_JOB_TOKEN, CI_COMMIT_REF_NAME) must be set.');
	process.exit(1);
}

async function downloadArtifactZip(jobName, outputPath) {
	const url = `${apiV4Url}/projects/${projectId}/jobs/artifacts/${encodeURIComponent(refName)}/download?job=${encodeURIComponent(jobName)}`;
	console.log(`Downloading artifacts from: ${url}`);
	const response = await fetch(url, { headers: { 'JOB-TOKEN': jobToken } });
	if (!response.ok) {
		const text = await response.text();
		console.error(`Failed to download artifacts for "${jobName}" (${response.status}): ${text}`);
		process.exit(1);
	}
	const buffer = Buffer.from(await response.arrayBuffer());
	writeFileSync(outputPath, buffer);
	console.log(`  Downloaded: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
	return outputPath;
}

const zipFiles = [];

zipFiles.push(await downloadArtifactZip('Build Linux Distributable', 'musebot-linux-x86_64.zip'));
zipFiles.push(await downloadArtifactZip('Build Windows Distributable', 'musebot-win-x86_64.zip'));

console.log(`Release version: ${version}`);
console.log(`Zip files: ${zipFiles.join(', ')}`);
console.log(`Changelog length: ${changelog.length} chars`);

zipFiles.push('musebot.jpg');

const EMBED_COLOR = 0x5865f2;
const now = new Date().toISOString();

async function postToMediaChannel() {
	console.log('Posting to Discord media channel...');
	const formData = new FormData();

	const payload = {
		content: `**Musebot ${version}** — release archives attached below.`,
		embeds: [
			{
				title: `Changelog — ${version}`,
				description: changelogEmbed,
				color: EMBED_COLOR,
				image: { url: `attachment://musebot.jpg` },
				footer: { text: 'Musebot Release' },
				timestamp: now,
			},
		],
	};

	formData.append('payload_json', JSON.stringify(payload));

	for (let i = 0; i < zipFiles.length; i++) {
		const buf = readFileSync(zipFiles[i]);
		formData.append(`files[${i}]`, new Blob([buf]), zipFiles[i]);
		console.log(`  Attached: ${zipFiles[i]} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
	}

	const response = await fetch(mediaWebhook, { method: 'POST', body: formData });

	if (!response.ok) {
		const text = await response.text();
		console.error(`Media channel webhook failed (${response.status}): ${text}`);
		process.exit(1);
	}

	console.log('Posted to media channel successfully.');
}

async function postToNewsChannel() {
	console.log('Posting to Discord news channel...');

	const payload = {
		embeds: [
			{
				title: `Musebot ${version} Released!`,
				description: changelogEmbed,
				color: EMBED_COLOR,
				footer: { text: 'Musebot Release' },
				timestamp: now,
			},
		],
	};

	const response = await fetch(newsWebhook, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const text = await response.text();
		console.error(`News channel webhook failed (${response.status}): ${text}`);
		process.exit(1);
	}

	console.log('Posted to news channel successfully.');
}

await postToMediaChannel();
await postToNewsChannel();
console.log('Release published to Discord successfully!');
