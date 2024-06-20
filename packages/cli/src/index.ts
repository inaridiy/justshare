import { Command } from "commander";
import pc from "picocolors";
import { version } from "../package.json";
import { upload } from "./commands/upload";

const program = new Command();

program.name("justshare").description("CLI for JustShare file uploading").version(version);

program.command("upload").description("Upload a file").argument("<path>", "Path to the file to upload").action(upload);

program.addHelpText(
	"after",
	`
Example:
  $ justshare upload ./path/to/file.txt
`,
);

console.info(pc.gray(`JustShare CLI version ${version}`));

program.parse(process.argv);
