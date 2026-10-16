import type {
  QuotationTerm,
} from "../types/quotation";

export const DEFAULT_QUOTATION_TERMS:
  ReadonlyArray<QuotationTerm> = [
    {
      id: "term-1",
      selected: true,
      text:
        "Quotation shall remain valid for 15 days from the date of quotation unless otherwise stated. Prices and commercial terms may be revised after expiry of the validity period.",
    },
    {
      id: "term-2",
      selected: true,
      text:
        "Delivery time 2 to 3 weeks against advance payment.",
    },
    {
      id: "term-3",
      selected: true,
      text:
        "50% advance along with Purchase Order.",
    },
    {
      id: "term-4",
      selected: true,
      text:
        "40% before dispatch Material.",
    },
    {
      id: "term-5",
      selected: true,
      text:
        "10% balance against delivery / commissioning, as applicable.",
    },
    {
      id: "term-6",
      selected: true,
      text:
        "GST 18% and other statutory taxes/duties shall be charged extra as applicable unless specifically stated otherwise. Any increase in the cost of major components, statutory duties, freight, or other unavoidable costs after quotation validity may be subject to revision with mutual agreement.",
    },
    {
      id: "term-7",
      selected: true,
      text:
        "The manufacturer warrants the supplied panels against manufacturing defects and defective workmanship for 12 months from the date of commissioning or 18 months from the date of dispatch, whichever occurs earlier, unless a different warranty period is specifically stated in the quotation.",
    },
    {
      id: "term-8",
      selected: true,
      text:
        "Any change in specifications, design, component make, rating, quantity, enclosure dimensions, protection scheme, or accessories after order confirmation shall be treated as a variation.",
    },
    {
      id: "term-9",
      selected: true,
      text:
        "The delivery period shall be as mentioned in the quotation and shall be calculated from the later of:\nReceipt of confirmed Purchase Order.\nReceipt of agreed advance payment.\nReceipt of complete technical information.",
    },
    {
      id: "term-10",
      selected: true,
      text:
        "The quoted price is based on the scope, quantities, specifications, and assumptions stated in our offer. Any changes in scope, specifications, quantities, statutory requirements, or site conditions may result in additional cost and/or extension of time.",
    },
    {
      id: "term-11",
      selected: true,
      text:
        "The Client shall provide, as applicable:\nClear and safe access to the site.\nRequired work fronts and site facilities.\nElectricity required for execution, unless specifically included in our scope.\nTimely approvals and decisions.\nNecessary statutory permissions and site-related clearances.",
    },
    {
      id: "term-12",
      selected: true,
      text:
        "Testing and commissioning shall be performed in accordance with the agreed specifications and applicable standards. The Client shall provide necessary utilities, operating personnel, raw materials, and other requirements where applicable.",
    },
    {
      id: "term-13",
      selected: true,
      text:
        "AMC\n" +
        "a. Scope of AMC: Covers software maintenance, dashboard availability, cloud database, alarm configuration, user management, software updates and remote support.\n" +
        "b. Hardware exclusions: Physical sensors, CTs, temperature probes, RS-485 converters, BLE Mesh nodes, gateways, Power supplies and field wiring are excluded from software AMC unless separately mentioned.\n" +
        "c. Cloud subscription: Subscription includes the agreed number of devices, storage capacity, users, data retention period, backup frequency and communication quota. Excess usage is chargeable.\n" +
        "d. Payment and renewal: Annual payment in advance or quarterly payment as agreed. Renewal pricing shall be confirmed before the next AMC period. Applicable GST shall be extra.\n" +
        "e. Downtime and service limits: The service provider shall use reasonable efforts to maintain the platform. Downtime caused by internet, mobile networks, power failure, third-party cloud providers, or force majeure is excluded from the restoration.\n" +
        "f. Customer Responsibility’s: Customer shall provide reliable auxiliary power, network/mobile connectivity where applicable, safe access to equipment, accurate site/device information, authorized user details and timely cooperation for troubleshooting.\n" +
        "g. Backup & Restoration: Routine backups shall be performed according to the standard shared-cloud policy. Restoration is subject to backup availability, cloud-provider limitations and the nature of the incident.",
    },
    {
      id: "term-14",
      selected: true,
      text:
        "Both parties shall maintain confidentiality regarding technical, commercial, financial, and other confidential information received in connection with the project, except where disclosure is required by law.",
    },
  ];

export const createDefaultTerms =
  (): QuotationTerm[] =>
    DEFAULT_QUOTATION_TERMS.map(
      (term) => ({
        ...term,
      }),
    );