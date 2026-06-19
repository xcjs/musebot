import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

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

const zipFiles = [];

execSync('zip -r musebot-linux-x86_64.zip build/dist/linux', { stdio: 'inherit' });
zipFiles.push('musebot-linux-x86_64.zip');

execSync('zip -r musebot-win-x86_64.zip build/dist/windows', { stdio: 'inherit' });
zipFiles.push('musebot-win-x86_64.zip');

console.log(`Release version: ${version}`);
console.log(`Zip files: ${zipFiles.join(', ')}`);
console.log(`Changelog length: ${changelog.length} chars`);

zipFiles.push('build/dist/linux/musebot.jpg');

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
		formData.append(`files[${i}]`, new Blob([buf]), zipFiles[i].split('/').pop());
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
