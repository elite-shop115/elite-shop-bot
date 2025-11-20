const TICKET_CATEGORIES = [
  {
    value: "purchase",
    label: "Purchase",
    description: "Open a ticket if you want to make a purchase",
    emoji: "💸"
  },
  {
    value: "support",
    label: "Request Support",
    description: "If you need any help open a ticket",
    emoji: "📞"
  },
  {
    value: "other",
    label: "Other",
    description: "Other inquiries",
    emoji: "❓"
  }
];

function isValidCategory(value) {
  return TICKET_CATEGORIES.some(cat => cat.value === value);
}

function getCategoryLabel(value) {
  const category = TICKET_CATEGORIES.find(cat => cat.value === value);
  return category ? category.label : null;
}

module.exports = {
  TICKET_CATEGORIES,
  isValidCategory,
  getCategoryLabel
};
