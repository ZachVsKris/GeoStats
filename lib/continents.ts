export type Continent = "Africa" | "Asia" | "Europe" | "North America" | "South America" | "Oceania";

const AFRICA = new Set([
  "DZA","AGO","BEN","BWA","BFA","BDI","CPV","CMR","CAF","TCD","COM","COG","COD","CIV","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","KEN","LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA","RWA","STP","SEN","SYC","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","TUN","UGA","ZMB","ZWE",
]);
const EUROPE = new Set([
  "ALB","AND","AUT","XKX","BLR","BEL","BIH","BGR","HRV","CZE","DNK","EST","FIN","FRA","DEU","GRC","VAT","HUN","ISL","IRL","ITA","LVA","LIE","LTU","LUX","MLT","MDA","MCO","MNE","NLD","MKD","NOR","POL","PRT","ROU","RUS","SMR","SRB","SVK","SVN","ESP","SWE","CHE","UKR","GBR",
]);
const NORTH_AMERICA = new Set([
  "ATG","BHS","BRB","BLZ","CAN","CRI","CUB","DMA","DOM","SLV","GRD","GTM","HTI","HND","JAM","MEX","NIC","PAN","KNA","LCA","VCT","TTO","USA",
]);
const SOUTH_AMERICA = new Set([
  "ARG","BOL","BRA","CHL","COL","ECU","GUY","PRY","PER","SUR","URY","VEN",
]);
const OCEANIA = new Set([
  "AUS","FJI","KIR","MHL","FSM","NRU","NZL","PLW","PNG","WSM","SLB","TON","TUV","VUT",
]);

export function continentForIso3(iso3: string): Continent {
  if (AFRICA.has(iso3)) return "Africa";
  if (EUROPE.has(iso3)) return "Europe";
  if (NORTH_AMERICA.has(iso3)) return "North America";
  if (SOUTH_AMERICA.has(iso3)) return "South America";
  if (OCEANIA.has(iso3)) return "Oceania";
  return "Asia";
}
