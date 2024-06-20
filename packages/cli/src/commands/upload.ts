import { intro, log, outro, spinner } from "@clack/prompts";
import { nanoid } from "nanoid";
import ora from "ora";
import pc from "picocolors";
import asyncPool from "tiny-async-pool";
import { completeUpload, createUpload, uploadPart } from "../utils/api";
import { getFileStats, readFilePart, validatePath } from "../utils/file";
import { retry } from "../utils/retry";

export const upload = async (path: string) => {
	intro(pc.bold("File Upload"));

	const fullPath = await validatePath(path);
	const fileId = nanoid();

	const s = spinner();
	s.start("Initializing upload");

	const { mpu } = await createUpload(fileId);
	s.stop("Upload initialized");

	const { totalParts } = await getFileStats(fullPath);

	const uploadProgress = ora("Uploading file parts").start();
	let uploadedPartsCount = 0;

	const poolUpload = async (i: number) => {
		const buffer = await readFilePart(fullPath, i);
		const result = await retry(() => uploadPart(fileId, mpu.uploadId, i, buffer));
		uploadedPartsCount++;
		uploadProgress.text = `Uploading file parts (${uploadedPartsCount}/${totalParts})`;
		return result;
	};

	const uploadedPartsItr = await asyncPool(
		20,
		Array.from({ length: totalParts }, (_, i) => i),
		poolUpload,
	);
	const uploadedParts = [];
	for await (const part of uploadedPartsItr) uploadedParts.push(part);

	uploadProgress.succeed("All parts uploaded");

	s.start("Completing upload");
	const { size: uploadedSize } = await completeUpload(
		fileId,
		mpu.uploadId,
		uploadedParts.map(({ part }) => part),
	);
	s.stop("Upload completed");

	log.success(`Uploaded ${uploadedSize} bytes`);
	outro(pc.green("File upload completed successfully!"));
};
