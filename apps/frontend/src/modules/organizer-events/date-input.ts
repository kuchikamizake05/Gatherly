export function toLocalInput(value: string, timezone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(" ", "T");
}
export function fromLocalInput(value: string, timezone: string) {
  if (!value) return "";
  const offset =
    timezone === "Asia/Makassar"
      ? "+08:00"
      : timezone === "Asia/Jayapura"
        ? "+09:00"
        : "+07:00";
  const date = new Date(`${value.slice(0, 16)}:00${offset}`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
