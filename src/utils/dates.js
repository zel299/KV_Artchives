
const TIME_ZONE = "Asia/Manila";

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-PH", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleString("en-PH", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

module.exports = {
  formatDate,
  formatDateTime,
};