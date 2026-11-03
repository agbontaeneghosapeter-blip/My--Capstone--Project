export async function charge({ shouldDecline = false } = {}) {
  return { status: shouldDecline ? 'declined' : 'succeeded' };
}
