import assert from 'assert'
import * as A from 'fp-ts/lib/Array'
import { constVoid, pipe } from 'fp-ts/lib/function'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import { Api, Drive } from '../../../icloud/drive'
import { DepApi, DepAskConfirmation } from '../../../icloud/drive/deps'
import { isNotRootDetails } from '../../../icloud/drive/types'

type Deps =
  & Drive.Deps
  & DepApi<'moveItemsToTrash'>
  & DepAskConfirmation

export const rm = (
  { paths, trash, recursive }: {
    paths: string[]
    trash: boolean
    recursive: boolean
  },
): Drive.Effect<void, Deps> => {
  assert(A.isNonEmpty(paths))

  return pipe(
    Drive.searchGlobs(paths, recursive ? Infinity : 1),
    SRTE.map(A.flatten),
    SRTE.chainW((items) =>
      items.length > 0
        ? pipe(
          SRTE.ask<Drive.State, Deps>(),
          SRTE.chainTaskEitherK(deps =>
            deps.askConfirmation({
              message: `remove\n${pipe(items, A.map(a => a.path)).join('\n')}`,
            })
          ),
          SRTE.chain((answer) =>
            answer
              ? pipe(
                Api.moveItemsToTrash<Drive.State>({
                  items: pipe(
                    items.map(a => a.item),
                    A.filter(isNotRootDetails),
                  ),
                  trash,
                }),
                SRTE.chainW(
                  resp => Drive.removeByIdsFromCache(resp.items.map(_ => _.drivewsid)),
                ),
              )
              : SRTE.of(constVoid())
          ),
        )
        : SRTE.of(constVoid())
    ),
  )
}
