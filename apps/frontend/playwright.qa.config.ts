import base from "./playwright.config";
export default { ...base, outputDir: "D:/Temp/claude/141e85602410c259/e5e52cda-e3c3-4b75-94d3-9c51b956c5b1/scratchpad/pw-mock", webServer: undefined, projects: base.projects?.filter((p) => p.name === "desktop-1440"), use: { ...base.use, channel: "chrome", baseURL: "http://organizer.localhost:3000" } };
