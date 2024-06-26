import fs from "node:fs/promises";
import path, { resolve } from "node:path";
import mime from "mime-types";
import { PART_SIZE } from "../constants";

export const validatePath = async (filePath: string) => {
	const fullPath = await resolve(filePath);
	await fs.access(fullPath, fs.constants.R_OK);
	return fullPath;
};

export const getFileStats = async (filePath: string) => {
	const stats = await fs.stat(filePath);
	return {
		size: stats.size,
		totalParts: Math.ceil(stats.size / PART_SIZE),
	};
};

export const getFileMetadata = async (filePath: string) => {
	const stats = await getFileStats(filePath);

	return {
		filename: path.basename(filePath),
		contentType: mime.lookup(path.extname(filePath).toLowerCase()) || "application/octet-stream",
		size: stats.size,
		totalParts: stats.totalParts,
	};
};

export const readFilePart = async (path: string, index: number) => {
	const { size } = await fs.stat(path);
	const startPos = index * PART_SIZE;
	const endPos = Math.min((index + 1) * PART_SIZE, size);
	const partSize = endPos - startPos;
	const buffer = Buffer.alloc(partSize);

	const file = await fs.open(path, "r");
	await file.read(buffer, 0, partSize, startPos);
	await file.close();

	return buffer;
};
