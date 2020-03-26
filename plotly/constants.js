export const GRAPH_TYPES = {
  BASIC_LAYOUT: '2d',
  BASIC_LAYOUT_3D: '3d',
};

export const NODE_SYMBOLS = {
  BUNDLE: 'diamond',
  COMPONENT: 'square',
  SERVICE: 'diamond-open',
  EXTENSION_POINT: 'cross',
  CONTRIBUTION: 'circle',
};

export const NODE_COLORS = {
  RUNTIME: 0,
  CORE: -1,
  STUDIO: -3,
  PLATFORM: -2,
};

export const EDGE_COLORS = {
  REQUIRES: '#FFA000',
  SOFT_REQUIRES: '#FDD835',
  REFERENCES: '#00CC00',
  CONTAINS: '#6699FF',
};

export const is3D = (type) => GRAPH_TYPES[type] === '3d';