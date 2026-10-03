export type Hotel = {
  id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  region: "Europe" | "Asia" | "Africa" | "Americas";
  monthly: number;
  coupleFactor: number;
  score: number;
  climate: string;
  board: string;
  tags: string[];
  lat: number;
  lng: number;
  provider: "booking" | "ratehawk" | "hbx";
  verifiedHoursAgo: number;
};

export const hotels: Hotel[] = [
  {id:"h01",slug:"sol-tenerife",name:"Atlantic Sun Residence",city:"Tenerife",country:"Spain",flag:"🇪🇸",region:"Europe",monthly:1640,coupleFactor:1.42,score:94,climate:"23°C winter",board:"Half board",tags:["pool","walkable","clinic","sea"],lat:28.29,lng:-16.63,provider:"booking",verifiedHoursAgo:1},
  {id:"h02",slug:"gran-canaria-bay",name:"Gran Canaria Bay Hotel",city:"Las Palmas",country:"Spain",flag:"🇪🇸",region:"Europe",monthly:1710,coupleFactor:1.4,score:92,climate:"22°C winter",board:"Breakfast",tags:["sea","walkable","clinic"],lat:28.12,lng:-15.43,provider:"ratehawk",verifiedHoursAgo:2},
  {id:"h03",slug:"benidorm-promenade",name:"Promenade Long Stay",city:"Benidorm",country:"Spain",flag:"🇪🇸",region:"Europe",monthly:1390,coupleFactor:1.45,score:91,climate:"18°C winter",board:"Full board",tags:["pool","walkable","clinic","sea"],lat:38.54,lng:-0.13,provider:"hbx",verifiedHoursAgo:1},
  {id:"h04",slug:"malaga-costa",name:"Costa Málaga Living",city:"Málaga",country:"Spain",flag:"🇪🇸",region:"Europe",monthly:1580,coupleFactor:1.44,score:90,climate:"18°C winter",board:"Breakfast",tags:["walkable","clinic","sea"],lat:36.72,lng:-4.42,provider:"booking",verifiedHoursAgo:3},
  {id:"h05",slug:"algarve-slow",name:"Algarve Slow Living",city:"Albufeira",country:"Portugal",flag:"🇵🇹",region:"Europe",monthly:1510,coupleFactor:1.43,score:93,climate:"17°C winter",board:"Half board",tags:["pool","sea","quiet"],lat:37.09,lng:-8.25,provider:"ratehawk",verifiedHoursAgo:2},
  {id:"h06",slug:"madeira-garden",name:"Madeira Garden House",city:"Funchal",country:"Portugal",flag:"🇵🇹",region:"Europe",monthly:1690,coupleFactor:1.4,score:94,climate:"20°C winter",board:"Breakfast",tags:["sea","walkable","clinic","garden"],lat:32.65,lng:-16.91,provider:"booking",verifiedHoursAgo:2},
  {id:"h07",slug:"malta-harbour",name:"Harbour Life Malta",city:"Sliema",country:"Malta",flag:"🇲🇹",region:"Europe",monthly:1760,coupleFactor:1.39,score:89,climate:"17°C winter",board:"Breakfast",tags:["sea","walkable","clinic"],lat:35.91,lng:14.5,provider:"hbx",verifiedHoursAgo:4},
  {id:"h08",slug:"cyprus-limassol",name:"Limassol Winter Club",city:"Limassol",country:"Cyprus",flag:"🇨🇾",region:"Europe",monthly:1480,coupleFactor:1.41,score:92,climate:"19°C winter",board:"Half board",tags:["pool","sea","clinic"],lat:34.68,lng:33.04,provider:"ratehawk",verifiedHoursAgo:2},
  {id:"h09",slug:"antalya-riviera",name:"Riviera Long Stay",city:"Antalya",country:"Türkiye",flag:"🇹🇷",region:"Europe",monthly:1190,coupleFactor:1.5,score:96,climate:"17°C winter",board:"All inclusive",tags:["pool","spa","sea","clinic"],lat:36.9,lng:30.7,provider:"ratehawk",verifiedHoursAgo:1},
  {id:"h10",slug:"izmir-seafront",name:"Izmir Seafront Club",city:"Izmir",country:"Türkiye",flag:"🇹🇷",region:"Europe",monthly:1270,coupleFactor:1.47,score:90,climate:"15°C winter",board:"Half board",tags:["sea","walkable","clinic"],lat:38.42,lng:27.14,provider:"hbx",verifiedHoursAgo:5},
  {id:"h11",slug:"hammamet-palms",name:"Hammamet Palms",city:"Hammamet",country:"Tunisia",flag:"🇹🇳",region:"Africa",monthly:980,coupleFactor:1.55,score:91,climate:"18°C winter",board:"All inclusive",tags:["pool","sea","spa"],lat:36.4,lng:10.62,provider:"ratehawk",verifiedHoursAgo:2},
  {id:"h12",slug:"djerba-blue",name:"Djerba Blue Residence",city:"Djerba",country:"Tunisia",flag:"🇹🇳",region:"Africa",monthly:940,coupleFactor:1.56,score:90,climate:"19°C winter",board:"All inclusive",tags:["pool","sea","quiet"],lat:33.81,lng:10.86,provider:"hbx",verifiedHoursAgo:3},
  {id:"h13",slug:"agadir-atlas",name:"Agadir Atlantic Club",city:"Agadir",country:"Morocco",flag:"🇲🇦",region:"Africa",monthly:1120,coupleFactor:1.5,score:89,climate:"21°C winter",board:"Half board",tags:["pool","sea","walkable"],lat:30.42,lng:-9.6,provider:"booking",verifiedHoursAgo:4},
  {id:"h14",slug:"hurghada-coral",name:"Coral Coast Living",city:"Hurghada",country:"Egypt",flag:"🇪🇬",region:"Africa",monthly:1010,coupleFactor:1.56,score:88,climate:"23°C winter",board:"All inclusive",tags:["pool","sea","spa"],lat:27.26,lng:33.81,provider:"hbx",verifiedHoursAgo:5},
  {id:"h15",slug:"chiang-mai-garden",name:"Chiang Mai Garden Suites",city:"Chiang Mai",country:"Thailand",flag:"🇹🇭",region:"Asia",monthly:870,coupleFactor:1.58,score:95,climate:"28°C winter",board:"Breakfast",tags:["pool","clinic","quiet"],lat:18.79,lng:98.98,provider:"ratehawk",verifiedHoursAgo:1},
  {id:"h16",slug:"hua-hin-breeze",name:"Hua Hin Sea Breeze",city:"Hua Hin",country:"Thailand",flag:"🇹🇭",region:"Asia",monthly:960,coupleFactor:1.56,score:94,climate:"29°C winter",board:"Breakfast",tags:["pool","sea","clinic"],lat:12.57,lng:99.96,provider:"booking",verifiedHoursAgo:3},
  {id:"h17",slug:"da-nang-river",name:"Da Nang River House",city:"Da Nang",country:"Vietnam",flag:"🇻🇳",region:"Asia",monthly:820,coupleFactor:1.58,score:96,climate:"25°C winter",board:"Breakfast",tags:["pool","sea","clinic","walkable"],lat:16.05,lng:108.2,provider:"ratehawk",verifiedHoursAgo:1},
  {id:"h18",slug:"nha-trang-bay",name:"Nha Trang Bay Living",city:"Nha Trang",country:"Vietnam",flag:"🇻🇳",region:"Asia",monthly:790,coupleFactor:1.6,score:93,climate:"26°C winter",board:"Breakfast",tags:["sea","pool","walkable"],lat:12.24,lng:109.2,provider:"hbx",verifiedHoursAgo:2},
  {id:"h19",slug:"bali-ubud",name:"Ubud Green Residence",city:"Ubud",country:"Indonesia",flag:"🇮🇩",region:"Asia",monthly:1030,coupleFactor:1.54,score:92,climate:"28°C",board:"Breakfast",tags:["pool","wellness","quiet"],lat:-8.51,lng:115.26,provider:"booking",verifiedHoursAgo:3},
  {id:"h20",slug:"bali-sanur",name:"Sanur Long Stay Club",city:"Sanur",country:"Indonesia",flag:"🇮🇩",region:"Asia",monthly:1110,coupleFactor:1.53,score:95,climate:"28°C",board:"Breakfast",tags:["pool","sea","clinic","walkable"],lat:-8.69,lng:115.26,provider:"ratehawk",verifiedHoursAgo:1},
  {id:"h21",slug:"penang-heritage",name:"Penang Heritage Living",city:"George Town",country:"Malaysia",flag:"🇲🇾",region:"Asia",monthly:920,coupleFactor:1.58,score:94,climate:"29°C",board:"Breakfast",tags:["clinic","walkable","food"],lat:5.41,lng:100.34,provider:"hbx",verifiedHoursAgo:3},
  {id:"h22",slug:"kuala-lumpur-sky",name:"KL Sky Residence",city:"Kuala Lumpur",country:"Malaysia",flag:"🇲🇾",region:"Asia",monthly:990,coupleFactor:1.55,score:93,climate:"29°C",board:"Room only",tags:["pool","clinic","metro"],lat:3.14,lng:101.69,provider:"booking",verifiedHoursAgo:4},
  {id:"h23",slug:"playa-del-carmen",name:"Riviera Maya Month Club",city:"Playa del Carmen",country:"Mexico",flag:"🇲🇽",region:"Americas",monthly:1460,coupleFactor:1.48,score:91,climate:"27°C winter",board:"Breakfast",tags:["pool","sea","walkable"],lat:20.63,lng:-87.07,provider:"ratehawk",verifiedHoursAgo:2},
  {id:"h24",slug:"merida-casa",name:"Mérida Courtyard Living",city:"Mérida",country:"Mexico",flag:"🇲🇽",region:"Americas",monthly:1040,coupleFactor:1.53,score:90,climate:"28°C winter",board:"Breakfast",tags:["pool","clinic","culture"],lat:20.97,lng:-89.62,provider:"booking",verifiedHoursAgo:3},
  {id:"h25",slug:"buenos-aires-palermo",name:"Palermo Urban Residence",city:"Buenos Aires",country:"Argentina",flag:"🇦🇷",region:"Americas",monthly:1080,coupleFactor:1.5,score:92,climate:"Seasonal",board:"Room only",tags:["walkable","clinic","culture"],lat:-34.58,lng:-58.43,provider:"hbx",verifiedHoursAgo:5},
  {id:"h26",slug:"mendoza-vines",name:"Mendoza Garden Stay",city:"Mendoza",country:"Argentina",flag:"🇦🇷",region:"Americas",monthly:990,coupleFactor:1.52,score:88,climate:"Dry",board:"Breakfast",tags:["quiet","clinic","culture"],lat:-32.89,lng:-68.84,provider:"booking",verifiedHoursAgo:6},
  {id:"h27",slug:"lima-miraflores",name:"Miraflores Pacific Living",city:"Lima",country:"Peru",flag:"🇵🇪",region:"Americas",monthly:1180,coupleFactor:1.5,score:91,climate:"Mild",board:"Breakfast",tags:["sea","walkable","clinic"],lat:-12.12,lng:-77.03,provider:"ratehawk",verifiedHoursAgo:2},
  {id:"h28",slug:"cartagena-breeze",name:"Cartagena Breeze Club",city:"Cartagena",country:"Colombia",flag:"🇨🇴",region:"Americas",monthly:1260,coupleFactor:1.5,score:89,climate:"30°C",board:"Breakfast",tags:["pool","sea","culture"],lat:10.39,lng:-75.48,provider:"hbx",verifiedHoursAgo:4},
  {id:"h29",slug:"paphos-garden",name:"Paphos Garden Residence",city:"Paphos",country:"Cyprus",flag:"🇨🇾",region:"Europe",monthly:1360,coupleFactor:1.45,score:90,climate:"19°C winter",board:"Half board",tags:["pool","sea","quiet"],lat:34.77,lng:32.43,provider:"booking",verifiedHoursAgo:4},
  {id:"h30",slug:"crete-slow",name:"Crete Slow Season Club",city:"Heraklion",country:"Greece",flag:"🇬🇷",region:"Europe",monthly:1430,coupleFactor:1.44,score:89,climate:"17°C winter",board:"Half board",tags:["sea","clinic","culture"],lat:35.34,lng:25.13,provider:"ratehawk",verifiedHoursAgo:3}
];

export const hotelBySlug = (slug: string) => hotels.find((h) => h.slug === slug);
