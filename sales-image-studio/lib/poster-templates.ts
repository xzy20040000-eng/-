export type PosterTemplate = {
  id: string;
  title: string;
  height: number;
  sourceHeight: number;
  logoBox: [number, number, number, number];
  companyBox: [number, number, number, number];
  colorRoles: { name: string; original: [number, number, number]; tone: "hero" | "primary" | "light" }[];
  defaultAccent: string;
  flatColors: string[];
  flatColorIslands?: boolean;
  flatColorIslandRegions?: [number, number, number, number][];
  flatColorEdgeRadius?: number;
  accentRegions: [number, number, number, number][];
  blackName?: { region: [number, number, number, number]; ink: [number, number, number]; background: [number, number, number] };
};

// One editable template per speaker. The other dated/color files are layout references.
// Coordinates are in the 1242 px source space; all five use the same footer grid.
const REGIONS: [number, number, number, number][] = [
  [0, 220, 700, 650],   // colored title words, including Jessica's third line
  [0, 1100, 370, 145],  // 培训亮点 tab
  [55, 1200, 1050, 435], // benefit icons and colored headings, including the first icon
  [0, 1650, 900, 145],  // workflow tab
  [55, 1800, 840, 320], // colored workflow bullets
];

export const TEMPLATES: PosterTemplate[] = [
  { id: "rio-1012", title: "吕蕊 Rio", height: 2575, sourceHeight: 2675, logoBox: [54, 110, 421, 80], companyBox: [495, 125, 164, 53], defaultAccent: "#ab1426", flatColors: ["#ae1a26"], flatColorIslands: true, flatColorEdgeRadius: 5, accentRegions: REGIONS, colorRoles: [
    {name:"hero",original:[175,26,39],tone:"hero"},{name:"light-panel",original:[255,243,244],tone:"light"},{name:"light-workflow",original:[253,238,228],tone:"light"},{name:"primary",original:[175,26,39],tone:"primary"},{name:"primary-tab",original:[175,26,39],tone:"primary"},{name:"secondary",original:[175,26,39],tone:"primary"},{name:"hero-strays",original:[175,26,39],tone:"hero"},{name:"hero-edge",original:[175,26,39],tone:"hero"}
  ] },
  { id: "jessica-1014", title: "李俊其 Jessica", height: 2575, sourceHeight: 2677, logoBox: [56, 108, 613, 103], companyBox: [693, 138, 136, 43], defaultAccent: "#a5142c", flatColors: ["#b41c29"], flatColorEdgeRadius: 5, accentRegions: REGIONS, colorRoles: [
    {name:"hero",original:[180,28,41],tone:"hero"},{name:"light-panel",original:[239,243,252],tone:"light"},{name:"light-workflow",original:[239,243,252],tone:"light"},{name:"primary",original:[180,28,41],tone:"primary"},{name:"secondary",original:[180,28,41],tone:"primary"},{name:"hero-strays",original:[180,28,41],tone:"hero"},{name:"hero-edge",original:[180,28,41],tone:"hero"}
  ] },
  { id: "jayden-1019", title: "杨景一 Jayden", height: 2575, sourceHeight: 2675, logoBox: [58, 99, 424, 85], companyBox: [498, 108, 174, 55], defaultAccent: "#bb9552", flatColors: ["#c8a063"], flatColorIslandRegions: [[750, 850, 330, 240]], accentRegions: REGIONS, blackName: { region: [785, 915, 245, 105], ink: [200, 160, 99], background: [252, 248, 237] }, colorRoles: [
    {name:"hero",original:[201,160,99],tone:"hero"},{name:"light-panel",original:[253,248,237],tone:"light"},{name:"light-workflow",original:[253,248,237],tone:"light"},{name:"primary",original:[201,160,99],tone:"primary"},{name:"secondary",original:[201,160,99],tone:"primary"},{name:"secondary-tab",original:[201,160,99],tone:"primary"},{name:"workflow-green",original:[23,70,38],tone:"primary"}
  ] },
  { id: "daniel-0921-blue", title: "邓欢 Daniel", height: 2575, sourceHeight: 2677, logoBox: [38, 0, 318, 184], companyBox: [370, 91, 164, 52], defaultAccent: "#2f69ae", flatColors: ["#436ab7", "#204a9c"], accentRegions: REGIONS, blackName: { region: [860, 1015, 205, 95], ink: [32, 74, 156], background: [214, 231, 252] }, colorRoles: [
    {name:"hero",original:[66,106,183],tone:"hero"},{name:"light",original:[214,230,255],tone:"light"},{name:"primary",original:[32,75,157],tone:"primary"}
  ] },
  { id: "kiki-1010", title: "陈凯瑶 Kiki", height: 2575, sourceHeight: 2675, logoBox: [50, 95, 435, 95], companyBox: [510, 110, 200, 62], defaultAccent: "#8f3336", flatColors: ["#8d3a32"], flatColorIslandRegions: [[780, 580, 130, 160]], accentRegions: REGIONS, colorRoles: [
    {name:"hero",original:[140,58,50],tone:"hero"},{name:"light-panel",original:[255,242,242],tone:"light"},{name:"light-workflow",original:[255,242,242],tone:"light"},{name:"primary",original:[140,58,50],tone:"primary"},{name:"primary-tab",original:[140,58,50],tone:"primary"},{name:"secondary",original:[140,58,50],tone:"primary"},{name:"hero-strays",original:[140,58,50],tone:"hero"},{name:"hero-edge",original:[140,58,50],tone:"hero"}
  ] },
];

const LEGACY_IDS: Record<string, string> = {
  "rio-1009": "rio-1012",
  "jessica-0924": "jessica-1014",
  "jayden-0923": "jayden-1019",
  "daniel-0921-gold": "daniel-0921-blue",
  "kiki-1009": "kiki-1010",
};
export const templateById = (id: string) => TEMPLATES.find(template => template.id === (LEGACY_IDS[id] || id)) || TEMPLATES[0];
