export function getYamlConfig(content: string): unknown {
  const lines = content.split("\n");
  const result: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [
    { obj: result, indent: -1 },
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.search(/\S/);
    const match = trimmed.match(/^(- )?([\w_-]+):\s*(.*)?$/);
    if (!match) continue;

    const [, isList, key, value] = match;

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1].obj;

    if (value === undefined || value === "" || value === "|" || value === ">") {
      const newObj: Record<string, unknown> = {};
      if (isList) {
        if (!Array.isArray(current[key])) {
          current[key] = [];
        }
        (current[key] as unknown[]).push(newObj);
      } else {
        current[key] = newObj;
      }
      stack.push({ obj: newObj, indent });
    } else {
      let parsed: unknown = value;
      if (value === "true") parsed = true;
      else if (value === "false") parsed = false;
      else if (/^-?\d+$/.test(value)) parsed = parseInt(value, 10);
      else if (/^-?\d+\.\d+$/.test(value)) parsed = parseFloat(value);
      else if (value.startsWith('"') && value.endsWith('"')) parsed = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) parsed = value.slice(1, -1);

      if (isList) {
        if (!Array.isArray(current[key])) {
          current[key] = [];
        }
        (current[key] as unknown[]).push(parsed);
      } else {
        current[key] = parsed;
      }
    }
  }

  return result;
}
