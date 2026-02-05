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

export function getIpcDataset(): IpcDataset {
  return ipcData as IpcDataset;
}

export function flattenIpcClasses(data: IpcDataset): IpcClassItem[] {
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

export function searchIpcClasses(query: string, data: IpcDataset): IpcClassItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = flattenIpcClasses(data);
  return all.filter((item) => item.code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q));
}
