(function(window) {
    'use strict';

    function NXPlotly() {

        var _plot = {};

        const traceSelectName = 'currentselectiontrace';

        const graphType = (type) => ({
            'BASIC_LAYOUT': '2d',
            'BASIC_LAYOUT_3D': '3d',
        })[type];

        _plot.render = function(datasource, datasource_title, graph, options) {
            Plotly.d3.json(datasource, function(err, fig) {
                if (err) {
                    alert("Error retrieving json data");
                    return;
                }
                if (graphType(fig.type) == undefined) {
                    console.alert("Unsupported graph type " + fig.type);
                }
                if (options == undefined) {
                    options = {};
                }
                _render(datasource, datasource_title, graph, fig, options);
            });
        };

        function is3D(type) {
            return graphType(type) === '3d';
        }

        const nodeTypes = [
            'BUNDLE',
            'COMPONENT',
            'SERVICE',
            'EXTENSION_POINT',
            'CONTRIBUTION',
            ];

        const nodeLabel = (type) => ({
            'BUNDLE': 'Bundles',
            'COMPONENT': 'Components',
            'SERVICE': 'Services',
            'EXTENSION_POINT': 'Extension Points',
            'CONTRIBUTION': 'Contributions',
        })[type];

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

        const edgeTypes = [
            'REQUIRES',
            'SOFT_REQUIRES',
            'REFERENCES',
            'CONTAINS',
            ];

        const edgeLabel = (value) => ({
            'REQUIRES': 'Requires Bundle',
            'SOFT_REQUIRES': 'Requires Component',
            'REFERENCES': 'Contributes to Extension Point',
            'CONTAINS': 'Contains',
        })[value];

        const edgeColor = (value) => ({
            'REQUIRES': '#ffa000',
            'SOFT_REQUIRES': '#fafa00',
            'REFERENCES': '#00c800',
            'CONTAINS': '#6496ff',
        })[value];

        function traceNodes(fig, type, config) {
            var nodes = fig.nodes.filter(function(node) {return type ? node.type == type: true});
            var dict = {
                    name: (type ? nodeLabel(type) : "Nodes"),
                    mode: 'markers',
                    type: 'scatter',
                    x: nodes.map(node => node['x']),
                    y: nodes.map(node => node['y']),
                    hoverinfo: 'text',
                    text: nodes.map(node => `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}`),
                    customdata: nodes.reduce(function(r, node) {return {type: 'node', 'nodetype': node.type, id: node.id};}, []),
            };
            if (is3D(fig.type)) {
                Object.assign(dict, {
                    type: 'scatter3d',
                    z: nodes.map(node => node['z'])
                });
            }
            Object.assign(dict, config);
            var marker = {
                    symbol: (type ? nodeSymbol(type) : nodes.map(node => nodeSymbol[node.type])),
                    color: nodes.map(node => nodeColor(node.category)),
                    colorscale: 'Viridis',
                    size: nodes.map(node => node['weight']*5),
                    opacity: 0.8,
                    line: {
                        color: 'rgb(50,50,50)',
                        width: 0.5
                    },
            };
            dict['marker'] = Object.assign({}, marker, config.marker);
            return [dict];
        }

        function traceEdges(fig, nodes_by_key, type, config) {
            var edges = fig.edges.filter(function(edge) {return type ? edge.value == type : true});
            function getLines(edges, axis) {
                return edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source][axis], nodes_by_key[edge.target][axis], null); return r;}, []);
            }
            var trace = {
                    name: (type ? edgeLabel(type) : "Edges"),
                    mode: 'lines',
                    type: 'scattergl',
                    x: getLines(edges, 'x'),
                    y: getLines(edges, 'y'),
                    hoverinfo: 'none',
            };
            if (is3D(fig.type)) {
                Object.assign(trace, {
                    type: 'scatter3d',
                    z: getLines(edges, 'z'),
                });
            }
            Object.assign(trace, config);
            var colors =  (type ? edgeColor(type) : edges.map(edge => edgeColor(edge.value)));
            var line = {
                    color: colors,
                    width: edges.map(edge => edge['weight']*3),
            };
            trace['line'] = Object.assign({}, line, config.line);

            // additional trace to show marker points on relations for better text on hover
            function getIntermediateNodes(edges, axis) {
                return edges.reduce(function(res, edge) {
                    res.push(
                            (3*nodes_by_key[edge.source][axis] + nodes_by_key[edge.target][axis])/4,
                            (nodes_by_key[edge.source][axis] + nodes_by_key[edge.target][axis])/2,
                            (nodes_by_key[edge.source][axis] + 3*nodes_by_key[edge.target][axis])/4,
                    );
                    return res;
                }, []);
            }
            var textlabels = edges.map(edge => `${nodes_by_key[edge.source]['label']} <b>${edge.value}</b> ${nodes_by_key[edge.target]['label']}`);
            // use edge index in original trace to find the edge thanks to the marker on selection
            var selecthelpers = edges.reduce(function(r, edge, index) {r.push({type: 'edgemarker', value: index}); return r;}, []);
            var labels = {
                    name: 'Edge Labels for '+ (type ? edgeLabel(type) : "Edges"),
                    mode: 'markers',
                    // adapt the following to intermediate nodes additions
                    text: textlabels.reduce(function(r, item) {r.push(item, item, item); return r;}, []),
                    // adapt the following to intermediate nodes additions
                    customdata: selecthelpers.reduce(function(r, item) {r.push(item, item, item); return r;}, []),
                    type: 'scattergl',
                    showlegend: false,
                    x: getIntermediateNodes(edges, 'x'),
                    y: getIntermediateNodes(edges, 'y'),
                    hoverinfo: 'text',
                    marker: {
                        symbol: 'star',
                        // adapt the following to intermediate nodes additions
                        color: (type ? colors: colors.reduce(function(r, item) {r.push(item, item, item); return r;}, [])),
                        size: 1,
                        opacity: 0.8,
                    },
            };
            if (is3D(fig.type)) {
                Object.assign(labels, {
                    type: 'scatter3d',
                    z: getIntermediateNodes(edges, 'z'),
                });
            }
            Object.assign(labels, config);
            var labelline = {
                    color: 'rgb(50,50,50)',
                    width: 0.5
            };
            labels['marker']['line'] = Object.assign({}, labelline, config.line);

            return [trace, labels];
        }

        function traceMesh(fig, nodes_by_key, type, config) {
            var edges = fig.edges.filter(function(edge) {return type ? edge.value == type: true});
            var trace = {
                    name: 'Mesh Tentative (WIP)',
                    alphahull: 7,
                    opacity: 0.1,
                    type: 'mesh',
                    x: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['x'], nodes_by_key[edge.target]['x'], null); return r;}, []),
                    y: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['y'], nodes_by_key[edge.target]['y'], null); return r;}, []),
            };
            if (is3D(fig.type)) {
                Object.assign(trace, {
                    type: 'mesh3d',
                    z: edges.reduce(function(r, edge) {r.push(nodes_by_key[edge.source]['z'], nodes_by_key[edge.target]['z'], null); return r;}, []),
                });
            }
            Object.assign(trace, config);
            return trace;
        }

        function getLayout(title, is3DGraph, config) {
            var layout = {
                    title: {text: title},
                    showlegend: true,
                    hovermode: 'closest',
                    paper_bgcolor: '#eee',
                    width: 2000,
                    height: 2000,
            },
            legend = {
                    borderwidth: 1,
                    bgcolor: '#fff',
                    tracegroupgap: 30,
            },
            axis = {
                    showbackground: false,
                    showspikes: false,
                    showgrid: false,
                    showticklabels: false,
                    zeroline: false,
                    title: '',
            },
            scene = {
                    xaxis: axis,
                    yaxis: axis,
            }

            if (is3DGraph) {
                Object.assign(scene, {zaxis: axis});
            }
            Object.assign(layout, config);
            if (is3DGraph) {
                layout['scene'] = scene;
            } else {
                Object.assign(layout, scene);
            }
            layout['legend'] = Object.assign({}, legend, config.legend);
            return layout;
        }

        function getUpdatemenus(graph, fig, data) {
            var updatemenus = [];

            var node_sizes = data.reduce(function(res, trace) {
                if ('marker' in trace) {
                    res.push(trace['marker']['size']);
                } else {
                    res.push([]);
                }
                return res;
            }, []);
            updatemenus.push({
                type: 'buttons',
                x: 0.40, xanchor: 'left',
                // size is shown by default -> inactive
                active: -1,
                buttons: [{
                    label: 'Hide Node Sizes',
                    method: 'restyle',
                    // toggle args
                    args: ['marker.size', '6'],
                    args2:  ['marker.size', node_sizes],
                }],
            });

            var marker_opacities = []
            var line_width_on = []
            for (var trace of data) {
                if ('marker' in trace) {
                    marker_opacities.push(trace['marker']['opacity']);
                    line_width_on.push("");
                } else if ('line' in trace) {
                    marker_opacities.push("");
                    line_width_on.push(trace['line']['width']);
                }
            }
            updatemenus.push({
                type: 'dropdown',
                direction: 'down',
                x: 0.55, xanchor: 'center',
                buttons: [{
                    label: 'Highlight',
                    method: 'restyle',
                    args: [{'marker.opacity': marker_opacities, 'line.width': line_width_on}],
                }, {
                    label: 'Unhighlight',
                    method: 'restyle',
                    args: [{'marker.opacity': 0.1, 'line.width': 0.1}],
                }],
            });

            updatemenus.push({
                name: traceSelectName,
                type: 'buttons',
                direction: 'down',
                x: 0.75, xanchor: 'center',
                // will be visible on selection existence only
                visible: false,
                showactive: false,
                buttons: [{
                    label: 'Clear Custom Selections',
                    // handled through plotly_buttonclicked event
                    method: 'skip',
                    execute: true,
                }],
            });

            // TODO: package selection (?) Plotly menus are not user-friendly with large data

// var filterbuttons = [{
// label: 'Filter on Bundle',
// method: 'skip',
// execute: false,
// }];
// var bundles = fig.nodes.filter(function(node) {return node.type == 'BUNDLE'});
// for (var i = 0; i < bundles.length; i++) {
// filterbuttons.push({
// label: bundles[i]['label'],
// method: 'skip',
// execute: true,
// });
// }
// updatemenus.push({
// type: 'dropdown',
// direction: 'down',
// x: 0.75, xanchor: 'center',
// buttons: filterbuttons,
// });

            return updatemenus;
        }

        function getAnnotations(graph, fig, data) {
            // XXX TODO
            var ann = [{
                x: 1, xanchor: 'left',
                y: 1, yanchor: 'bottom',
                // text: '<select class="bundleselector2"><option value="" selected disabled hidden="hidden">Filter on
                // Bundle</option></select>',
                text: '<span class="bundleselector2">blaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaah</span><a href="http:www.google.com">yyooo</a>',

                showarrow: false,
            }];
            return [];
        }

        function getSelectionTraceIndexes(graph) {
            var gd = document.getElementById(graph);
            var tindexes = [];
            for (var i = 0; i < gd.data.length; i++) {
                if (gd.data[i]['name'].startsWith(traceSelectName)) {
                    tindexes.push(i);
                    // do not bother going further: selection traces are prepended
                    break;
                }
            }
            return tindexes;
        }

        function selectNode(graph, fig, data, doubleclick) {
            var selection = data.points[0];
            if (!(selection.customdata)) {
                console.log("Cannot select " + selection);
                return;
            }
            

            // retrieve customdata for selection, assume invalid selection if not avail
            var stype = selection.customdata.type;
            if (stype == 'edgemarker') {
                // retrieve corresponding edge thanks to curveNumber: customdata represents index previous trace holding
                // edges
                var iindex = selection.customdata.value,
                tindex = selection.curveNumber;

                // add edge to the selection trace, annotate source and target markers, and annotate central edge marker
                // too

                // if doubleclicked: resolve source and target nodes and act as if they had been double-clicked too
                if (doubleclick) {
                    
                }

            } else if (stype = 'node') {
                var type = selection.customdata.nodetype,
                id = selection.customdata.id;
                // add node to the new trace and annotate it
                
                
                // if doubleclicked, resolve relations and act as if each edge had been clicked
                if (doubleclick) {
                    
                }
                
                
            }

            // create the trace from scratch
            console.log("create trace");
            console.log(graph);
            console.log(data);
            var trace1 = {
                    x: [1, 2, 3, 4],
                    y: [0, 2, 3, 5],
                    fill: 'tozeroy',
                    type: 'scatter',
                    mode: 'none',
                    name: traceSelectName,
            };
            Plotly.addTraces(graph, trace1, 0);

            // add a specific single trace to be selected, adding to existing traces if needed
            // XXX handle annotations
// var nodes = type ? fig.nodes.filter(function(node) {return node.type == type}) : fig.nodes;
// var name = type ? nodeLabel(type) : "Nodes";
// var dict = {
// name: name,
// mode: 'markers',
// type: 'scatter',
// x: nodes.map(node => node['x']),
// y: nodes.map(node => node['y']),
// hoverinfo: 'text',
// text: nodes.map(node => `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight:
// ${node.weight}`),
// };
// if (is3D(fig.type)) {
// Object.assign(dict, {
// type: 'scatter3d',
// z: nodes.map(node => node['z'])
// });
// }
// var marker = {
// symbol: nodeSymbol(type),
// color: nodes.map(node => nodeColor(node.category)),
// colorscale: 'Viridis',
// size: nodes.map(node => node['weight']*5),
// opacity: 0.8,
// line: {
// color: 'rgb(50,50,50)',
// width: 0.5
// },
// };
// Object.assign(dict, config);
// dict['marker'] = Object.assign({}, marker, config.marker);

// return dict;



        };

        function selectBundle(bundle, fig) {
            console.log("select bundle " + bundle);
            console.log("fig: " + fig);
        };

        function clearSelections(graph, data) {
            setClearSelectionButtonVisible(graph, false);
            Plotly.deleteTraces(graph, getSelectionTraceIndexes(graph));
        }

        function setClearSelectionButtonVisible(graph, visible) {
            var gd = document.getElementById(graph);
            for (var menu of gd.layout.updatemenus) {
                if (menu.name == traceSelectName) {
                    menu.visible = visible;
                    break;
                }
            }
        }
        
        function initBundleSelect(graph, fig, options) {
            if (!options.bundleselector) {
                return;
            }
            var bundles = fig.nodes.filter(function(node) {return node.type == 'BUNDLE'});
            var gd = document.getElementById(graph);
            var selector = gd.parentNode.querySelector(options.bundleselector);
            var firstOption = selector.querySelector('option');
            selector.textContent = '';
            if (firstOption) {
                selector.appendChild(firstOption);
            }
            for (var i = 0; i < bundles.length; i++) {
                var currentOption = document.createElement('option');
                currentOption.text = bundles[i]['label'];
                currentOption.value = bundles[i]['id'];
                selector.appendChild(currentOption);
            }
            selector.addEventListener('change', function() {
                selectBundle(selector.value, fig);
            }, false);
            
            // XX maybe init selection based on current value too
        }

        function _render(datasource, datasource_title, graph, fig, options) {
            if (options['circ']) {
                _render_circ(datasource, datasource_title, graph, fig, options);
            } else {
                _render_basic(datasource, datasource_title, graph, fig, options);
            }
        };

        function _render_circ(datasource, datasource_title, graph, fig, options) {
            // TODO
        }

        function _render_basic(datasource, datasource_title, graph, fig, options) {
            var nodes_by_key = fig.nodes.reduce(function(map, node) {
                map[node.id] = node;
                return map;
            }, {});

            var containsconf = {
                    legendgroup: 'contains',
                    visible: 'legendonly',
            }
            var data = [
                ...traceNodes(fig, 'BUNDLE', {legendgroup: 'bundles'}),
                ...traceEdges(fig, nodes_by_key, 'REQUIRES', {legendgroup: 'bundles'}),
                ...traceNodes(fig, 'COMPONENT', {legendgroup: 'components'}),
                ...traceEdges(fig, nodes_by_key, 'SOFT_REQUIRES', {legendgroup: 'components'}),
                ...traceNodes(fig, 'EXTENSION_POINT', {legendgroup: 'xps'}),
                ...traceNodes(fig, 'CONTRIBUTION', {legendgroup: 'xps'}),
                ...traceEdges(fig, nodes_by_key, 'REFERENCES', {legendgroup: 'xps'}),
                ];

            // another set of traces for containment, seems to be more efficient than 'groupby' transform
            for (var type of nodeTypes) {
                data.push(...traceNodes(fig, type, containsconf));
            }
            data = data.concat([
                ...traceEdges(fig, nodes_by_key, 'CONTAINS',  containsconf),
// traceMesh(fig, nodes_by_key, 'CONTAINS', Object.assign({}, containsconf, {
// name: 'Mesh Tentative (WIP)',
// })),
                ]);

            var layout = getLayout(`<b>${fig.title}</b> (${datasource_title})<br><i>${fig.description}</i>`, is3D(fig.type), {
                updatemenus: getUpdatemenus(graph, fig, data),
                annotations: getAnnotations(graph, fig, data),
            });

            Plotly.newPlot(graph, data, layout, {responsive: true});

            // events management
            var gd = document.getElementById(graph);
            gd.on('plotly_afterplot', function() {
                initBundleSelect(graph, fig, options);
            });
            // avoid recursion bug, see https://github.com/plotly/plotly.js/issues/1025
            var clickcalled = false;
            gd.on('plotly_click', function(data) {
                if (!clickcalled) {
                    clickcalled = true;
                    console.log('click');
                    selectNode(graph, fig, data, false);
                    clickcalled = false;
                }
            });
            var dblclickcalled = false;
            gd.on('plotly_doubleclick', function(data) {
                if (!dblclickcalled) {
                    dblclickcalled = true;
                    console.log('double click');
                    selectNode(graph, fig, data, true);
                    dblclickcalled = false;
                }
            });
            gd.on('plotly_buttonclicked', function(data) {
                if (data.menu.name == traceSelectName) {
                    clearSelections(graph, data);
                };
            });
        }

        return _plot;

    }

    if (typeof (window.NXPlotly) === 'undefined') {
        window.NXPlotly = NXPlotly();
    }
})(window);