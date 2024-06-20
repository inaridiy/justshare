export const retry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
	try {
		return await fn();
	} catch (error) {
		if (retries > 1) return retry(fn, retries - 1);
		throw error;
	}
};

export const asyncPool = async <T extends unknown[], R>(
	concurrency: number,
	array: Readonly<T[]>,
	fn: (...args: T) => Promise<R>,
): Promise<R[]> => {
	const ret: R[] = [];
	const executing: Promise<void>[] = [];

	for (const item of array) {
		const p = Promise.resolve().then(() => fn(...item));
		ret.push(p as unknown as R);

		if (concurrency <= array.length) {
			// @ts-expect-error
			const e: Promise<void> = p.then(() => executing.splice(executing.indexOf(e), 1));
			executing.push(e);
			if (executing.length >= concurrency) {
				await Promise.race(executing);
			}
		}
	}

	await Promise.all(executing);
	return ret;
};
