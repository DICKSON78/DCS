export class ApiError extends Error {
  constructor(httpStatus, code, message, details) {
    super(message);
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

export const errorCodes = {
  invalidPayload: { httpStatus: 400, code: 'invalid_payload' },
  invalidKey: { httpStatus: 401, code: 'invalid_key' },
  duplicateRequest: { httpStatus: 409, code: 'duplicate_request' },
  unscoreable: { httpStatus: 422, code: 'unscoreable' },
  rateLimited: { httpStatus: 429, code: 'rate_limited' },
  degraded: { httpStatus: 503, code: 'degraded' },
  notFound: { httpStatus: 404, code: 'not_found' },
  forbidden: { httpStatus: 403, code: 'forbidden' },
  conflict: { httpStatus: 409, code: 'conflict' },
};

export const throwIf = (condition, spec, message) => {
  if (condition) {
    const { httpStatus, code } = errorCodes[spec] || errorCodes.invalidPayload;
    throw new ApiError(httpStatus, code, message);
  }
};
