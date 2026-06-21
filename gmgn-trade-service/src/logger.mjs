import fs from 'node:fs';
import path from 'node:path';

export function createLogger(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });

  return {
    info(message, detail) {
      logConsole('INFO', message, detail);
    },
    warn(message, detail) {
      logConsole('WARN', message, detail);
    },
    error(message, detail) {
      logConsole('ERROR', message, detail);
    },
    writeSignal(record) {
      appendJsonLine('signals.jsonl', record);
    },
    writeExecution(record) {
      appendJsonLine('executions.jsonl', record);
    },
    writeError(record) {
      appendJsonLine('errors.jsonl', record);
    },
    serializeError
  };

  function appendJsonLine(fileName, data) {
    const filePath = path.join(dataDir, fileName);
    fs.appendFileSync(filePath, `${JSON.stringify(data)}\n`, 'utf8');
  }
}

export function serializeError(error) {
  if (!error) return null;
  return {
    name: error.name || 'Error',
    message: error.message || String(error),
    stack: error.stack || ''
  };
}

function logConsole(level, message, detail) {
  const ts = new Date().toISOString();
  if (detail === undefined) {
    console.log(`[${ts}] [${level}] ${message}`);
    return;
  }
  console.log(`[${ts}] [${level}] ${message}`, detail);
}
