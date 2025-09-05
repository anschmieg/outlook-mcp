// Simple logger with adjustable level controlled by env.DEBUG or env.LOG_LEVEL
// Levels: error=0, warn=1, info=2, debug=3

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function getLevel() {
  const lvl = global.__LOG_LEVEL;
  if (typeof lvl === 'number') return lvl;
  return LEVELS.warn; // default to warn and above
}

function setLevel(level) {
  if (typeof level === 'string') {
    const l = level.toLowerCase();
    if (l in LEVELS) {
      global.__LOG_LEVEL = LEVELS[l];
      return;
    }
    const n = Number(level);
    if (!Number.isNaN(n)) {
      global.__LOG_LEVEL = Math.max(0, Math.min(3, n));
      return;
    }
  } else if (typeof level === 'number') {
    global.__LOG_LEVEL = Math.max(0, Math.min(3, level));
    return;
  }
}

function setLevelFromEnv(env) {
  if (env && typeof env === 'object') {
    if (env.LOG_LEVEL) return setLevel(env.LOG_LEVEL);
    if (env.DEBUG === true || env.DEBUG === 'true' || env.DEBUG === '1') return setLevel('debug');
  }
  // If nothing specified, leave existing or default
}

function debug(...args) {
  if (getLevel() >= LEVELS.debug) console.log(...args);
}
function info(...args) {
  if (getLevel() >= LEVELS.info) console.log(...args);
}
function warn(...args) {
  if (getLevel() >= LEVELS.warn) console.warn(...args);
}
function error(...args) {
  // Always print errors
  console.error(...args);
}

module.exports = { setLevelFromEnv, setLevel, debug, info, warn, error };

