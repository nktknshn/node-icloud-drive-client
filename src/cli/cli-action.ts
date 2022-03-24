import { constVoid, pipe } from 'fp-ts/lib/function'
import * as RTE from 'fp-ts/lib/ReaderTaskEither'
import * as TE from 'fp-ts/lib/TaskEither'
import { AccountData } from '../icloud/authorization/types'
import { readAccountData, saveAccountData as _saveAccountData } from '../icloud/authorization/validate'
import { Api, Drive } from '../icloud/drive'
import * as C from '../icloud/drive/cache/cache'
import { DepApi, DepFs } from '../icloud/drive/deps/deps'
import { AuthorizationState, BasicState } from '../icloud/drive/requests/request'
import { ICloudSession } from '../icloud/session/session'
import { readSessionFile, saveSession as _saveSession } from '../icloud/session/session-file'
import { err } from '../lib/errors'
import { ReadJsonFileError } from '../lib/files'
import { loggerIO } from '../lib/loggerIO'
import { cacheLogger } from '../lib/logging'

export type DriveActionDeps =
  & { sessionFile: string }
  & { cacheFile: string; noCache: boolean }
  & DepApi<'authorizeSession'>
  & DepFs<'writeFile'>
  & DepFs<'readFile'>

/** read the state from files and executes the action in the context */
export function driveAction<A, R>(
  action: () => Drive.Effect<A, R>,
): RTE.ReaderTaskEither<
  & R
  & DriveActionDeps,
  Error,
  A
> {
  return pipe(
    loadDriveState,
    RTE.bindW('result', action()),
    RTE.chainFirst(({ result: [, { cache }] }) =>
      RTE.fromIO(
        () => cacheLogger.debug(`saving cache: ${Object.keys(cache.byDrivewsid).length} items`),
      )
    ),
    RTE.chainFirstW(({ result: [, state] }) =>
      pipe(
        RTE.of(state),
        RTE.chainFirstW(saveSession),
        RTE.chainFirstW(saveAccountData),
        RTE.chainFirstW(saveCache),
      )
    ),
    RTE.map(_ => _.result[0]),
  )
}

const loadSessionFile = RTE.asksReaderTaskEitherW(
  readSessionFile,
)

const loadSession = pipe(
  loadSessionFile,
  RTE.orElse(
    (e) =>
      ({ sessionFile }) =>
        TE.left(
          err(
            `Couldn't read session file from '${sessionFile}' (${e}). Init new session file by using command\nidrive init -s ${sessionFile}`,
          ),
        ),
  ),
  RTE.map(session => ({ session })),
)

const loadAccountData = (
  { session }: { session: ICloudSession },
): RTE.ReaderTaskEither<
  DepApi<'authorizeSession'> & { sessionFile: string } & DepFs<'readFile'>,
  Error,
  AuthorizationState
> =>
  pipe(
    _loadAccountDataFromFile,
    RTE.map(accountData => ({ session, accountData })),
    RTE.orElseW(e =>
      pipe(
        loggerIO.error(`couldn't read account data from file. (${e}). Fetching from the icloud server`),
        RTE.fromIO,
        RTE.chain(() => Api.authorizeState({ session })),
      )
    ),
  )

const loadDriveState = pipe(
  loadSession,
  RTE.chain(loadAccountData),
  RTE.bindW('cache', () => loadCache),
)

const _loadAccountDataFromFile = RTE.asksReaderTaskEitherW(
  (deps: { sessionFile: string }) => readAccountData(`${deps.sessionFile}-accountData`),
)

const loadCache: RTE.ReaderTaskEither<
  {
    noCache: boolean
    cacheFile: string
  } & DepFs<'readFile'>,
  Error | ReadJsonFileError,
  C.Cache
> = RTE.asksReaderTaskEitherW((deps: { noCache: boolean; cacheFile: string }) =>
  pipe(
    deps.noCache
      ? RTE.of(C.cachef())
      : C.tryReadFromFile(deps.cacheFile),
    RTE.orElse(
      (e) => RTE.of(C.cachef()),
    ),
  )
)

export const saveSession = <S extends BasicState>(state: S) =>
  RTE.asksReaderTaskEitherW(
    _saveSession(state.session),
  )

export const saveAccountData = <S extends { accountData: AccountData }>(
  state: S,
) =>
  RTE.asksReaderTaskEitherW((deps: { sessionFile: string }) =>
    _saveAccountData(state.accountData, `${deps.sessionFile}-accountData`)
  )

const saveCache = <S extends { cache: C.Cache }>(state: S) =>
  RTE.asksReaderTaskEitherW((deps: { cacheFile: string; noCache: boolean }) =>
    deps.noCache
      ? RTE.of(constVoid())
      : C.trySaveFile(state.cache)(deps.cacheFile)
  )
