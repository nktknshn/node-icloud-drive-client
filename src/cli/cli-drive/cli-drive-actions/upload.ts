import { constVoid, pipe } from 'fp-ts/lib/function'
import * as NA from 'fp-ts/lib/NonEmptyArray'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import * as AM from '../../../icloud/drive/api'
import * as V from '../../../icloud/drive/cache/cache-get-by-path-types'
import * as DF from '../../../icloud/drive/ffdrive'
import { cliActionM2 } from '../../../icloud/drive/ffdrive/cli-action'
import * as H from '../../../icloud/drive/ffdrive/validation'
import { parseName } from '../../../icloud/drive/helpers'
import { DetailsDocwsRoot, fileName, isFolderLike } from '../../../icloud/drive/requests/types/types'
import { normalizePath } from './helpers'

export const upload = (
  { sessionFile, cacheFile, srcpath, dstpath, noCache, overwright }: {
    srcpath: string
    dstpath: string
    noCache: boolean
    sessionFile: string
    cacheFile: string
    overwright: boolean
  },
) => {
  return pipe(
    { sessionFile, cacheFile, noCache },
    cliActionM2(() => {
      return pipe(
        DF.chainRoot(root =>
          pipe(
            DF.Do,
            SRTE.bind('src', () => DF.of(srcpath)),
            SRTE.bind('overwright', () => DF.of(overwright)),
            SRTE.bind('dst', () => DF.lsPartial(root, normalizePath(dstpath))),
            DF.chain(handle),
            DF.saveCacheFirst(cacheFile),
            DF.map(() => `Success.`),
          )
        ),
      )
    }),
  )
}

const getDrivewsid = ({ zone, document_id, type }: { document_id: string; zone: string; type: string }) => {
  return `${type}::${zone}::${document_id}`
}

const uploadOverwrighting = (
  { src, dst }: { dst: V.ResultValidWithFile<H.Hierarchy<DetailsDocwsRoot>>; src: string },
) => {
  const dstitem = V.target(dst)
  const parent = NA.last(dst.path.details)

  return pipe(
    DF.Do,
    SRTE.bind(
      'uploadResult',
      () => DF.fromApiRequest(AM.upload({ sourceFilePath: src, docwsid: parent.docwsid })),
    ),
    SRTE.bind('removeResult', () => {
      return DF.fromApiRequest(AM.moveItemsToTrash({
        items: [dstitem],
        trash: true,
      }))
    }),
    DF.chain(({ uploadResult, removeResult }) => {
      const drivewsid = getDrivewsid(uploadResult)
      return pipe(
        AM.renameItems({
          items: [{
            drivewsid,
            etag: uploadResult.etag,
            ...parseName(fileName(dstitem)),
          }],
        }),
        DF.fromApiRequest,
        DF.map(constVoid),
      )
    }),
  )
}

const handle = (
  { src, dst, overwright }: { dst: V.HierarchyResult<DetailsDocwsRoot>; src: string; overwright: boolean },
): DF.DriveM<void> => {
  // upload to the directory
  if (dst.valid) {
    const dstitem = V.target(dst)

    if (isFolderLike(dstitem)) {
      return pipe(
        AM.upload({ sourceFilePath: src, docwsid: dstitem.docwsid }),
        DF.fromApiRequest,
        DF.map(constVoid),
      )
    }
    //
    else if (overwright && V.isValidWithFile(dst)) {
      return uploadOverwrighting({ src, dst })
    }

    return DF.errS(`invalid destination path: ${V.asString(dst)} It's a file`)
  }

  if (dst.path.rest.length == 1) {
    // upload and rename
    const dstitem = NA.last(dst.path.details)
    const fname = NA.head(dst.path.rest)

    if (isFolderLike(dstitem)) {
      return pipe(
        AM.upload({ sourceFilePath: src, docwsid: dstitem.docwsid, fname }),
        DF.fromApiRequest,
        DF.map(constVoid),
      )
    }
  }

  return DF.errS(`invalid destination path: ${H.showMaybeValidPath(dst.path)}`)
}
