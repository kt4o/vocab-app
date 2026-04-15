const DEFAULT_FOUNDING_MEMBER_DEADLINE = "2026-05-15T23:59:59.999+10:00";

function getFoundingMemberDeadline() {
  const configuredDeadline = String(process.env.FOUNDING_MEMBER_DEADLINE || "").trim();
  const deadlineValue = configuredDeadline || DEFAULT_FOUNDING_MEMBER_DEADLINE;
  const deadline = new Date(deadlineValue);
  if (Number.isNaN(deadline.getTime())) {
    return new Date(DEFAULT_FOUNDING_MEMBER_DEADLINE);
  }
  return deadline;
}

export function isFoundingMemberOfferActive(dateLike = new Date()) {
  const currentDate = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(currentDate.getTime())) return false;
  return currentDate.getTime() <= getFoundingMemberDeadline().getTime();
}

