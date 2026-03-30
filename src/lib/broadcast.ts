export const broadcastRefresh = async () => {
  const url = process.env.WS_BROADCAST_URL;
  if (!url) return;
  try {
    await fetch(url, { method: "POST" });
  } catch {
    // ignore broadcast errors
  }
};
