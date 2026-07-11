from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import shutil
from pathlib import Path
import time
import networkx as nx

from config import INPUT_DIR, neo4j_config, setup_logging
from generate_mock_data import generate_all_documents
from pipeline import NexusGuardPipeline
from graph_engine import GraphConnection, GraphBuilder, GraphQueryEngine, NEO4J_AVAILABLE
from fraud_detector import FraudDetector

setup_logging()

app = FastAPI(title="NexusGuard API", description="Offline Fraud Detection System Backend")

# Enable CORS for the local React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Neo4jConfigSchema(BaseModel):
    uri: str
    username: str
    password: str

class CypherQuery(BaseModel):
    query: str

# Global state for prototype
state = {
    "neo4j_ok": False,
    "graph_conn": None,
    "cached_result": None,
}

def get_connection(cfg: Optional[Neo4jConfigSchema] = None) -> Optional[GraphConnection]:
    if cfg:
        neo4j_config.uri = cfg.uri
        neo4j_config.username = cfg.username
        neo4j_config.password = cfg.password
    
    if not NEO4J_AVAILABLE:
        return None
    
    if state["graph_conn"] and state["graph_conn"].connected and state["graph_conn"].test_connection():
        return state["graph_conn"]
        
    conn = GraphConnection(neo4j_config)
    ok = conn.connect()
    state["neo4j_ok"] = ok
    state["graph_conn"] = conn if ok else None
    return conn if ok else None

# Pre-connect attempt
get_connection()

@app.get("/api/status")
def get_status():
    docs = list(INPUT_DIR.glob("*.txt")) + list(INPUT_DIR.glob("*.pdf"))
    spacy_ok = True
    try:
        import spacy; spacy.load("en_core_web_sm")
    except Exception:
        spacy_ok = False
        
    return {
        "neo4j_connected": state["neo4j_ok"],
        "spacy_loaded": spacy_ok,
        "documents_ready": len(docs),
        "neo4j_uri": neo4j_config.uri
    }

@app.post("/api/connect-neo4j")
def connect_neo4j(cfg: Neo4jConfigSchema):
    conn = get_connection(cfg)
    if conn:
        return {"status": "success", "message": "Connected to Neo4j"}
    raise HTTPException(status_code=500, detail="Failed to connect to Neo4j. Check your credentials.")

@app.post("/api/generate-docs")
def generate_docs():
    try:
        paths = generate_all_documents()
        return {"status": "success", "message": f"Generated {len(paths)} documents."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents")
def list_documents():
    docs = []
    for f in sorted(INPUT_DIR.iterdir()):
        if f.suffix.lower() in {".txt", ".pdf", ".png", ".jpg", ".jpeg"}:
            docs.append({
                "filename": f.name,
                "size_bytes": f.stat().st_size,
                "file_type": f.suffix[1:].upper()
            })
    return docs

@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".txt", ".pdf", ".png", ".jpg", ".jpeg"}:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use .txt, .pdf, or images.")
    
    filepath = INPUT_DIR / file.filename
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"status": "success", "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    filepath = INPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        filepath.unlink()
        return {"status": "success", "message": f"Deleted {filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/documents/{filename}")
def get_document_details(filename: str):
    filepath = INPUT_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    from pipeline import _read_text, _classify_document
    text = _read_text(filepath)
    doc_type = _classify_document(text, filename)
    
    # Run a isolated extraction pipeline on just this single file
    pipeline = NexusGuardPipeline()
    from pipeline import Document
    doc = Document(id="temp_doc", filename=filename, doc_type=doc_type, raw_text=text)
    entities = pipeline.extract_entities(doc)
    relationships = pipeline.extract_relationships(doc, entities)
    
    return {
        "filename": filename,
        "doc_type": doc_type,
        "raw_text": text,
        "entities": [
            {
                "id": e.id,
                "name": e.name,
                "entity_type": e.entity_type,
                "attributes": e.attributes
            } for e in entities
        ],
        "relationships": [
            {
                "src": r.source_entity_id,
                "tgt": r.target_entity_id,
                "rel_type": r.rel_type,
                "confidence": r.confidence
            } for r in relationships
        ]
    }

def run_local_cypher(query: str) -> List[Dict[str, Any]]:
    query_lower = query.lower()
    
    # Ensure cached result is populated
    if not state.get("cached_result"):
        pipeline = NexusGuardPipeline()
        state["cached_result"] = pipeline.run_full_pipeline(INPUT_DIR)
        
    result = state["cached_result"]
    detector = FraudDetector(None, result)
    
    # 1. Preset 1: Show Full Graph
    if "match (n)-[r]->(m)" in query_lower or "match (n)" in query_lower:
        records = []
        for r in result.relationships:
            src_name = next((e.name for e in result.entities if e.id == r.source_entity_id), r.source_entity_id)
            tgt_name = next((e.name for e in result.entities if e.id == r.target_entity_id), r.target_entity_id)
            src_type = next((e.entity_type for e in result.entities if e.id == r.source_entity_id), "UNKNOWN")
            tgt_type = next((e.entity_type for e in result.entities if e.id == r.target_entity_id), "UNKNOWN")
            
            records.append({
                "Source Node": f"{src_name} ({src_type})",
                "Relationship": r.rel_type,
                "Target Node": f"{tgt_name} ({tgt_type})",
                "Confidence": f"{int(r.confidence * 100)}%"
            })
        if not records:
            for e in result.entities:
                records.append({
                    "Node Name": e.name,
                    "Entity Type": e.entity_type,
                    "Identifier (PAN/CIN/DIN)": e.attributes.get("pan") or e.attributes.get("cin") or e.attributes.get("din") or "N/A",
                    "Source Doc": ", ".join(e.source_documents)
                })
        return records
        
    # 2. Preset 2: Address Overlap
    elif "address" in query_lower:
        alerts = detector.detect_address_reuse()
        records = []
        for a in alerts:
            entities = [ent["name"] for ent in a.involved_entities]
            addr = a.evidence_path[0].replace("Address node: ", "") if a.evidence_path else "Unknown Address"
            records.append({
                "Shared Address": addr,
                "Overlapping Entities": ", ".join(entities),
                "Overlapping Count": len(entities),
                "Risk Level": a.severity
            })
        return records
        
    # 3. Preset 3: Collateral Double-Pledge / Lien Conflicts
    elif "applied_for_loan_with" in query_lower or "owns_asset" in query_lower:
        alerts = detector.detect_collateral_conflicts() + detector.detect_ownership_conflicts()
        records = []
        for a in alerts:
            entities = {ent["role"]: ent["name"] for ent in a.involved_entities}
            records.append({
                "Alert Title": a.title,
                "Involved Parties": ", ".join(f"{role}: {name}" for role, name in entities.items()),
                "RBI Compliance Category": a.rbi_risk_category,
                "Underwriter Status": a.severity
            })
        return records
        
    # 4. Preset 4: Guarantor Loops / Cycles
    elif "guarantor_for" in query_lower or "cycle" in query_lower:
        alerts = detector.detect_network_cycles()
        records = []
        for a in alerts:
            entities = [ent["name"] for ent in a.involved_entities]
            records.append({
                "Loop Participants": ", ".join(entities),
                "Risk Classification": a.rbi_risk_category,
                "Overall Severity": a.severity,
                "Mitigation Action": a.recommendations[0] if a.recommendations else "Audit account"
            })
        return records
        
    # Default fallback: list all entities
    records = []
    for e in result.entities:
        records.append({
            "Entity Name": e.name,
            "Type": e.entity_type,
            "Unique ID": e.id,
            "PAN/CIN/DIN": e.attributes.get("pan") or e.attributes.get("cin") or e.attributes.get("din") or "N/A",
            "Location/Address": e.attributes.get("full_address") or "N/A"
        })
    return records

@app.post("/api/cypher")
def execute_cypher(query_body: CypherQuery):
    conn = get_connection()
    if conn:
        try:
            qe = GraphQueryEngine(conn)
            records = qe.run_custom_query(query_body.query)
            return {"status": "success", "data": records}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        try:
            records = run_local_cypher(query_body.query)
            return {"status": "success", "data": records}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/run-pipeline")
def run_pipeline(clear_graph: bool = True):
    docs_in = list(INPUT_DIR.glob("*.txt")) + list(INPUT_DIR.glob("*.pdf")) + list(INPUT_DIR.glob("*.png")) + list(INPUT_DIR.glob("*.jpg")) + list(INPUT_DIR.glob("*.jpeg"))
    if not docs_in:
        raise HTTPException(status_code=400, detail="No documents found. Upload documents or generate mock data first.")
        
    conn = get_connection()
    pipeline = NexusGuardPipeline()
    
    # 1. NLP Ingestion and Extraction
    result = pipeline.run_full_pipeline(INPUT_DIR)
    state["cached_result"] = result
    
    metrics = {
        "documents": len(result.documents),
        "entities": len(result.entities),
        "relationships": len(result.relationships),
    }
    
    alerts = []
    risk_score = 0.0
    overall_severity = "NONE"
    run_mode = "networkx"
    
    graph_data = {"nodes": [], "edges": []}
    
    # Pre-populate graph data in case Neo4j is offline
    G = nx.DiGraph()
    for e in result.entities:
        G.add_node(e.id, name=e.name, label=e.entity_type)
        graph_data["nodes"].append({
            "id": e.id, 
            "name": e.name, 
            "label": e.entity_type, 
            "props": e.attributes
        })
    for r in result.relationships:
        if r.source_entity_id in G and r.target_entity_id in G:
            graph_data["edges"].append({
                "src": r.source_entity_id, 
                "tgt": r.target_entity_id, 
                "rel_type": r.rel_type
            })

    # 2. Neo4j Integration
    if conn:
        run_mode = "neo4j"
        if clear_graph:
            conn.clear_database()
        
        # Merge entities into Neo4j
        builder = GraphBuilder(conn)
        builder.build_graph_from_extraction(result)
        
        # Execute Neo4j cypher fraud detections
        detector = FraudDetector(conn, result)
        det_result = detector.run_all_detections()
        
        # Format alerts
        for a in det_result["alerts"]:
            alerts.append({
                "alert_id": a.alert_id,
                "title": a.title,
                "description": a.description,
                "severity": a.severity,
                "risk_score": a.risk_score,
                "alert_type": a.alert_type,
                "involved_entities": a.involved_entities,
                "evidence_path": a.evidence_path,
                "recommendations": a.recommendations,
                "cypher_query": a.cypher_query,
                "timestamp": a.timestamp,
                "rbi_risk_category": a.rbi_risk_category,
                "evidence_nodes": a.evidence_nodes,
                "underwriter_recommendation": a.underwriter_recommendation,
            })
            
        risk_score = det_result["overall_risk_score"]
        overall_severity = det_result["overall_severity"]
        
        # Update visualization data from Neo4j
        qe = GraphQueryEngine(conn)
        neo4j_graph = qe.get_full_graph()
        if neo4j_graph:
            graph_data = neo4j_graph
    else:
        # Fallback to local NetworkX engine
        run_mode = "networkx"
        detector = FraudDetector(None, result)
        det_result = detector.run_all_detections()
        
        for a in det_result["alerts"]:
            alerts.append({
                "alert_id": a.alert_id,
                "title": a.title,
                "description": a.description,
                "severity": a.severity,
                "risk_score": a.risk_score,
                "alert_type": a.alert_type,
                "involved_entities": a.involved_entities,
                "evidence_path": a.evidence_path,
                "recommendations": a.recommendations,
                "cypher_query": a.cypher_query,
                "timestamp": a.timestamp,
                "rbi_risk_category": a.rbi_risk_category,
                "evidence_nodes": a.evidence_nodes,
                "underwriter_recommendation": a.underwriter_recommendation,
            })
            
        risk_score = det_result["overall_risk_score"]
        overall_severity = det_result["overall_severity"]

    return {
        "status": "success",
        "run_mode": run_mode,
        "metrics": metrics,
        "alerts": alerts,
        "risk_score": risk_score,
        "overall_severity": overall_severity,
        "graph_data": graph_data,
        "logs": result.processing_log
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
