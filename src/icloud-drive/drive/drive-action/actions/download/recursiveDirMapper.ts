import { identity } from 'fp-ts/lib/function'
import { Path, prependPath } from '../../../../../util/path'
import { DownloadTask, DownloadTaskMapped } from './types'

export const recursiveDirMapper = (
  dstpath: string,
  mapPath: (path: string) => string = identity,
) =>
  (ds: DownloadTask): DownloadTaskMapped => {
    return {
      downloadable: ds.downloadable
        .map(([remotepath, file]) => ({
          info: [remotepath, file],
          localpath: prependPath(dstpath)(mapPath(remotepath)),
        })),
      empties: ds.empties
        .map(([remotepath, file]) => ({
          info: [remotepath, file],
          localpath: prependPath(dstpath)(mapPath(remotepath)),
        })),
      localdirstruct: [
        dstpath,
        ...ds.dirstruct
          .map(p => prependPath(dstpath)(mapPath(p))),
      ],
    }
  }

export const shallowDirMapper = (dstpath: string) =>
  (ds: DownloadTask) => ({
    downloadable: ds.downloadable.map(info => ({
      info,
      localpath: Path.join(dstpath, Path.basename(info[0])),
    })),
    empties: ds.empties.map(info => ({ info, localpath: Path.join(dstpath, Path.basename(info[0])) })),
    localdirstruct: [dstpath],
  })
