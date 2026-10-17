/** Item definitions used by the inventory and the shopping device. */
export const ITEM_DEFS = {
  headphones: {
    id: "headphones",
    asset: "headphones",
    name: "Old Headphones",
    condition: "Worn",
    blurb: "The cable is frayed near the jack, but they still play.",
    repairCost: 250,
    resaleValue: 450,
    careNote: "A repair would re-solder the frayed jack.",
  },
  hoodie: {
    id: "hoodie",
    asset: "hoodie",
    name: "Coral Hoodie",
    condition: "Unused",
    blurb: "Soft, still tagged, never worn. It was an impulse buy last spring.",
    resaleValue: 700,
    careNote: "Never worn. Someone else could use it.",
  },
  sneakers: {
    id: "sneakers",
    asset: "sneakers",
    name: "Everyday Sneakers",
    condition: "Worn",
    blurb: "A hole in the left toe. The soles still have months left in them.",
    repairCost: 300,
    resaleValue: 500,
    careNote: "A cobbler can patch the toe.",
  },
  trendy_sneakers: {
    id: "trendy_sneakers",
    asset: "trendy_sneakers",
    name: "Trendy Sneakers",
    condition: "New",
    blurb: "The pair everyone at college is wearing this term.",
    repairCost: 300,
    resaleValue: 1600,
    careNote: "New; wear them before deciding they need replacing.",
  },
  wireless_headphones: {
    id: "wireless_headphones",
    asset: "wireless_headphones",
    name: "Wireless Headphones",
    condition: "New",
    blurb: "No cable left to fray.",
    repairCost: 250,
    resaleValue: 1200,
    careNote: "New; still worth using before thinking about the next pair.",
  },
  party_speaker: {
    id: "party_speaker",
    asset: "party_speaker",
    name: "Party Speaker",
    condition: "New",
    blurb: "Loud, heavy, and used a few times a year at most.",
    repairCost: 400,
    resaleValue: 1300,
    careNote: "Loud but occasional. It may sit unused between parties.",
  },
};

/**
 * The device catalogue. `reuse` is only offered when the player already owns
 * the referenced item; `borrow` is only present on products where sharing is
 * genuinely plausible.
 */
export const PRODUCTS = [
  {
    id: "trendy_sneakers",
    itemId: "trendy_sneakers",
    name: "Trendy Sneakers",
    price: 2499,
    tag: "What everyone wears",
    blurb: "Everyone at college has a pair. Your everyday pair is worn but usable.",
    reuse: {
      itemId: "sneakers",
      label: "Reuse your everyday sneakers",
      text: "You clean the everyday pair and glue the toe. No money spent, and they still fit.",
    },
  },
  {
    id: "wireless_headphones",
    itemId: "wireless_headphones",
    name: "Wireless Headphones",
    price: 1899,
    tag: "Trending",
    blurb: "No cable to fray. Your old pair still plays, though the jack is taped.",
    reuse: {
      itemId: "headphones",
      label: "Repair your old headphones",
      text: "You tape the frayed cable and keep using the old pair. They work well enough.",
    },
  },
  {
    id: "party_speaker",
    itemId: "party_speaker",
    name: "Party Speaker",
    price: 2199,
    tag: "Occasional use",
    blurb: "Loud and heavy. You would use it a few times a year.",
    borrow: {
      from: "Noor",
      label: "Borrow Noor's speaker",
      text: "Noor's speaker is free this weekend. You borrow it instead of buying one.",
    },
  },
];

export function getProduct(id) {
  return PRODUCTS.find((product) => product.id === id) || null;
}

export function getItemDef(id) {
  return ITEM_DEFS[id] || null;
}

/** Rupee amounts use Indian digit grouping, e.g. ₹2,499 and ₹1,50,000. */
export function formatMoney(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}
