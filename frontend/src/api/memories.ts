import { api } from './client'
import type { Memory } from './types'

export const getMemory = (id: number): Promise<Memory> =>
  api.get<Memory>(`/api/memories/${id}`)

export const deleteMemory = (id: number): Promise<void> =>
  api.delete<void>(`/api/memories/${id}`)

export const markHelpful = (id: number): Promise<void> =>
  api.post<void>(`/api/memories/${id}/helpful`)
