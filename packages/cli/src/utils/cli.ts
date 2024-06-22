import { promises as fs } from "node:fs";
import path from "node:path";
import inquirer from "inquirer";

export async function selectFile(startPath: string): Promise<string> {
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

export async function promptPassword(): Promise<string> {
	const { password } = await inquirer.prompt([
		{
			type: "password",
			name: "password",
			message: "Enter a password for the file (leave empty for no password):",
			mask: "*",
		},
	]);
	return password;
}
