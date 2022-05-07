import assert from 'assert'
import * as A from 'fp-ts/lib/Array'
import { DriveQuery } from '../../../icloud-drive/drive'
import { recursivels } from './ls/ls-recursive'
import { shallowList } from './ls/ls-shallow'

type ShowOpts = {
  showDocwsid: boolean
  showDrivewsid: boolean
  showEtag: boolean
  showHeader: boolean
}

type Argv = {
  paths: string[]
  fullPath: boolean
  listInfo: boolean
  header: boolean
  trash: boolean
  tree: boolean
  etag: boolean
  glob: boolean
  raw: boolean
  recursive: boolean
  depth: number
  cached: boolean
}

export const listUnixPath = (
  { paths, raw, fullPath, recursive, depth, listInfo, trash, etag, cached, header, glob, tree }: Argv,
): DriveQuery.Effect<string> => {
  assert(A.isNonEmpty(paths))

  if (recursive) {
    return recursivels({ paths, depth, tree, cached })
  }

  return shallowList(paths)({
    raw,
    fullPath,
    listInfo,
    trash,
    etag,
    cached,
    header,
    glob,
  })
}
