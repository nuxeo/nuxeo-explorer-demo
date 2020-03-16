(function(window) {
    'use strict';

    function NXPlotly() {

        var _plot = {};

        _plot.render = function(datasource, datasource_title, graph) {
            Plotly.d3.json(datasource, function(err, fig) {
                if (err) {
                    alert("Error retrieving json data");
                    return;
                }
                _render(datasource, datasource_title, graph, fig);
            });
        };

        const graphType = (type) => ({
            'BASIC_LAYOUT': '2d',
            'BASIC_LAYOUT_3D': '3d',
        })[type];

        function is3D(type) {
            var graph_type = graphType(type);
            return graph_type === '3d';
        }

        const nodeSymbol = (type) => ({
            'BUNDLE': 'diamond',
            'COMPONENT': 'square',
            'SERVICE': 'diamond-open',
            'EXTENSION_POINT': 'cross',
            'CONTRIBUTION': 'circle',
        })[type];

        const nodeColor = (category) => ({
            'RUNTIME': 0,
            'CORE': -1,
            'STUDIO': -3,
            'PLATFORM': -2,
        })[category];

        const edgeColor = (value) => ({
            'REQUIRES': '#FFA000',
            'SOFT_REQUIRES': '#FDD835',
            'REFERENCES': '#00CC00',
            'CONTAINS': '#6699FF',
        })[value];

        function traceNodes(fig, type, config) {
            var nodes = fig.nodes.filter(function(node) {return node.type == type});
            var dict = {
                    name: 'Nodes',
                    mode: 'markers',
                    type: 'scatter',
                    x: nodes.map(node => node['x']),
                    y: nodes.map(node => node['y']),
                    hoverinfo: 'text',
                    text: nodes.map(node => `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}<br />`),
            };
            if (is3D(fig.type)) {
                Object.assign(dict, {
                    type: 'scatter3d',
                    z: nodes.map(node => node['z'])
                });
            }
            var marker = {
                    symbol: nodeSymbol(type),
                    color: nodes.map(node => nodeColor(node.category)),
                    colorscale: "Viridis",
                    size: 6,
                    opacity: 0.8,
                    line: {
                        color: "rgb(50,50,50)",
                        width: 0.5
                    },
            };
            Object.assign(dict, config);
            dict['marker'] = Object.assign({}, marker, config.marker);
            return dict;
        }

        function traceEdges(fig, nodes_by_key, type, config) {
            var edges = fig.edges.filter(function(edge) {return edge.value == type});
            var dict = {
                    name: 'Edges',
                    mode: 'lines',
                    type: 'scatter',
                    x: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['x'], nodes_by_key[edge.target]['x'], null); return r;}, []),
                    y: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['y'], nodes_by_key[edge.target]['y'], null); return r;}, []),
                    hoverinfo: 'none',
            };
            if (is3D(fig.type)) {
                Object.assign(dict, {
                    type: 'scatter3d',
                    z: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['z'], nodes_by_key[edge.target]['z'], null); return r;}, []),
                });
            }
            var line = {
                    color: edgeColor(type),
                    width: edges.map(edge => edge['weight']*3),
                    opacity: 0.5
            };
            Object.assign(dict, config);
            dict['line'] = Object.assign({}, line, config.line);
            return dict;
        }

        function traceMesh(fig, nodes_by_key, type, config) {
            var edges = fig.edges.filter(function(edge) {return edge.value == type});
            var dict = {
                    alphahull: 7,
                    opacity: 0.1,
                    type: 'mesh',
                    x: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['x'], nodes_by_key[edge.target]['x'], null); return r;}, []),
                    y: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['y'], nodes_by_key[edge.target]['y'], null); return r;}, []),
            };
            if (is3D(fig.type)) {
                Object.assign(dict, {
                    type: 'mesh3d',
                    z: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['z'], nodes_by_key[edge.target]['z'], null); return r;}, []),
                });
            }
            Object.assign(dict, config);
            return dict;
        }

        function _render(datasource, datasource_title, graph, fig) {

            var graph_type = graphType(fig.type);
            if (graph_type == undefined) {
                console.alert("Unsupported graph type " + fig.type);
            }
            var is3DGraph = is3D(fig.type);

            var nodes_by_key = fig.nodes.reduce(function(map, node) {
                map[node.id] = node;
                return map;
            }, {});

            var trace_bundles = traceNodes(fig, 'BUNDLE', {
                name: 'Bundles',
                legendgroup: "bundles",
            });
            var trace_brequires = traceEdges(fig, nodes_by_key, 'REQUIRES', {
                name: 'Requires Bundle',
                legendgroup: "bundles",
            });
            var trace_components = traceNodes(fig, 'COMPONENT', {
                name: 'Components',
                legendgroup: "components",
            });
            var trace_crequires = traceEdges(fig, nodes_by_key, 'SOFT_REQUIRES', {
                name: 'Requires Component',
                legendgroup: "components",
            });
            var trace_xps = traceNodes(fig, 'EXTENSION_POINT', {
                name: 'Extension Points',
                legendgroup: "xps",
            });
            var trace_contributions = traceNodes(fig, 'CONTRIBUTION', {
                name: 'Contributions',
                legendgroup: "xps",
            });
            var trace_references = traceEdges(fig, nodes_by_key, 'REFERENCES', {
                name: 'Contributes to Extension Point',
                legendgroup: "xps",
            });

            var trace_bundles_cont = traceNodes(fig, 'BUNDLE', {
                name: 'Bundles',
                legendgroup: "contains",
                visible: 'legendonly',
            });
            var trace_components_cont = traceNodes(fig, 'COMPONENT', {
                name: 'Components',
                legendgroup: "contains",
                visible: 'legendonly',
            });
            var trace_services_cont = traceNodes(fig, 'SERVICE', {
                name: 'Services',
                legendgroup: "contains",
                visible: 'legendonly',
            });
            var trace_xps_cont = traceNodes(fig, 'EXTENSION_POINT', {
                name: 'Extension Points',
                legendgroup: "contains",
                visible: 'legendonly',
            });
            var trace_contributions_cont = traceNodes(fig, 'CONTRIBUTION', {
                name: 'Contributions',
                legendgroup: "contains",
                visible: 'legendonly',
            });
            var trace_contains = traceEdges(fig, nodes_by_key, 'CONTAINS', {
                name: 'Contains',
                legendgroup: "contains",
                visible: 'legendonly',
            });
            var trace_mesh = traceMesh(fig, nodes_by_key, 'CONTAINS', {
                name: 'Mesh Tentative (WIP)',
                legendgroup: "contains",
                visible: 'legendonly',
            });

            var data = [
                trace_bundles, trace_brequires,
                trace_components, trace_crequires,
                trace_xps, trace_contributions, trace_references,
                trace_bundles_cont, trace_components_cont, trace_services_cont, trace_xps_cont, trace_contributions_cont, trace_contains, trace_mesh
                ];

            if (is3DGraph) {
                var trace_references_cont = traceEdges(fig, nodes_by_key, 'REFERENCES', {
                    name: 'Contributes to Extension Point',
                    legendgroup: "contains",
                    visible: 'legendonly',
                });
                data.push(trace_references_cont);
            }

            var axis = {
                    showbackground: false,
                    showspikes: false,
                    showgrid: false,
                    showticklabels: false,
                    zeroline: false,
                    title: "",
            }
            var scene = {
                    xaxis: axis,
                    yaxis: axis,
            }
            if (is3DGraph) {
                Object.assign(scene, {zaxis: axis});
            }
            var layout = {
                    title: {text: `<b>${fig.title}</b> (${datasource_title})<br><i>${fig.description}</i>`},
                    showlegend: true,
                    legend : {
                        borderwidth: 1,
                        bgcolor: '#fff',
                    },
                    hovermode: 'closest',
                    margin: {t: 100},
                    paper_bgcolor: "#eee",
                    width: 2000,
                    height: 2000,
            };
            if (is3DGraph) {
                Object.assign(layout, {scene: scene});
            } else {
                Object.assign(layout, scene);
            }

            Plotly.newPlot(graph, data, layout, {responsive: true});

        };

        return _plot;

    }

    if (typeof (window.NXPlotly) === 'undefined') {
        window.NXPlotly = NXPlotly();
    }
})(window);