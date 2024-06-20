/*
  This file is based on code from the following projects:
  https://github.com/honojs/create-hono/blob/main/build.ts

  MIT License
  Copyright (c) 2024 Yusuke Wada <https://github.com/yusukebe>
*/

import { build } from "esbuild";

const b = () =>
	build({
		bundle: true,
		entryPoints: ["./src/index.ts"],
		banner: {
			js: "#!/usr/bin/env node",
		},
		platform: "node",
		outfile: "bin",
		format: "cjs",
		minify: true,
	});

Promise.all([b()]);
