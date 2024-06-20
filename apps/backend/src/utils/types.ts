export type AsRecord<T> = { [K in keyof T]: T[K] };
