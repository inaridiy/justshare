import { intro, log, outro, spinner } from "@clack/prompts";
import { nanoid } from "nanoid";
import ora from "ora";
import pc from "picocolors";
import qrcode from "qrcode-terminal";
import asyncPool from "tiny-async-pool";
import { completeUpload, createUpload, getDownloadUrl, uploadPart } from "../utils/api";
import { getFileMetadata, readFilePart, validatePath } from "../utils/file";
import { retry } from "../utils/retry";

export const upload = async (path: string, password: string | undefined) => {
	try {
		intro(pc.bold("File Upload"));

		const fullPath = await validatePath(path);
		const fileId = nanoid();

		const s = spinner();
		s.start("Initializing upload");

		const { totalParts, size: fileSize, filename, contentType } = await getFileMetadata(fullPath);

		const { mpu } = await createUpload(fileId, { filename, contentType, password });
		s.stop("Upload initialized");

		const concurrency = 20;
		const uploadProgress = ora(`Uploading file (0/${totalParts} parts, 0%))`).start();
		let uploadedPartsCount = 0;
		let uploadedBytes = 0;

		const updateProgress = () => {
			const percentage = ((uploadedPartsCount / totalParts) * 100).toFixed(2);
			uploadProgress.text = `Uploading file (${uploadedPartsCount}/${totalParts} parts, ${percentage}%)`;
		};

		const poolUpload = async (i: number) => {
			const buffer = await readFilePart(fullPath, i);
			const result = await retry(() => uploadPart(fileId, mpu.uploadId, i, buffer));
			uploadedPartsCount++;
			uploadedBytes += buffer.length;
			updateProgress();
			return result;
		};

		const uploadedPartsItr = await asyncPool(
			concurrency,
			Array.from({ length: totalParts }, (_, i) => i),
			poolUpload,
		);

		const uploadedParts = [];
		for await (const part of uploadedPartsItr) {
			uploadedParts.push(part);
		}

		uploadProgress.succeed(`All parts uploaded (Size: ${pc.bold(uploadedBytes)} bytes)`);

		s.start("Completing upload");
		const { size: uploadedSize } = await completeUpload(
			fileId,
			mpu.uploadId,
			uploadedParts.map(({ part }) => part),
		);
		s.stop("Upload completed");

		log.success(`Uploaded ${uploadedSize} bytes`);
		outro(pc.green("File upload completed successfully!"));

		if (uploadedSize !== fileSize) {
			log.warn(
				pc.yellow(
					`Warning: Uploaded size (${uploadedSize} bytes) differs from original file size (${fileSize} bytes).`,
				),
			);
		}

		const fileUrl = getDownloadUrl(fileId);
		console.info(pc.cyan("\nScan this QR code to access the uploaded file:"));
		qrcode.generate(fileUrl, { small: true }, (qrcode) => {
			console.info(qrcode);
		});
		console.info(pc.dim(`Or use this link: ${fileUrl}`));
	} catch (error) {
		outro(pc.red("File upload failed"));
		throw error; // Re-throw the error to be caught in the main CLI handler
	}
};
