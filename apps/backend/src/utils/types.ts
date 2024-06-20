export type AsRecord<T> = { [key in keyof T]: T[key] };
