import * as A from 'fp-ts/Array'
import { flow, pipe } from 'fp-ts/lib/function'
import * as NA from 'fp-ts/lib/NonEmptyArray'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import { Eq } from 'fp-ts/lib/string'
import * as O from 'fp-ts/Option'
import { loggerIO } from '../../../logging/loggerIO'
import { err } from '../../../util/errors'
import { NEA } from '../../../util/types'
import { sequenceArrayO } from '../../../util/util'
import { Cache, DriveLookup, Types } from '../..'
import { DriveApiMethods } from '../../drive-api'
import { rootDrivewsid, trashDrivewsid } from '../../drive-types/types-io'
import { Lookup, State } from '..'
import { chainCache, getCache, getsCache, putMissedFound, usingCache } from './cache-methods'

/** Returns details from cache if they are there otherwise fetches them from icloid api.   */
export const retrieveItemDetailsInFoldersCached = (
  drivewsids: NEA<string>,
): Lookup<NEA<O.Option<Types.Details>>> => {
  const uniqids = pipe(drivewsids, NA.uniq(Eq))

  return pipe(
    getCache(),
    SRTE.chain(
      c =>
        SRTE.fromIO(
          loggerIO.debug(`retrieveItemDetailsInFoldersCached: ${Cache.getAllDetails(c).map(_ => _.drivewsid)}`),
        ),
    ),
    SRTE.chain(() =>
      chainCache(
        SRTE.fromEitherK(Cache.getFoldersDetailsByIdsSeparated(uniqids)),
      )
    ),
    SRTE.chainW(({ missed }) =>
      pipe(
        missed,
        A.matchW(
          () => DriveLookup.of({ missed: [], found: [] }),
          (missed) => DriveApiMethods.retrieveItemDetailsInFoldersSeparated<State>(missed),
        ),
      )
    ),
    SRTE.chain(putMissedFound),
    SRTE.chainW(() => getsCache(Cache.getFoldersDetailsByIds(drivewsids))),
    SRTE.chainW(e => SRTE.fromEither(e)),
    SRTE.map(NA.map(Types.invalidIdToOption)),
  )
}

export function retrieveItemDetailsInFoldersCachedStrict(
  drivewsids: NEA<string>,
): Lookup<NEA<Types.NonRootDetails>>
export function retrieveItemDetailsInFoldersCachedStrict(
  drivewsids: NEA<string>,
): Lookup<NEA<Types.Details>> {
  return pipe(
    retrieveItemDetailsInFoldersCached(drivewsids),
    SRTE.chain(res =>
      SRTE.fromOption(() => err(`some of the ids was not found`))(
        sequenceArrayO(res),
      )
    ),
  )
}

// WTF those comments below
// when no special context enabled it behaves just like retrieveItemDetailsInFoldersSaving
// but when inside the context it works like retrieveItemDetailsInFoldersCached
// but using the context cache

/** Retrieves actual drivewsids saving valid ones to cache and removing those that were not found */
export function retrieveItemDetailsInFoldersSaving<R extends Types.Root>(
  drivewsids: [R['drivewsid'], ...Types.NonRootDrivewsid[]],
): Lookup<[O.Some<R>, ...O.Option<Types.NonRootDetails>[]]>
export function retrieveItemDetailsInFoldersSaving(
  drivewsids: [typeof rootDrivewsid, ...string[]],
): Lookup<[O.Some<Types.DetailsDocwsRoot>, ...O.Option<Types.Details>[]]>
export function retrieveItemDetailsInFoldersSaving(
  drivewsids: [typeof trashDrivewsid, ...string[]],
): Lookup<[O.Some<Types.DetailsTrashRoot>, ...O.Option<Types.Details>[]]>
export function retrieveItemDetailsInFoldersSaving<R extends Types.Root>(
  drivewsids: [R['drivewsid'], ...string[]],
): Lookup<[O.Some<R>, ...O.Option<Types.Details>[]]>
export function retrieveItemDetailsInFoldersSaving(
  drivewsids: NEA<string>,
): Lookup<NEA<O.Option<Types.Details>>>
export function retrieveItemDetailsInFoldersSaving(
  drivewsids: NEA<string>,
): Lookup<NEA<O.Option<Types.Details>>> {
  return pipe(
    loggerIO.debug(`retrieveItemDetailsInFoldersSaving`),
    SRTE.fromIO,
    SRTE.chain(() =>
      pipe(
        retrieveItemDetailsInFoldersCached(drivewsids),
        // WHY?
        // usingCache(Cache.cachef()),
      )
    ),
  )
}

/** Fails if some of the ids were not found */
export function retrieveItemDetailsInFoldersSavingStrict(
  drivewsids: NEA<string>,
): Lookup<NEA<Types.NonRootDetails>>
export function retrieveItemDetailsInFoldersSavingStrict(
  drivewsids: NEA<string>,
): Lookup<NEA<Types.Details>> {
  return pipe(
    retrieveItemDetailsInFoldersSaving(drivewsids),
    SRTE.chain(
      flow(
        O.sequenceArray,
        SRTE.fromOption(() => err(`retrieveItemDetailsInFoldersSavingStrict: some of the ids was not found`)),
        v => v as Lookup<NEA<Types.Details>>,
      ),
    ),
  )
}
