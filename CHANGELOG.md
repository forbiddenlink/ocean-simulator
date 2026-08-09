# Changelog

## 1.0.0 (2026-08-09)


### Features

* comprehensive realism improvements and bug fixes ([4a9fad7](https://github.com/forbiddenlink/ocean-simulator/commit/4a9fad7204d1ec6c44ef6ca5fe48efc8a72038d0))
* **creatures:** animated caustic dapples on fish and large bodies ([c9efe9c](https://github.com/forbiddenlink/ocean-simulator/commit/c9efe9c03de4ded11bc45acf35790b313b570371))
* **creatures:** extrude flat shark/dolphin fins into real 3D ([b98a703](https://github.com/forbiddenlink/ocean-simulator/commit/b98a703549ca2466b49b9c809f6bf0e20457f764))
* **fish:** sleeker fusiform body + fix flat-shading on standard fish ([3acc51a](https://github.com/forbiddenlink/ocean-simulator/commit/3acc51a0b83c52355c5f3ff9557acf271b0733e5))
* **hunting:** add bait-ball panic contagion + hunt visual events, raise population caps ([87695e6](https://github.com/forbiddenlink/ocean-simulator/commit/87695e64fbcb4a333650cca8638108d73298eeb6))
* **life:** add bioluminescent anglerfish to the ambient ocean life ([4627d7d](https://github.com/forbiddenlink/ocean-simulator/commit/4627d7dd7aca7afe29b9d8986edfc0e00604b0ef))
* **life:** add cuttlefish, comb jelly, and hermit crab species ([40c34b3](https://github.com/forbiddenlink/ocean-simulator/commit/40c34b34d7d45ef8de79bfccd07ea08ab530e59d))
* **life:** add nautilus, giant clam, and sea cucumber species ([ac1fae5](https://github.com/forbiddenlink/ocean-simulator/commit/ac1fae5838dc2c3f961f9f171297210fa3ac8e74))
* **life:** add squid, pufferfish, and sea snake species + spawn tests ([aff430f](https://github.com/forbiddenlink/ocean-simulator/commit/aff430f1a58355aa87c4870d138a00c3136e5abf))
* **life:** idle drift for ambient species + refreshed README case study ([e43e9ed](https://github.com/forbiddenlink/ocean-simulator/commit/e43e9ed3cae3dfcd48291af7c7f69a8d4036e3db))
* **look:** bioluminescent night mode as a third look preset ([d05a48d](https://github.com/forbiddenlink/ocean-simulator/commit/d05a48d40fd774292944846ea3fefd0f371afc48))
* **models:** optional GLTF creature-model pipeline (inert by default) ([62279cb](https://github.com/forbiddenlink/ocean-simulator/commit/62279cb94f9869d7a0e9c0a1150c28d3db91d3fd))
* **ocean:** fix black-screen rendering + overhaul ecosystem visuals ([640fc82](https://github.com/forbiddenlink/ocean-simulator/commit/640fc82a995cb6a836a141a276e54924e9b06222))
* **ray:** rebuild the ray as a proper manta wing ([ee7318a](https://github.com/forbiddenlink/ocean-simulator/commit/ee7318a95e5b633ba3729c89a548f6bf43fc8ecc))
* **rendering:** cinematic deep overhaul — lit creatures, god rays, intro ([dd6ba71](https://github.com/forbiddenlink/ocean-simulator/commit/dd6ba7159e3895bf831dcae2f3cd2bf47c7b9e28))
* **rendering:** image-based lighting, depth of field, sun in-scattering ([89bbb90](https://github.com/forbiddenlink/ocean-simulator/commit/89bbb904665758ef00790da5abf62a286ef1cb16))
* **ui:** rebuild the HUD as a premium instrument, remove all emoji ([f0e6f5c](https://github.com/forbiddenlink/ocean-simulator/commit/f0e6f5c6bbfbe8a96446ecf2132ff4747d7ad567))


### Bug Fixes

* allow PostHog domains in CSP and isolate UV-transforming post-processing effects ([b91d48f](https://github.com/forbiddenlink/ocean-simulator/commit/b91d48f60057f92796f046f75845171917207282))
* **ci:** regenerate pnpm-lock to match package.json ([1d12195](https://github.com/forbiddenlink/ocean-simulator/commit/1d121959f8e1ed4ec07b772144d2cfd5581db660))
* convert manualChunks to function form for Vite 8 rolldown compatibility ([cadd221](https://github.com/forbiddenlink/ocean-simulator/commit/cadd2217cdde8334560350e482c6e91d975ba176))
* **deps:** add pnpm.overrides esbuild &gt;=0.28.1 to clear HIGH alert in lockfile ([b64221a](https://github.com/forbiddenlink/ocean-simulator/commit/b64221a89af9c9d8fc3dfd37e4006f8eb2e7508f))
* **deps:** bump vitest from 4.0.18 to 4.1.9 to resolve GHSA critical CVE ([3d9067c](https://github.com/forbiddenlink/ocean-simulator/commit/3d9067c9f09c6bb2dcea7ac9d145f9b01d6773ab))
* **deps:** force esbuild &gt;=0.28.1 via npm override to resolve HIGH CVE ([fb37987](https://github.com/forbiddenlink/ocean-simulator/commit/fb37987a39cbf1007f4bd62ee8de45e09d0eae94))
* disable noUnusedLocals/Parameters to fix TS6133 build error ([9722f34](https://github.com/forbiddenlink/ocean-simulator/commit/9722f340ba42916405842d13d613b0af90f974f6))
* include pnpm-lock.yaml for CI ([b624054](https://github.com/forbiddenlink/ocean-simulator/commit/b624054ab04ea8c943266091cba622b928a231b4))
* patch 4 security vulnerabilities ([9e37b54](https://github.com/forbiddenlink/ocean-simulator/commit/9e37b54c33a42d1a7b03621a0322a98fa7992b5b))
* Position debug GUI below custom HUD panels ([e8bc511](https://github.com/forbiddenlink/ocean-simulator/commit/e8bc5116e31b48c1db3f8df65edaed96a2896d28))
* prefix unused private class members with _ to suppress TS6133 ([84690ea](https://github.com/forbiddenlink/ocean-simulator/commit/84690eaba10bee5bf45de79be820da3749617ac9))
* regenerate pnpm lockfile ([8c0ead3](https://github.com/forbiddenlink/ocean-simulator/commit/8c0ead3e25aee28c0938cdaecfaa70aa42f55316))
* regenerate pnpm lockfile for three and zustand version bumps ([6ee0dd8](https://github.com/forbiddenlink/ocean-simulator/commit/6ee0dd8b307cf08f87cd7e8ce7334f61a3318c53))
* **rendering:** tune ocean visuals and fish material for color visibility ([2c75e68](https://github.com/forbiddenlink/ocean-simulator/commit/2c75e68929734a9a98f4b6f4f6977f4ca41f8a32))
* update posthog-js to resolve protobufjs and dompurify vulnerabilities ([59b057b](https://github.com/forbiddenlink/ocean-simulator/commit/59b057b286b4b4894761a841d9aeed9cb1eac76f))


### Performance Improvements

* **life:** merge ambient creatures by material to cut draw calls ([7589ec1](https://github.com/forbiddenlink/ocean-simulator/commit/7589ec1de586a231358f401d49773e752f1078d6))
* **mesh-pool:** drop per-frame debug counting and throttle despawn cleanup ([b927f0e](https://github.com/forbiddenlink/ocean-simulator/commit/b927f0ef693c6faafe3e0d99f4893a9715874444))
* **spawn:** trim over-spawned floor critters and pale jelly clutter ([808fdef](https://github.com/forbiddenlink/ocean-simulator/commit/808fdef2c5e293d505206d482413ae437c015efd))
