import assert from 'assert'
import * as A from 'fp-ts/lib/Array'
import { constVoid, pipe } from 'fp-ts/lib/function'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import * as TE from 'fp-ts/TaskEither'
import { DepAskConfirmation } from '../../../icloud/deps'
import { Drive, DriveApi } from '../../../icloud/drive'
import { DepDriveApi } from '../../../icloud/drive/deps'
import { DriveChildrenItemFile, isNotRootDetails, NonRootDetails } from '../../../icloud/drive/drive-types'
import { guardProp } from '../../../util/guards'
import { NEA } from '../../../util/types'

type Deps =
  & Drive.Deps
  & DepDriveApi<'moveItemsToTrash'>
  & DepAskConfirmation

export const rm = (
  { paths, skipTrash, force, recursive }: {
    paths: string[]
    skipTrash: boolean
    recursive: boolean
    force: boolean
  },
): Drive.Effect<void, Deps> => {
  assert(A.isNonEmpty(paths))

  return pipe(
    Drive.searchGlobs(paths, recursive ? Infinity : 1),
    SRTE.map(A.flatten),
    SRTE.map(
      A.filter(guardProp('item', isNotRootDetails)),
    ),
    SRTE.chainW((items) =>
      A.isNonEmpty(items)
        ? _rm({ items, trash: !skipTrash, force })
        : SRTE.of(constVoid())
    ),
  )
}

const _rm = (
  { items, trash, force }: {
    trash: boolean
    force: boolean
    items: NEA<{ path: string; item: NonRootDetails | DriveChildrenItemFile }>
  },
) => {
  const effect = () =>
    pipe(
      DriveApi.moveItemsToTrash<Drive.State>({
        items: items.map(a => a.item),
        trash,
      }),
      SRTE.chainW(
        resp =>
          Drive.removeByIdsFromCache(
            resp.items.map(_ => _.drivewsid),
          ),
      ),
    )

  return pipe(
    SRTE.ask<Drive.State, Deps>(),
    SRTE.chainTaskEitherK(deps =>
      force
        ? TE.of(true)
        : deps.askConfirmation({
          message: `remove\n${pipe(items, A.map(a => a.path)).join('\n')}`,
        })
    ),
    SRTE.chain((answer) =>
      answer
        ? effect()
        : SRTE.of(constVoid())
    ),
  )
}
