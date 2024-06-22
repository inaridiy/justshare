import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { version } from "../package.json";
import { upload } from "./commands/upload";
import { promptPassword, selectFile } from "./utils/cli";

const program = new Command();

program
	.name("justshare")
	.description("CLI for JustShare file uploading")
	.version(version, "-v, --version", "output the current version")
	.option("-d, --debug", "output extra debugging information")
	.on("option:debug", () => {
		process.env.DEBUG = "true";
	});

program
	.command("upload")
	.description("Upload a file")
	.argument("[path]", "Path to the file to upload")
	.option("-p, --password <password>", "Password to protect the file")
	.action(async (providedPath, { password: providedPassword }: { password: string }) => {
		try {
			const filePath = providedPath ? path.resolve(providedPath) : await selectFile(process.cwd());
			const password = (providedPassword || (await promptPassword())).trim() || undefined;

			await upload(filePath, password);
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
  $ justshare upload ./path/to/large-file.zip -p mypassword

Basic auth can be added for files. The user name is always **user**.
More information can be found at https://github.com/inaridiy/justshare`,
);

console.info(pc.gray(`JustShare CLI version ${version}`));

program.parse(process.argv);

if (!process.argv.slice(2).length) {
	program.outputHelp();
}
