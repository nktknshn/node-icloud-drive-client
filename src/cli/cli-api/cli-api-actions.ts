import { hole, pipe } from 'fp-ts/lib/function'
import { Api } from '../../icloud/drive'
import { parseFilename } from '../../icloud/drive/helpers'
import * as RQ from '../../icloud/drive/requests'
import { NEA } from '../../util/types'
import { apiActionM } from '../api-action'

export const retrieveTrashDetails = (argv: {
  sessionFile: string
}) => {
  return apiActionM(
    () => pipe(RQ.retrieveTrashDetails()),
  )
}

export const putBackItemsFromTrash = (argv: {
  drivewsid: string
  etag: string
}) => {
  return apiActionM(
    () =>
      RQ.putBackItemsFromTrash([{
        drivewsid: argv.drivewsid,
        etag: argv.etag,
      }]),
  )
}

export const rename = (argv: {
  drivewsid: string
  name: string
  etag: string
}) =>
  apiActionM(
    () =>
      pipe(
        RQ.renameItems({
          items: [
            {
              drivewsid: argv.drivewsid,
              etag: argv.etag,
              ...parseFilename(argv.name),
            },
          ],
        }),
      ),
  )

export const retrieveItemDetailsInFolders = (argv: {
  drivewsids: string[]
}) =>
  apiActionM(
    () =>
      pipe(
        // hole(),
        Api.retrieveItemDetailsInFolders({ drivewsids: argv.drivewsids as NEA<string> }),
      ),
  )

// export const retrieveItemDetails = (argv: {
//   drivewsids: string[]
// }) =>
//   apiActionM(
//     () =>
//       pipe(
//         // hole(),
//         Api.retrieveItemsDetails(argv.drivewsids),
//       ),
//   )

// export const retrieveHierarchy = (argv: {
//   drivewsids: string[]
// }) =>
//   apiActionM(
//     () =>
//       pipe(
//         hole(),
//         // TE.Do,
//         // TE.bind('hierarchy', () => api.retrieveHierarchy(argv.drivewsids)),
//         // TE.bind('path', ({ hierarchy }) => TE.of(hierarchyToPath(hierarchy[0].hierarchy))),
//       ),
//   )
