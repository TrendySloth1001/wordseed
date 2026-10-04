// Messages between the page and the offline worker: a request mirrors a call
// to the API, a response mirrors what the server would have answered.
export type OfflineRequest = { method: string; path: string; body?: unknown };
export type OfflineResponse = { status: number; body: unknown };
