(function (window) {
    'use strict';

    function NXPlotly() {

        var _plot = {};

        const MARKER_OPACITY = {
            DEFAULT: 1,
            UNSELECTED: 0.1,
        }

        const EDGE_WIDTH = {
            DEFAULT: 3,
            UNSELECTED: 0.1,
        }

        const MARKER_TYPES = {
            NODE: 'node',
            EDGE: 'edge',
        }
        const TRACE_TYPES = {
            NODE: 'nodes',
            EDGE: 'edges',
            // used only in 2d
            EDGE_LINE: 'edgelines',
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

        // hardcode Viridis colorscale for easier retrieval from custom code (maybe can acccess ColorScale features directly (??)
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

        // handle selections with this trick since marker opacity and line width do not accept arrays in 3D...
        // see https://github.com/plotly/plotly.js/issues/2186
        const highlightColor = (color, doHighlight) => {
            var alpha = parseFloat(color.slice(color.lastIndexOf(',') + 1, color.lastIndexOf(')')));
            if (!doHighlight) {
                // don't change selected opacities
                if (alpha != MARKER_OPACITY.DEFAULT) {
                    // replace color as rgba does not render well in 3D
                    return 'rgba(255, 255, 255, 0.1)';
                    //var nalpha = doHighlight? MARKER_OPACITY.DEFAULT: MARKER_OPACITY.UNSELECTED;
                    //return `${color.slice(0, color.lastIndexOf(','))} ${nalpha})`;
                }
                return color;
            } else {
                // TODO:
                // get back original color on trace
            }
            return color;
        }

        const nodeColor = (category) => ({
            'RUNTIME': colorFromScale(0),
            'CORE': colorFromScale(1),
            'PLATFORM': colorFromScale(2),
            'STUDIO': colorFromScale(3),
        })[category];


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
        const edgeLineMarkerSymbol = (nxgraph) => (nxgraph.is3D ? 'circle' : 'triangle-right');

        const nodeMarkerAnnotation = (node) => `<b>${node.label}</b><br />(${node.x}, ${node.y}, ${node.z})<br /><br />Type: ${node.type}<br />Category: ${node.category}<br />Weight: ${node.weight}`;
        const NODE_HOVERTEMPLATE = "%{customdata.annotation}<extra></extra>";

        const edgeLineMarkerAnnotation = (edge, source, target) => `${source.label}<br /><b>${edge.value}</b><br />${target.label}<br />(${source.x}, ${source.y}, ${source.z}) -> (${target.x}, ${target.y}, ${target.z})`;
        const EDGE_LINE_HOVERTEMPLATE = "%{customdata.annotation}<extra></extra>";

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
                Object.assign(scene, { zaxis: axis });
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
                name: (type ? nodeLabel(type) : "Nodes"),
                type: 'scatter',
                mode: 'markers',
                x: nodes.map(node => node.x),
                y: nodes.map(node => node.y),
                hovertemplate: NODE_HOVERTEMPLATE,
                hoverlabel: {
                    font: {
                        size: 20,
                    }
                },
                customdata: nodes.map(node => getNodeMarkerCustomData(nxgraph, node)),
                marker: {
                    symbol: (type ? nodeSymbol(type) : nodes.map(node => nodeSymbol(node.type))),
                    size: nodes.map(node => nodeWeight(node.weight)),
                    // XXX: color is not shared with hover background in 3D...
                    color: colors, // to be changed on selection/highlight
                    //opacity: MARKER_OPACITY.DEFAULT,
                    line: {
                        color: 'rgb(50,50,50)',
                        width: 0.5
                    },
                },
                // additional custom trace info
                tracetype: TRACE_TYPES.NODE,
                references: references,
                selected: [],
                originalcolors: colors, // keep original colors to handle unhighlight on selection
            };
            if (nxgraph.is3D) {
                Object.assign(trace, {
                    'type': 'scatter3d',
                    'z': nodes.map(node => node.z),
                });
            }
            Object.assign(trace, config);
            console.log(trace);
            return [trace];
        }

        function getEdgeTrace(nxgraph, type, config) {
            var edges = nxgraph.fig.edges.filter(function (edge) { return type ? edge.value == type : true });
            // use markers instead of lines because of 3D restrictions on lines (color + width + marker opacity)
            var x = computeEdgeLineMarkers(edges, nxgraph.nodesById, 'x'); // will server as final size reference
            var nbpoints = x.length / edges.length;
            var customdata = edges.map(edge => getEdgeLineMarkerCustomData(nxgraph, edge));
            var colors = type ? edgeColor(type) : edges.map(edge => edgeColor(edge.value));
            console.log("edge color: ", colors);
            var mreferences = edges.reduce(function (map, edge, index) {
                map[edge.id] = [...Array(nbpoints).keys()].map(i => i + index);
                return map;
            }, {});
            var allcolors = (type ? colors : computeLineMarkersData(colors, nbpoints));
            var markers = {
                name: (type ? edgeLabel(type) : "Edges"),
                type: 'scattergl',
                mode: 'markers',
                x: computeEdgeLineMarkers(edges, nxgraph.nodesById, 'x'),
                y: computeEdgeLineMarkers(edges, nxgraph.nodesById, 'y'),
                hovertemplate: EDGE_LINE_HOVERTEMPLATE,
                hoverlabel: {
                    font: {
                        size: 20,
                    },
                },
                customdata: computeLineMarkersData(customdata, nbpoints),
                marker: {
                    symbol: edgeLineMarkerSymbol(nxgraph),
                    color: allcolors, // to be changed on selection/highlight
                    size: (nxgraph.is3D ? 2 : 10),
                    //opacity: MARKER_OPACITY.DEFAULT,
                    line: {
                        color: 'rgb(50,50,50)',
                        width: 0.3,
                    },
                },
                // additional custom trace info
                tracetype: TRACE_TYPES.EDGE,
                references: mreferences,
                originalcolors: allcolors, // keep original colors to handle unhighlight on selection
                selected: [],
            };
            if (nxgraph.is3D) {
                Object.assign(markers, {
                    type: 'scatter3d',
                    z: computeEdgeLineMarkers(edges, nxgraph.nodesById, 'z'),
                });
            }
            Object.assign(markers, config);
            console.log(markers);
            return [markers];
        }

        function computeEdgeLines(edges, nodesById, axis) {
            return edges.reduce(function (r, edge) { r.push(nodesById[edge.source][axis], nodesById[edge.target][axis], null); return r; }, []);
        }

        // helps building an additional trace to show marker points on relations for better text on hover
        function computeEdgeLineMarkers(edges, nodesById, axis) {
            return edges.reduce(function (res, edge) {
                res.push(...midpoints(nodesById[edge.source][axis], nodesById[edge.target][axis], 0, 4));
                return res;
            }, []);
        }

        // adapt other data content to line markers multiplication thanks to above logics
        function computeLineMarkersData(data, nbpoints) {
            return data.reduce(function (r, item) { r.push(...Array(nbpoints).fill(item)); return r; }, []);
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

        function getInitialTraceUpdates(traces) {
            var traceupdates = {};
            for (var ti = 0; ti < traces.length; ti++) {
                // init with info that will be impacted by selection
                var trace = traces[ti];
                traceupdates[ti]['selected'] = [...trace.selected];
                if (Array.isArray(trace.marker.color)) {
                    traceupdates[ti]['colors'] = [...trace.marker.color];
                } else {
                    traceupdates[ti]['colors'] = trace.x.map(item => trace.marker.color);
                }
            }
            console.log("init tu ", traceupdates);
            return traceupdates;
        }

        function performTraceUpdates(lnxgraph, traces, traceupdates) {
            // XX check if it can be done all at once!
            for (var ti = 0; ti < traces.length; ti++) {
                // init with info that will be impacted by selection
                var trace = traces[ti];
                console.log("Updating trace " + trace.name + ": ", trace);
                Plotly.restyle(lnxgraph.div, {
                    'marker.color': [traceupdates[ti]['colors']],
                    'selected': [traceupdates[ti]['selected']]
                }, [ti]);
                console.log("Updated trace " + trace.name + ": ", graphElement(lnxgraph.div).data[ti]);
            }
        }

        function getSelectionInfo(lnxgraph, id, trace, toggle) {
            var indexes = trace.references[id];
            if (!indexes) {
                return null;
            }
            var index = indexes[0];
            if (trace.tracetype == TRACE_TYPES.EDGE) {
                // annotate the middle marker
                index = indexes[parseInt(indexes.length / 2)];
            }
            var info = {
                x: trace.x[index],
                y: trace.y[index],
                links: trace.customdata[index].links,
            }
            if (lnxgraph.is3D) {
                Object.assign(info, { z: trace.z[index] });
            }
            if (!toggle) {
                // fill up other info that will be useful for annotation creation
                Object.assign(info, {
                    annotationtext: trace.customdata[index].annotation,
                    isEdge: trace.tracetype != TRACE_TYPES.NODE, // XX: flat edges should not be flagged as is maybe
                });
                var color = trace.marker.color;
                if (Array.isArray(color)) {
                    color = trace.marker.color[index];
                }
                var color = trace.marker.color;
                if (Array.isArray(color)) {
                    color = trace.marker.color[index];
                }
                if (trace.tracetype == TRACE_TYPES.NODE) {
                    var textcolor = color > 1 ? 'black' : 'white';
                    Object.assign(info, { color: color, textcolor: textcolor });
                } else if (trace.tracetype == TRACE_TYPES.EDGE) {
                    Object.assign(info, { color: color, textcolor: 'black' });
                }
            }
            console.log("selection info for " + id + ": ", info);
            return info;
        }

        // change selected points and relations to:
        // - udpate colors on nodes (handling rgb opacity in 3D)
        // - update width on edges (on 2D)
        // - show corresponding annotations on the fly
        function selectPoint(lnxgraph, point) {
            var isFirstTime = lnxgraph.selected.length == 0;
            if (isFirstTime) {
                setClearSelectionsButtonVisible(lnxgraph.div, true);
                setHighlightButtonActive(lnxgraph.div, false);
            }
            var gd = graphElement(lnxgraph.div);
            var traces = gd.data;
            var annotations = [];
            // init but dereference annotations as the array will be changed by update
            if (lnxgraph.is3D && gd.layout.scene.annotations) {
                annotations = [...gd.layout.scene.annotations];
            } else if (gd.layout.annotations) {
                annotations = [...gd.layout.annotations];
            }
            var update = {
                traces: traces,
                annotations: annotations,
                traceupdates: getInitialTraceUpdates(traces),
            };

            update = selectPointRecursive(lnxgraph, update, point, true, isFirstTime);
            console.log("selectPoint update: ", update);

            // perform updates trace by trace
            performTraceUpdates(lnxgraph, traces, update.traceupdates);
            // update annotations
            var layout_update = {};
            if (lnxgraph.is3D) {
                layout_update = {
                    scene: {
                        annotations: update.annotations,
                        // preserve camera eye position
                        camera: graphElement(lnxgraph.div).layout.scene.camera,
                    },
                };
            } else {
                layout_update = { annotations: update.annotations };
            }
            console.log("selectPoint lupdate ", layout_update);
            Plotly.relayout(lnxgraph.div, layout_update);
        }

        function selectPointRecursive(lnxgraph, update, point, doTarget, isFirstTime) {
            console.log("selectPointRecursive: ", point);
            var markertype = point.customdata.markertype,
                id = point.customdata.id,
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
                        sinfo = getSelectionInfo(lnxgraph, id, trace, toggle);
                    }
                    // impact trace layout
                    var tup = update.traceupdates[ti];
                    for (var i of indexes) {
                        // FIXME: color not avail on toggle
                        tup[i]['colors'] = highlightColor(tup[i], !toggle);
                    }
                    console.log("trace name: ", trace.name);
                    console.log("updates: ", tup);
                }
                // unhighlight all other elements on first selection
                if (isFirstTime && !toggle) {
                    var tup = update.traceupdates[ti];
                    console.log("tup", tup);
                    for (var i = 0; i < tup.length; i++) {
                        tup[i] = highlightColor(tup[i], !toggle);
                    }
                }
            }

            // annotations
            if (sinfo) {
                console.log("sinfo: ", sinfo);
                if (toggle) {
                    update.annotations = removeAnnotation(lnxgraph, update.annotations, sinfo);
                } else {
                    var marker = {
                        x: sinfo.x,
                        y: sinfo.y,
                        ax: (sinfo.isEdge ? 0 : -100),
                        ay: (sinfo.isEdge ? 0 : -150),
                        text: sinfo.annotationtext,
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
                        // arrowsize: 30,
                        // arrowwidth: 0.1,
                    }
                    if (lnxgraph.is3D) {
                        Object.assign(marker, { z: sinfo.z });
                    }
                    update.annotations.push(marker);
                }
                // XX disabled for now
                if (sinfo.links && false) {
                    var links = sinfo.links;
                    console.log("links ", links);
                    console.log(markertype);
                    console.log(doTarget);
                    if (markertype == MARKER_TYPES.NODE && doTarget) {
                        // select all link edges recursively
                        console.log("linking edges ", links);
                        for (var link of links) {
                            update = selectPointRecursive(lnxgraph, update, createFakePoint(link, false), false, false);
                        }
                    } else if (markertype == MARKER_TYPES.EDGE) {
                        if (doTarget) {
                            // select all links recursively
                            console.log("linking nodes ", links);
                            for (var link of links) {
                                update = selectPointRecursive(lnxgraph, update, createFakePoint(link, true), false, false);
                            }
                        } else {
                            console.log("linking edge ", links[1]);
                            // at least select target node
                            update = selectPointRecursive(lnxgraph, update, createFakePoint(links[1], true), false, false);
                        }
                    }
                }
            }

            return update;
        }

        function removeAnnotation(lnxgraph, annotations, sinfo) {
            var aindex = null;
            var is3D = lnxgraph.is3D;
            for (var i = 0; i < annotations.length; i++) {
                if (annotations[i].x === sinfo.x && annotations[i].y == sinfo.y && (!is3D || annotations[i].z == sinfo.z)) {
                    aindex = i;
                    break;
                }
            }
            annotations.splice(aindex, 1);
            return annotations;
        }

        function setHighlight(lnxgraph, doHighlight) {
            var traces = graphElement(lnxgraph.div).data;
            var traceupdates = getInitialTraceUpdates(traces);
            for (var ti = 0; ti < traces.length; ti++) {
                var tup = traceupdates[ti];
                for (var i = 0; i < tup.length; i++) {
                    // FIXME
                    if (doHighlight) {
                        tup[i] = highlightColor(tup[i], doHighlight);
                    }
                }
            }
            performTraceUpdates(lnxgraph, traces, traceupdates);
        }

        function clearSelections(lnxgraph) {
            setClearSelectionsButtonVisible(lnxgraph.div, false);
            setHighlightButtonActive(lnxgraph.div, true);
            // reset dupe detection helpers
            lnxgraph.selected = [];
            var up = {};
            if (lnxgraph.is3D) {
                up = {
                    scene: {
                        annotations: [],
                        // preserve camera eye position
                        camera: graphElement(lnxgraph.div).layout.scene.camera,
                    },
                };
            } else {
                up = { annotations: [] };
            }
            Plotly.relayout(lnxgraph.div, up);
            setHighlight(lnxgraph, true);
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
                    execute: true,
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
                    execute: true,
                }],
            });

            // TODO: package selection (?) Plotly menus are not user-friendly with large data...

            return menus;
        }

        function setMenuButtonActive(graphDiv, menuName, active) {
            var gd = graphElement(graphDiv);
            for (var menu of gd.layout.updatemenus) {
                if (menu.name == menuName) {
                    menu.active = active ? 0 : -1;
                    break;
                }
            }
        }

        function setHighlightButtonActive(graphDiv, active) {
            setMenuButtonActive(graphDiv, menuName('HIGHLIGHT_MENU'), active);
        }

        function setClearSelectionsButtonVisible(graphDiv, visible) {
            var gd = graphElement(graphDiv);
            for (var menu of gd.layout.updatemenus) {
                if (menu.name == menuName('SELECT_MENU')) {
                    menu.visible = visible;
                    break;
                }
            }
        }

        function initBundleSelect(lnxgraph, bundles) {
            // FIXME: to refactor to adapt to new logics
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
            // assign ids to edges for easier management in selection, if missing, and fill references in edgesByNodeId
            // map
            var edgesByNodeId = {},
                edgesById = {};
            for (var i = 0; i < fig.edges.length; i++) {
                var edge = fig.edges[i];
                edge.id = 'NXEdge' + i;
                edgesById[edge.id] = edge;
                if (!edgesByNodeId[edge.source]) {
                    edgesByNodeId[edge.source] = [];
                }
                edgesByNodeId[edge.source].push(edge.id);
                //              if (!edgesByNodeId[edge.target]) {
                //              edgesByNodeId[edge.target] = [];
                //              }
                //              edgesByNodeId[edge.target].push(edge.id);
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
                ...getEdgeTrace(nxgraph, 'REQUIRES', { legendgroup: 'bundles' }),
                ...getNodeTrace(nxgraph, 'COMPONENT', { legendgroup: 'components' }),
                ...getEdgeTrace(nxgraph, 'SOFT_REQUIRES', { legendgroup: 'components' }),
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
                    console.log("click: ", data);
                    clickCalled = true;
                    var point = data.points[0];
                    if (point.customdata) {
                        selectPoint(lightNXGraph, point, true);
                    }
                    clickCalled = false;
                }
            });
            gd.on('plotly_doubleclick', function (data) {
                // XXX
                console.log("doubleclick: ", data);
            });
            gd.on('plotly_clickannotation', function (event, data) {
                console.log("annot event: ", event);
                console.log("annot data: ", data);
                if (data.points) {
                    var point = data.points[0];
                    if (point.customdata) {
                        selectPoint(lightNXGraph, point, false);
                    }
                }
            });
            // custom menus management
            gd.on('plotly_buttonclicked', function (data) {
                if (data.menu.name == menuName('SELECT_MENU')) {
                    clearSelections(lightNXGraph);
                } else if (data.menu.name == menuName('HIGHLIGHT_MENU')) {
                    // FIXME
                    console.log(data);
                    var highlight = (data.menu.active == 0);
                    console.log(highlight);
                    setHighlightButtonActive(graphDiv, highlight);
                    setHighlight(lightNXGraph, !highlight);
                }
            });

            // init and hook bundle selection, might trigger an update if selections exist

            // FIXME: disabled for now: makes the page freeze for some reason
            // var bundles = fig.nodes.filter(function(node) {return node.type == 'BUNDLE'});
            // initBundleSelect(lightNXGraph, bundles);
        }

        return _plot;

    }

    if (typeof (window.NXPlotly) === 'undefined') {
        window.NXPlotly = NXPlotly();
    }
})(window);