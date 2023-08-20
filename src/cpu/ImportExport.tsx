import { Vec3 } from "../utils/vector";
import { IComp, ICpuLayout, IElRef, IWireGraph, IWireGraphNode, RefType } from "./CpuModel";

// what's our format?
// plain text format, with # comments
// first line is #wire-schema <version> where version is a single number

// Then we have a list of components & wires
// Component lines start with "C", and wires start with "W"

// Want to make them fairly easily copy-able, so we use deltas for the ids
// note that ids can't contain spaces

/* e.g.:

#wire-schema 1
C ram 0 p:-12,-23
C rom 1 p:-12,-10
C insFetch 3 p:-12,2
C id 2 p:3,4
C ls 8 p:26,4
C alu 4 p:26,15
C pc 5 p:3,11
C reg 6 p:3,23
W 3 ns:[13,6 p:id/rhsImm|22,6,0|22,12,1|33,12|33,12,2,3|22,28,2|33,7,3 p:ls/data|13,28,5 p:reg/outB|33,15,4 p:alu/rhs]
W 6 ns:[-12,3 p:insFetch/addr|-17,3,0]
W 7 ns:[-12,4 p:insFetch/data|-17,4,0]
W 10 ns:[3,26 p:reg/in|-1,26,0|-1,31,1|31,31,2|31,21,3 p:alu/result|38,31,3|38,6,5|36,6,6 p:ls/dataOut]
W 11 ns:[3,12 p:pc/in|-5,12,0]
W 13 ns:[29,10|29,15,0 p:alu/lhs|29,7,0 p:ls/addrBase|20,10,0|16,10,3|20,26,3|16,12,4|16,9,4|13,26,5 p:reg/outA|13,12,6 p:pc/out|-7,9,7|-7,5,10 p:insFetch/pc]
W 16 ns:[3,5 p:id/ins|0,5,0|0,3,1|-2,3,2 p:insFetch/ins]

*/

export function exportData(layout: ICpuLayout) {

    let str = "#wire-schema 1\n";

    for (let i = 0; i < layout.comps.length; i++) {
        let comp = layout.comps[i];
        str += `C ${comp.id} ${comp.defId} p:${comp.pos.x},${comp.pos.y}\n`;
    }
    for (let i = 0; i < layout.wires.length; i++) {
        let wire = layout.wires[i];
        str += `W ${wire.id} ns:[`;
        for (let j = 0; j < wire.nodes.length; j++) {
            let node = wire.nodes[j];
            let nodeStr = "";
            if (j > 0) {
                nodeStr += "|";
            }
            let initParts = [node.pos.x, node.pos.y].concat(node.edges.filter(x => x < j));
            nodeStr += initParts.join(",");
            if (node.ref?.type === RefType.CompNode) {
                nodeStr += ` p:${node.ref.id}/${node.ref.compNodeId}`;
            }
            str += nodeStr;
        }
        str += "]\n";
    }

    return str;
}

export interface IImportResult {
   issues: ILineIssue[] | null;
}

export interface ILineIssue {
    issue: string;
    lineNo: number;
    lineContent: string;
    colNo?: number;
}

export function importData(str: string): IImportResult {
    let res: IImportResult = { issues: null };
    let lines = str.split("\n");

    function makeIssue(issue: string, lineIdx: number, colNo?: number) {
        res.issues = res.issues || [];
        res.issues.push({ issue, lineNo: lineIdx + 1, lineContent: lines[lineIdx], colNo });
    }

    if (lines.length === 0 || !lines[0].startsWith('#wire-schema')) {
        makeIssue("Invalid file format: first line must be #wire-schema <version>", 0);
        return res;
    }
    let version = parseInt(lines[0].split(" ")[1]);
    if (version !== 1) {
        makeIssue("Invalid file format: only version 1 is supported", 0);
        return res;
    }

    interface ILinePart {
        text: string;
        label: string;
        value: string;
    }

    function parseLine(a: string): ILinePart[] {
        let res: ILinePart[] = [];
        let re = /\s*(?:([\w]+):)?(\[[^\]]+\]|[^\[\]: ]+)/g;
        let match: RegExpExecArray | null;
        while (!!(match = re.exec(a))) {
            let value = match[2].trim();
            if (value.startsWith("[") && value.endsWith("]")) {
                value = value.substring(1, value.length - 1);
            }
            res.push({ text: match[0].trim(), label: match[1], value });
        }
        return res;
    }

    let comps: IComp[] = [];
    let wires: IWireGraph[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        let lineRaw = lines[lineIdx];
        let line = lineRaw.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }

        let parts = parseLine(line);

        if (parts[0].text === 'C') {
            if (parts.length < 3) {
                makeIssue("Invalid component line: must have at least 3 parts", lineIdx);
                continue;
            }
            let id = parts[1].text;
            let type = parts[2].text;
            for (let j = 3; j < parts.length; j++) {
                let part = parts[j];
                if (part.label === 'p') {
                    let posParts = part.value.split(",");
                    if (posParts.length !== 2) {
                        makeIssue("Invalid component line: p: must have 2 parts", lineIdx);
                        continue;
                    }
                    let x = parseFloat(posParts[0]);
                    let y = parseFloat(posParts[1]);
                    if (isNaN(x) || isNaN(y)) {
                        makeIssue("Invalid component line: p: must have 2 numbers", lineIdx);
                        continue;
                    }
                    comps.push({
                        id,
                        name: id,
                        pos: new Vec3(x, y),
                        size: new Vec3(0, 0),
                        defId: type,
                        ports: [],
                    });
                } else {
                    makeIssue("Invalid component line: unknown part", lineIdx);
                    continue;
                }
            }

        } else if (parts[0].text === 'W') {
            if (parts.length < 3) {
                makeIssue("Invalid wire line: must have at least 3 space-separated parts", lineIdx);
                continue;
            }
            let id = parts[1].text;
            let nodes: IWireGraphNode[] = [];
            for (let part of parts) {
                if (part.label === 'ns') {
                    let nodesStrs = part.value.split("|");
                    for (let nodeStr of nodesStrs) {
                        let nodeParts = parseLine(nodeStr);
                        let posAndEdges = nodeParts[0].text.split(",");
                        if (posAndEdges.length < 2) {
                            makeIssue("Invalid wire node: must have at least 2 parts", lineIdx);
                            continue;
                        }
                        let x = parseFloat(posAndEdges[0]);
                        let y = parseFloat(posAndEdges[1]);
                        if (isNaN(x) || isNaN(y)) {
                            makeIssue("Invalid wire node: must have 2 numbers", lineIdx);
                            continue;
                        }
                        let edges: number[] = [];
                        for (let i = 2; i < posAndEdges.length; i++) {
                            let edge = parseInt(posAndEdges[i]);
                            if (isNaN(edge)) {
                                makeIssue("Invalid wire node: edge must be a number", lineIdx);
                                continue;
                            }
                            edges.push(edge);
                        }

                        let ref: IElRef | undefined;

                        for (let nodePart of nodeParts) {
                            if (nodePart.label === 'p') {
                                let compNodeParts = nodePart.value.split("/");
                                if (compNodeParts.length !== 2) {
                                    makeIssue("Invalid wire node: c: must have 2 parts", lineIdx);
                                    continue;
                                }
                                let compId = compNodeParts[0];
                                let compNodeId = compNodeParts[1];
                                ref = { type: RefType.CompNode, id: compId, compNodeId };
                            }
                        }

                        nodes.push({ id: nodes.length, pos: new Vec3(x, y), edges, ref });
                    }
                }
            }
            wires.push({ id, nodes });
        } else {
            makeIssue(`Unexpected line start letter: '${line[0]}'`, lineIdx);
            continue;
        }

    }

    let outStr = exportData({ comps, wires, nextWireId: 0, nextCompId: 0 });

    if (outStr !== str) {
        makeIssue("Exported data does not match imported data", 0);
        console.log('--- str:\n', str);
        console.log('--- outStr:\n', outStr);
    }

    if (res.issues !== null) {
        console.log(res.issues);
    }

    return res;
}
