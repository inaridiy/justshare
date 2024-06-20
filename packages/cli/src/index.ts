import { hc } from "hono/client";
import chalk from "chalk";
import arg from "arg";
import { nanoid } from "nanoid";
import type { AppType } from "backend";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { version } from "../package.json";
import { asyncPool, retry } from "./utils";

const API_URL = "http://localhost:8989";
const client = hc<AppType>(API_URL);

const PART_SIZE = 1024 * 1024 * 128; // 128MB

const uploadFilePart = async (fileId: string, uploadId: string, partSize: number, index: number) => {
	const dip = await fs.open(fileId, "r");
	const buffer = Buffer.alloc(partSize);
	await dip.read(buffer, 0, partSize, index * partSize);
	await dip.close();

	const result = await retry(async () => {
		const res = await client[":id"].upload.$put(
			{ param: { id: fileId }, query: { uploadId, partNumber: String(index + 1) } },
			{ init: { body: buffer, headers: { "Content-Type": "application/octet-stream" } } },
		);
		if (!res.ok) throw new Error(await res.json().then((j) => j.error));
		return await res.json();
	}).catch((error) => {
		console.error(chalk.red(`Failed to upload part ${index + 1}: ${error.message} :(`));
		process.exit(1);
	});

	console.info(chalk.green(`Uploaded part ${index + 1} :D`));
	return result;
};

const main = async () => {
	console.info(chalk.gray(`JustShare CLI version ${version}`));

	const args = arg({ "--path": String });

	const path = args["--path"];
	if (!path) throw new Error("Path is required");
	const fullPath = await resolve(path);

	const fileId = nanoid();

	const createResult = await client[":id"].create.$post({ param: { id: fileId } });
	if (!createResult.ok) throw new Error("Failed to create file");

	const { mpu } = await createResult.json();
	console.info(chalk.green("File Upload Started :D"));

	const targetFileStat = await fs.stat(fullPath);
	const totalParts = Math.ceil(targetFileStat.size / PART_SIZE);

	const uploadArgs = Array.from({ length: totalParts }, (_, i) => i).map(
		(i) => [fileId, mpu.uploadId as string, PART_SIZE, i] as [string, string, number, number],
	);
	const uploadedParts = await asyncPool(20, uploadArgs, uploadFilePart);

	const completeResult = await client[":id"].complete.$post({
		param: { id: fileId },
		query: { uploadId: mpu.uploadId as string },
		json: { parts: uploadedParts.map(({ part }) => part) },
	});

	if (!completeResult.ok) throw new Error("Failed to complete upload");

	console.info(chalk.green("File Upload Completed :D"));

	const { size } = await completeResult.json();

	console.info(chalk.green(`Uploaded ${size} bytes :D`));

	process.exit(0);
};

main().catch((error) => {
	console.error(chalk.red(error.message));
	process.exit(1);
});
