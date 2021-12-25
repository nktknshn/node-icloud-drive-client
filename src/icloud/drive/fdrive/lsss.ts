import * as A from 'fp-ts/lib/Array'
import * as E from 'fp-ts/lib/Either'
import { fromEquals } from 'fp-ts/lib/Eq'
import { pipe } from 'fp-ts/lib/function'
import * as NA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import * as R from 'fp-ts/lib/Record'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import { fst } from 'fp-ts/lib/Tuple'
import { NonRootDrivewsid, NormalizedPath } from '../../../cli/cli-drive/cli-drive-actions/helpers'
import { err } from '../../../lib/errors'
import { logg, logger } from '../../../lib/logging'
import { NEA } from '../../../lib/types'
import { ItemIsNotFileError, ItemIsNotFolderError, NotFoundError } from '../errors'
import * as DF from '../fdrive'
import { findInParent, recordFromTuples } from '../helpers'
import * as T from '../requests/types/types'
import * as V from './GetByPathResultValid'
import { modifySubsetDF } from './modifySubsetDF'
import * as H from './validation'

const equalsDrivewsId = fromEquals((a: { drivewsid: string }, b: { drivewsid: string }) => a.drivewsid == b.drivewsid)

const toActual = (
  cachedPath: T.DetailsRegular[],
  actualsRecord: Record<string, O.Option<T.DetailsRegular>>,
): O.Option<T.DetailsRegular>[] => {
  return pipe(
    cachedPath,
    A.map(h => R.lookup(h.drivewsid)(actualsRecord)),
    A.map(O.flatten),
  )
}

const showHierarchiy = (h: H.Hierarchy<T.Root>): string => {
  const [root, ...rest] = h

  return `${T.isCloudDocsRootDetails(root) ? 'root' : 'trash'}/${rest.map(T.fileName).join('/')}`
}

export const validateHierarchies = <R extends T.Root>(
  root: R,
  cachedHierarchies: NEA<H.Hierarchy<R>>,
): DF.DriveM<NEA<H.WithDetails<H.Hierarchy<R>>>> => {
  const cachedRoot = root

  const cachedPaths = pipe(
    cachedHierarchies,
    NA.map(H.tail),
  )

  const drivewsids = pipe(
    cachedPaths,
    A.flatten,
    A.uniq(equalsDrivewsId),
    A.map(_ => _.drivewsid),
  )

  const res = pipe(
    logg(`validateHierarchies: [${cachedHierarchies.map(showHierarchiy)}]`),
    () =>
      pipe(
        DF.Do,
        SRTE.bind(
          'validation',
          () =>
            DF.retrieveItemDetailsInFoldersSavingNEA<R>([
              cachedRoot.drivewsid,
              ...(drivewsids as NonRootDrivewsid[]),
            ]),
        ),
      ),
    SRTE.map(({ validation: [actualRoot, ...actualRest] }) => {
      const detailsRecord = recordFromTuples(
        A.zip(drivewsids, actualRest),
      )

      return pipe(
        cachedPaths,
        NA.map(cachedPath =>
          H.getValidHierarchyPart<R>(
            [cachedRoot, ...cachedPath],
            [actualRoot.value, ...toActual(cachedPath, detailsRecord)],
          )
        ),
      )
    }),
  )

  return res
}

const showDetails = (details: T.Details) => {
  return `${T.isTrashDetailsG(details) ? 'TRASH_ROOT' : details.type} ${T.fileName(details)}. items: [${
    details.items.map(T.fileName)
  }]`
}

const concatCachedWithValidated = <R extends T.Root>(
  cached: V.GetByPathResult<H.Hierarchy<R>>,
  validated: H.WithDetails<H.Hierarchy<R>>,
): V.GetByPathResult<H.Hierarchy<R>> => {
  if (cached.valid) {
    if (H.isValid(validated)) {
      if (O.isSome(cached.file)) {
        const fname = T.fileName(cached.file.value)
        const parent = NA.last(validated.details)

        return pipe(
          findInParent(parent, T.fileName(cached.file.value)),
          O.fold(
            () => E.left(NotFoundError.createTemplate(fname, parent.drivewsid)),
            (actualFileItem) =>
              T.isFileItem(actualFileItem)
                ? E.of(actualFileItem)
                : E.left(ItemIsNotFileError.createTemplate(actualFileItem)),
          ),
          E.fold(
            (e) =>
              V.invalidResult(
                H.partialPath(validated.details, [fname]),
                e,
              ),
            file => V.validResult(validated.details, O.some(file)),
          ),
        )
      }
      else {
        logger.debug(`V.validResult: ${showDetails(NA.last(validated.details))}`)
        return V.validResult(validated.details)
      }
    }
    else {
      return V.invalidResult(validated, err(`the path changed`))
    }
  }
  else {
    if (H.isValid(validated)) {
      return V.invalidResult(
        H.partialPath(
          validated.details,
          cached.path.rest,
        ),
        cached.error,
      )
    }
    else {
      return V.invalidResult(
        H.partialPath(
          validated.details,
          NA.concat(validated.rest, cached.path.rest),
        ),
        err(`the path changed`),
      )
    }
  }
}

export const validateCachedPaths = <R extends T.Root>(
  root: R,
  paths: NEA<NormalizedPath>,
): DF.DriveM<NEA<V.GetByPathResult<H.Hierarchy<R>>>> => {
  return pipe(
    logg(`validateCachedPaths: ${paths}`),
    () => DF.readEnv,
    SRTE.bind('cached', ({ cache }) =>
      pipe(
        SRTE.fromEither(
          pipe(
            paths,
            NA.map(path => cache.getByPathVER(root, path)),
            E.sequenceArray,
            E.map(_ => _ as NEA<V.GetByPathResult<H.Hierarchy<R>>>),
          ),
        ),
      )),
    SRTE.chain(({ cached }) =>
      pipe(
        logg(`cached: ${cached.map(V.showGetByPathResult).join('      &&      ')}`),
        () => validateHierarchies(root, pipe(cached, NA.map(_ => _.path.details))),
        SRTE.map(NA.zip(cached)),
        SRTE.map(NA.map(([validated, cached]): V.GetByPathResult<H.Hierarchy<R>> => {
          return concatCachedWithValidated<R>(cached, validated)
        })),
      )
    ),
    DF.logS(paths => `result: [${paths.map(V.showGetByPathResult).join(', ')}]`),
  )
}

type DepperFolders<R extends T.Root> =
  // folders items with empty rest (valid, requires details)
  | [O.Some<T.DriveChildrenItemFolder | T.DriveChildrenItemAppLibrary>, [[], V.GetByPathResultInvalid<H.Hierarchy<R>>]]
  // folders items with non empty rest (incomplete paths)
  | [
    O.Some<T.DriveChildrenItemFolder | T.DriveChildrenItemAppLibrary>,
    [NEA<string>, V.GetByPathResultInvalid<H.Hierarchy<R>>],
  ]

const handleFolders = <R extends T.Root>(task: NEA<DepperFolders<R>>): DF.DriveM<NEA<V.HierarchyResult<R>>> => {
  logger.debug(`handleFolders: ${
    task.map(([item, [rest, partial]]) => {
      return `item: ${T.fileName(item.value)}. rest: [${rest}]`
    })
  }`)

  const foldersToRetrieve = pipe(
    task,
    NA.map(([item, [rest, validPart]]) => item.value.drivewsid),
  )

  return pipe(
    DF.retrieveItemDetailsInFoldersSavingE(foldersToRetrieve),
    DF.map(NA.zip(task)),
    DF.chain((details) => {
      return modifySubsetDF(
        details,
        (v): v is [
          T.DriveDetailsWithHierarchy,
          [
            O.Some<T.DriveChildrenItemFolder | T.DriveChildrenItemAppLibrary>,
            [NEA<string>, V.GetByPathResultInvalid<H.Hierarchy<R>>],
          ],
        ] => pipe(v, ([details, [item, [rest, partial]]]) => A.isNonEmpty(rest)),
        (task) => {
          return pipe(
            task,
            NA.map(([details, [item, [rest, partial]]]): V.GetByPathResultInvalid<H.Hierarchy<R>> =>
              V.invalidResult(
                H.partialPath(
                  H.concat(partial.path.details, [details]),
                  rest,
                ),
                err(`we need to go deepr)`),
              )
            ),
            retrivePartials,
          )
        },
        ([details, [item, [rest, partial]]]): V.GetByPathResultValid<H.Hierarchy<R>> => {
          return {
            valid: true,
            path: H.validPath(H.concat(partial.path.details, [details])),
            file: O.none,
          }
        },
      )
    }),
  )
}

const handleFiles = <R extends T.Root>() =>
  (
    [item, [rest, partial]]: [
      O.Some<T.DriveChildrenItemFile>,
      [string[], V.GetByPathResultInvalid<H.Hierarchy<R>>],
    ],
  ): V.GetByPathResult<H.Hierarchy<R>> => {
    return pipe(
      rest,
      A.match(
        (): V.GetByPathResultValid<H.Hierarchy<R>> => ({
          valid: true,
          file: item,
          path: H.validPath(partial.path.details),
        }),
        (rest): V.GetByPathResult<H.Hierarchy<R>> => ({
          valid: false,
          error: ItemIsNotFolderError.create(`item is not folder`),
          path: H.partialPath(partial.path.details, NA.concat([T.fileName(item.value)], rest)),
        }),
      ),
    )
  }

const handleItems = <R extends T.Root>(
  found: NEA<[O.Some<T.DriveChildrenItem>, [string[], V.GetByPathResultInvalid<H.Hierarchy<R>>]]>,
): DF.DriveM<V.HierarchyResult<R>[]> => {
  logger.debug(`handleItems. ${
    found.map(([item, [rest, partial]]) => {
      return `item: ${T.fileName(item.value)}.`
    })
  }`)

  const filterFolders = (
    v: [O.Some<T.DriveChildrenItem>, [string[], V.GetByPathResultInvalid<H.Hierarchy<R>>]],
  ): v is DepperFolders<R> => {
    return T.isFolderLikeItem(v[0].value)
  }

  if (A.isNonEmpty(found)) {
    return modifySubsetDF(found, filterFolders, handleFolders, handleFiles())
  }

  return DF.of([])
}

const retrivePartials = <R extends T.Root>(
  partialPaths: NEA<V.GetByPathResultInvalid<H.Hierarchy<R>>>,
): DF.DriveM<NEA<V.GetByPathResult<H.Hierarchy<R>>>> => {
  logger.debug(`retrivePartials: ${partialPaths.map(V.showGetByPathResult)}`)

  const subItems = pipe(
    partialPaths,
    NA.map(_ => findInParent(NA.last(_.path.details), NA.head(_.path.rest))),
    NA.zip(pipe(partialPaths, NA.map(_ => NA.tail(_.path.rest)), NA.zip(partialPaths))),
  )

  return modifySubsetDF(
    subItems,
    (v): v is [O.Some<T.DriveChildrenItem>, [string[], V.GetByPathResultInvalid<H.Hierarchy<R>>]] =>
      pipe(v, fst, O.isSome),
    handleItems,
    ([item, [rest, partial]]: [O.None, [string[], V.GetByPathResultInvalid<H.Hierarchy<R>>]]): V.HierarchyResult<R> => {
      return {
        valid: false,
        error: NotFoundError.createTemplate(
          NA.head(partial.path.rest),
          T.fileName(NA.last(partial.path.details)),
        ),
        path: partial.path,
      }
    },
  )
}

const getActuals = <R extends T.Root>(
  results: NEA<[V.GetByPathResult<H.Hierarchy<R>>, NormalizedPath]>,
): DF.DriveM<NEA<V.GetByPathResult<H.Hierarchy<R>>>> => {
  logger.debug(
    `getActuals: ${results.map(([p, path]) => `for ${path}. so far we have: ${V.showGetByPathResult(p)}`)}`,
  )
  return pipe(
    modifySubsetDF(
      results,
      (res): res is [V.GetByPathResultInvalid<H.Hierarchy<R>>, NormalizedPath] => !res[0].valid,
      (subset: NEA<[V.GetByPathResultInvalid<H.Hierarchy<R>>, NormalizedPath]>) =>
        pipe(subset, NA.map(fst), retrivePartials),
      ([h, p]: [V.GetByPathResultValid<H.Hierarchy<R>>, NormalizedPath]): V.HierarchyResult<R> => h,
    ),
  )
}

export const getByPaths = <R extends T.Root>(
  root: R,
  paths: NEA<NormalizedPath>,
): DF.DriveM<NEA<V.HierarchyResult<R>>> => {
  const res = pipe(
    validateCachedPaths<R>(root, paths),
    SRTE.map(NA.zip(paths)),
    SRTE.chain(getActuals),
  )

  return res
}

export const lsss = <R extends T.Root>(
  root: R,
  paths: NEA<NormalizedPath>,
): DF.DriveM<NEA<V.HierarchyResult<R>>> => {
  return getByPaths(root, paths)
}

export const lsssG = <R extends T.Root>(
  root: R,
  paths: NEA<NormalizedPath>,
): DF.DriveM<NEA<V.HierarchyResult<R>>> => {
  return getByPaths(root, paths)
}
