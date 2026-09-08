import type { FoodName } from "@ui/food-icons";

/**
 * What a typed line is made of, as icons.
 *
 * "poulet, carottes" becomes a drumstick and a carrot, and those are what
 * turn while a model writes — the wait shows what it is working from rather
 * than an hourglass. Matching is by word, in the three languages the app
 * speaks, accents stripped and a trailing s dropped; it is decoration, so a
 * word nobody recognises costs nothing and simply draws the pot.
 *
 * Titles go through the same table: "Soupe de courge" reads as a bowl, and
 * the icon changes as each new dish is started.
 */
const WORDS: Record<FoodName, string[]> = {
  drumstick: [
    "poulet", "chicken", "hahnchen", "huhn", "poule", "dinde", "turkey", "pute",
    "volaille", "cuisse", "canard", "duck", "ente",
  ],
  steak: [
    "boeuf", "beef", "rind", "rindfleisch", "steak", "viande", "meat", "fleisch",
    "porc", "pork", "schwein", "agneau", "lamb", "lamm", "veau", "veal", "kalb",
    "saucisse", "sausage", "wurst", "lardon", "bacon", "speck", "jambon", "ham",
    "schinken", "hache", "burger", "kebab", "merguez",
  ],
  fish: [
    "poisson", "fish", "fisch", "saumon", "salmon", "lachs", "thon", "tuna",
    "thunfisch", "cabillaud", "cod", "kabeljau", "truite", "trout", "forelle",
    "crevette", "shrimp", "garnele", "sardine", "dorade", "moule", "mussel",
    "calamar", "squid",
  ],
  egg: ["oeuf", "egg", "ei", "eier", "omelette", "omelett"],
  tomato: ["tomate", "tomato", "tomaten", "ketchup", "passata"],
  onion: [
    "oignon", "onion", "zwiebel", "echalote", "shallot", "schalotte", "ail",
    "garlic", "knoblauch", "poireau", "leek", "lauch",
  ],
  carrot: ["carotte", "carrot", "karotte", "ruebli", "rubli", "mohre", "moehre"],
  potato: [
    "patate", "potato", "potatoe", "kartoffel", "erdapfel", "frite", "fries",
    "rosti", "gnocchi", "puree",
  ],
  pepper: ["poivron", "pepper", "paprika", "piment", "chili", "chile", "peperoni"],
  mushroom: ["champignon", "mushroom", "pilz", "pilze", "cepe", "bolet", "morille"],
  lemon: ["citron", "lemon", "zitrone", "lime", "limette", "orange", "agrume"],
  apple: ["pomme", "apple", "apfel", "poire", "pear", "birne", "fruit", "obst", "banane", "banana"],
  leaf: [
    "salade", "salad", "salat", "epinard", "spinach", "spinat", "basilic", "basil",
    "basilikum", "persil", "parsley", "petersilie", "coriandre", "coriander",
    "koriander", "herbe", "herb", "kraut", "roquette", "rucola", "chou", "cabbage",
    "kohl", "brocoli", "broccoli", "brokkoli", "courgette", "zucchini", "haricot",
    "bean", "bohne", "poi", "pea", "erbse", "legume", "vegetable", "gemuse",
    "aubergine", "eggplant", "concombre", "cucumber", "gurke", "avocat", "avocado",
    "fenouil", "fennel", "asperge", "asparagus", "spargel", "courge", "squash",
    "kurbi", "potiron", "pumpkin",
  ],
  bowl: [
    "riz", "rice", "rei", "pate", "pasta", "nudel", "nudeln", "spaghetti", "penne",
    "lentille", "lentil", "linse", "linsen", "quinoa", "couscous", "soupe", "soup",
    "suppe", "curry", "dahl", "dal", "risotto", "ramen", "bouillon", "polenta",
    "semoule", "boulgour", "bulgur", "pois chiche", "chickpea", "kichererbse",
    "wok", "poke", "salade de", "porridge", "muesli",
  ],
  bread: [
    "pain", "bread", "brot", "farine", "flour", "mehl", "pizza", "tarte", "pie",
    "kuchen", "toast", "wrap", "tortilla", "quiche", "gateau", "cake", "crepe",
    "pancake", "brioche", "sandwich", "focaccia", "naan",
  ],
  cheese: [
    "fromage", "cheese", "kase", "gruyere", "parmesan", "mozzarella", "feta",
    "raclette", "fondue", "yaourt", "yogurt", "joghurt", "creme", "cream", "rahm",
    "beurre", "butter", "lait", "milk", "milch", "tofu", "ricotta", "chevre",
  ],
  pot: ["mijote", "ragout", "stew", "eintopf", "gratin", "four", "oven", "ofen", "braise"],
};

/** Shown when nothing typed matched: the kitchen in general. */
export const KITCHEN: FoodName[] = ["pot", "carrot", "drumstick", "tomato", "fish", "leaf", "bowl", "egg"];

/** One lookup, built once: word to icon. */
const BY_WORD = new Map<string, FoodName>();
for (const [icon, words] of Object.entries(WORDS) as [FoodName, string[]][]) {
  for (const word of words) BY_WORD.set(word, icon);
}

/** Lowercased, unaccented, and one phrase that would otherwise read as fruit. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/pommes? de terre/g, "patate");
}

/** "courgettes" and "courgette" are the same vegetable. */
function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

/**
 * The icons a line calls for, in the order its words come, each once.
 * Empty input and unknown words both fall back to the kitchen.
 */
export function iconsFor(text: string): FoodName[] {
  const found: FoodName[] = [];
  for (const raw of normalise(text).split(/[^a-z]+/)) {
    const word = singular(raw);
    if (!word) continue;
    const icon = BY_WORD.get(word) ?? BY_WORD.get(raw);
    if (icon && !found.includes(icon)) found.push(icon);
  }
  return found.length > 0 ? found : KITCHEN;
}
