import { hc } from "hono/client";
import type { AppType } from "justshare-api";
import { API_URL } from "../constants";
import type { UploadedPart } from "../types";

export const client = hc<AppType>(API_URL);

export const createUpload = async (
	fileId: string,
	metadata: { filename: string; contentType: string; password: string | undefined },
) => {
	const result = await client[":id"].create.$post({ param: { id: fileId }, json: { ...metadata } });
	if (!result.ok) {
		console.error(await result.text());
		throw new Error("Failed to create file");
	}
	return result.json();
};

export const uploadPart = async (fileId: string, uploadId: string, partIndex: number, buffer: Buffer) => {
	const partNumber = partIndex + 1;
	const res = await client[":id"].upload.$put(
		{ param: { id: fileId }, query: { uploadId, partNumber: String(partNumber) } },
		{ init: { body: buffer, headers: { "Content-Type": "application/octet-stream" } } },
	);
	if (!res.ok) throw new Error(await res.json().then((j) => j.error));
	return res.json();
};

export const completeUpload = async (fileId: string, uploadId: string, parts: UploadedPart[]) => {
	const result = await client[":id"].complete.$post({
		param: { id: fileId },
		query: { uploadId },
		json: { parts },
	});
	if (!result.ok) throw new Error(`Failed to complete file upload: ${await result.text()}`);
	return result.json();
};

export const getDownloadUrl = (fileId: string) => {
	return client[":id"].$url({ param: { id: fileId } }).toString();
};
