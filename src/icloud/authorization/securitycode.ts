import { constant, flow, pipe } from 'fp-ts/lib/function'
import * as AR from '../drive/requests/request'
import { applyCookiesToSession } from '../session/session-http'
import { headers } from '../session/session-http-headers'
import { authorizationHeaders } from './headers'
import { applyAuthorizationResponse } from './session'

export const requestSecurityCodeM = <S extends AR.BasicState>(
  code: string,
): AR.ApiRequest<{}, S> => {
  return pipe(
    AR.buildRequestC<S>(() => ({
      method: 'POST',
      url: 'https://idmsa.apple.com/appleauth/auth/verify/trusteddevice/securitycode',
      options: {
        addClientInfo: false,
        data: { securityCode: { code } },
        headers: [headers.default, authorizationHeaders],
      },
    })),
    AR.handleResponse(flow(
      AR.validateHttpResponse({ validStatuses: [204] }),
      AR.applyToSession(({ httpResponse }) =>
        flow(
          applyAuthorizationResponse(httpResponse),
          applyCookiesToSession(httpResponse),
        )
      ),
    )),
    AR.map(constant({})),
  )
}
