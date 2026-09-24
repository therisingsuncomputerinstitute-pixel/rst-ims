export interface MandatoryRegistryEntry {
  key: string;
  name: string;
  category: string;
  regex?: string;
  keywords?: string[];
  standardText?: string;
}

export interface DefaultWorkspaceSeed {
  name: string;
  type: string;
  isGlobal: boolean;
  mandatoryRegistry: MandatoryRegistryEntry[];
}

export const DEFAULT_WORKSPACES: DefaultWorkspaceSeed[] = [
  {
    name: "Reinsurance",
    type: "reinsurance",
    isGlobal: true,
    mandatoryRegistry: [
      {
        key: "follow-settlements",
        name: "Follow Settlements",
        category: "Claims",
        regex: "follow\\s+(the\\s+)?settlements?",
        keywords: ["follow settlements", "follow the settlements"],
      },
      {
        key: "claims-cooperation",
        name: "Claims Cooperation",
        category: "Claims",
        regex: "claims?\\s+co-?operation",
        keywords: ["claims cooperation", "claims cooperation clause"],
      },
      {
        key: "sanctions",
        name: "Sanctions",
        category: "Compliance",
        regex: "sanctions?",
        keywords: ["sanctions", "sanction limitation"],
      },
      {
        key: "termination",
        name: "Termination",
        category: "General Provision",
        regex: "terminat(ion|e)",
        keywords: ["termination", "right to terminate"],
      },
      {
        key: "governing-law",
        name: "Governing Law",
        category: "General Provision",
        regex: "governing\\s+law",
        keywords: ["governing law", "applicable law", "jurisdiction"],
      },
      {
        key: "arbitration",
        name: "Arbitration",
        category: "Dispute Resolution",
        regex: "arbitration",
        keywords: ["arbitration", "dispute resolution"],
      },
      {
        key: "war-exclusion",
        name: "War Exclusion",
        category: "Exclusions",
        regex: "war\\s+exclusion",
        keywords: ["war exclusion", "war and terrorism exclusion", "nma 464"],
      },
    ],
  },
  {
    name: "Property",
    type: "property",
    isGlobal: false,
    mandatoryRegistry: [
      {
        key: "insured-property",
        name: "Insured Property",
        category: "Parties & Definitions",
        regex: "insured\\s+property",
        keywords: ["insured property", "property insured"],
      },
      {
        key: "business-interruption",
        name: "Business Interruption",
        category: "Claims",
        regex: "business\\s+interruption",
        keywords: ["business interruption", "loss of gross profit"],
      },
      {
        key: "deductible",
        name: "Deductible",
        category: "Premium & Payments",
        regex: "deductible",
        keywords: ["deductible", "retention"],
      },
      {
        key: "force-majeure",
        name: "Force Majeure",
        category: "General Provision",
        regex: "force\\s+majeure",
        keywords: ["force majeure", "act of god"],
      },
      {
        key: "subrogation",
        name: "Subrogation",
        category: "Claims",
        regex: "subrogation",
        keywords: ["subrogation", "waiver of subrogation"],
      },
      {
        key: "notice-of-loss",
        name: "Notice of Loss",
        category: "Claims",
        regex: "notice\\s+of\\s+loss",
        keywords: ["notice of loss", "claims notification"],
      },
    ],
  },
];

export function getControlledGlobalWorkspaceSeeds(): DefaultWorkspaceSeed[] {
  return DEFAULT_WORKSPACES.filter((seed) => seed.isGlobal);
}

export function getGlobalWorkspaceSeedByType(
  type: string,
): DefaultWorkspaceSeed | undefined {
  const normalizedType = type.trim().toLowerCase();
  return DEFAULT_WORKSPACES.find(
    (seed) => seed.type.toLowerCase() === normalizedType,
  );
}
