function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];

    if (!current.startsWith("--")) {
      continue;
    }

    const splitIdx = current.indexOf("=");
    if (splitIdx > -1) {
      const key = current.slice(2, splitIdx);
      const value = current.slice(splitIdx + 1);
      result[key] = value;
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      i += 1;
    } else {
      result[key] = "true";
    }
  }
  return result;
}

function deepMerge(target, source) {
  const output = { ...target };
  if (!source || typeof source !== "object") {
    return output;
  }

  Object.keys(source).forEach((key) => {
    const srcValue = source[key];
    if (
      srcValue
      && typeof srcValue === "object"
      && !Array.isArray(srcValue)
      && !Buffer.isBuffer(srcValue)
    ) {
      output[key] = deepMerge(output[key] || {}, srcValue);
    } else {
      output[key] = srcValue;
    }
  });

  return output;
}

function printJson(title, data) {
  console.log(`\n=== ${title} ===`);
  if (data === undefined) {
    console.log("undefined");
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

module.exports = { parseArgs, deepMerge, printJson };
