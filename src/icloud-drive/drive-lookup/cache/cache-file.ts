import * as E from 'fp-ts/lib/Either'
import { flow, pipe } from 'fp-ts/lib/function'
import * as RTE from 'fp-ts/lib/ReaderTaskEither'
import * as R from 'fp-ts/lib/Record'
import * as TE from 'fp-ts/TaskEither'
import { DepFs } from '../../../deps-types/dep-fs'
import { cacheLogger } from '../../../logging/logging'
import { TypeDecodingError } from '../../../util/errors'
import { ReadJsonFileError, tryReadJsonFile } from '../../../util/files'
import { saveJson } from '../../../util/json'
import { LookupCache } from './cache'
import * as cachIo from './cache-io-types'
import * as CT from './cache-types'

export const trySaveFile = (
  cache: LookupCache,
) =>
  (cacheFilePath: string): RTE.ReaderTaskEither<DepFs<'writeFile'>, Error, void> => {
    return pipe(
      TE.fromIO(() => cacheLogger.debug(`saving cache: ${R.keys(cache.byDrivewsid).length} items`)),
      TE.map(() => cache),
      saveJson(cacheFilePath),
    )
  }

export const tryReadFromFile = (
  accountDataFilePath: string,
): RTE.ReaderTaskEither<DepFs<'readFile'>, Error | ReadJsonFileError, CT.CacheF> => {
  return pipe(
    tryReadJsonFile(accountDataFilePath),
    RTE.chainEitherKW(flow(
      cachIo.cache.decode,
      E.mapLeft(es => TypeDecodingError.create(es, 'wrong ICloudDriveCache json')),
    )),
  )
}
