(function(window) {
    'use strict';

    function NXPlotly() {

        var _plot = {};

        const DEFAULT_MARKER_OPACITY = 0.8;
        const DEFAULT_EDGE_WIDTH = 3;
        const HIGHLIGHT_LAYOUT_UPDATE = {
                'marker.opacity': DEFAULT_MARKER_OPACITY,
                'line.width': DEFAULT_EDGE_WIDTH
        }
        const UNHIGHLIGHT_LAYOUT_UPDATE = {
                'marker.opacity': 0.1,
                'line.width': 0.1,
        }
        const HIGHLIGHT_MENU_NAME = 'Highlight Menu';
        const TRACE_SELECT_NAME = 'Current Selection';
        const TRACE_SELECT_INDEXES = [0, 1];

        const graphType = (type) => ({
            'BASIC_LAYOUT': '2d',
            'BASIC_LAYOUT_3D': '3d',
        })[type];

        const NODE_TYPES = {
                'BUNDLE': {
                    label: 'Bundles',
                    symbol: 'diamond',
                },
                'COMPONENT': {
                    label:'Components',
                    symbol: 'square',
                },
                'SERVICE': {
                    label: 'Services',
                    symbol: 'diamond-open',
                },
                'EXTENSION_POINT': {
                    label: 'Extension Points',
                    symbol: 'cross',
                },
                'CONTRIBUTION': {
                    label: 'Contributions',
                    symbol: 'circle',
                },
        };

        const nodeLabel = (type) => NODE_TYPES[type]['label'];

        const nodeSymbol = (type) => NODE_TYPES[type]['symbol'];

        const nodeWeight = (weight) => (weight) ? weight*5 : 5;

        const nodeColor = (category) => ({
            'RUNTIME': 0,
            'CORE': 1,
            'STUDIO': 3,
            'PLATFORM': 2,
        })[category];

        const NODE_HOVERTEMPLATE = "<b>%{customdata.label}</b><br><br>" +
        "Type: %{customdata.type}<br>" +
        "Category: %{customdata.category}<br>" +
        "Weight: %{marker.size:,}<extra></extra>";

        const nodeMarkerText = (node) => `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}`;

        const EDGE_TYPES = {
                'REQUIRES': {
                    label: 'Requires Bundle',
                    color: '#ffa000',
                },
                'SOFT_REQUIRES': {
                    label: 'Requires Component',
                    color: '#fafa00',
                },
                'REFERENCES': {
                    label: 'Contributes to Extension Point',
                    color: '#00c800',
                },
                'CONTAINS': {
                    label: 'Contains',
                    color: '#6496ff',
                }
        };

        const edgeLabel = (value) => EDGE_TYPES[value]['label'];

        const edgeColor = (value) => EDGE_TYPES[value]['color'];

        const edgeLineMarkerSymbol = (graph) => (graph.is3D ? 'circle' : 'triangle-right');

        const edgeLineMarkerText = (edge, source, target) => `${source.label} <b>${edge.value}</b> ${target.label}`;

        const EDGE_LINE_HOVERTEMPLATE = "%{customdata.sourcelabel} <b>%{customdata.value}</b> %{customdata.targetlabel}<extra></extra>";

        _plot.render = function(graphDiv, options) {
            var datasource = options.datasource;
            if (!datasource) {
                alert("No datasource");
                return;
            }
            Plotly.d3.json(datasource, function(err, fig) {
                if (err) {
                    alert("Error retrieving json data");
                    console.error(err);
                    return;
                }
                if (graphType(fig.type) == undefined) {
                    var err = "Unsupported graph type " + fig.type;
                    alert(err);
                    console.error(err);
                    return;
                }
                if (options.circ) {
                    renderCirc(graphDiv, fig, options);
                } else {
                    renderBasic(graphDiv, fig, options);
                }
            });
        };

        function getBasicLayout(title, is3D) {
            var axis = {
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
            };

            var layout = {
                    title: {text: title},
                    showlegend: true,
                    hovermode: 'closest',
                    paper_bgcolor: '#eee',
                    width: 2000,
                    height: 2000,
                    legend: {
                        borderwidth: 1,
                        bgcolor: '#fff',
                        tracegroupgap: 30,
                    },
            };

            if (is3D) {
                Object.assign(scene, {zaxis: axis});
                Object.assign(layout, {scene: scene});
            } else {
                // axis directly on layout, outside of scene, in 2D
                Object.assign(layout, scene);
            }
            return layout;
        }

        function nodeMarkerCustomData(node) {
            return {
                type: 'node',
                id: node.id,
                label: node.label,
                nodetype: node.type,
                category: node.category,
            };
        }

        function edgeLineMarkerCustomData(edge, nodesById) {
            var source = nodesById[edge.source],
            target = nodesById[edge.source];
            return {
                type: 'edgemarker',
                id: edge.id,
                value: edge.value,
                sourcelabel: source.label,
                targetlabel: target.label,
            };
        }

        function traceNodes(graph, type, config) {
            var nodes = graph.data.nodes.filter(function(node) {return type ? node.type == type: true});
            var trace = {
                    name: 'nodes',
                    type: 'scatter',
                    mode: 'markers',
                    name: (type ? nodeLabel(type) : "Nodes"),
                    x: nodes.map(node => node.x),
                    y: nodes.map(node => node.y),
                    hovertemplate: NODE_HOVERTEMPLATE,
                    customdata: nodes.map(node => nodeMarkerCustomData(node)),
                    marker: {
                        symbol: (type ? nodeSymbol(type) : nodes.map(node => nodeSymbol(node.type))),
                        size: nodes.map(node => nodeWeight(node.weight)),
                        color: nodes.map(node => nodeColor(node.category)),
                        colorscale: 'Viridis',
                        reversescale: true,
                        opacity: DEFAULT_MARKER_OPACITY,
                        line: {
                            color: 'rgb(50,50,50)',
                            width: 0.5
                        },
                    },
            };
            if (graph.is3D) {
                Object.assign(trace, {
                    'type': 'scatter3d',
                    'z': nodes.map(node => node.z),
                });
            }
            Object.assign(trace, config);
            return [trace];
        }

        function computeEdgeLines(edges, nodesById, axis) {
            return edges.reduce(function(r, edge) {r.push(nodesById[edge.source][axis], nodesById[edge.target][axis], null); return r;}, []);
        }

        function computeEdgeLineMarkers(edges, nodesById, axis) {
            return edges.reduce(function(res, edge) {
                res.push(...computeLineMarkers(nodesById[edge.source][axis], nodesById[edge.target][axis]));
                return res;
            }, []);
        }

        // helps building an additional trace to show marker points on relations for better text on hover
        function computeLineMarkers(sourceaxis, targetaxis) {
            return [
                (3*sourceaxis + targetaxis)/4,
                (sourceaxis + targetaxis)/2,
                (sourceaxis + 3*targetaxis)/4,
                ];
        }

        // adapt other data content to line markers multiplication thanks to above logics
        function computeLineMarkersData(data) {
            return data.reduce(function(r, item) {r.push(item, item, item); return r;}, []);
        }

        function traceEdges(graph, type, config) {
            var edges = graph.data.edges.filter(function(edge) {return type ? edge.value == type : true});
            var colors = (type ? edgeColor(type) : edges.map(edge => edgeColor(edge.value)));
            var lines = {
                    name: (type ? edgeLabel(type) : "Edges"),
                    type: 'scattergl',
                    mode: 'lines',
                    hoverinfo: 'none',
                    x: computeEdgeLines(edges, graph.nodesById, 'x'),
                    y: computeEdgeLines(edges, graph.nodesById, 'y'),
                    line: {
                        color: colors,
                        width: DEFAULT_EDGE_WIDTH,
                    },
            };
            if (graph.is3D) {
                Object.assign(lines, {
                    type: 'scatter3d',
                    z: computeEdgeLines(edges, graph.nodesById, 'z'),
                });
            }
            Object.assign(lines, config);

            var customdata = edges.map(edge => edgeLineMarkerCustomData(edge, graph.nodesById));
            var markers = {
                    name: 'Edge Labels for '+ (type ? edgeLabel(type) : "Edges"),
                    type: 'scattergl',
                    mode: 'markers',
                    showlegend: false,
                    x: computeEdgeLineMarkers(edges, graph.nodesById, 'x'),
                    y: computeEdgeLineMarkers(edges, graph.nodesById, 'y'),
                    hovertemplate: EDGE_LINE_HOVERTEMPLATE,
                    customdata: computeLineMarkersData(customdata),
                    marker: {
                        color: (type ? colors: computeLineMarkersData(colors)),
                        symbol: edgeLineMarkerSymbol(graph),
                        size: 2,
                        opacity: DEFAULT_MARKER_OPACITY,
                        line: {
                            color: 'rgb(50,50,50)',
                            width: 0.5
                        },
                    },
            };
            if (graph.is3D) {
                Object.assign(markers, {
                    type: 'scatter3d',
                    z: computeEdgeLineMarkers(edges, graph.nodesById, 'z'),
                });
            }
            Object.assign(markers, config);

            return [lines, markers];
        }

        function traceMesh(graph, type, config) {
            var edges = graph.data.edges.filter(function(edge) {return type ? edge.value == type: true});
            var trace = {
                    name: 'Mesh Tentative (WIP)',
                    alphahull: 7,
                    opacity: 0.1,
                    type: 'mesh',
                    x: computeEdgeLines(edges, graph.nodesById, 'x'),
                    y: computeEdgeLines(edges, graph.nodesById, 'y'),
            };
            if (graph.is3D) {
                Object.assign(trace, {
                    type: 'mesh3d',
                    z: computeEdgeLines(edges, graph.nodesById, 'z'),
                });
            }
            Object.assign(trace, config);
            return trace;
        }

        function traceSelections(graph) {
            // create specific traces for selection
            var lines = {
                    name: TRACE_SELECT_NAME,
                    mode: 'lines',
                    type: 'scattergl',
                    legendgroup: TRACE_SELECT_NAME,
                    hoverinfo: 'none',
                    ids: [], // to be filled according to selection, useful to detect dupe selections
                    x: [], // to be filled according to selection
                    y: [], // to be filled according to selection
                    customdata: [], // to be filled according to selection
                    line: {
                        color: [], // to be filled according to selection
                        width: DEFAULT_EDGE_WIDTH,
                    },
            },
            markers = {
                    name: TRACE_SELECT_NAME + ' (Edge Labels)',
                    mode: 'markers+text',
                    type: 'scattergl',
                    legendgroup: TRACE_SELECT_NAME,
                    showlegend: false,
                    ids: [], // to be filled according to selection, useful to detect dupe selections
                    x: [], // to be filled according to selection
                    y: [], // to be filled according to selection
                    customdata: [], // to be filled according to selection
                    marker: {
                        text: [], // to be filled according to selection
                        hovertext: [], // to be filled according to selection
                        symbol: [], // to be filled according to selection
                        color: [], // to be filled according to selection
                        size: [], // to be filled according to selection
                        opacity: DEFAULT_MARKER_OPACITY,
                        line: {
                            color: 'rgb(50,50,50)',
                            width: 0.5
                        },
                    },
            };
            if (graph.is3D) {
                Object.assign(lines, {
                    type: 'scatter3d',
                    z: [], // to be filled according to selection
                });
                Object.assign(markers, {
                    type: 'scatter3d',
                    z: [], // to be filled according to selection
                });
            }
            return [lines, markers];
        }

        function clearSelections(graph) {
            setClearSelectionButtonVisible(graph.divid, false);
            // update selection traces with empty initial traces
            var traces = traceSelections(graph);
            // FIXME
            Plotly.update(graph.divid, traces, {}, TRACE_SELECT_INDEXES);
            console.log(document.getElementById(graph.divid).data);
            // highlight again all other traces
            setHighlightButtonActive(graph.divid, true);
            var tindexes = [...Array(document.getElementById(graph.divid).data.length).keys()].slice(TRACE_SELECT_INDEXES.length);
            Plotly.restyle(graph.divid, HIGHLIGHT_LAYOUT_UPDATE, tindexes);
        }

        function selectNode(graph, lines, markers, id, point, doTarget) {
            var markerTemplate = {
                    x: 0, // TBD
                    y: 0, // TBD
                    z: 0, // TBD
                    customdata: null, // TBD
                    text: null, // TBD
                    symbol: null, // TBD
                    color: null, // TBD
                    size: null, // TBD
            }

            if (point) {
                // get directly node text from it, as well as symbol, color, etc..
                // also consider only this marker needs to be annotated
                console.log("point: ", point);
            }

            if (!doTarget) {
                return;
            }


//          return {
//          type: 'node',
//          id: node.id,
//          label: node.label,
//          nodetype: node.type,
//          category: node.category,
//          };



            // resolve relations and maybe act as if each edge target had been clicked, depending on its type
        }

        function selectEdge(graph, lines, markers, id, point, doTarget) {
            var edge = graph.edgesById[id];
            if (!edge) {
                console.log("Invalid edge with id ", id);
                return;
            }
            var source = graph.nodesById[edge.source],
            target = graph.nodesById[edge.target];
            if (!source || !target) {
                console.log("Invalid edge with id ", id);
                return;
            }
            if (lines.ids.includes(id)) {
                console.log("Edge already selected: ", id);
                return;
            }

            // rebuild other info for new markers and lines
            var text, symbol, color, size, customdata, pointx;
            text = edgeLineMarkerText(edge, source, target);
            size = 2;
            if (point) {
                symbol = point.data.marker.symbol;
                // colors are sometimes adjusted on edges
                var colors = point.data.marker.color;
                color = Array.isArray(colors) ? colors[point.pointNumber] : colors;
                customdata = Object.assign({}, point.customdata, {'selected': true});
                pointx = point.x;
            } else {
                // recalculate information
                symbol = edgeLineMarkerSymbol(graph);
                color = edgeColor(edge.type);
                customdata = Object.assign({}, edgeLineMarkerCustomData(edge, graph.nodesById), {'selected': true});
            }

            // trace same edge than the one that was selected
            lines.ids.push('NXEdge' + id);
            lines.x.push(source.x, target.x, null);
            lines.y.push(source.y, target.y, null);
            if (graph.is3D) {
                lines.z.push(source.z, target.z, null);
            }
            lines.customdata.push(customdata);
            lines.line.color.push(color);

            // add again associated edge line markers, annotating the central one
            var markerFakeId = 'NXEdge' + id;
            markers.ids.push(markerFakeId, markerFakeId, markerFakeId);
            markers.x.push(...computeLineMarkers(source.x, target.x));
            markers.y.push(...computeLineMarkers(source.y, target.y));
            if (graph.is3D) {
                markers.z.push(...computeLineMarkers(source.z, target.z));
            }
            markers.customdata.push(...computeLineMarkersData([customdata]));
            // add text only on the middle one
            markers.marker.text.push('', text, '');
            markers.marker.hovertext.push(text, '', text);
            markers.marker.symbol.push(...computeLineMarkersData([symbol]));
            markers.marker.color.push(...computeLineMarkersData([color]));
            markers.marker.size.push(...computeLineMarkersData([size]));

            // handle source and target selection
//            selectNode(graph, lines, markers, edge.source, null, false);
//            selectNode(graph, lines, markers, edge.target, null, false);
        }




        function selectMarker(graph, point) {
            if (point.customdata.selected) {
                console.log("Marker already selected");
                return;
            }

            // retrieve customdata for selection, assume invalid selection if not avail
            var gd = document.getElementById(graph.divid);
            var lines = gd.data[TRACE_SELECT_INDEXES[0]];
            var markers = gd.data[TRACE_SELECT_INDEXES[1]];

            var selectedpoint = point;
            if (point.fake) {
                // handle bundle selection from outside the graph context
                selectedpoint = null;
            }
            var type = point.customdata.type;
            if (type == 'node') {
                selectNode(graph, lines, markers, point.customdata.id, selectedpoint, true);
            } else if (type = 'edgemarker') {
                selectEdge(graph, lines, markers, point.customdata.id, selectedpoint);
            } else {
                console.log('Unhandled selection of marker with type ', type);
                return;
            }

            setClearSelectionButtonVisible(graph.divid, true);
            // unhighlight all other traces
            setHighlightButtonActive(graph.divid, false);
            var tindexes = [...Array(document.getElementById(graph.divid).data.length).keys()].slice(TRACE_SELECT_INDEXES.length);
            Plotly.restyle(graph.divid, UNHIGHLIGHT_LAYOUT_UPDATE, tindexes);
            // update selection traces
            // FIXME
            Plotly.update(graph.divid, [lines, markers], {}, TRACE_SELECT_INDEXES);

            console.log("selection done");
        }

        function selectBundle(graph, bundle) {
            console.log("select bundle ", bundle);
            selectMarker(graph, {
                fake: true,
                customdata: {
                    type: 'node',
                    id: bundle,
                }
            });
        };

        function getUpdateMenus(data) {
            var menus = [];

            // restrict to 'non-selection' traces to avoid misbehavior on custom selection traces addition
            var tindexes = [...Array(data.length).keys()].slice(TRACE_SELECT_INDEXES.length);

            var msizes = data.slice(TRACE_SELECT_INDEXES.length).reduce(function(res, trace) {
                if ('marker' in trace) {
                    res.push(trace.marker.size);
                } else {
                    res.push([]);
                }
                return res;
            }, []);
            menus.push({
                type: 'buttons',
                x: 0.40, xanchor: 'left',
                // size is shown by default -> inactive
                active: -1,
                buttons: [{
                    label: 'Hide Node Sizes',
                    method: 'restyle',
                    // toggle args
                    args: ['marker.size', '6', tindexes],
                    args2: ['marker.size', msizes, tindexes],
                }],
            });

            menus.push({
                name: HIGHLIGHT_MENU_NAME,
                type: 'buttons',
                direction: 'down',
                x: 0.55, xanchor: 'center',
                // highlighted by default -> active
                active: 0,
                buttons: [{
                    label: 'Highlight Unselected',
                    method: 'restyle',
                    // FIXME: check if it works ok with this format
                    args: [HIGHLIGHT_LAYOUT_UPDATE, tindexes],
                    args2: [UNHIGHLIGHT_LAYOUT_UPDATE, tindexes],
                }],
            });

            menus.push({
                name: TRACE_SELECT_NAME,
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

            // TODO: package selection (?) Plotly menus are not user-friendly with large data...

            return menus;
        }

        function setHighlightButtonActive(graphDiv, active) {
            var gd = document.getElementById(graphDiv);
            for (var menu of gd.layout.updatemenus) {
                if (menu.name == HIGHLIGHT_MENU_NAME) {
                    menu.active = active ? 0 : -1;
                    break;
                }
            }
        }

        function setClearSelectionButtonVisible(graphDiv, visible) {
            var gd = document.getElementById(graphDiv);
            for (var menu of gd.layout.updatemenus) {
                if (menu.name == TRACE_SELECT_NAME) {
                    menu.visible = visible;
                    break;
                }
            }
        }

        function initBundleSelect(graph, bundles, options) {
            if (!options.bundleselector) {
                return;
            }
            var gd = document.getElementById(graph.divid);
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
                if (!options.selectedbundles.includes(selector.value)) {
                    options.selectedbundles.push(selector.value);
                    selectBundle(graph, selector.value);
                }
            }, false);

            // keep track of selected bundles in options, to avoid tracking them again through here
            options.selectedbundles = [];
            // init selection based on current value too
            var selected = options.selectedbundle;
            if (selected) {
                options.selectedbundles.push(selected);
                selectBundle(graph, selected);
            }

            return selector;
        }

        function renderCirc(graphDiv, fig, options) {
            // TODO
        }

        function renderBasic(graphDiv, fig, options) {
            var is3D = graphType(fig.type) === '3d';
            var nodesById = fig.nodes.reduce(function(map, node) {
                map[node.id] = node;
                return map;
            }, {});
            // assign ids to edges for easier management in selection, if missing, and fill references in edgesByNodeId map
            var edgesByNodeId = {},
            edgesById = {};
            for (var i = 0; i < fig.edges.length; i++) {
                var edge = fig.edges[i];
                edge.id = i;
                edgesById[edge.id] = edge;
                if (!edgesByNodeId[edge.source]) {
                    edgesByNodeId[edge.source] = [];
                }
                edgesByNodeId[edge.source].push(edge.id);
                if (!edgesByNodeId[edge.target]) {
                    edgesByNodeId[edge.target] = [];
                }
                edgesByNodeId[edge.target].push(edge.id);
            }
            // wrap these helpers inside a graph object
            var graph = {
                    'divid': graphDiv,
                    'is3D': is3D,
                    'nodesById': nodesById,
                    'edgesById': edgesById,
                    'edgesByNodeId': edgesByNodeId,
                    'data': fig,
            }

            var data = [
                // selection traces, at index specified by TRACE_SELECT_INDEXES
                ...traceSelections(graph),
                // groups of nodes and edges, grouped depending on runtime logics
                ...traceNodes(graph, 'BUNDLE', {legendgroup: 'bundles'}),
                ...traceEdges(graph, 'REQUIRES', {legendgroup: 'bundles'}),
                ...traceNodes(graph, 'COMPONENT', {legendgroup: 'components'}),
                ...traceEdges(graph, 'SOFT_REQUIRES', {legendgroup: 'components'}),
                ...traceNodes(graph, 'EXTENSION_POINT', {legendgroup: 'xps'}),
                ...traceNodes(graph, 'CONTRIBUTION', {legendgroup: 'xps'}),
                ...traceEdges(graph, 'REFERENCES', {legendgroup: 'xps'}),
                ];

            // push another set of traces for containment (seems to be more efficient than using the 'groupby' transform)
            var containsconf = {
                    legendgroup: 'contains',
                    visible: 'legendonly',
            }
            for (var type of Object.keys(NODE_TYPES)) {
                data.push(...traceNodes(graph, type, containsconf));
            }
            data = data.concat([
                ...traceEdges(graph, 'CONTAINS', containsconf),
                //traceMesh(graph, 'CONTAINS', Object.assign({}, containsconf, {
                //    name: 'Mesh Tentative (WIP)',
                //})),
                ]);

            // now that plot is created, empty original data in graph, passed on to listeners
            delete graph.data;

            var title = `<b>${fig.title}</b>`;
            if (options.datasourcetitle) {
                title += ` (${options.datasourcetitle})`;
            }
            if (fig.description) {
                title += `<br><i>${fig.description}</i>`;
            }
            var template = {layout: getBasicLayout(title, is3D)};
            var layout = {
                    template: template,
                    updatemenus: getUpdateMenus(data),
                    responsive: true,
            };

            console.log(graph);
            console.log(data);
            // plot creation
            Plotly.newPlot(graphDiv, data, layout, {responsive: true});

            // init and hook bundle selection
            // disabled for now: makes the page freeze for some reason
            // var bundles = fig.nodes.filter(function(node) {return node.type == 'BUNDLE'});
            // initBundleSelect(graph, bundles, options);

            // events management
            var gd = document.getElementById(graphDiv);
            // avoid recursion bug, see https://github.com/plotly/plotly.js/issues/1025
            var clickCalled = false;
            gd.on('plotly_click', function(data) {
                console.log(data);
                if (!clickCalled) {
                    clickCalled = true;
                    var point = data.points[0];
                    if (point.customdata) {
                        selectMarker(graph, point);
                    }
                    clickCalled = false;
                }
            });
            // custom menus management
            gd.on('plotly_buttonclicked', function(data) {
                if (data.menu.name == TRACE_SELECT_NAME) {
                    clearSelections(graph);
                };
            });
        }

        return _plot;

    }

    if (typeof (window.NXPlotly) === 'undefined') {
        window.NXPlotly = NXPlotly();
    }
})(window);