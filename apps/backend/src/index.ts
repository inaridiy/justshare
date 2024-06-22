import { vValidator } from "@hono/valibot-validator";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { createMiddleware } from "hono/factory";
// biome-ignore lint/style/noNamespaceImport: Simple is better than complex
import * as v from "valibot";
import type { AsRecord } from "./utils/types";

const fileMetadataSChema = v.object({
	filename: v.string(),
	password: v.optional(v.string()),
});

// biome-ignore lint/style/useNamingConvention: This is a Hono specific type
const app = new Hono<{ Bindings: AsRecord<Env> }>();

const rateLimiter = createMiddleware(async (c, next) => {
	const ipAddress = c.req.header("cf-connecting-ip") ?? "unknown";
	const { success } = await c.env.RATE_LIMITER.limit({ key: ipAddress });
	if (!success) return c.json({ success: false, error: "Rate limit exceeded" }, 429);

	await next();
});

const MAX_PART_SIZE = 1024 * 1024 * 1024 * 128; // 128GB
const EXPIRATION_TTL = 60 * 60 * 24 * 7; // 7 days

const routes = app
	.post(
		"/:id/create",
		rateLimiter,
		vValidator("json", v.object({ filename: v.string(), password: v.optional(v.string()) })),
		async (c) => {
			const id = c.req.param("id");
			const { filename, password } = c.req.valid("json");

			const exists = await c.env.KV.get(`justshare:${id}`);
			if (exists) return c.json({ success: false, error: "File already exists" }, 400);

			const metadata = { filename, password };
			const valid = v.parse(fileMetadataSChema, metadata);
			await c.env.KV.put(`justshare:${id}`, JSON.stringify(valid), { expirationTtl: EXPIRATION_TTL });

			const { key, uploadId } = await c.env.DRIVE_BUCKET.createMultipartUpload(`justshare:${id}`);
			return c.json({ mpu: { key, uploadId } }, 200);
		},
	)
	.post(
		"/:id/complete",
		rateLimiter,
		vValidator("query", v.object({ uploadId: v.string() })),
		vValidator("json", v.object({ parts: v.array(v.object({ partNumber: v.number(), etag: v.string() })) })),
		async (c) => {
			const id = c.req.param("id");
			const { uploadId } = c.req.valid("query");
			const { parts } = c.req.valid("json");

			const mpu = await c.env.DRIVE_BUCKET.resumeMultipartUpload(`justshare:${id}`, uploadId);
			try {
				const uploaded = await mpu.complete(parts);

				if (uploaded.size > MAX_PART_SIZE) {
					await c.env.DRIVE_BUCKET.delete(`justshare:${id}`);
					return c.json({ success: false, error: "File too large" }, 400);
				}

				c.header("etag", uploaded.etag);
				return c.json({ success: true, size: uploaded.size }, 200);
			} catch (e) {
				return c.json({ success: false, error: (e as Error).message }, 400);
			}
		},
	)
	.put(
		"/:id/upload",
		rateLimiter,
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

			const mpu = await c.env.DRIVE_BUCKET.resumeMultipartUpload(`justshare:${id}`, uploadId);
			try {
				const part = await mpu.uploadPart(Number(partNumber), payload);
				return c.json({ success: true, part }, 200);
			} catch (e) {
				return c.json({ success: false, error: (e as Error).message }, 400);
			}
		},
	)
	.get("/:id", async (c, next) => {
		const id = c.req.param("id");
		const mayBeMetadata = await c.env.KV.get(`justshare:${id}`).then((x) => x && JSON.parse(x));
		const metadata = v.parse(fileMetadataSChema, mayBeMetadata);
		if (!metadata) return c.text("Not found", 404);

		if (metadata.password) {
			const failResponse = await basicAuth({ username: "user", password: metadata.password })(c, next);
			if (failResponse) return failResponse;
		}

		const file = await c.env.DRIVE_BUCKET.get(`justshare:${id}`);

		if (!file) return c.text("Not found", 404);

		return c.body(file.body);
	})
	.delete("/:id", async (c) => {
		const id = c.req.param("id");

		await c.env.KV.delete(`justshare:${id}`);
		await c.env.DRIVE_BUCKET.delete(`justshare:${id}`);
		return c.json({ success: true });
	});

// biome-ignore lint/style/noDefaultExport: This is the entry point of the app
export default app;
export type AppType = typeof routes;
