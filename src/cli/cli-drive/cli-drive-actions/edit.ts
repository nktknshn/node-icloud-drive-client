import child_process from 'child_process'
import { randomUUID } from 'crypto'
import { pipe } from 'fp-ts/lib/function'
import * as NA from 'fp-ts/lib/NonEmptyArray'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import * as TE from 'fp-ts/lib/TaskEither'
import * as O from 'fp-ts/Option'
import fs from 'fs/promises'
import { tempDir } from '../../../defaults'
import * as API from '../../../icloud/drive/api'
import * as NM from '../../../icloud/drive/api/methods'
import { Use } from '../../../icloud/drive/api/type'
import * as DF from '../../../icloud/drive/drive'
import { consumeStreamToString, getUrlStream } from '../../../icloud/drive/requests/download'
import { isFile } from '../../../icloud/drive/requests/types/types'
import { err } from '../../../lib/errors'
import { logger } from '../../../lib/logging'
import { Path } from '../../../lib/util'
import { upload } from '.'
import { normalizePath } from './helpers'

type Deps = DF.DriveMEnv & Use<'downloadM'> & Use<'getUrlStream'>

export const edit = ({ path }: { path: string }) => {
  const npath = pipe(path, normalizePath)

  const tempFile = Path.join(
    tempDir,
    Path.basename(npath) + '.' + randomUUID().substring(0, 8),
  )

  logger.debug(`temp file: ${tempFile}`)

  return pipe(
    SRTE.ask<DF.DriveMState, Deps>(),
    SRTE.bindTo('api'),
    SRTE.bindW('item', () =>
      pipe(
        DF.chainRoot(root => DF.getByPaths(root, [npath])),
        DF.map(NA.head),
        DF.filterOrElse(isFile, () => err(`you cannot cat a directory`)),
      )),
    SRTE.bindW('url', ({ item }) => NM.download<DF.DriveMState>(item)),
    SRTE.chain(({ api, url }) =>
      pipe(
        url,
        O.fromNullable,
        O.matchW(
          () => SRTE.left(err(`cannot get url`)),
          url =>
            pipe(
              api.getUrlStream({ url }),
              TE.chain(consumeStreamToString),
              DF.fromTaskEither,
            ),
        ),
      )
    ),
    SRTE.chainW((data) => {
      return pipe(
        SRTE.fromTask(
          () => fs.writeFile(tempFile, data),
        ),
        // DF.logS(() => ``),
        // SRTE.chainFirst(
        //   (): DF.DriveM<void> =>
        //     SRTE.fromIO(() => {
        //       logger.debug(`as`)
        //     }),
        // ),
      )
    }),
    SRTE.chainW((): DF.DriveM<NodeJS.Signals | null> => {
      return SRTE.fromTask(
        (): Promise<NodeJS.Signals | null> => {
          return new Promise(
            (resolve, reject) => {
              child_process
                .spawn(`vim`, [tempFile], {
                  // shell: true,
                  stdio: 'inherit',
                })
                .on('close', (code, signal) => {
                  if (code === 0) {
                    return resolve(signal)
                  }
                  return reject(code)
                })
            },
          )
        },
      )
    }),
    SRTE.chainW((signal) => {
      return upload({
        overwright: true,
        srcpath: tempFile,
        dstpath: npath,
      })
    }),
    _ => _,
  )
}
