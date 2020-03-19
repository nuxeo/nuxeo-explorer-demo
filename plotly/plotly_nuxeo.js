(function(window) {
    'use strict';

    function NXPlotly() {

        var _plot = {};

        const DEFAULT_LINE_WIDTH = 3;
        const DEFAULT_MARKER_OPACITY = 0.8;
        const TRACE_SELECT_NAME = 'Current Selection';

        const graphType = (type) => ({
            'BASIC_LAYOUT': '2d',
            'BASIC_LAYOUT_3D': '3d',
        })[type];

        _plot.render = function(graph, options) {
            var datasource = options.datasource;
            if (!datasource) {
                alert("No datasource");
            }
            Plotly.d3.json(datasource, function(err, fig) {
                if (err) {
                    alert("Error retrieving json data");
                    return;
                }
                if (graphType(fig.type) == undefined) {
                    console.alert("Unsupported graph type " + fig.type);
                }
                if (options.circ) {
                    renderCirc(graph, fig, options);
                } else {
                    renderBasic(graph, fig, options);
                }
            });
        };

        function is3DGraph(type) {
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

        function nodeMarkerText(node) {
            return `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}`;
        };

        // info to be parsed on node marker selection
        function nodeMarkerInfo(node) {
            return {
                type: 'node',
                id: node.id,
            };
        }

        function nodeWeight(weight) {
            return (weight) ? weight*5 : 5;
        }

        function edgeLineMarkerText(edge, nodesById) {
            return `${nodesById[edge.source]['label']} <b>${edge.value}</b> ${nodesById[edge.target]['label']}`;
        };

        // info to be parsed on edge line marker selection
        function edgeLineMarkerInfo(edge) {
            return {
                type: 'edgemarker',
                id: edge.id,
            };
        }

        function getLayout(title, is3D, config) {
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

            if (is3D) {
                scene.zaxis = axis;
            }
            Object.assign(layout, config);
            if (is3D) {
                layout.scene = scene;
            } else {
                // axis directly on layout, outside of scene, in 2D
                Object.assign(layout, scene);
            }
            layout.legend = Object.assign({}, legend, config.legend);
            return layout;
        }

        function traceNodes(graphObject, type, config) {
            var nodes = graphObject.data.nodes.filter(function(node) {return type ? node.type == type: true});
            var trace = {
                    name: (type ? nodeLabel(type) : "Nodes"),
                    mode: 'markers',
                    type: 'scatter',
                    x: nodes.map(node => node.x),
                    y: nodes.map(node => node.y),
                    hoverinfo: 'text',
                    text: nodes.map(node => nodeMarkerText(node)),
                    customdata: nodes.map(node => nodeMarkerInfo(node)),
            };
            if (graphObject.is3D) {
                Object.assign(trace, {
                    type: 'scatter3d',
                    z: nodes.map(node => node.z)
                });
            }
            Object.assign(trace, config);
            var marker = {
                    symbol: (type ? nodeSymbol(type) : nodes.map(node => nodeSymbol(node.type))),
                    color: nodes.map(node => nodeColor(node.category)),
                    colorscale: 'Viridis',
                    size: nodes.map(node => nodeWeight(node.weight)),
                    opacity: DEFAULT_MARKER_OPACITY,
                    line: {
                        color: 'rgb(50,50,50)',
                        width: 0.5
                    },
            };
            trace.marker = Object.assign({}, marker, config.marker);
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

        function traceEdges(graphObject, type, config) {
            var edges = graphObject.data.edges.filter(function(edge) {return type ? edge.value == type : true});
            var lines = {
                    name: (type ? edgeLabel(type) : "Edges"),
                    mode: 'lines',
                    type: 'scattergl',
                    x: computeEdgeLines(edges, graphObject.nodesById, 'x'),
                    y: computeEdgeLines(edges, graphObject.nodesById, 'y'),
                    hoverinfo: 'none',
            };
            if (graphObject.is3D) {
                Object.assign(lines, {
                    type: 'scatter3d',
                    z: computeEdgeLines(edges, graphObject.nodesById, 'z'),
                });
            }
            Object.assign(lines, config);
            var colors =  (type ? edgeColor(type) : edges.map(edge => edgeColor(edge.value)));
            var line = {
                    color: colors,
                    width: DEFAULT_LINE_WIDTH,
            };
            lines.line = Object.assign({}, line, config.line);

            var labels = edges.map(edge => edgeLineMarkerText(edge, graphObject.nodesById));
            var selecthelpers = edges.map(edge => edgeLineMarkerInfo(edge));
            var markers = {
                    name: 'Edge Labels for '+ (type ? edgeLabel(type) : "Edges"),
                    mode: 'markers',
                    text: computeLineMarkersData(labels),
                    customdata: computeLineMarkersData(selecthelpers),
                    type: 'scattergl',
                    showlegend: false,
                    x: computeEdgeLineMarkers(edges, graphObject.nodesById, 'x'),
                    y: computeEdgeLineMarkers(edges, graphObject.nodesById, 'y'),
                    hoverinfo: 'text',
                    marker: {
                        symbol: graphObject.is3D ? 'circle' : 'triangle-right',
                                // adapt the following to intermediate nodes additions
                                color: (type ? colors: computeLineMarkersData(colors)),
                                size: 2,
                                opacity: DEFAULT_MARKER_OPACITY,
                    },
            };
            if (graphObject.is3D) {
                Object.assign(markers, {
                    type: 'scatter3d',
                    z: computeEdgeLineMarkers(edges, graphObject.nodesById, 'z'),
                });
            }
            Object.assign(markers, config);
            var labelline = {
                    color: 'rgb(50,50,50)',
                    width: 0.5
            };
            markers.marker.line = Object.assign({}, labelline, config.line);

            return [lines, markers];
        }

        function traceMesh(graphObject, type, config) {
            var edges = graphObject.data.edges.filter(function(edge) {return type ? edge.value == type: true});
            var trace = {
                    name: 'Mesh Tentative (WIP)',
                    alphahull: 7,
                    opacity: 0.1,
                    type: 'mesh',
                    x: computeEdgeLines(edges, graphObject.nodesById, 'x'),
                    y: computeEdgeLines(edges, graphObject.nodesById, 'y'),
            };
            if (graphObject.is3D) {
                Object.assign(trace, {
                    type: 'mesh3d',
                    z: computeEdgeLines(edges, graphObject.nodesById, 'z'),
                });
            }
            Object.assign(trace, config);
            return trace;
        }

        function getUpdateMenus(graph, data) {
            var menus = [];

            var msizes = data.reduce(function(res, trace) {
                if ('marker' in trace) {
                    res.push(trace.marker.size);
                } else {
                    res.push([]);
                }
                return res;
            }, []);
            // restrict to current traces to avoid misbehavior on custom selection traces addition
            var tindexes = [...Array(data.length).keys()];
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
                type: 'dropdown',
                direction: 'down',
                x: 0.55, xanchor: 'center',
                buttons: [{
                    label: 'Unhighlight',
                    method: 'restyle',
                    args: [{'marker.opacity': 0.1, 'line.width': 0.1}],
                }, {
                    label: 'Highlight',
                    method: 'restyle',
                    args: [{'marker.opacity': DEFAULT_MARKER_OPACITY, 'line.width': DEFAULT_LINE_WIDTH}],
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

        function setClearSelectionButtonVisible(graph, visible) {
            var gd = document.getElementById(graph);
            for (var menu of gd.layout.updatemenus) {
                if (menu.name == TRACE_SELECT_NAME) {
                    menu.visible = visible;
                    break;
                }
            }
        }

        function initSelectTraces(graph, is3D) {
            // create specific traces for selection
            var lines = {
                    name: TRACE_SELECT_NAME,
                    mode: 'lines',
                    type: 'scattergl',
                    legendgroup: TRACE_SELECT_NAME,
                    hoverinfo: 'none',
                    x: [], // to be filled according to selection
                    y: [], // to be filled according to selection
                    z: [], // to be filled according to selection
                    customdata: [], // to be filled according to selection
                    line: {
                        color: [], // to be filled according to selection
                        width: DEFAULT_LINE_WIDTH,
                    },
            },
            markers = {
                    name: TRACE_SELECT_NAME + '(Edge Labels)',
                    mode: 'markers+text',
                    type: 'scattergl',
                    legendgroup: TRACE_SELECT_NAME,
                    showlegend: false,
                    hoverinfo: 'text',
                    x: [], // to be filled according to selection
                    y: [], // to be filled according to selection
                    z: [], // to be filled according to selection
                    customdata: [], // to be filled according to selection
                    marker: {
                        text: [], // to be filled according to selection
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
            if (is3D) {
                lines['type'] = 'scatter3d';
                markers['type'] = 'scatter3d';
            }
            return [lines, markers];
        }

        // should return [0, 1] on selection, [] otherwise
        function getSelectionTraceIndexes(graph) {
            var gd = document.getElementById(graph);
            var tindexes = [];
            for (var i = 0; i < gd.data.length; i++) {
                if ((gd.data[i].name) && gd.data[i].name.startsWith(TRACE_SELECT_NAME)) {
                    tindexes.push(i);
                } else {
                    // do not bother going further: selection traces are prepended
                    break;
                }
            }
            return tindexes;
        }

        function clearSelections(graph) {
            setClearSelectionButtonVisible(graph, false);
            Plotly.deleteTraces(graph, getSelectionTraceIndexes(graph));
            // highlight again all traces
            Plotly.restyle(graph, {'marker.opacity': DEFAULT_MARKER_OPACITY, 'line.width': DEFAULT_LINE_WIDTH});
        }


        function selectNode(graphObject, lines, markers, id, point, propagate) {
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

            if (!propagate) {
                return;
            }

            // resolve relations and maybe act as if each edge target had been clicked, depending on its type
        }

        function selectEdge(graphObject, lines, markers, id, point) {
            var lineTemplate = {
                    x: 0, // TBD
                    y: 0, // TBD
                    z: 0, // TBD
                    customdata: null, // TBD
                    color: null, // TBD
            }
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
            var edge = graphObject.edgesById[id];
            if (!edge) {
                console.log("Edge not found: " + id);
                return;
            }

            if (point) {
                // get directly node text from it, as well as symbol, color, etc..
                // also consider only this marker needs to be annotated
                console.log("point: ", point);
                markerTemplate.text = point.text;
            }

            // trace same edge than the one that triggered the click

            // push same intermediate nodes with same text than the triggered one on the middle-edge marker only

            // add edge to the selection trace, annotate source and target markers, and annotate central edge marker
            // too

            // handle source and target selection
            selectNode(graphObject, lines, markers, edge.source, null, false);
            selectNode(graphObject, lines, markers, edge.target, null, false);
        }

        function selectMarker(graphObject, point) {
            var tindexes = getSelectionTraceIndexes(graphObject.graph),
            created = tindexes.length > 1;

            var lines, markers;
            if (created) {
                // fetch existing traces
                var gd = document.getElementById(graphObject.graph);
                lines = gd.data[tindexes[0]];
                markers = gd.data[tindexes[1]];
            } else {
                var traces = initSelectTraces(graphObject.graph, graphObject.is3D);
                lines = traces[0], markers = traces[1];
            }

            if (point.customdata.selected) {
                console.log("Marker already selected");
                return;
            }

            // retrieve customdata for selection, assume invalid selection if not avail
            var type = point.customdata.type;
            if (type == 'node') {
                selectNode(graphObject, lines, markers, point.customdata.id, point, true);
            } else if (type = 'edgemarker') {
                selectEdge(graphObject, lines, markers, point.customdata.id, point);
            } else {
                console.log('Unhandled selection of marker with type ', type);
                return;
            }

            if (created) {
                Plotly.update(graphObject.graph, [lines, markers], 0);
            } else {
                // cleanup any potential remnant // should not happen
                Plotly.deleteTraces(graphObject.graph, tindexes);
                setClearSelectionButtonVisible(graphObject.graph, true);
                // unhighlight all other traces first
                Plotly.restyle(graphObject.graph, {'marker.opacity': 0.1, 'line.width': 0.1});
                // add them to beginning of traces, lines first
                Plotly.addTraces(graphObject.graph, markers, 0);
                Plotly.addTraces(graphObject.graph, lines, 0);
            }

            console.log("selection done");
        }

        function selectBundle(graphObject, bundle) {
            console.log("select bundle ", bundle);
            selectMarker(graphObject, {
                customdata: nodeMarkerInfo({node: bundle}),
            });
        };

        function initBundleSelect(graphObject, bundles, options) {
            if (!options.bundleselector) {
                return;
            }
            var gd = document.getElementById(graphObject.graph);
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
                    selectBundle(graphObject, selector.value);
                }
            }, false);

            // keep track of selected bundles in options, to avoid tracking them again through here
            options.selectedbundles = [];
            // init selection based on current value too
            var selected = options.selectedbundle;
            if (selected) {
                options.selectedbundles.push(selected);
                selectBundle(graphObject, selected);
            }

            return selector;
        }

        function renderCirc(graph, fig, options) {
            // TODO
        }

        function renderBasic(graph, fig, options) {
            var is3D = is3DGraph(fig.type),
            nodesById = fig.nodes.reduce(function(map, node) {
                map[node.id] = node;
                return map;
            }, {});
            // assign ids to edges for easier management in selection, if missing, and fill references in edgesByNodeId map
            var edgesByNodeId = {},
            edgesById = {};
            for (var i = 0; i < fig.edges.length; i++) {
                var edge = fig.edges[i];
                if (!(edge.id)) {
                    edge.id = i;
                }
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
            // wrap these helpers inside a graphObject, to be sent to methods
            var graphObject = {
                    'graph': graph,
                    'is3D': is3D,
                    'nodesById': nodesById,
                    'edgesById': edgesById,
                    'edgesByNodeId': edgesByNodeId,
                    'data': fig,
            }

            var containsconf = {
                    legendgroup: 'contains',
                    visible: 'legendonly',
            }
            var data = [
                ...traceNodes(graphObject, 'BUNDLE', {legendgroup: 'bundles'}),
                ...traceEdges(graphObject, 'REQUIRES', {legendgroup: 'bundles'}),
                ...traceNodes(graphObject, 'COMPONENT', {legendgroup: 'components'}),
                ...traceEdges(graphObject, 'SOFT_REQUIRES', {legendgroup: 'components'}),
                ...traceNodes(graphObject, 'EXTENSION_POINT', {legendgroup: 'xps'}),
                ...traceNodes(graphObject, 'CONTRIBUTION', {legendgroup: 'xps'}),
                ...traceEdges(graphObject, 'REFERENCES', {legendgroup: 'xps'}),
                ];

            // another set of traces for containment, seems to be more efficient than 'groupby' transform
            for (var type of nodeTypes) {
                data.push(...traceNodes(graphObject, type, containsconf));
            }
            data = data.concat([
                ...traceEdges(graphObject, 'CONTAINS', containsconf),
                //traceMesh(graphObject, 'CONTAINS', Object.assign({}, containsconf, {
                //    name: 'Mesh Tentative (WIP)',
                //})),
                ]);

            var title = `<b>${fig.title}</b>`;
            if (options.datasourcetitle) {
                title += ` (${options.datasourcetitle})`;
            }
            if (fig.description) {
                title += `<br><i>${fig.description}</i>`;
            }
            var layout = getLayout(title, is3D, {
                updatemenus: getUpdateMenus(graph, data),
            });

            Plotly.newPlot(graph, data, layout, {responsive: true});

            // now that plot is created, empty original data in graphObject, passed on to listeners
            delete graphObject.data;

            // init and hook bundle selection
            // disabled for now: makes the page freeze for some reason
            // var bundles = fig.nodes.filter(function(node) {return node.type == 'BUNDLE'});
            // initBundleSelect(graphObject, bundles, options);

            // events management
            var gd = document.getElementById(graph);
            // avoid recursion bug, see https://github.com/plotly/plotly.js/issues/1025
            var clickCalled = false;
            gd.on('plotly_click', function(data) {
                if (!clickCalled) {
                    clickCalled = true;
                    var point = data.points[0];
                    if (point.customdata) {
                        selectMarker(graphObject, point);
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