export const asyncHandler = (fn) => async (request, reply) => {
  try {
    return await fn(request, reply);
  } catch (err) {
    throw err;
  }
};
