/*
 * This file contains all the JavaScript logic for the D3.js interactive graph.
 * It's separated from the main HTML for better code organization and reusability.
 * The functions and variables are named with the "my" prefix as per the user's preference.
 */

// Global D3.js variables
let mySvg, myWidth, myHeight;
let myTreeLayout;
let myRootNode;
let myArbitraryLinks = [];
let myIsDragging = false;
let mySelectedNodes = [];
let myZoomBehavior;
const myLineGenerator = d3.line()
    .x(d => d.x)
    .y(d => d.y);

// Default data to be used when the page loads
const myDefaultData = {
    nodes: [
        { id: "food", parentId: "", name: "Food", fact: "" },
        { id: "meat", parentId: "food", name: "Meat", fact: "" },
        { id: "carbs", parentId: "food", name: "Carbs", fact: "" },
        { id: "veggies", parentId: "food", name: "Veggies", fact: "" },
        { id: "salmon", parentId: "meat", name: "Salmon", fact: "" },
        { id: "steak", parentId: "meat", name: "Steak", fact: "" },
        { id: "chicken", parentId: "meat", name: "Chicken", fact: "Chickens can fly, but only for short distances. The chicken is the closest living relative of the T-rex." },
        { id: "round", parentId: "steak", name: "Round", fact: "" },
        { id: "ribeye", parentId: "steak", name: "Ribeye", fact: "" },
        { id: "tbone", parentId: "steak", name: "T-Bone", fact: "" }
    ],
    links: []
};

// Main initialization function for the D3.js graph, called on window load
window.onload = function() {
    myWidth = 960;
    myHeight = 600;

    myZoomBehavior = d3.zoom().on("zoom", myZoomed);

    mySvg = d3.select("#mySvgContainer")
        .attr("width", myWidth)
        .attr("height", myHeight)
        .call(myZoomBehavior)
        .append("g");
    
    mySvg.on("click", myUnselectAllNodes);

    myTreeLayout = d3.tree()
        .size([myWidth, myHeight - 150]);

    myDrawData(myDefaultData);
    myMakeDraggable("myFactDialog", "myFactDialogHeader");
};

// Make a dialog box draggable by its header
function myMakeDraggable(dialogId, headerId) {
    const myDialog = document.getElementById(dialogId);
    const myHeader = document.getElementById(headerId);

    myHeader.onmousedown = (e) => {
        e.preventDefault();
        let myOffsetX = e.clientX - myDialog.offsetLeft;
        let myOffsetY = e.clientY - myDialog.offsetTop;
        
        function myMouseMove(e) {
            myDialog.style.top = (e.clientY - myOffsetY) + 'px';
            myDialog.style.left = (e.clientX - myOffsetX) + 'px';
        }

        function myMouseUp() {
            window.removeEventListener('mousemove', myMouseMove);
            window.removeEventListener('mouseup', myMouseUp);
        }

        window.addEventListener('mousemove', myMouseMove);
        window.addEventListener('mouseup', myMouseUp);
    };
}

// Handles the zoom and pan behavior of the SVG
function myZoomed(event) {
    mySvg.attr("transform", event.transform);
}

// Unselects all currently selected nodes
function myUnselectAllNodes() {
    d3.selectAll('.node.selected').classed('selected', false);
    mySelectedNodes = [];
}

// Resets the graph layout to the default tree structure
function myTidyUpGraph() {
    if (!myRootNode) return;
    myTreeLayout(myRootNode);
    myUpdate(myRootNode);
    myShowMessage("Graph layout has been reset.");
}

// Zooms and centers the entire graph to fit within the SVG container
function myFitToScreen() {
    const myNodeElements = d3.selectAll(".node").nodes();
    const myLinkElements = d3.selectAll(".link, .arbitrary-link").nodes();
    const allElements = [...myNodeElements, ...myLinkElements];
    if (allElements.length === 0) {
        return;
    }
    const myCombinedBoundingBox = allElements.reduce((box, el) => {
        const b = el.getBBox();
        return {
            x: Math.min(box.x, b.x),
            y: Math.min(box.y, b.y),
            width: Math.max(box.width, b.x + b.width),
            height: Math.max(box.height, b.y + b.height)
        };
    }, { x: Infinity, y: Infinity, width: -Infinity, height: -Infinity });

    const myScale = Math.min(myWidth / myCombinedBoundingBox.width, myHeight / myCombinedBoundingBox.height) * 0.9;
    const myTranslateX = (myWidth / 2) - (myCombinedBoundingBox.x + myCombinedBoundingBox.width / 2) * myScale;
    const myTranslateY = (myHeight / 2) - (myCombinedBoundingBox.y + myCombinedBoundingBox.height / 2) * myScale;

    d3.select("#mySvgContainer")
        .transition()
        .duration(750)
        .call(myZoomBehavior.transform, d3.zoomIdentity.translate(myTranslateX, myTranslateY).scale(myScale));
}

// Draws the graph based on the provided data
function myDrawData(data) {
    const myRawData = data.nodes;
    myArbitraryLinks = data.links;
    myRootNode = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parentId)(myRawData);
    
    myTreeLayout(myRootNode);
    myRootNode.descendants().forEach(d => {
        const myLoadedData = myRawData.find(item => item.id === d.id);
        d.x = myLoadedData && myLoadedData.x ? +myLoadedData.x : d.x;
        d.y = myLoadedData && myLoadedData.y ? +myLoadedData.y : d.y;
        d.x0 = d.x;
        d.y0 = d.y;
    });
    myUpdate(myRootNode);
}
window.myDrawData = myDrawData; // Expose to the global scope for the main script

// Updates the D3.js graph with new or modified data
function myUpdate(source) {
    const myNodeData = myRootNode.descendants();
    const myTreeLinkData = myRootNode.links();
    const myNodesById = new Map(myNodeData.map(d => [d.id, d]));

    const myDragBehavior = d3.drag()
        .on("start", myDragStart)
        .on("drag", myDragged)
        .on("end", myDragEnd);

    const myTreeLink = mySvg.selectAll(".link")
        .data(myTreeLinkData, d => d.target.id);

    myTreeLink.enter().append("path")
        .attr("class", "link")
        .attr("d", d3.linkVertical()
            .x(d => d.x0)
            .y(d => d.y0))
        .merge(myTreeLink)
        .transition()
        .duration(500)
        .attr("d", d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y));

    myTreeLink.exit().remove();

    const validArbitraryLinks = myArbitraryLinks.filter(d => myNodesById.has(d.sourceId) && myNodesById.has(d.targetId));
    
    const myArbitraryLinkPath = mySvg.selectAll(".arbitrary-link")
        .data(validArbitraryLinks, d => `${d.sourceId}-${d.targetId}`);

    myArbitraryLinkPath.enter().append("path")
        .attr("class", "arbitrary-link")
        .attr("id", d => `path-${d.sourceId}-${d.targetId}`)
        .attr("d", d => myLineGenerator([myNodesById.get(d.sourceId), myNodesById.get(d.targetId)]))
        .merge(myArbitraryLinkPath)
        .attr("d", d => myLineGenerator([myNodesById.get(d.sourceId), myNodesById.get(d.targetId)]));
        
    const myArbitraryLinkText = mySvg.selectAll(".line-text")
        .data(validArbitraryLinks, d => `text-${d.sourceId}-${d.targetId}`);

    myArbitraryLinkText.enter().append("text")
        .attr("class", "line-text")
        .merge(myArbitraryLinkText)
        .html(d => `<textPath href="#path-${d.sourceId}-${d.targetId}" startOffset="50%">${d.joiningFact}</textPath>`);

    myArbitraryLinkText.exit().remove();
    
    const myNode = mySvg.selectAll(".node")
        .data(myNodeData, d => d.id);

    const myNodeEnter = myNode.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.x0},${source.y0})`)
        .on("click", myClickNode);

    myNodeEnter.append("circle")
        .attr("r", 10)
        .style("fill", d => d._children ? "#60a5fa" : "#fff");

    myNodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", d => d._children || d.data.children ? -15 : 15)
        .attr("text-anchor", d => d._children || d.data.children ? "end" : "start")
        .text(d => d.data.name);

    const myNodeUpdate = myNodeEnter.merge(myNode);

    myNodeUpdate.transition()
        .duration(500)
        .attr("transform", d => `translate(${d.x},${d.y})`);

    myNodeUpdate.call(myDragBehavior);

    myNode.exit().remove();

    myNodeData.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}

// Drag behavior functions for nodes
function myDragStart(event, d) {
    myIsDragging = true;
    d3.select(this).raise().classed("dragging", true);
}

function myDragged(event, d) {
    d.x = event.x;
    d.y = event.y;
    d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
}

function myDragEnd(event, d) {
    myIsDragging = false;
    d3.select(this).classed("dragging", false);
    myUpdate(d);
    myShowMessage(d.data.fact || "No fact available for this node.");
}

// Handles click events on nodes
function myClickNode(event, d) {
    event.stopPropagation();
    if (myIsDragging) return;
    if (event.ctrlKey) {
        const myIndex = mySelectedNodes.indexOf(d);
        if (myIndex > -1) {
            mySelectedNodes.splice(myIndex, 1);
            d3.select(event.currentTarget).classed('selected', false);
        } else {
            mySelectedNodes.push(d);
            d3.select(event.currentTarget).classed('selected', true);
        }
    } else {
        myUnselectAllNodes();
        d3.select(event.currentTarget).classed('selected', true);
        mySelectedNodes.push(d);
        if (d.data.fact) {
            myShowMessage(d.data.fact);
        } else {
            myShowMessage("No fact available for this node. Use the **Ctrl key** to select multiple nodes for adding a line.");
        }
    }
}

// Displays the "Add New Line" dialog
function myShowAddLineDialog() {
    if (mySelectedNodes.length < 2) {
        myShowMessage("Please select at least two nodes to add a line.");
        return;
    }
    document.getElementById('myAddLineDialog').style.display = 'flex';
}

// Adds a new arbitrary link with a fact between selected nodes
function myAddLineWithFact() {
    const myJoiningFact = document.getElementById('myJoiningFact').value;

    if (mySelectedNodes.length < 2) {
        myShowMessage("Please select at least two nodes.");
        return;
    }

    const mySourceNode = mySelectedNodes[0];
    const myTargetNodes = mySelectedNodes.slice(1);

    for (const myTargetNode of myTargetNodes) {
        if (mySourceNode.id === myTargetNode.id) continue;
        
        const myExistingLink = myArbitraryLinks.find(
            link => (link.sourceId === mySourceNode.id && link.targetId === myTargetNode.id) ||
                    (link.sourceId === myTargetNode.id && link.targetId === mySourceNode.id)
        );
        if (myExistingLink) continue;

        myArbitraryLinks.push({ 
            sourceId: mySourceNode.id, 
            targetId: myTargetNode.id,
            joiningFact: myJoiningFact
        });
    }

    myUpdate(myRootNode);

    document.getElementById('myAddLineDialog').style.display = 'none';
    document.getElementById('myJoiningFact').value = '';
    myUnselectAllNodes();
    myShowMessage(`Added a new line.${myJoiningFact ? ` with fact: "${myJoiningFact}"` : ""}`);
}

// Displays a message in the fact display area
function myShowMessage(message) {
    document.getElementById("myFactDisplayArea").value = message;
}

// Displays the "Add New Node" dialog
function myShowAddNodeDialog() {
    if (mySelectedNodes.length === 1) {
        document.getElementById('myNewNodeParentId').value = mySelectedNodes[0].id;
        document.getElementById('myAddNodeDialog').style.display = 'flex';
    } else if (mySelectedNodes.length === 0) {
        myShowMessage("Please select a single node to be the parent of the new node.");
    } else {
        myShowMessage("Please select ONLY one node to add a child node to.");
    }
}

// Adds a new node to the graph
function myAddNewNode() {
    const myNewNodeName = document.getElementById('myNewNodeName').value;
    const myNewNodeParentId = document.getElementById('myNewNodeParentId').value;
    const myNewNodeFact = document.getElementById('myNewNodeFact').value;
    
    if (!myNewNodeName || !myNewNodeParentId) {
        myShowMessage("Node Name and Parent ID are required.");
        return;
    }

    const myRawData = myRootNode.descendants().map(d => d.data);
    const myParentNodeData = myRawData.find(d => d.id === myNewNodeParentId);
    if (!myParentNodeData) {
        myShowMessage("Parent node not found with the given ID.");
        return;
    }

    const myNewNodeId = myNewNodeName.toLowerCase().replace(/\s/g, '');
    const myNewDataPoint = {
        id: myNewNodeId,
        parentId: myNewNodeParentId,
        name: myNewNodeName,
        fact: myNewNodeFact || ""
    };

    myRawData.push(myNewDataPoint);
    const myCurrentPositions = new Map(myRootNode.descendants().map(d => [d.id, { x: d.x, y: d.y }]));
    myRootNode = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parentId)(myRawData);
    
    myTreeLayout(myRootNode);
    myRootNode.descendants().forEach(d => {
        const oldPos = myCurrentPositions.get(d.id);
        if (oldPos) {
            d.x = oldPos.x;
            d.y = oldPos.y;
        }
    });
    myUpdate(myRootNode);
    
    document.getElementById('myAddNodeDialog').style.display = 'none';
    document.getElementById('myNewNodeName').value = '';
    document.getElementById('myNewNodeParentId').value = '';
    document.getElementById('myNewNodeFact').value = '';
    myUnselectAllNodes();
}

// Loads a JSON file to update the graph data
function myLoadFile(event) {
    const myFile = event.target.files[0];
    if (!myFile) {
        return;
    }
    const myReader = new FileReader();
    myReader.onload = function(e) {
        try {
            const myJsonContent = JSON.parse(e.target.result);
            d3.select("#mySvgContainer g").selectAll("*").remove(); 
            myDrawData(myJsonContent);
            myShowMessage("File loaded successfully!");
        } catch (error) {
            myShowMessage("Error loading file. Please ensure it is a valid JSON file.");
        }
    };
    myReader.readAsText(myFile);
}

// Saves the current graph data as a JSON file
function mySaveData() {
    const mySavedNodes = myRootNode.descendants().map(d => {
        return {
            id: d.id,
            parentId: d.parent ? d.parent.id : "",
            name: d.data.name,
            fact: d.data.fact || "",
            x: d.x,
            y: d.y
        };
    });
    const myDataToSave = {
        nodes: mySavedNodes,
        links: myArbitraryLinks
    };

    const myJson = JSON.stringify(myDataToSave, null, 2);
    document.getElementById("myFactDisplayArea").value = myJson;

    const myBlob = new Blob([myJson], { type: "application/json" });
    const myUrl = URL.createObjectURL(myBlob);
    const myLink = document.createElement("a");
    myLink.setAttribute("href", myUrl);
    myLink.setAttribute("download", "d3_graph_data.json");
    myLink.style.display = "none";
    document.body.appendChild(myLink);
    myLink.click();
    document.body.removeChild(myLink);
}
