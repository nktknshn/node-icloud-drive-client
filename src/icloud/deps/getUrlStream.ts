import { apply } from 'fp-ts/function'
import { flow, pipe } from 'fp-ts/lib/function'
import * as RTE from 'fp-ts/lib/ReaderTaskEither'
import { Readable } from 'stream'
import { getUrlStream as getUrlStream_ } from '../drive/drive-api/requests/download'
import { DepFetchClient } from '.'

export const getUrlStream = ({ url }: {
  url: string
}): RTE.ReaderTaskEither<DepFetchClient, Error, Readable> =>
  pipe(
    RTE.ask<DepFetchClient>(),
    RTE.chainTaskEitherK(flow(getUrlStream_, apply({ url }))),
  )
