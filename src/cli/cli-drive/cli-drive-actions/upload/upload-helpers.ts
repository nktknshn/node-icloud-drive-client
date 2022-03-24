import { Eq } from 'fp-ts/Eq'
import * as A from 'fp-ts/lib/Array'
import { flow, pipe } from 'fp-ts/lib/function'
import * as RTE from 'fp-ts/lib/ReaderTaskEither'
import { snd } from 'fp-ts/lib/ReadonlyTuple'
import * as R from 'fp-ts/lib/Record'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import * as TR from 'fp-ts/lib/Tree'
import * as NA from 'fp-ts/NonEmptyArray'
import { Stats } from 'fs'
import micromatch from 'micromatch'
import { Api } from '../../../../icloud/drive'
import { DepApi } from '../../../../icloud/drive/deps/deps'
import * as Drive from '../../../../icloud/drive/drive'
import { parseDrivewsid } from '../../../../icloud/drive/helpers'
import { printerIO } from '../../../../lib/logging'
import { NEA, XXX } from '../../../../lib/types'
import { Path } from '../../../../lib/util'
import { getDirectoryStructure } from '../download/download-helpers'
import { LocalTreeElement } from '../download/walkdir'
import { UploadResult } from '../upload-folder'

export type UploadTask = {
  dirstruct: string[]
  uploadable: (readonly [string, { path: string; stats: Stats }])[]
  empties: (readonly [string, { path: string; stats: Stats }])[]
  excluded: (readonly [string, { path: string; stats: Stats }])[]
}

export const createUploadTask = (
  { exclude, include }: { include: string[]; exclude: string[] },
) =>
  (reltree: TR.Tree<LocalTreeElement>): UploadTask => {
    const flatTree = pipe(
      reltree,
      TR.reduce([] as (readonly [string, LocalTreeElement])[], (acc, cur) => [...acc, [cur.path, cur] as const]),
    )

    const files = pipe(
      flatTree,
      A.filter(flow(snd, _ => _.type === 'file')),
    )

    const { left: excluded, right: valid } = pipe(
      files,
      A.partition(
        ([path, item]) =>
          (include.length == 0 || micromatch.any(path, include, { dot: true }))
          && (exclude.length == 0 || !micromatch.any(path, exclude, { dot: true })),
      ),
    )

    const { left: uploadable, right: empties } = pipe(
      valid,
      A.partition(([, file]) => file.stats.size == 0),
    )

    const dirstruct = pipe(
      A.concat(uploadable)(empties),
      A.map(a => a[0]),
      getDirectoryStructure,
    )

    return {
      dirstruct,
      uploadable,
      empties,
      excluded,
    }
  }

export const uploadChunk = (
  pathToDrivewsid: Record<string, string>,
) =>
  (
    chunk: NEA<
      readonly [
        remotepath: string,
        element: { path: string; stats: Stats },
      ]
    >,
  ): XXX<Drive.State, Api.UploadMethodDeps, NEA<UploadResult>> =>
    state =>
      pipe(
        chunk,
        NA.map(([remotepath, element]) => {
          const d = parseDrivewsid(pathToDrivewsid[Path.dirname(remotepath)])
          return pipe(
            Api.upload<Drive.State>({
              sourceFilePath: element.path,
              docwsid: d.docwsid,
              zone: d.zone,
            })(state),
            RTE.chainFirstIOK(() => printerIO.print(`${remotepath}`)),
          )
        }),
        NA.sequence(RTE.ApplicativePar),
        RTE.map(
          results => [NA.unzip(results)[0], NA.last(results)[1]],
        ),
      )

export const createRemoteDirStructure = (
  dstitemDrivewsid: string,
  dirstruct: string[],
): XXX<Drive.State, DepApi<'createFolders'>, Record<string, string>> => {
  const task = pipe(
    getSubdirsPerParent('/')(dirstruct),
    group<readonly [string, string]>({
      equals: (a, b) => a[0] == b[0],
    }),
    A.map(chunk => [chunk[0][0], A.map(snd)(chunk)] as const),
  )

  const pathToDrivewsid: Record<string, string> = {
    '/': dstitemDrivewsid,
  }

  return pipe(
    task,
    A.reduce(
      SRTE.of(pathToDrivewsid),
      (acc, [parent, subdirs]) =>
        pipe(
          acc,
          SRTE.chainFirstIOK(() => printerIO.print(`creating ${subdirs} in ${parent}`)),
          SRTE.chain((dirToIdMap) =>
            Api.createFoldersFailing<Drive.State>({
              destinationDrivewsId: dirToIdMap[parent],
              names: subdirs,
            })
          ),
          SRTE.map(flow(
            A.zip(subdirs),
            A.reduce(pathToDrivewsid, (a, [item, name]) =>
              R.upsertAt(
                Path.join(parent, name),
                item.drivewsid as string,
              )(a)),
          )),
        ),
    ),
  )
}

export const getSubdirsPerParent = (parent: string) =>
  (struct: string[]): (readonly [string, string])[] => {
    const kids = pipe(
      struct,
      A.map(Path.parse),
      A.filter(_ => _.dir == parent),
      A.map(_ => [parent, _.base] as const),
    )

    const subkids = pipe(
      kids,
      A.map(([p, k]) => getSubdirsPerParent(Path.join(p, k))(struct)),
      A.flatten,
    )

    return [...kids, ...subkids]
  }

const group = <A>(S: Eq<A>): ((as: Array<A>) => Array<Array<A>>) => {
  return A.chop(as => {
    const { init, rest } = pipe(as, A.spanLeft((a: A) => S.equals(a, as[0])))
    return [init, rest]
  })
}
