// Generated by Wrangler on Thu Jun 20 2024 21:37:01 GMT+0900 (Japan Standard Time)
// by running `wrangler types`

interface Env {
	DRIVE_BUCKET: R2Bucket;
	KV: KVNamespace;
	RATE_LIMITER: { limit({ key: string }): Promise<{ success: true }> };
}
