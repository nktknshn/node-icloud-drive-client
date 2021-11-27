import { boolean } from 'fp-ts'
import { flow, pipe } from 'fp-ts/lib/function'
import * as J from 'fp-ts/lib/Json'
import * as TE from 'fp-ts/lib/TaskEither'
import { hideBin } from 'yargs/helpers'
import yargs from 'yargs/yargs'
import { cliAction } from './cli/cli-action'
import { Env } from './cli/types'
import { defaultCacheFile, defaultSessionFile } from './config'
import { consumeStream } from './icloud/drive/requests/download'
import { apiLogger, cacheLogger, logger, loggingLevels, printer, stderrLogger } from './lib/logging'

import { listUnixPath } from './cli/actions/ls'
import { mkdir } from './cli/actions/mkdir'
import { move } from './cli/actions/move'
import { rm } from './cli/actions/rm'
import { checkForUpdates, update } from './cli/actions/update'
import { upload } from './cli/actions/upload'
import { ensureError } from './lib/errors'

function parseArgs() {
  return yargs(hideBin(process.argv))
    // .parserConfiguration({})
    .options({
      sessionFile: { alias: ['s', 'session'], default: defaultSessionFile },
      cacheFile: { alias: ['c', 'cache'], default: defaultCacheFile },
      noCache: { alias: 'n', default: false, type: 'boolean' },
      raw: { alias: 'r', default: false, type: 'boolean' },
      debug: { alias: 'd', default: true, type: 'boolean' },
      update: { alias: 'u', default: false, type: 'boolean' },
    })
    .command('ls [path]', 'list files in a folder', _ =>
      _
        .positional('path', { type: 'string', default: '/' })
        .options({
          fullPath: { alias: ['f'], default: false, type: 'boolean' },
          listInfo: { alias: ['l'], default: false, type: 'boolean' },
          recursive: { alias: ['R'], default: false, type: 'boolean' },
          depth: { alias: ['D'], default: 0, type: 'number', demandOption: 'recursive' },
        }))
    .command('update [path]', 'update cache', _ =>
      _
        .positional('path', { type: 'string', default: '/' })
        .options({
          fullPath: { alias: ['f'], default: false, type: 'boolean' },
          recursive: { alias: ['R'], default: false, type: 'boolean' },
          depth: { alias: ['D'], default: 0, type: 'number', demandOption: 'recursive' },
        }))
    .command('mkdir <path>', 'mkdir', (_) => _.positional('path', { type: 'string', demandOption: true }))
    .command('check', 'check updates', (_) => _.positional('path', { type: 'string', default: '/' }))
    .command('rm [path]', 'check updates', (_) => _.positional('path', { type: 'string', demandOption: true }))
    .command('cat <path>', 'cat', (_) => _.positional('path', { type: 'string', demandOption: true }))
    .command(
      'mv <srcpath> <dstpath>',
      'move',
      (_) =>
        _.positional('srcpath', { type: 'string', demandOption: true })
          .positional('dstpath', { type: 'string', demandOption: true }),
    )
    .command(
      'upload <srcpath> <dstpath>',
      'upload',
      (_) =>
        _.positional('srcpath', { type: 'string', demandOption: true })
          .positional('dstpath', { type: 'string', demandOption: true }),
    )
    .help()
}

async function main() {
  const { argv, showHelp } = parseArgs()

  logger.add(
    argv.debug
      ? loggingLevels.debug
      : loggingLevels.info,
  )

  cacheLogger.add(
    argv.debug
      ? loggingLevels.debug
      : loggingLevels.info,
  )

  stderrLogger.add(
    argv.debug
      ? loggingLevels.debug
      : loggingLevels.info,
  )

  apiLogger.add(
    argv.debug
      ? loggingLevels.debug
      : loggingLevels.info,
  )

  // logger.debug(argv)

  const [command] = argv._

  switch (command) {
    case 'ls':
      await pipe(
        listUnixPath(argv),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    case 'mkdir':
      await pipe(
        mkdir(argv),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    // case 'cat':
    //   await pipe(
    //     cat(argv),
    //     TE.fold(printer.errorTask, printer.printTask),
    //   )()
    //   break
    case 'rm':
      await pipe(
        rm(argv),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    case 'upload':
      await pipe(
        upload(argv),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    case 'update':
      await pipe(
        update(argv),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    case 'mv':
      await pipe(
        move(argv),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    case 'check':
      await pipe(
        checkForUpdates(argv),
        TE.chain(flow(J.stringify, TE.fromEither)),
        TE.mapLeft(ensureError),
        TE.fold(printer.errorTask, printer.printTask),
      )()
      break
    default:
      command && printer.error(`invalid command ${command}`)
      showHelp()
      break
  }
}

// const mkdir = (
//   { sessionFile, cacheFile, path, raw, noCache }: Env & { path: string },
// ): TE.TaskEither<Error, unknown> => {
//   return cliAction(
//     { sessionFile, cacheFile, noCache },
//     ({ drive }) => drive.createFolder(path),
//   )
// }

// const cat = (
//   { sessionFile, cacheFile, path, raw, noCache }: Env & { path: string },
// ): TE.TaskEither<Error, unknown> => {
//   return cliAction(
//     { sessionFile, cacheFile, noCache },
//     ({ drive }) =>
//       pipe(
//         drive.getDownloadStream(path),
//         TE.chain(consumeStream),
//         // TE.map(_ => new TextDecoder().decode(_))
//       ),
//   )
// }

// const rm = (
//   { sessionFile, cacheFile, path, raw, noCache }: Env & { path: string },
// ): TE.TaskEither<Error, unknown> => {
//   return cliAction(
//     { sessionFile, cacheFile, noCache },
//     ({ drive }) => drive.removeItemByPath(path),
//   )
// }

// const move = (
//   { sessionFile, cacheFile, srcpath, dstpath, raw, noCache }: Env & { srcpath: string; dstpath: string },
// ): TE.TaskEither<Error, unknown> => {
//   return cliAction(
//     { sessionFile, cacheFile, noCache },
//     ({ drive }) => move({ sessionFile, cacheFile, srcpath, dstpath, noCache }),
//   )
// }

/* const upload = (
  sourcePath: string,
  targetPath: string,
  { sessionFile = defaultSessionFile, cacheFile = defaultCacheFile } = {},
): TE.TaskEither<Error, unknown> => {
  return cliAction(
    { sessionFile, cacheFile, noCache },
    ({ drive }) => drive.upload(sourcePath, targetPath),
  )
} */

/*
  program
    .command('upload <sourcePath> <targetPath>')
    .description('rm')
    .action(async (sourcePath: string, targetPath: string) => {
      assert(sourcePath)
      assert(targetPath)

      logger.info(await upload(sourcePath, targetPath)())
    })

  await program.parseAsync()
} */
// const byAge: Ord<User> = contramap((user: User) => user.age)(ordNumber)

main()
