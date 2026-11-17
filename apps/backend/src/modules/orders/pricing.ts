/** Integer rupiah. Fee is charged in addition to the organizer's face value. */
export function orderPricing(unitPrice: number, quantity: number) {
  if (
    !Number.isSafeInteger(unitPrice) ||
    unitPrice < 0 ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 4
  ) {
    throw new RangeError("Invalid ticket price or quantity.");
  }
  const subtotalAmount = unitPrice * quantity;
  const serviceFeeAmount = Math.round((subtotalAmount * 5) / 100);
  const totalAmount = subtotalAmount + serviceFeeAmount;
  if (!Number.isSafeInteger(totalAmount))
    throw new RangeError("Order amount exceeds the supported range.");
  return { subtotalAmount, serviceFeeAmount, totalAmount };
}

/** One calendar month before the event, clamped at the last day of the previous month. */
export function refundDeadline(startsAt: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = (date: Date) => {
    const values = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
    return [
      Number(values.year),
      Number(values.month),
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    ];
  };
  const [year, month, day, hour, minute, second] = parts(startsAt);
  const previousMonth = new Date(Date.UTC(year, month - 2, 1));
  const maxDay = new Date(
    Date.UTC(previousMonth.getUTCFullYear(), previousMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const target = Date.UTC(
    previousMonth.getUTCFullYear(),
    previousMonth.getUTCMonth(),
    Math.min(day, maxDay),
    hour,
    minute,
    second,
  );
  let result = new Date(target);
  for (let i = 0; i < 3; i++) {
    const [y, m, d, h, min, sec] = parts(result);
    const localAsUtc = Date.UTC(y, m - 1, d, h, min, sec);
    result = new Date(result.getTime() + target - localAsUtc);
  }
  return result;
}
