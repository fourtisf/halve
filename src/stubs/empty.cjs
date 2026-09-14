// Empty CommonJS module. Optional peer packages of transitive wallet SDKs (e.g. @x402/*) are aliased
// here so the bundler does not fail on imports Halve never executes. CommonJS keeps the export
// surface dynamic, so named imports resolve to undefined instead of failing at build time.
module.exports = {}
