import Taro from '@tarojs/taro';

export async function ensureWeappVideoSrc(assetPath: string, fileName: string): Promise<string> {
  if (process.env.TARO_ENV !== 'weapp') return assetPath;
  const fs = Taro.getFileSystemManager();
  const userVideoPath = `${Taro.env.USER_DATA_PATH}/${fileName}`;

  const accessFile = (path: string) =>
    new Promise<boolean>((resolve) => {
      fs.access({
        path,
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    });

  const copyFile = (src: string, dest: string) =>
    new Promise<void>((resolve, reject) => {
      fs.copyFile({
        srcPath: src,
        destPath: dest,
        success: () => resolve(),
        fail: (err) => reject(err),
      });
    });

  const readFile = (path: string) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      fs.readFile({
        filePath: path,
        success: (res) => resolve(res.data as ArrayBuffer),
        fail: (err) => reject(err),
      });
    });

  const writeFile = (path: string, data: ArrayBuffer) =>
    new Promise<void>((resolve, reject) => {
      fs.writeFile({
        filePath: path,
        data,
        success: () => resolve(),
        fail: (err) => reject(err),
      });
    });

  const exists = await accessFile(userVideoPath);
  if (!exists) {
    try {
      await copyFile(assetPath, userVideoPath);
    } catch (copyErr) {
      try {
        const data = await readFile(assetPath);
        await writeFile(userVideoPath, data);
      } catch (rwErr) {
        throw new Error(
          `copy-failed:${(copyErr as any)?.errMsg || 'unknown'}|readwrite-failed:${(rwErr as any)?.errMsg || 'unknown'}`,
        );
      }
    }
  }

  return userVideoPath;
}
