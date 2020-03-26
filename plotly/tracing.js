import { is3D, EDGE_COLORS, NODE_SYMBOLS, NODE_COLORS } from './constants.js';

function traceNodes(fig, type, config) {
  const nodes = fig.nodes.filter((node) => node.type == type);

  const dict = {
    name: 'Nodes',
    mode: 'markers',
    type: is3D(fig.type) ? 'scatter3d' : 'scatter',
    x: nodes.map(node => node.x),
    y: nodes.map(node => node.y),
    hoverinfo: 'text',
    text: nodes.map(node => `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}<br />`),
    ...config,
  };

  if (is3D(fig.type)) {
    dict.z = nodes.map(node => node['z'])
  }

  dict.marker = {
    symbol: NODE_SYMBOLS[type],
    color: nodes.map(({ category }) => NODE_COLORS[category]),
    colorscale: "Viridis",
    size: 6,
    opacity: 0.8,
    line: {
        color: "rgb(50,50,50)",
        width: 0.5
    },
    ...config.marker
  };

  return dict;
}

function traceEdges(fig, nodes_by_key, type, config) {
  var edges = fig.edges.filter((edge) => edge.value == type);
  var dict = {
          name: 'Edges',
          mode: 'lines',
          type: is3D(fig.type) ? 'scatter3d' : 'scatter',
          x: edges.reduce((r, edge) => [...r, nodes_by_key[edge.source].x, nodes_by_key[edge.target].x, null], []),
          y: edges.flatMap(edge => [nodes_by_key[edge.source].y, nodes_by_key[edge.target].y, null]),
          hoverinfo: 'none',
          ...config
  };

  if (is3D(fig.type)) {
    dict.z = edges.reduce((r, edge) => {r.push(nodes_by_key[edge.source].z, nodes_by_key[edge.target].z, null); return r;}, []);
  }

  dict.line = {
          color: EDGE_COLORS[type],
          width: edges.map(({ weight }) => weight * 3),
          opacity: 0.5,
          ...config.line
  };
  
  return dict;
}

function traceMesh(fig, nodes_by_key, type, config) {
  var edges = fig.edges.filter((edge) => edge.value == type);
  var dict = {
          alphahull: 7,
          opacity: 0.1,
          type: is3D(fig.type) ? 'mesh3d' : 'mesh',
          x: edges.reduce((r, edge) => {r.push(nodes_by_key[edge.source].x, nodes_by_key[edge.target].x, null); return r;}, []),
          y: edges.reduce((r, edge) => {r.push(nodes_by_key[edge.source].y, nodes_by_key[edge.target].y, null); return r;}, []),
          ...config
  };
  if (is3D(fig.type)) {
      dict.z = edges.reduce((r, edge) => {r.push(nodes_by_key[edge.source].z, nodes_by_key[edge.target].z, null); return r;}, []);
  }
  return dict;
}

export {
  traceNodes,
  traceEdges,
  traceMesh,
};
