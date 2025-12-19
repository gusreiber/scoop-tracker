// src/fixtures/location-935.js
export const location935 = {
  location: { id: 935, name: "Woodinville" },
  cabinets: [
    {
      id: 1181,
      name: "Woodinville_dairy",
      restricted: false,
      slots: [
        {
          id: 1242,
          index: 1,
          current: { flavorId: 1084, name: "Mint Chip" },
          planned: { flavorId: 1091, name: "Vanilla" },
          counts: { localTubsTotal: 6, unopened: 2, opened: 1 }
        }
      ],
      oddGroups: [
        { label: "Needs attention", items: [/* slot ids */] },
        { label: "Planned today", items: [/* slot ids */] }
      ]
    }
  ],
  generatedAt: "2025-12-16T00:00:00-08:00"
};
