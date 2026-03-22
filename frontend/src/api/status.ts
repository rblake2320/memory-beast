import { api } from './client'
import type { StatusResponse } from './types'

export const getStatus = (): Promise<StatusResponse> =>
  api.get<StatusResponse>('/api/status')
