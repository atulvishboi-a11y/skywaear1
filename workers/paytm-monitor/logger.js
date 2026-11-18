import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

// Ensure logs directory exists
if (!fs.existsSync(config.logsDir)) {
  fs.mkdirSync(config.logsDir, { recursive: true });
}

const logFilePath = path.join(config.logsDir, "worker.log");

function formatTimestamp() {
  return new Date().toISOString();
}

function writeToFile(level, message, meta) {
  try {
    const entry = {
      timestamp: formatTimestamp(),
      level,
      message,
      ...(meta ? { meta } : {}),
    };
    fs.appendFileSync(logFilePath, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.error("[Logger] Failed to write to log file:", err.message);
  }
}

export const logger = {
  info(message, meta) {
    const ts = formatTimestamp();
    console.log(`[${ts}] [INFO] ${message}`, meta ? meta : "");
    writeToFile("INFO", message, meta);
  },

  warn(message, meta) {
    const ts = formatTimestamp();
    console.warn(`\x1b[33m[${ts}] [WARN] ${message}\x1b[0m`, meta ? meta : "");
    writeToFile("WARN", message, meta);
  },

  error(message, meta) {
    const ts = formatTimestamp();
    console.error(`\x1b[31m[${ts}] [ERROR] ${message}\x1b[0m`, meta ? meta : "");
    writeToFile("ERROR", message, meta);
  },

  success(message, meta) {
    const ts = formatTimestamp();
    console.log(`\x1b[32m[${ts}] [SUCCESS] ${message}\x1b[0m`, meta ? meta : "");
    writeToFile("SUCCESS", message, meta);
  },

  alert(message, meta) {
    const ts = formatTimestamp();
    console.log(`\x1b[35m[${ts}] [ALERT 🔔] ${message}\x1b[0m`, meta ? meta : "");
    writeToFile("ALERT", message, meta);
  },
};
