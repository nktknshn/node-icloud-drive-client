import assert from 'assert'
import * as A from 'fp-ts/lib/Array'
import { pipe } from 'fp-ts/lib/function'
import * as NA from 'fp-ts/lib/NonEmptyArray'
import { not } from 'fp-ts/lib/Refinement'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import * as TE from 'fp-ts/lib/TaskEither'
import { fst } from 'fp-ts/lib/Tuple'
import * as AM from '../../../icloud/drive/api'
import * as DF from '../../../icloud/drive/ffdrive'
import { cliActionM2 } from '../../../icloud/drive/ffdrive/cli-action'
import {
  isCloudDocsRootDetails,
  isCloudDocsRootDetailsG,
  isTrashDetails,
  isTrashDetailsG,
} from '../../../icloud/drive/requests/types/types'
import { err } from '../../../lib/errors'
import { normalizePath } from './helpers'

export const rm = (
  { sessionFile, cacheFile, paths, noCache, trash }: {
    paths: string[]
    noCache: boolean
    sessionFile: string
    cacheFile: string
    trash: boolean
  },
) => {
  return pipe(
    {
      sessionFile,
      cacheFile,
      noCache,
      dontSaveCache: true,
    },
    cliActionM2(() => {
      assert(A.isNonEmpty(paths))

      const npaths = pipe(paths, NA.map(normalizePath))

      return pipe(
        DF.Do,
        SRTE.bind('items', () =>
          pipe(
            DF.chainRoot(root => DF.getByPathsE(root, npaths)),
            DF.filterOrElse(not(A.some(isTrashDetailsG)), () => err(`you cannot remove root`)),
            DF.filterOrElse(not(A.some(isCloudDocsRootDetailsG)), () => err(`you cannot remove trash`)),
          )),
        SRTE.bind('result', ({ items }) =>
          pipe(
            AM.moveItemsToTrash({ items, trash }),
            DF.fromApiRequest,
            DF.chain(
              resp => DF.removeByIds(resp.items.map(_ => _.drivewsid)),
            ),
          )),
        // SRTE.chain(() => DF.lsdir(parentPath)),
        DF.saveCacheFirst(cacheFile),
        DF.map(() => `Success.`),
        // SRTE.map(showDetailsInfo({
        //   fullPath: false,
        //   path: '',
        // })),
      )
    }),
  )
}
