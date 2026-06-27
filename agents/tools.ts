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
  description:
    "Submit slow-moving SKUs ranked by days-of-supply with a suggested discount, a reorder/JIT recommendation to cut holding costs, and a vendor-negotiation tip.",
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
            reorderRecommendation: {
              type: "string",
              description:
                "One short sentence on whether to keep the current reorder cadence, switch to smaller/more frequent (JIT) batches, or pause reordering — to cut holding costs on overstocked SKUs.",
            },
            vendorNegotiationTip: {
              type: "string",
              description:
                "One short sentence on whether this SKU is a candidate to negotiate consignment or extended payment terms with its supplier, given how overstocked it is. Say 'No action needed' for healthy SKUs.",
            },
          },
          required: [
            "sku",
            "daysOfSupply",
            "suggestedDiscountPct",
            "reorderRecommendation",
            "vendorNegotiationTip",
          ],
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

export const payablesPriorityTool: Anthropic.Tool = {
  name: "submit_payables_priority",
  description: "Submit upcoming vendor bills ranked by payment urgency.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            billId: { type: "string" },
            vendorId: { type: "string" },
            amount: { type: "number" },
            daysUntilDue: { type: "number" },
            priorityScore: { type: "number" },
          },
          required: ["billId", "vendorId", "amount", "daysUntilDue", "priorityScore"],
        },
      },
    },
    required: ["items"],
  },
};

export const purchasingRecommendationTool: Anthropic.Tool = {
  name: "submit_purchasing_recommendation",
  description: "Submit which SKUs to reorder, how much, and the estimated cost, based on real sales velocity vs. inventory on hand.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sku: { type: "string" },
            vendorName: { type: "string", description: "Real supplier name from the inventory row, or omit if unknown." },
            daysOfSupply: { type: "number" },
            recommendedQty: { type: "number" },
            estimatedCost: { type: "number" },
            urgency: { type: "string", enum: ["reorder_now", "reorder_soon", "healthy"] },
          },
          required: ["sku", "daysOfSupply", "recommendedQty", "estimatedCost", "urgency"],
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
