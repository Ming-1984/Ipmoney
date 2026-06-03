import ipcData from '../data/ipc/ipc-2026-01.json';

export type IpcClass = {
  code: string;
  name: string;
};

export type IpcSection = {
  code: string;
  name: string;
  classes: IpcClass[];
};

export type IpcDataset = {
  version: string;
  sections: IpcSection[];
};

export type IpcClassItem = IpcClass & {
  sectionCode: string;
  sectionName: string;
};

let datasetCache: IpcDataset | null = null;
let flattenedDatasetRef: IpcDataset | null = null;
let flattenedCache: IpcClassItem[] | null = null;
let searchableDatasetRef: IpcDataset | null = null;
let searchableCache: Array<{ item: IpcClassItem; haystack: string }> | null = null;

function buildFlattened(data: IpcDataset): IpcClassItem[] {
  const out: IpcClassItem[] = [];
  data.sections.forEach((section) => {
    section.classes.forEach((cls) => {
      out.push({
        code: cls.code,
        name: cls.name,
        sectionCode: section.code,
        sectionName: section.name,
      });
    });
  });
  return out;
}

function getSearchable(data: IpcDataset): Array<{ item: IpcClassItem; haystack: string }> {
  if (searchableDatasetRef === data && searchableCache) return searchableCache;
  const flattened = flattenIpcClasses(data);
  searchableDatasetRef = data;
  searchableCache = flattened.map((item) => ({
    item,
    haystack: `${item.code} ${item.name} ${item.sectionCode} ${item.sectionName}`.toLowerCase(),
  }));
  return searchableCache;
}

export function getIpcDataset(): IpcDataset {
  if (!datasetCache) {
    datasetCache = ipcData as IpcDataset;
  }
  return datasetCache;
}

export function flattenIpcClasses(data: IpcDataset): IpcClassItem[] {
  if (flattenedDatasetRef === data && flattenedCache) return flattenedCache;
  const flattened = buildFlattened(data);
  flattenedDatasetRef = data;
  flattenedCache = flattened;
  return flattened;
}

export function searchIpcClasses(query: string, data: IpcDataset): IpcClassItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getSearchable(data)
    .filter((entry) => entry.haystack.includes(q))
    .map((entry) => entry.item);
}
