import assert from 'assert'
import { flow, pipe } from 'fp-ts/lib/function'
import * as J from 'fp-ts/lib/Json'
import * as TE from 'fp-ts/lib/TaskEither'
import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { hierarchyToPath } from './cli/actions/helpers'
import { apiAction } from './cli/cli-actionF'
import { defaultSessionFile } from './config'
import { retrieveHierarchy } from './icloud/drive/requests'
import { ensureError, err } from './lib/errors'
import { fetchClient } from './lib/fetch-client'
import { cacheLogger, logger, loggingLevels, printer } from './lib/logging'
import { Path } from './lib/util'

const actionsNames = ['retrieveHierarchy', 'retrieveItemDetails', 'retrieveItemDetailsInFolders', 'rename'] as const

type Action = (typeof actionsNames)[number]

const validateAction = (action: string): action is Action => (actionsNames as readonly string[]).includes(action)

function parseArgs() {
  return yargs(hideBin(process.argv))
    // .parserConfiguration({})
    .options({
      sessionFile: { alias: ['s', 'session'], default: defaultSessionFile },
      // cacheFile: { alias: ['c', 'cache'], default: defaultCacheFile },
      // noCache: { alias: 'n', default: false, type: 'boolean' },
      raw: { alias: 'r', default: false, type: 'boolean' },
      debug: { alias: 'd', default: false, type: 'boolean' },
    })
    .command('retrieveHierarchy [drivewsids..]', 'get h for drivewsids', _ =>
      _
        .positional('drivewsids', { type: 'string', array: true, demandOption: true })
        .options({}))
    .command('retrieveItemDetails [drivewsids..]', 'get h for drivewsids', _ =>
      _
        .positional('drivewsids', { type: 'string', array: true, demandOption: true })
        .options({}))
    .command('retrieveItemDetailsInFolders [drivewsids..]', 'get h for drivewsids', _ =>
      _
        .positional('drivewsids', { type: 'string', array: true, demandOption: true })
        .options({
          h: { type: 'boolean', default: false },
        }))
    .command('rename [drivewsid] [name] [etag]', 'get h for drivewsids', _ =>
      _
        .positional('drivewsid', { type: 'string', demandOption: true })
        .positional('name', { type: 'string', demandOption: true })
        .positional('etag', { type: 'string', default: '12::34' /* demandOption: true */ })
        .options({}))
    .help()
}

const parseName = (fileName: string): { name: string; extension?: string } => {
  const extension = pipe(
    Path.extname(fileName),
    _ => _ === '' ? undefined : _,
  )

  return {
    name: extension ? fileName.slice(0, fileName.length - extension.length) : fileName,
    extension: extension ? extension.slice(1) : undefined,
  }
}

const actions = {
  retrieveHierarchy: (argv: {
    sessionFile: string
    raw: boolean
    debug: boolean
    drivewsids: string[]
  }) =>
    apiAction(
      { sessionFile: argv.sessionFile },
      ({ api, session, accountData }) =>
        pipe(
          TE.Do,
          TE.bind(
            'hierarchy',
            () => api.retrieveHierarchy(argv.drivewsids),
            // retrieveHierarchy(
            //   fetchClient,
            //   { session, accountData },
            //   { drivewsids: argv.drivewsids },
            // ),
          ),
          TE.bind('path', ({ hierarchy }) => TE.of(hierarchyToPath(hierarchy[0].hierarchy))),
        ),
    ),
  retrieveItemDetails: (argv: {
    sessionFile: string
    raw: boolean
    debug: boolean
    drivewsids: string[]
  }) =>
    apiAction(
      { sessionFile: argv.sessionFile },
      ({ api }) =>
        pipe(
          TE.Do,
          TE.bind('details', () => api.retrieveItemsDetails(argv.drivewsids)),
          // TE.bind('path', ({ hierarchy }) => TE.of(hierarchyToPath(hierarchy[0].hierarchy))),
        ),
    ),
  retrieveItemDetailsInFolders: (argv: {
    sessionFile: string
    raw: boolean
    debug: boolean
    drivewsids: string[]
    h: boolean
  }) =>
    apiAction(
      { sessionFile: argv.sessionFile },
      ({ api }) =>
        pipe(
          TE.Do,
          TE.bind(
            'details',
            () =>
              (argv.h
                ? api.retrieveItemDetailsInFoldersHierarchies
                : api.retrieveItemDetailsInFolders)(argv.drivewsids),
          ),
          // TE.bind('path', ({ hierarchy }) => TE.of(hierarchyToPath(hierarchy[0].hierarchy))),
        ),
    ),
  rename: (argv: {
    sessionFile: string
    raw: boolean
    debug: boolean
    drivewsid: string
    name: string
    etag: string
  }) =>
    apiAction(
      { sessionFile: argv.sessionFile },
      ({ api }) =>
        pipe(
          TE.Do,
          TE.bind(
            'result',
            () =>
              api.renameItems([
                { drivewsid: argv.drivewsid, ...parseName(argv.name), etag: argv.etag },
              ]),
          ),
          // TE.bind('path', ({ hierarchy }) => TE.of(hierarchyToPath(hierarchy[0].hierarchy))),
        ),
    ),
} as const

async function main() {
  const { argv, showHelp } = parseArgs()

  logger.add(
    argv.debug
      ? loggingLevels.debug
      : loggingLevels.info,
  )

  logger.debug(argv)

  cacheLogger.add(
    loggingLevels.info,
  )

  const [command] = argv._

  assert(typeof command === 'string' && validateAction(command))

  const te: TE.TaskEither<Error, unknown> = actions[command](argv)

  await pipe(
    te,
    TE.chain(flow(J.stringify, TE.fromEither)),
    TE.mapLeft(ensureError),
    TE.fold(printer.errorTask, printer.printTask),
  )()
  // logger.debug(argv)

  // const [command] = argv._
}

main()
