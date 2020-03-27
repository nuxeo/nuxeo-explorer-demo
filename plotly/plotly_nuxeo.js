(function (window) {
    'use strict';

    function NXPlotly() {

        var _plot = {};

        const UNSELECTED_COLOR = 'white';
        const MARKER_OPACITY = {
            DEFAULT: 1,
            UNSELECTED: 0.1,
        }
        const MARKER_TYPES = {
            NODE: 'node',
            EDGE: 'edge',
        }
        const TRACE_TYPES = {
            NODE: 'nodes',
            EDGE: 'edges',
        }

        const MENUS = {
            NODE_SIZE_MENU: {
                name: 'NodeSizeMenu',
                label: 'Hide Node Sizes',
            },
            HIGHLIGHT_MENU: {
                name: 'HighlightMenu',
                label: 'Highlight Unselected',
            },
            SELECT_MENU: {
                name: 'SelectMenu',
                label: 'Clear Selections',
            },
        };
        const menuName = (id) => MENUS[id]['name'];
        const menuLabel = (id) => MENUS[id]['label'];

        const graphType = (type) => ({
            BASIC_LAYOUT: '2d',
            BASIC_LAYOUT_3D: '3d',
        })[type];

        const graphElement = (graphDiv) => document.getElementById(graphDiv);

        const NODE_TYPES = {
            BUNDLE: {
                label: 'Bundles',
                symbol: 'diamond',
            },
            COMPONENT: {
                label: 'Components',
                symbol: 'square',
            },
            SERVICE: {
                label: 'Services',
                symbol: 'diamond-open',
            },
            EXTENSION_POINT: {
                label: 'Extension Points',
                symbol: 'cross',
            },
            CONTRIBUTION: {
                label: 'Contributions',
                symbol: 'circle',
            },
        };
        const nodeLabel = (type) => NODE_TYPES[type]['label'];
        const nodeSymbol = (type) => NODE_TYPES[type]['symbol'];
        const nodeWeight = (weight) => (weight) ? weight * 5 : 5;

        // hardcode Viridis colorscale for easier retrieval from custom code (maybe can acccess ColorScale features directly (?)
        const NODE_CATEGORY_CMIN = 0;
        const NODE_CATEGORY_CMAX = 3;
        //const NODE_CATEGORY_COLORSCALE = 'Viridis';[
        const NODE_CATEGORY_COLORSCALE = [
            [0, '#440154'], [0.06274509803921569, '#48186a'],
            [0.12549019607843137, '#472d7b'], [0.18823529411764706, '#424086'],
            [0.25098039215686274, '#3b528b'], [0.3137254901960784, '#33638d'],
            [0.3764705882352941, '#2c728e'], [0.4392156862745098, '#26828e'],
            [0.5019607843137255, '#21918c'], [0.5647058823529412, '#1fa088'],
            [0.6274509803921569, '#28ae80'], [0.6901960784313725, '#3fbc73'],
            [0.7529411764705882, '#5ec962'], [0.8156862745098039, '#84d44b'],
            [0.8784313725490196, '#addc30'], [0.9411764705882353, '#d8e219'],
            [1, '#fde725']
        ];

        // XXX: find a better way to do that maybe...
        const colorFromScale = (value) => {
            var scolor = value / (NODE_CATEGORY_CMAX - NODE_CATEGORY_CMIN);
            for (var item of NODE_CATEGORY_COLORSCALE) {
                if (scolor <= item[0]) {
                    return item[1];
                }
            }
            return null;
        }

        const nodeColor = (category) => ({
            RUNTIME: colorFromScale(0),
            CORE: colorFromScale(1),
            PLATFORM: colorFromScale(2),
            STUDIO: colorFromScale(3),
        })[category];

        const EDGE_TYPES = {
            REQUIRES: {
                label: 'Requires Bundle',
                color: '#FFA500', // Orange
            },
            SOFT_REQUIRES: {
                label: 'Requires Component',
                color: '#FFD700', // Gold
            },
            REFERENCES: {
                label: 'Contributes to Extension Point',
                color: '#8FBC8F', // DarkSeaGreen
            },
            CONTAINS: {
                label: 'Contains',
                color: '#87CEFA', // LightSkyBlue
            }
        };
        const edgeLabel = (value) => EDGE_TYPES[value]['label'];
        const edgeColor = (value) => EDGE_TYPES[value]['color'];
        const edgeLineMarkerSymbol = (nxgraph) => (nxgraph.is3D ? 'circle' : 'hexagon');
        const edgeLineMarkerSize = (nxgraph) => (nxgraph.is3D ? 2 : 5);

        const HOVERTEMPLATE = "%{customdata.annotation}<extra></extra>";
        const nodeMarkerAnnotation = (node) => `<b>${node.label}</b><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}`;
        const edgeLineMarkerAnnotation = (edge, source, target) => `${source.label}<br /><b>${edge.value}</b><br />${target.label}`;

        _plot.render = function (graphDiv, options) {
            var datasource = options.datasource;
            if (!datasource) {
                alert("No datasource");
                return;
            }
            Plotly.d3.json(datasource, function (err, fig) {
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

        // initial rendering
        function getBasicLayout(nxgraph) {
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

            var title = `<b>${nxgraph.fig.title}</b>`;
            if (nxgraph.options.datasourcetitle) {
                title += ` (${nxgraph.options.datasourcetitle})`;
            }
            if (nxgraph.fig.description) {
                title += `<br><i>${nxgraph.fig.description}</i>`;
            }

            var layout = {
                title: { text: title },
                showlegend: true,
                hovermode: 'closest',
                hoverdistance: 50, // no effect on 3d...
                paper_bgcolor: '#eee',
                width: 2000,
                height: 2000,
                legend: {
                    borderwidth: 1,
                    bgcolor: '#fff',
                    tracegroupgap: 30,
                },
            };

            if (nxgraph.is3D) {
                Object.assign(scene, {
                    zaxis: axis,
                    camera: {
                        // default camera eye: 1.25, 1.25, 1.25
                        eye: { x: 0.8, y: 2, z: 0.8 }
                    }
                });
                Object.assign(layout, { scene: scene });
            } else {
                // axis directly on layout, outside of scene, in 2D
                Object.assign(layout, scene);
            }
            return layout;
        }

        function getNodeMarkerCustomData(nxgraph, node) {
            // resolve dependencies to highlight when selecting this node
            // XXX: depending on node type and each related edge value, resolve some references here or not, maybe?
            var links = nxgraph.edgesByNodeId[node.id];
            var data = {
                markertype: MARKER_TYPES.NODE,
                id: node.id,
                annotation: nodeMarkerAnnotation(node),
                links: links,
            };
            return data;
        }

        function getEdgeLineMarkerCustomData(nxgraph, edge) {
            // resolve dependencies to highlight when selecting this edge
            var links = [edge.source, edge.target];
            var source = nxgraph.nodesById[edge.source],
                target = nxgraph.nodesById[edge.target];
            var data = {
                markertype: MARKER_TYPES.EDGE,
                id: edge.id,
                annotation: edgeLineMarkerAnnotation(edge, source, target),
                links: links,
            };
            return data;
        }

        function createFakePoint(id, isNode) {
            return {
                fake: true,
                customdata: {
                    markertype: (isNode ? MARKER_TYPES.NODE : MARKER_TYPES.EDGE),
                    id: id,
                }
            };
        };

        function getNodeTrace(nxgraph, type, config) {
            var nodes = nxgraph.fig.nodes.filter(function (node) { return type ? node.type == type : true });
            var references = nodes.reduce(function (map, node, index) {
                map[node.id] = [index];
                return map;
            }, {});
            var colors = nodes.map(node => nodeColor(node.category));
            var trace = {
                name: `<b>${type ? nodeLabel(type) : "Nodes"}</b>`,
                type: 'scatter',
                mode: 'markers',
                x: nodes.map(node => node.x),
                y: nodes.map(node => node.y),
                hovertemplate: HOVERTEMPLATE,
                hoverlabel: { font: { size: 20 } },
                customdata: nodes.map(node => getNodeMarkerCustomData(nxgraph, node)),
                marker: {
                    symbol: (type ? nodeSymbol(type) : nodes.map(node => nodeSymbol(node.type))),
                    size: nodes.map(node => nodeWeight(node.weight)),
                    // XXX: color is not shared with hover background in 3D...
                    color: colors, // to be changed on selection/highlight in 3D
                    opacity: MARKER_OPACITY.DEFAULT, // to be changed on selection/highlight in 2D
                    line: {
                        color: 'rgb(50,50,50)',
                        width: 0.5
                    },
                },
                // additional custom trace info
                tracetype: TRACE_TYPES.NODE,
                references: references,
                selectedindexes: [],
                originalcolors: colors, // keep original colors to handle selections and annotations
            };
            if (nxgraph.is3D) {
                Object.assign(trace, {
                    'type': 'scatter3d',
                    'z': nodes.map(node => node.z),

                });
            }
            Object.assign(trace, config);
            return [trace];
        }

        // use markers instead of lines because of restrictions on lines (color + width + marker opacity)
        function getEdgeTrace(nxgraph, type, config) {
            var edges = nxgraph.fig.edges.filter(function (edge) { return type ? edge.value == type : true });
            var nbiterations = 4;
            var x = computeEdgeLineMarkers(edges, nxgraph.nodesById, 'x', nbiterations); // will server as final size reference
            var nbpoints = x.length / edges.length;
            var mreferences = edges.reduce(function (map, edge, index) {
                map[edge.id] = [...Array(nbpoints).keys()].map(i => index * nbpoints + i);
                return map;
            }, {});
            var customdata = edges.map(edge => getEdgeLineMarkerCustomData(nxgraph, edge));
            var colors = type ? edgeColor(type) : edges.map(edge => edgeColor(edge.value));
            var allcolors = (type ? colors : computeLineMarkersData(colors, nbpoints));
            var name = (type ? edgeLabel(type) : "Edges");
            if (type) {
                name = `<b><span style="color:${edgeColor(type)}">${name}</span></b>`;
            }
            var markers = {
                name: name,
                type: 'scattergl',
                mode: 'markers',
                x: x,
                y: computeEdgeLineMarkers(edges, nxgraph.nodesById, 'y', nbiterations),
                hovertemplate: HOVERTEMPLATE,
                hoverlabel: { font: { size: 20 } },
                customdata: computeLineMarkersData(customdata, nbpoints),
                marker: {
                    symbol: edgeLineMarkerSymbol(nxgraph),
                    color: allcolors, // to be changed on selection/highlight
                    size: edgeLineMarkerSize(nxgraph),
                    line: {
                        color: 'rgb(50,50,50)',
                        width: 0.3,
                    },
                },
                // additional custom trace info
                tracetype: TRACE_TYPES.EDGE,
                references: mreferences,
                selectedindexes: [],
                originalcolors: allcolors, // keep original colors to handle selections and annotations
            };
            if (nxgraph.is3D) {
                Object.assign(markers, {
                    type: 'scatter3d',
                    z: computeEdgeLineMarkers(edges, nxgraph.nodesById, 'z', nbiterations),


                });
            }
            Object.assign(markers, config);
            return [markers];
        }

        function computeEdgeLines(edges, nodesById, axis) {
            return edges.reduce(function (res, edge) {
                res.push(nodesById[edge.source][axis], nodesById[edge.target][axis], null);
                return res;
            }, []);
        }

        // helps building an additional trace to show marker points on relations for better text on hover
        function computeEdgeLineMarkers(edges, nodesById, axis, nbiterations) {
            return edges.reduce(function (res, edge) {
                res.push(...midpoints(nodesById[edge.source][axis], nodesById[edge.target][axis], 0, nbiterations));
                return res;
            }, []);
        }

        // adapt other data content to line markers multiplication thanks to above logics
        function computeLineMarkersData(data, nbpoints) {
            return data.reduce(function (res, item) {
                res.push(...Array(nbpoints).fill(item));
                return res;
            }, []);
        }

        function midpoints(a, b, iteration, nbmax) {
            var res = [];
            if (iteration > nbmax) {
                return res;
            }
            var m = midpoint(a, b);
            res.push(m);
            res.push(...midpoints(a, m, iteration + 1, nbmax));
            res.push(...midpoints(m, b, iteration + 1, nbmax));
            return res;
        }

        function midpoint(sourceaxis, targetaxis) {
            return (sourceaxis + targetaxis) / 2;
        }

        // selection management

        function getSelectionInfo(lnxgraph, id, trace, traceindex, toggle) {
            var indexes = trace.references[id];
            if (!indexes) {
                return null;
            }
            var index = indexes[0];
            if (trace.tracetype == TRACE_TYPES.EDGE) {
                // annotate the middle marker
                index = indexes[parseInt(indexes.length / 2) + 1];
            }
            var info = {
                x: trace.x[index],
                y: trace.y[index],
                links: trace.customdata[index].links,
                visible: trace.visible === true || trace.visible === undefined,
                traceindexes: [traceindex],
            }
            if (lnxgraph.is3D) {
                Object.assign(info, { z: trace.z[index] });
            }
            if (!toggle) {
                // fill up other info that will be useful for annotation creation
                Object.assign(info, {
                    annotationtext: trace.customdata[index].annotation,
                    isEdge: trace.tracetype != TRACE_TYPES.NODE, // XX: flat edges should not be flagged as is maybe
                    isFlatEdge: trace.isFlatEdge == true,
                });
                var color = trace.originalcolors;
                if (Array.isArray(color)) {
                    color = trace.originalcolors[index];
                }
                if (trace.tracetype == TRACE_TYPES.NODE) {
                    var textcolor = color > 1 ? 'black' : 'white';
                    Object.assign(info, { color: color, textcolor: textcolor });
                } else {
                    Object.assign(info, { color: color, textcolor: 'black' });
                }
            }
            //console.log("selection info for " + id + ": ", info);
            return info;
        }

        // change selected points and relations to:
        // - udpate colors on nodes (handling rgb opacity in 3D)
        // - update width on edges (on 2D)
        // - show corresponding annotations on the fly
        function selectPoint(lnxgraph, point) {
            var isFirstSelection = lnxgraph.selected.length == 0;
            if (isFirstSelection) {
                setClearSelectionsButtonVisible(lnxgraph.div, true);
            }
            var traces = graphElement(lnxgraph.div).data;
            var traceupdates = traces.reduce(function (res, trace) {
                if (trace.selectedindexes) {
                    res.push([...trace.selectedindexes]);
                } else {
                    res.push([]);
                }
                return res;
            }, []);
            var update = {
                traces: traces,
                annotations: getInitialAnnotations(lnxgraph),
                traceupdates: traceupdates,
            };
            selectPointRecursive(lnxgraph, update, point, true);
            var dataUpdate = { selectedindexes: update.traceupdates };
            var layoutUpdate = getAnnotationsLayoutUpdate(lnxgraph, update.annotations);
            var traceIndices = [...Array(traceupdates.length).keys()];
            Plotly.update(lnxgraph.div, dataUpdate, layoutUpdate, traceIndices);
            // maybe highlight new selections
            if (!isHighlightButtonActive(lnxgraph.div)) {
                highlightUnselected(lnxgraph, false);
            }
        }

        function selectPointRecursive(lnxgraph, update, point, doTarget) {
            //console.log("selectPointRecursive: ", point);
            var id = point.customdata.id,
                toggle = lnxgraph.selected.includes(id);
            if (toggle) {
                lnxgraph.selected.splice(lnxgraph.selected.indexOf(id), 1);
            } else {
                lnxgraph.selected.push(id);
            }

            var sinfo = null;
            // for each trace, get the element index for this node, and perform selection
            for (var ti = 0; ti < update.traces.length; ti++) {
                var trace = update.traces[ti];
                var indexes = trace.references[id];
                if (indexes) {
                    if (sinfo == null) {
                        sinfo = getSelectionInfo(lnxgraph, id, trace, ti, toggle);
                    } else {
                        sinfo.traceindexes.push(ti);
                    }
                    var tup = update.traceupdates[ti];
                    for (var i of indexes) {
                        if (toggle) {
                            tup = tup.splice(tup.indexOf(i), 1);
                        } else {
                            tup.push(i);
                        }
                    }
                }
            }

            if (sinfo == null) {
                // no reference to selected point, should not happen
                return;
            }

            console.log("sinfo: ", sinfo);
            // annotations
            updateAnnotation(lnxgraph, update, sinfo, !toggle);
            // follow links
            if (sinfo.links && sinfo.links.length > 0) {
                var links = sinfo.links;
                console.log("links ", links);
                var markertype = point.customdata.markertype;
                console.log("markertype", markertype);
                console.log("doTarget", doTarget);
                if (markertype == MARKER_TYPES.NODE && doTarget) {
                    // select all link edges recursively
                    console.log("linking edges ", links);
                    for (var link of links) {
                        selectPointRecursive(lnxgraph, update, createFakePoint(link, false), false);
                    }
                } else if (markertype == MARKER_TYPES.EDGE) {
                    if (doTarget) {
                        // select all links recursively
                        console.log("linking nodes ", links);
                        for (var link of links) {
                            selectPointRecursive(lnxgraph, update, createFakePoint(link, true), false);
                        }
                    } else {
                        console.log("linking edge ", links[1]);
                        // at least select target node
                        selectPointRecursive(lnxgraph, update, createFakePoint(links[1], true), false);
                    }
                }
            }
        }

        function getInitialAnnotations(lnxgraph) {
            var gd = graphElement(lnxgraph.div);
            var annotations = [];
            // init but dereference annotations as the array will be changed by update
            if (lnxgraph.is3D && gd.layout.scene.annotations) {
                annotations = [...gd.layout.scene.annotations];
            } else if (gd.layout.annotations) {
                annotations = [...gd.layout.annotations];
            }
            return annotations;
        }

        function getAnnotationsLayoutUpdate(lnxgraph, annotations) {
            var layout_update = {};
            if (lnxgraph.is3D) {
                layout_update = {
                    scene: {
                        annotations: annotations,
                        // preserve camera eye position
                        camera: graphElement(lnxgraph.div).layout.scene.camera,
                    },
                };
            } else {
                layout_update = { annotations: annotations };
            }
            //console.log("annot lupdate ", layout_update);
            return layout_update;
        }

        function updateAnnotation(lnxgraph, update, sinfo, doCreate) {
            if (doCreate) {
                var ax = -100;
                if (lnxgraph.is3D && sinfo.isEdge && !sinfo.isFlatEdge) {
                    ax = -200;
                }
                var ay = -150;
                if (lnxgraph.is3D && sinfo.isEdge) {
                    ay = sinfo.isFlatEdge ? 150 : 0;
                }
                var annotation = {
                    x: sinfo.x,
                    y: sinfo.y,
                    ax: ax,
                    ay: ay,
                    text: sinfo.annotationtext,
                    opacity: 0.7,
                    font: {
                        size: 20,
                        color: sinfo.textcolor,
                    },
                    bgcolor: sinfo.color,
                    showarrow: true,
                    arrowhead: 2,
                    bordercolor: 'black',
                    borderwidth: 1,
                    borderpad: 4,
                    // handle events on annotation
                    captureevents: true,
                    // make annotation visible only if trace is visible
                    visible: sinfo.visible == true,
                    // keep trace index for annotation visibility trigger on trace visibility
                    traceindexes: sinfo.traceindexes,
                }
                if (lnxgraph.is3D) {
                    Object.assign(annotation, { z: sinfo.z });
                }
                update.annotations.push(annotation);
            } else {
                // remove annotation
                var aindex = null;
                var is3D = lnxgraph.is3D;
                var annotations = update.annotations;
                for (var i = 0; i < annotations.length; i++) {
                    if (annotations[i].x === sinfo.x && annotations[i].y == sinfo.y && (!is3D || annotations[i].z == sinfo.z)) {
                        aindex = i;
                        break;
                    }
                }
                annotations.splice(aindex, 1);
            }
        }

        function highlightUnselected(lnxgraph, doHighlight) {
            var traces = graphElement(lnxgraph.div).data;
            // use color for selection, see https://github.com/plotly/plotly.js/issues/2186
            var colors = traces.reduce(function (res, trace) {
                if (!trace.selectedindexes || trace.selectedindexes.length == 0) {
                    // reset to original color(s) or unselected color
                    res.push(doHighlight ? trace.originalcolors : UNSELECTED_COLOR);
                } else if (doHighlight) {
                    // reset to original color(s)
                    res.push(trace.originalcolors);
                } else {
                    // take into account selections
                    var tcolors;
                    if (Array.isArray(trace.originalcolors)) {
                        tcolors = [...trace.originalcolors];
                    } else {
                        tcolors = [...Array(trace.x.length).fill(trace.originalcolors)];
                    }
                    tcolors = tcolors.map((color, index) => trace.selectedindexes.includes(index) ? color : UNSELECTED_COLOR);
                    res.push(tcolors);
                }
                return res;
            }, []);
            Plotly.restyle(lnxgraph.div, { 'marker.color': colors }, [...Array(traces.length).keys()]);
            setHighlightButtonActive(lnxgraph.div, doHighlight);
        }

        function clearSelections(lnxgraph) {
            setClearSelectionsButtonVisible(lnxgraph.div, false);
            // reset dupe detection helpers
            lnxgraph.selected = [];
            // reset all annotations and selected info on all traces too
            var data_update = { selectedindexes: null }; // XXX: update with an empty array does not work ok...
            var layout_update = getAnnotationsLayoutUpdate(lnxgraph, []);
            Plotly.update(lnxgraph.div, data_update, layout_update);
            // reset highlight
            highlightUnselected(lnxgraph, true);
        }

        // make annotations visible or not depending on the corresponding trace visibility
        function syncAnnotations(lnxgraph) {
            var traces = graphElement(lnxgraph.div).data;
            var annotations = getInitialAnnotations(lnxgraph);
            var vtraces = traces.map(trace => (trace.visible == true || trace.visible == undefined));
            var updatedAnnotations = annotations.reduce(function (res, a) {
                a.visible = a.traceindexes.some(index => vtraces[index] == true);
                res.push(a);
                return res;
            }, []);
            if (annotations != updatedAnnotations) {
                var layout_update = getAnnotationsLayoutUpdate(lnxgraph, updatedAnnotations);
                Plotly.relayout(lnxgraph.div, layout_update);
            }
        }

        function getUpdateMenus(traces) {
            var menus = [];

            var msizes = traces.reduce(function (res, trace) {
                if ('marker' in trace) {
                    res.push(trace.marker.size);
                } else {
                    res.push([]);
                }
                return res;
            }, []);
            menus.push({
                name: menuName('NODE_SIZE_MENU'),
                type: 'buttons',
                x: 0.40, xanchor: 'left',
                // size is shown by default -> inactive
                active: -1,
                buttons: [{
                    label: menuLabel('NODE_SIZE_MENU'),
                    method: 'restyle',
                    // toggle args
                    args: ['marker.size', '6'],
                    // will put selected markers back to original size
                    args2: ['marker.size', msizes],
                }],
            });

            menus.push({
                name: menuName('HIGHLIGHT_MENU'),
                type: 'buttons',
                direction: 'down',
                x: 0.55, xanchor: 'center',
                // highlighted by default -> active
                active: 0,
                buttons: [{
                    label: menuLabel('HIGHLIGHT_MENU'),
                    // handled through plotly_buttonclicked event
                    method: 'skip',
                    execute: false,
                }],
            });

            menus.push({
                name: menuName('SELECT_MENU'),
                type: 'buttons',
                direction: 'down',
                x: 0.75, xanchor: 'center',
                // will be visible on selection existence only
                visible: false,
                showactive: false,
                buttons: [{
                    label: menuLabel('SELECT_MENU'),
                    // handled through plotly_buttonclicked event
                    method: 'skip',
                    execute: false,
                }],
            });

            // TODO: package selection (?) Plotly menus are not user-friendly with large data...

            return menus;
        }

        function getMenuIndex(graphDiv, menuName) {
            var menus = graphElement(graphDiv).layout.updatemenus;
            for (var i = 0; i < menus.length; i++) {
                if (menus[i].name == menuName) {
                    return i;
                };
            }
            return -1;
        }

        function setMenuButtonActive(graphDiv, menuName, active) {
            var index = getMenuIndex(graphDiv, menuName);
            Plotly.relayout(graphDiv, 'updatemenus[' + index + '].active', (active ? 0 : -1));
        }

        function setHighlightButtonActive(graphDiv, active) {
            setMenuButtonActive(graphDiv, menuName('HIGHLIGHT_MENU'), active);
        }

        function isHighlightButtonActive(graphDiv) {
            var index = getMenuIndex(graphDiv, menuName('HIGHLIGHT_MENU'));
            return graphElement(graphDiv).layout.updatemenus[index].active == 0;
        }

        function setClearSelectionsButtonVisible(graphDiv, visible) {
            var index = getMenuIndex(graphDiv, menuName('SELECT_MENU'));
            console.log(index);
            // for some reason this does not need to go through a Plotly.relayout call
            graphElement(graphDiv).layout.updatemenus[index].visible = visible;
        }

        function initBundleSelect(lnxgraph, bundles) {
            if (!lnxgraph.options.bundleselector) {
                return;
            }
            var gd = graphElement(lnxgraph.div);
            var selector = gd.parentNode.querySelector(lnxgraph.options.bundleselector);
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
            selector.addEventListener('change', function () {
                selectPoint(lnxgraph, createFakePoint(selector.value, true));
            }, false);

            // init selection based on current value too
            if (options.selectedbundle) {
                selectPoint(lnxgraph, createFakePoint(options.selectedbundle, true));
            }

            return selector;
        }

        function renderCirc(graphDiv, fig, options) {
            // TODO
        }

        function renderBasic(graphDiv, fig, options) {
            var is3D = graphType(fig.type) === '3d';
            var nodesById = fig.nodes.reduce(function (map, node) {
                map[node.id] = node;
                return map;
            }, {});
            var edgesByNodeId = {},
                edgesById = {};
            for (var i = 0; i < fig.edges.length; i++) {
                var edge = fig.edges[i];
                // assign ids to edges for easier management in selection
                edge.id = `NXEdge${i}-${edge.value}`;
                // fill references in edgesByNodeId map
                edgesById[edge.id] = edge;
                if (!edgesByNodeId[edge.source]) {
                    edgesByNodeId[edge.source] = [];
                }
                edgesByNodeId[edge.source].push(edge.id);
                // FIXME?
                // if (edge.value == EDGE_TYPES.REFERENCES) {
                //     if (!edgesByNodeId[edge.target]) {
                //         edgesByNodeId[edge.target] = [];
                //     }
                //     edgesByNodeId[edge.target].push(edge.id);
                // }
            }
            // wrap these helpers inside a graph object
            var nxgraph = {
                div: graphDiv,
                is3D: is3D,
                options: options,
                // helper objects for initial rendering and management of annotations on selection
                nodesById: nodesById,
                edgesById: edgesById,
                edgesByNodeId: edgesByNodeId,
                // share original parsed data
                fig: fig,
            }

            var traces = [
                // groups of nodes and edges, grouped depending on runtime logics
                ...getNodeTrace(nxgraph, 'BUNDLE', { legendgroup: 'bundles' }),
                ...getEdgeTrace(nxgraph, 'REQUIRES', { legendgroup: 'bundles', isFlatEdge: true }),
                ...getNodeTrace(nxgraph, 'COMPONENT', { legendgroup: 'components' }),
                ...getEdgeTrace(nxgraph, 'SOFT_REQUIRES', { legendgroup: 'components', isFlatEdge: true }),
                ...getNodeTrace(nxgraph, 'EXTENSION_POINT', { legendgroup: 'xps' }),
                ...getNodeTrace(nxgraph, 'CONTRIBUTION', { legendgroup: 'xps' }),
                ...getEdgeTrace(nxgraph, 'REFERENCES', { legendgroup: 'xps' }),
            ];

            // push another set of traces for containment (seems to be more efficient than using the 'groupby'
            // transform)
            var containsconf = {
                legendgroup: 'contains',
                visible: 'legendonly',
            }
            for (var type of Object.keys(NODE_TYPES)) {
                traces.push(...getNodeTrace(nxgraph, type, containsconf));
            }
            traces = traces.concat([
                ...getEdgeTrace(nxgraph, 'CONTAINS', containsconf),
            ]);

            var template = { layout: getBasicLayout(nxgraph) };
            var layout = {
                template: template,
                updatemenus: getUpdateMenus(traces),
            };

            // plot creation
            Plotly.newPlot(graphDiv, traces, layout, { responsive: true });

            // events management
            var gd = graphElement(graphDiv);
            var lightNXGraph = {
                div: graphDiv,
                is3D: is3D,
                options: options,
                selected: [],
            }

            // avoid recursion bug, see https://github.com/plotly/plotly.js/issues/1025
            var clickCalled = false;
            gd.on('plotly_click', function (data) {
                if (!clickCalled) {
                    //console.log("click: ", data);
                    clickCalled = true;
                    var point = data.points[0];
                    if (point.customdata) {
                        selectPoint(lightNXGraph, point, true);
                    }
                    clickCalled = false;
                }
            });
            gd.on('plotly_restyle', function (data) {
                // catch traces visibility changes to sync annotations, see https://community.plotly.com/t/how-to-catch-trace-visibility-changed/5554
                syncAnnotations(lightNXGraph);
            });
            // TODO: toggle selection on annotation click?
            gd.on('plotly_clickannotation', function (event, data) {
                console.log("annotation event: ", event);
            });

            // custom menus management
            gd.on('plotly_buttonclicked', function (data) {
                if (data.menu.name == menuName('SELECT_MENU')) {
                    clearSelections(lightNXGraph);
                } else if (data.menu.name == menuName('HIGHLIGHT_MENU')) {
                    highlightUnselected(lightNXGraph, data.active != 0);
                }
            });

            // init and hook bundle selection, might trigger an update if selections exist
            var bundles = fig.nodes.filter(function (node) { return node.type == 'BUNDLE' });
            initBundleSelect(lightNXGraph, bundles);

            // XXX for debug only
            gd.on('plotly_afterplot', function () {
                console.log('done plotting');
                console.log(document.getElementById(graphDiv).data);
            });
        }

        // TODO notes after feedback from Nelson:
        // 1. add package.json (with plotly.js-dist as dep)
        // 2. add npm start script to serve the thing (and open plotly.html)
        // 3. split things into modules
        // (cannot load plotly as ESM, see known bug in d3 preventing it from working https://github.com/plotly/plotly.js/issues/3518)
        // 4. higher order functions: see _render a function that return another function
        // 5. const { value, options, selectedIndex } = sel; destructuring assingments
        // 6. spread operator in maps: { …options } (? not sure still valid in WIP branch)
        // 7. flatMap: you can use map and have it produce an array but still end up with a flat array (not an array of arrays)

        return _plot;

    }

    if (typeof (window.NXPlotly) === 'undefined') {
        window.NXPlotly = NXPlotly();
    }
})(window);