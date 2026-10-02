const origin = new URL(process.argv[2] || "https://www.setups.nexus");
if (!["http:", "https:"].includes(origin.protocol) || origin.username || origin.password) {
  throw new Error("Provide a public HTTP(S) origin without credentials.");
}
const checks = [
  ["/", 200], ["/api/auth/providers", 200], ["/api/auth/session", 200],
  ["/api/auth/csrf", 200], ...["projects", "assets", "notifications", "settings", "tasks", "creators"]
    .map(name => [`/api/${name}`, 401]),
];
for (const [path, expected] of checks) {
  try {
    const response = await fetch(new URL(path, origin.origin), {
      redirect: "manual", signal: AbortSignal.timeout(15_000),
    });
    let passed = response.status === expected;
    if (path === "/api/auth/providers" && passed) {
      const data = await response.json();
      passed = data.credentials?.type === "credentials" &&
        new URL(data.credentials.callbackUrl).origin === origin.origin;
    } else { await response.body?.cancel(); }
    console.log(`${passed ? "PASS" : "FAIL"} ${path}: ${response.status} (expected ${expected})`);
    if (!passed) process.exitCode = 1;
  } catch {
    console.log(`FAIL ${path}: request or response validation failed`);
    process.exitCode = 1;
  }
}
