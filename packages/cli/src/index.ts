import { Command } from "commander";
import pc from "picocolors";
import inquirer from "inquirer";
import { version } from "../package.json";
import { upload } from "./commands/upload";
import { promises as fs } from "node:fs";
import path from "node:path";

const program = new Command();

program
	.name("justshare")
	.description("CLI for JustShare file uploading")
	.version(version, "-v, --version", "output the current version")
	.option("-d, --debug", "output extra debugging information")
	.on("option:debug", () => {
		process.env.DEBUG = "true";
	});

async function selectFile(startPath: string): Promise<string> {
	const files = await fs.readdir(startPath, { withFileTypes: true });
	const choices = files.map((file) => ({
		name: file.isDirectory() ? `📁 ${file.name}` : `📄 ${file.name}`,
		value: path.join(startPath, file.name),
		short: file.name,
	}));

	choices.unshift({ name: "📂 ..", value: path.join(startPath, ".."), short: ".." });

	const { selected } = await inquirer.prompt([
		{
			type: "list",
			name: "selected",
			message: "Select a file or directory:",
			choices: choices,
			pageSize: 15,
		},
	]);

	const stats = await fs.stat(selected);
	if (stats.isDirectory()) {
		return selectFile(selected);
	}
	return selected;
}

program
	.command("upload")
	.description("Upload a file")
	.argument("[path]", "Path to the file to upload")
	.action(async (providedPath) => {
		try {
			let filePath: string;
			if (providedPath) {
				filePath = path.resolve(providedPath);
			} else {
				filePath = await selectFile(process.cwd());
			}
			await upload(filePath);
		} catch (e) {
			const error = e as Error;

			console.error(pc.red("Error during upload:"), error.message);
			if (process.env.DEBUG) {
				console.error(error.stack);
			}
			process.exit(1);
		}
	});

program.addHelpText(
	"after",
	`
Example:
  $ justshare upload
  $ justshare upload ./path/to/file.txt
  $ justshare upload ./path/to/large-file.zip

For more information, visit: https://justshare.example.com/docs
`,
);

console.info(pc.gray(`JustShare CLI version ${version}`));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
	program.outputHelp();
}
