import { flow, pipe } from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as SRTE from 'fp-ts/lib/StateReaderTaskEither'
import * as AR from '../../icloud-core/icloud-request/lib/request'
import { applyCookiesToSession } from '../../icloud-core/session/session-http'
import { headers } from '../../icloud-core/session/session-http-headers'
import { sessionLens } from '../../icloud-core/session/session-type'
import { err } from '../../util/errors'
import { logger } from '../../util/logging'
import { applyAuthorizationResponse } from './authorization-session'
import { authorizationHeaders, getTrustToken } from './headers'

export interface TrustResponse204 {
  trustToken: string
}

export const requestTrustDevice = <S extends AR.BaseState>(): AR.ApiRequest<TrustResponse204, S> => {
  logger.debug('requestTrustDeviceM')

  return pipe(
    AR.buildRequest<S>(() => ({
      method: 'GET',
      url: 'https://idmsa.apple.com/appleauth/auth/2sv/trust',
      options: { addClientInfo: false, headers: [headers.default, authorizationHeaders] },
    })),
    AR.handleResponse(flow(
      AR.validateHttpResponse({ validStatuses: [200, 204] }),
      SRTE.bind(
        'trustToken',
        ({ httpResponse }) => AR.fromOption(() => err('Missing trust token'))(getTrustToken(httpResponse)),
      ),
      AR.applyToSession(({ httpResponse, trustToken }) =>
        flow(
          applyAuthorizationResponse(httpResponse),
          applyCookiesToSession(httpResponse),
          sessionLens.trustToken.set(O.some(trustToken)),
        )
      ),
    )),
  )
}
