import { readFileSync } from 'node:fs';

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
	const lines = content.split(/\r?\n/);
	const headerRegex = new RegExp(`^##\\s+\\[${ver.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`);
	let capturing = false;
	const collected = [];
	for (const line of lines) {
		if (capturing) {
			if (/^##\s+\[/.test(line)) break;
			collected.push(line);
		} else if (headerRegex.test(line)) {
			capturing = true;
		}
	}
	return collected.length > 0 ? collected.join('\n').trim() : null;
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
	console.error(`No changelog entry found for version "${version}" in CHANGELOG.md`);
	process.exit(1);
}

const changelog = formatForDiscord(rawChangelog);
const changelogEmbed = truncateForEmbed(changelog);

console.log(`Release version: ${version}`);
console.log(`Changelog length: ${changelog.length} chars`);

const EMBED_COLOR = 0x5865f2;
const now = new Date().toISOString();

async function postToMediaChannel() {
	console.log('Posting to Discord media channel...');
	const formData = new FormData();

	const payload = {
		content: `**Musebot ${version}** — release archives will be attached as a comment.`,
		thread_name: `Musebot ${version} Release`,
		embeds: [
			{
				title: `Changelog — ${version}`,
				description: changelogEmbed,
				color: EMBED_COLOR,
				image: { url: `attachment://logo.jpg` },
				footer: { text: 'Musebot Release' },
				timestamp: now,
			},
		],
	};

	formData.append('payload_json', JSON.stringify(payload));

	const buf = readFileSync('logo.jpg');
	formData.append('files[0]', new Blob([buf]), 'logo.jpg');
	console.log(`  Attached: logo.jpg (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);

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
