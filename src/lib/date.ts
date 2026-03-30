export const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(date);
