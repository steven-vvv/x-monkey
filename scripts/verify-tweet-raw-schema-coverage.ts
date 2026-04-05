import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { ZodTypeAny } from 'zod';
import * as tweetRawSchema from '../src/schema/tweet-raw-schema';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface RootTweetResultNode {
  file: string;
  path: string;
  value: unknown;
}

interface ParseFailure {
  file: string;
  path: string;
  typename: string | null;
  message: string;
}

interface FieldCoverageStat {
  fieldName: string;
  optional: boolean;
  presentCount: number;
  missingCount: number;
}

interface ObjectCoverageStat {
  objectName: string;
  objectCount: number;
  fields: Map<string, FieldCoverageStat>;
}

const ROOT = resolve(process.cwd());
const DUMPS_DIR = join(ROOT, 'dumps');
const TWEET_RESULT_SCHEMA = tweetRawSchema.TweetResultSchema;
const TWEET_RESULT_TYPENAMES = new Set([
  'Tweet',
  'TweetWithVisibilityResults',
  'TweetTombstone',
]);

const schemaNames = new Map<ZodTypeAny, string>();
const coverageStats = new Map<string, ObjectCoverageStat>();

function listJsonFiles(dir: string): string[] {
  const result: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      result.push(fullPath);
    }
  }

  return result.sort();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function unwrapSchema(schema: ZodTypeAny): ZodTypeAny {
  let current = schema;

  while (true) {
    const type = current.def?.type;

    if (type === 'lazy') {
      current = current.def.getter();
      continue;
    }

    if (
      type === 'optional'
      || type === 'nullable'
      || type === 'default'
      || type === 'prefault'
      || type === 'catch'
      || type === 'nonoptional'
    ) {
      current = current.def.innerType;
      continue;
    }

    if (type === 'pipe') {
      current = current.def.out;
      continue;
    }

    return current;
  }
}

function registerExportedSchemaNames() {
  for (const [exportName, value] of Object.entries(tweetRawSchema)) {
    if (!exportName.endsWith('Schema')) continue;
    if (!value || typeof value !== 'object' || !('def' in value)) continue;

    const rawSchema = value as ZodTypeAny;
    schemaNames.set(rawSchema, exportName.replace(/Schema$/, ''));

    const resolved = unwrapSchema(rawSchema);
    if (resolved.def?.type !== 'object') continue;

    const schemaName = exportName.replace(/Schema$/, '');
    if (!schemaNames.has(resolved)) {
      schemaNames.set(resolved, schemaName);
    }
  }
}

function getObjectName(schemaInput: ZodTypeAny, schema: ZodTypeAny, fallbackName: string): string {
  return schemaNames.get(schemaInput) ?? schemaNames.get(schema) ?? fallbackName;
}

function getOrCreateObjectStat(objectName: string): ObjectCoverageStat {
  let stat = coverageStats.get(objectName);
  if (!stat) {
    stat = {
      objectName,
      objectCount: 0,
      fields: new Map(),
    };
    coverageStats.set(objectName, stat);
  }
  return stat;
}

function getOrCreateFieldStat(
  objectStat: ObjectCoverageStat,
  fieldName: string,
  optional: boolean,
): FieldCoverageStat {
  let stat = objectStat.fields.get(fieldName);
  if (!stat) {
    stat = {
      fieldName,
      optional,
      presentCount: 0,
      missingCount: 0,
    };
    objectStat.fields.set(fieldName, stat);
  }
  return stat;
}

function selectUnionOption(schema: ZodTypeAny, value: unknown): ZodTypeAny | null {
  for (const option of schema.def.options as ZodTypeAny[]) {
    if ((option as ZodTypeAny).safeParse(value).success) {
      return option;
    }
  }
  return null;
}

function walkCoverage(
  schemaInput: ZodTypeAny,
  value: unknown,
  fallbackName: string,
) {
  const schema = unwrapSchema(schemaInput);
  const type = schema.def?.type;

  if (type === 'union') {
    const option = selectUnionOption(schema, value);
    if (option) {
      walkCoverage(option, value, fallbackName);
    }
    return;
  }

  if (type === 'array') {
    if (!Array.isArray(value)) return;
    for (const item of value) {
      walkCoverage(schema.def.element, item, `${fallbackName}[]`);
    }
    return;
  }

  if (type !== 'object' || !isPlainObject(value)) {
    return;
  }

  const objectName = getObjectName(schemaInput, schema, fallbackName);
  const objectStat = getOrCreateObjectStat(objectName);
  objectStat.objectCount++;

  for (const [fieldName, fieldSchema] of Object.entries(schema.def.shape as Record<string, ZodTypeAny>)) {
    const fieldStat = getOrCreateFieldStat(objectStat, fieldName, fieldSchema.isOptional());
    const hasField = Object.prototype.hasOwnProperty.call(value, fieldName);

    if (!hasField) {
      fieldStat.missingCount++;
      continue;
    }

    fieldStat.presentCount++;
    walkCoverage(fieldSchema, value[fieldName], `${objectName}.${fieldName}`);
  }
}

function collectTweetResultRoots(
  value: unknown,
  file: string,
  currentPath = '',
  roots: RootTweetResultNode[] = [],
): RootTweetResultNode[] {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return roots;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectTweetResultRoots(item, file, `${currentPath}[${index}]`, roots);
    });
    return roots;
  }

  const tweetResult = value.tweet_results;
  if (isPlainObject(tweetResult) && 'result' in tweetResult) {
    const resultValue = tweetResult.result;
    const typename = isPlainObject(resultValue) && typeof resultValue.__typename === 'string'
      ? resultValue.__typename
      : null;
    if (typename && TWEET_RESULT_TYPENAMES.has(typename)) {
      roots.push({
        file,
        path: currentPath ? `${currentPath}.tweet_results.result` : 'tweet_results.result',
        value: resultValue,
      });
    }
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    collectTweetResultRoots(child, file, childPath, roots);
  }

  return roots;
}

function formatFieldList(fields: string[]): string {
  return fields.length === 0 ? '(none)' : fields.join(', ');
}

function main() {
  registerExportedSchemaNames();

  const files = listJsonFiles(DUMPS_DIR);
  const roots: RootTweetResultNode[] = [];
  const failures: ParseFailure[] = [];

  for (const filePath of files) {
    const relFile = relative(ROOT, filePath);
    const json = JSON.parse(readFileSync(filePath, 'utf8')) as JsonValue;
    collectTweetResultRoots(json, relFile, '', roots);
  }

  for (const root of roots) {
    const parsed = TWEET_RESULT_SCHEMA.safeParse(root.value);
    if (!parsed.success) {
      failures.push({
        file: root.file,
        path: root.path,
        typename: isPlainObject(root.value) && typeof root.value.__typename === 'string'
          ? root.value.__typename
          : null,
        message: parsed.error.issues[0]?.message ?? 'Unknown parse error',
      });
      continue;
    }

    walkCoverage(TWEET_RESULT_SCHEMA, root.value, 'TweetResult');
  }

  const zeroHitOptionalFields = [...coverageStats.values()]
    .map((objectStat) => ({
      objectName: objectStat.objectName,
      objectCount: objectStat.objectCount,
      fields: [...objectStat.fields.values()]
        .filter((field) => field.optional && field.presentCount === 0)
        .map((field) => field.fieldName)
        .sort(),
    }))
    .filter((item) => item.fields.length > 0)
    .sort((a, b) => a.objectName.localeCompare(b.objectName));

  const unseenExportedObjects = [...schemaNames.entries()]
    .map(([, objectName]) => objectName)
    .filter((objectName, index, arr) => arr.indexOf(objectName) === index)
    .filter((objectName) => !coverageStats.has(objectName))
    .sort();

  console.log('# Tweet Raw Schema Coverage');
  console.log(`- json-files: ${files.length}`);
  console.log(`- tweet-result-roots: ${roots.length}`);
  console.log(`- parse-failures: ${failures.length}`);
  console.log(`- observed-object-schemas: ${coverageStats.size}`);
  console.log();

  console.log('## Optional Fields Never Seen In Samples');
  if (zeroHitOptionalFields.length === 0) {
    console.log('- (none)');
  } else {
    for (const item of zeroHitOptionalFields) {
      console.log(`- ${item.objectName} (objects=${item.objectCount}): ${formatFieldList(item.fields)}`);
    }
  }
  console.log();

  console.log('## Exported Object Schemas Never Reached');
  console.log(`- ${formatFieldList(unseenExportedObjects)}`);
  console.log();

  console.log('## Parse Failures');
  if (failures.length === 0) {
    console.log('- (none)');
  } else {
    for (const failure of failures.slice(0, 20)) {
      console.log(`- ${failure.file} :: ${failure.path} :: ${failure.typename ?? '(unknown)'} :: ${failure.message}`);
    }
    if (failures.length > 20) {
      console.log(`- ... ${failures.length - 20} more`);
    }
  }
}

main();
