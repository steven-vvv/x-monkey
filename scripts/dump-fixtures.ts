import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { XHR_CAPTURE_EXPORT_FORMAT } from '../src/lib/xhr-capture-export';

/** One GraphQL response found under `dumps/`. */
export interface DumpFixture {
  /** Path relative to the project root; capture export records end with `#<record id>`. */
  source: string;
  operationName: string;
  response: unknown;
  /** Request variables, known for capture export records only. */
  variables?: Record<string, unknown>;
  pageUrl?: string;
}

const ROOT = resolve(process.cwd());
/** Response files saved by the old single-response download: `<Operation>-<hash>.json`. */
const RAW_RESPONSE_FILE = /^([A-Za-z]+)-[0-9a-f]{8}\.json$/;

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listJsonFiles(path);
      return entry.isFile() && entry.name.endsWith('.json') ? [path] : [];
    })
    .sort();
}

/**
 * Collects fixtures from raw response files and from XHR capture exports
 * (successful JSON responses only). Dumps are gitignored and may be absent.
 */
export function loadDumpFixtures(dir = join(ROOT, 'dumps')): DumpFixture[] {
  if (!existsSync(dir)) return [];

  return listJsonFiles(dir).flatMap((path): DumpFixture[] => {
    const source = relative(ROOT, path);
    const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;

    if (json?.format === XHR_CAPTURE_EXPORT_FORMAT) {
      return (json.records as any[])
        .filter((record) => record.response?.status === 200 && record.response?.bodyFormat === 'json')
        .map((record) => ({
          source: `${source}#${record.id}`,
          operationName: record.request.graphql.operationName,
          response: record.response.body,
          variables: record.request.graphql.variables,
          pageUrl: record.page?.url,
        }));
    }

    const match = RAW_RESPONSE_FILE.exec(basename(path));
    return match ? [{ source, operationName: match[1], response: json }] : [];
  });
}
