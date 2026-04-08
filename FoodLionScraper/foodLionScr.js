const { spawnSync } = require("child_process");
const path = require("path");

const SEARCH = "milk";

const scriptPath = path.join(__dirname, "foodLionScr.py");

const result = spawnSync(
    "C:\\Users\\jasse\\AppData\\Local\\Microsoft\\WindowsApps\\python3.13.exe",
    [scriptPath],
    {
        env: { ...process.env, SEARCH },
        encoding: "utf-8",
    }
);

if (result.stderr) process.stderr.write(result.stderr);
if (result.stdout) process.stdout.write(result.stdout);
