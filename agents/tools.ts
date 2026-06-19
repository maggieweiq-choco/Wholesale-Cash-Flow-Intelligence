import Anthropic from "@anthropic-ai/sdk";

export const cashflowForecastTool: Anthropic.Tool = {
  name: "submit_cashflow_forecast",
  description: "Submit the 90-day daily cash flow forecast for the company.",
  input_schema: {
    type: "object",
    properties: {
      days: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: { type: "string" },
            cashIn: { type: "number" },
            cashOut: { type: "number" },
            balance: { type: "number" },
            gap: { type: "number" },
          },
          required: ["date", "cashIn", "cashOut", "balance", "gap"],
        },
      },
    },
    required: ["days"],
  },
};

export const deadStockTool: Anthropic.Tool = {
  name: "submit_dead_stock_ranking",
  description: "Submit slow-moving SKUs ranked by days-of-supply with a suggested discount.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sku: { type: "string" },
            daysOfSupply: { type: "number" },
            suggestedDiscountPct: { type: "number" },
          },
          required: ["sku", "daysOfSupply", "suggestedDiscountPct"],
        },
      },
    },
    required: ["items"],
  },
};

export const collectionsPriorityTool: Anthropic.Tool = {
  name: "submit_collections_priority",
  description: "Submit overdue invoices ranked by collection priority.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            invoiceId: { type: "string" },
            customerId: { type: "string" },
            amount: { type: "number" },
            daysOverdue: { type: "number" },
            priorityScore: { type: "number" },
          },
          required: ["invoiceId", "customerId", "amount", "daysOverdue", "priorityScore"],
        },
      },
    },
    required: ["items"],
  },
};

export const financingRecommendationTool: Anthropic.Tool = {
  name: "submit_financing_recommendation",
  description: "Submit a comparison of financing options for closing the cash flow gap.",
  input_schema: {
    type: "object",
    properties: {
      gapAmount: { type: "number" },
      options: {
        type: "array",
        items: {
          type: "object",
          properties: {
            optionType: { type: "string", enum: ["bank_loan", "liquidate", "ar_finance"] },
            amount: { type: "number" },
            durationDays: { type: "number" },
            estimatedCost: { type: "number" },
            recommended: { type: "boolean" },
          },
          required: ["optionType", "amount", "durationDays", "estimatedCost", "recommended"],
        },
      },
    },
    required: ["gapAmount", "options"],
  },
};
