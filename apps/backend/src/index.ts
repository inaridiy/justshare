import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import v from "valibot";
import type { AsRecord } from "./utils/types";

// biome-ignore lint/style/useNamingConvention: This is a Hono specific type
const app = new Hono<{ Bindings: AsRecord<Env> }>();

const routes = app
	.post("/:id/create", async (c) => {
		const id = c.req.param("id");
		const { key, uploadId } = await c.env.DRIVE_BUCKET.createMultipartUpload(id);
		return c.json({ mpu: { key, uploadId } });
	})
	.post(
		"/:id/complete",
		vValidator("query", v.object({ uploadId: v.string() })),
		vValidator("json", v.object({ parts: v.array(v.object({ partNumber: v.number(), etag: v.string() })) })),
		async (c) => {
			const id = c.req.param("id");
			const { uploadId } = c.req.valid("query");
			const { parts } = c.req.valid("json");

			const mpu = await c.env.DRIVE_BUCKET.resumeMultipartUpload(id, uploadId);

			try {
				const uploaded = await mpu.complete(parts);
				c.header("etag", uploaded.etag);
				return c.json({ success: true, size: uploaded.size });
			} catch (e) {
				return c.json({ success: false, error: (e as Error).message }, 400);
			}
		},
	)
	.put(
		"/:id/upload",
		vValidator(
			"query",
			v.object({
				uploadId: v.string(),
				partNumber: v.pipe(v.string(), v.regex(/^\d+$/, "partNumber must be a number")),
			}),
		),
		async (c) => {
			const id = c.req.param("id");
			const { uploadId, partNumber } = c.req.valid("query");
			const payload = c.req.raw.body;

			if (!payload) return c.json({ success: false, error: "No body provided" }, 400);

			const mpu = await c.env.DRIVE_BUCKET.resumeMultipartUpload(id, uploadId);

			try {
				const part = await mpu.uploadPart(Number(partNumber), payload);
				return c.json({ success: true, part });
			} catch (e) {
				return c.json({ success: false, error: (e as Error).message }, 400);
			}
		},
	)
	.get("/:id", async (c) => {
		const id = c.req.param("id");

		const file = await c.env.DRIVE_BUCKET.get(id);

		if (!file) return c.text("Not found", 404);

		c.header("etag", file.etag);
		const response = c.body(file.body);

		file.writeHttpMetadata(response.headers);
		return response;
	})
	.delete("/:id", async (c) => {
		const id = c.req.param("id");
		await c.env.DRIVE_BUCKET.delete(id);
		return c.json({ success: true });
	});

// biome-ignore lint/style/noDefaultExport: This is the entry point of the app
export default app;
export type AppType = typeof routes;
