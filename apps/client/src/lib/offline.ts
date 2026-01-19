import offlineScenario from '../mock/offline-scenario.json';

type ScenarioEntry = { status?: number; body?: any };
type CompiledEntry = { method: string; regex: RegExp; body: any };

const compiled: CompiledEntry[] = Object.entries(offlineScenario as Record<string, ScenarioEntry>)
  .filter(([_, value]) => value && typeof value === 'object')
  .flatMap(([key, value]) => {
    const [method, rawPath] = key.split(' ');
    if (!method || !rawPath || !value?.body) return [];

    // convert /foo/:id/bar to regex for path matching
    const pattern = '^' + rawPath.replace(/:[^/]+/g, '[^/]+') + '$';
    return [
      {
        method: method.toUpperCase(),
        regex: new RegExp(pattern),
        body: value.body,
      },
    ];
  });

export function getOfflineMock<T>(method: string, path: string): T | null {
  const target = compiled.find((it) => it.method === method.toUpperCase() && it.regex.test(path));
  if (!target) return null;

  // return a deep copy to avoid accidental mutations
  return JSON.parse(JSON.stringify(target.body)) as T;
}
