"""
NexusGuard — Neo4j Graph Engine
================================
Manages all interactions with the local Neo4j graph database:
node/relationship creation, constraints, stats, and raw query
execution.

Requires a running Neo4j instance:
  bolt://localhost:7687   (default Bolt port)
  http://localhost:7474   (Neo4j Browser)

100 % offline — no network calls beyond localhost.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Dict, Generator, List, Optional

from config import neo4j_config, Neo4jConfig

logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────
# Optional neo4j driver
# ────────────────────────────────────────────────────────────────────
try:
    from neo4j import GraphDatabase
    from neo4j.exceptions import (
        ServiceUnavailable,
        AuthError,
        SessionExpired,
        ClientError,
    )
    NEO4J_AVAILABLE = True
except ImportError:
    NEO4J_AVAILABLE = False
    ServiceUnavailable = AuthError = SessionExpired = ClientError = Exception
    logger.warning("neo4j Python driver not installed.  Graph features disabled.")


# ════════════════════════════════════════════════════════════════════
#  GraphConnection
# ════════════════════════════════════════════════════════════════════

class GraphConnection:
    """
    Manages the lifecycle of a Neo4j Bolt connection.

    Usage
    ─────
    >>> conn = GraphConnection()
    >>> if conn.connect():
    ...     with conn.session() as s:
    ...         s.run("RETURN 1")
    """

    def __init__(self, config: Optional[Neo4jConfig] = None):
        self._config = config or neo4j_config
        self._driver = None
        self.connected: bool = False

    # ── Connection management ─────────────────────────────────────

    def connect(self) -> bool:
        """Open the Bolt connection.  Returns True on success."""
        if not NEO4J_AVAILABLE:
            logger.error("neo4j driver not installed — cannot connect.")
            return False
        try:
            self._driver = GraphDatabase.driver(
                self._config.uri,
                auth=(self._config.username, self._config.password),
                max_connection_lifetime=self._config.max_connection_lifetime,
                max_connection_pool_size=self._config.max_connection_pool_size,
                connection_timeout=self._config.connection_timeout,
            )
            # Verify immediately
            self._driver.verify_connectivity()
            self.connected = True
            logger.info("Connected to Neo4j at %s", self._config.uri)
            return True
        except AuthError:
            logger.error(
                "Neo4j auth failed.  Check credentials (user=%s).",
                self._config.username,
            )
        except ServiceUnavailable:
            logger.error(
                "Neo4j unreachable at %s.  Is the database running?",
                self._config.uri,
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Neo4j connection error: %s", exc)
        self.connected = False
        return False

    def disconnect(self) -> None:
        """Close the connection pool gracefully."""
        if self._driver:
            try:
                self._driver.close()
            except Exception:  # noqa: BLE001
                pass
            self._driver = None
        self.connected = False
        logger.info("Disconnected from Neo4j.")

    @contextmanager
    def session(self) -> Generator:
        """Context manager yielding a Neo4j session."""
        if not self._driver:
            raise RuntimeError("Not connected.  Call connect() first.")
        sess = self._driver.session(database=self._config.database)
        try:
            yield sess
        finally:
            sess.close()

    def test_connection(self) -> bool:
        """Ping the database with a trivial query."""
        if not self.connected:
            return False
        try:
            with self.session() as s:
                s.run("RETURN 1").consume()
            return True
        except Exception:  # noqa: BLE001
            self.connected = False
            return False

    def clear_database(self) -> None:
        """Delete ALL nodes and relationships (used before re-runs)."""
        if not self.connected:
            logger.warning("Cannot clear — not connected.")
            return
        with self.session() as s:
            s.run("MATCH (n) DETACH DELETE n").consume()
        logger.info("Database cleared.")

    def get_stats(self) -> Dict[str, Any]:
        """Return basic graph statistics."""
        if not self.connected:
            return {}
        try:
            with self.session() as s:
                node_count = s.run("MATCH (n) RETURN count(n) AS c").single()["c"]
                rel_count  = s.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
                labels_raw = s.run(
                    "CALL db.labels() YIELD label RETURN label"
                ).data()
                labels = [r["label"] for r in labels_raw]
                label_counts: Dict[str, int] = {}
                for lbl in labels:
                    cnt = s.run(
                        f"MATCH (n:{lbl}) RETURN count(n) AS c"
                    ).single()["c"]
                    label_counts[lbl] = cnt
            return {
                "node_count": node_count,
                "relationship_count": rel_count,
                "labels": label_counts,
            }
        except Exception as exc:  # noqa: BLE001
            logger.error("get_stats error: %s", exc)
            return {}


# ════════════════════════════════════════════════════════════════════
#  GraphBuilder
# ════════════════════════════════════════════════════════════════════

class GraphBuilder:
    """
    Translates ExtractionResult entities/relationships into
    Neo4j nodes and edges via parameterised Cypher MERGE statements.
    """

    def __init__(self, connection: GraphConnection):
        self._conn = connection

    # ── Schema constraints ────────────────────────────────────────

    def create_constraints(self) -> None:
        """Create uniqueness constraints if they don't exist."""
        constraints = [
            "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Person)       REQUIRE n.entity_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Asset)        REQUIRE n.entity_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Address)      REQUIRE n.entity_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Company)      REQUIRE n.entity_id IS UNIQUE",
            "CREATE CONSTRAINT IF NOT EXISTS FOR (n:Organization) REQUIRE n.entity_id IS UNIQUE",
        ]
        with self._conn.session() as s:
            for cypher in constraints:
                try:
                    s.run(cypher).consume()
                except ClientError:
                    # Older Neo4j editions — ignore
                    pass
        logger.info("Schema constraints applied.")

    # ── Node MERGE helpers ────────────────────────────────────────

    def merge_person(self, entity) -> None:
        cypher = """
        MERGE (n:Person {entity_id: $entity_id})
        SET n.name           = $name,
            n.canonical_name = $canonical_name,
            n.pan            = $pan,
            n.aadhaar        = $aadhaar,
            n.updated_at     = datetime()
        """
        with self._conn.session() as s:
            s.run(cypher, {
                "entity_id":      entity.id,
                "name":           entity.name,
                "canonical_name": entity.canonical_name,
                "pan":            entity.attributes.get("pan", ""),
                "aadhaar":        entity.attributes.get("aadhaar", ""),
            }).consume()

    def merge_asset(self, entity) -> None:
        cypher = """
        MERGE (n:Asset {entity_id: $entity_id})
        SET n.name          = $name,
            n.survey_number = $survey_number,
            n.asset_type    = $asset_type,
            n.updated_at    = datetime()
        """
        with self._conn.session() as s:
            s.run(cypher, {
                "entity_id":     entity.id,
                "name":          entity.name,
                "survey_number": entity.attributes.get("survey_number", entity.name),
                "asset_type":    entity.attributes.get("type", "land"),
            }).consume()

    def merge_address(self, entity) -> None:
        cypher = """
        MERGE (n:Address {entity_id: $entity_id})
        SET n.full_address   = $full_address,
            n.pincode        = $pincode,
            n.canonical_name = $canonical_name,
            n.updated_at     = datetime()
        """
        with self._conn.session() as s:
            s.run(cypher, {
                "entity_id":     entity.id,
                "full_address":  entity.attributes.get("full_address", entity.name),
                "pincode":       entity.attributes.get("pincode", ""),
                "canonical_name": entity.canonical_name,
            }).consume()

    def merge_company(self, entity) -> None:
        cypher = """
        MERGE (n:Company {entity_id: $entity_id})
        SET n.name           = $name,
            n.canonical_name = $canonical_name,
            n.cin            = $cin,
            n.updated_at     = datetime()
        """
        with self._conn.session() as s:
            s.run(cypher, {
                "entity_id":      entity.id,
                "name":           entity.name,
                "canonical_name": entity.canonical_name,
                "cin":            entity.attributes.get("cin", ""),
            }).consume()

    def merge_organization(self, entity) -> None:
        cypher = """
        MERGE (n:Organization {entity_id: $entity_id})
        SET n.name           = $name,
            n.canonical_name = $canonical_name,
            n.cin            = $cin,
            n.updated_at     = datetime()
        """
        with self._conn.session() as s:
            s.run(cypher, {
                "entity_id":      entity.id,
                "name":           entity.name,
                "canonical_name": entity.canonical_name,
                "cin":            entity.attributes.get("cin", ""),
            }).consume()

    def _merge_node(self, entity) -> None:
        et = entity.entity_type
        if et == "PERSON":
            self.merge_person(entity)
        elif et == "ASSET":
            self.merge_asset(entity)
        elif et == "ADDRESS":
            self.merge_address(entity)
        elif et == "ORGANIZATION":
            # Use Company label for companies, Organization for banks etc.
            if any(kw in entity.name.lower() for kw in ("holdings", "pvt", "ltd", "llp")):
                self.merge_company(entity)
            else:
                self.merge_organization(entity)
        else:
            logger.warning("Unknown entity type '%s' for %s", et, entity.name)

    # ── Relationship creation ─────────────────────────────────────

    def create_relationship(self, relationship) -> None:
        """
        Generic relationship creator — dispatches on rel_type.
        Both endpoints must already exist as nodes.
        """
        rel_type = relationship.rel_type.upper()
        cypher = f"""
        MATCH (src {{entity_id: $src_id}})
        MATCH (tgt {{entity_id: $tgt_id}})
        MERGE (src)-[r:{rel_type}]->(tgt)
        SET r.confidence      = $confidence,
            r.source_document = $source_doc,
            r.created_at      = datetime()
        """
        with self._conn.session() as s:
            try:
                s.run(cypher, {
                    "src_id":     relationship.source_entity_id,
                    "tgt_id":     relationship.target_entity_id,
                    "confidence": relationship.confidence,
                    "source_doc": relationship.source_document,
                }).consume()
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "Relationship creation failed (%s → %s [%s]): %s",
                    relationship.source_entity_id,
                    relationship.target_entity_id,
                    rel_type, exc,
                )

    # ── Full graph build ──────────────────────────────────────────

    def build_graph_from_extraction(self, extraction_result) -> Dict[str, int]:
        """
        Iterate through ExtractionResult and push everything into Neo4j.
        Returns a summary dict with counts.
        """
        self.create_constraints()
        nodes_created = 0
        rels_created  = 0

        logger.info("Building graph — %d entities, %d relationships.",
                    len(extraction_result.entities),
                    len(extraction_result.relationships))

        for entity in extraction_result.entities:
            try:
                self._merge_node(entity)
                nodes_created += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("Node merge failed for %s: %s", entity.name, exc)

        for rel in extraction_result.relationships:
            try:
                self.create_relationship(rel)
                rels_created += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("Relationship failed: %s", exc)

        summary = {"nodes_created": nodes_created, "relationships_created": rels_created}
        logger.info("Graph build complete: %s", summary)
        return summary


# ════════════════════════════════════════════════════════════════════
#  GraphQueryEngine
# ════════════════════════════════════════════════════════════════════

class GraphQueryEngine:
    """Execute Cypher queries and return serialisable Python structures."""

    def __init__(self, connection: GraphConnection):
        self._conn = connection

    def _run(self, cypher: str, params: Optional[Dict] = None) -> List[Dict]:
        if not self._conn.connected:
            return []
        try:
            with self._conn.session() as s:
                result = s.run(cypher, params or {})
                return [dict(record) for record in result]
        except Exception as exc:  # noqa: BLE001
            logger.error("Query error: %s\nCypher: %s", exc, cypher)
            return []

    def get_full_graph(self) -> Dict[str, List]:
        """Return all nodes and relationships for visualisation."""
        nodes_raw = self._run(
            "MATCH (n) RETURN "
            "  elementId(n) AS id, "
            "  labels(n) AS labels, "
            "  properties(n) AS props"
        )
        edges_raw = self._run(
            "MATCH (a)-[r]->(b) RETURN "
            "  elementId(a) AS src, "
            "  elementId(b) AS tgt, "
            "  type(r) AS rel_type, "
            "  properties(r) AS props"
        )
        nodes = [
            {
                "id": r["id"],
                "label": r["labels"][0] if r["labels"] else "Node",
                "name": r["props"].get("name", r["props"].get("full_address", "?")),
                "props": r["props"],
            }
            for r in nodes_raw
        ]
        edges = [
            {
                "src": r["src"],
                "tgt": r["tgt"],
                "rel_type": r["rel_type"],
                "props": r["props"],
            }
            for r in edges_raw
        ]
        return {"nodes": nodes, "edges": edges}

    def get_node_by_id(self, entity_id: str) -> Optional[Dict]:
        rows = self._run(
            "MATCH (n {entity_id: $eid}) RETURN properties(n) AS props, labels(n) AS labels",
            {"eid": entity_id},
        )
        return rows[0] if rows else None

    def run_custom_query(self, cypher: str, params: Optional[Dict] = None) -> List[Dict]:
        return self._run(cypher, params)

    def get_cypher_for_visualization(self) -> str:
        """Return ready-to-use Cypher snippets for Neo4j Browser."""
        return """
// ═══════════════════════════════════════════════════════════════════
//  NexusGuard — Neo4j Browser Queries
//  Paste any of these into http://localhost:7474
// ═══════════════════════════════════════════════════════════════════

// 1. Full graph (all nodes & relationships)
MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100;

// 2. Address Overlap — find entities sharing the same address
MATCH (addr:Address)<-[:REGISTERED_AT|RESIDES_AT]-(entity)
WITH addr, collect(entity) AS entities, count(entity) AS cnt
WHERE cnt >= 2
RETURN addr.full_address AS address, [e IN entities | e.name] AS shared_by, cnt
ORDER BY cnt DESC;

// 3. Collateral Conflict — asset pledged AND transferred
MATCH (applicant:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset:Asset)
MATCH (asset)<-[:OWNS_ASSET]-(owner)
WHERE applicant.entity_id <> owner.entity_id
RETURN applicant.name AS loan_applicant, asset.name AS disputed_asset,
       owner.name AS current_owner;

// 4. Guarantor Network — Applicant B's guarantor connected to Applicant A
MATCH (b:Person)-[:APPLIED_FOR_LOAN_WITH]->(asset_b:Asset)
MATCH (guarantor:Person)-[:GUARANTOR_FOR]->(b)
MATCH (guarantor)-[:GUARANTOR_FOR]->(a:Person)
WHERE a.entity_id <> b.entity_id
MATCH (a)-[:APPLIED_FOR_LOAN_WITH]->(asset_a:Asset)
RETURN a.name AS applicant_a, b.name AS applicant_b,
       guarantor.name AS shared_guarantor,
       asset_a.name AS collateral_a, asset_b.name AS collateral_b;

// 5. Shell Company — director is also a loan guarantor
MATCH (p:Person)-[:DIRECTOR_OF]->(c:Company)
MATCH (p)-[:GUARANTOR_FOR]->(other:Person)
RETURN p.name AS suspect_person, c.name AS company,
       other.name AS guaranteed_borrower;

// 6. Lien vs Transfer conflict — asset under lien but ownership transferred
MATCH (asset:Asset)-[:HAS_LIEN_BY]->(bank)
MATCH (new_owner)-[:OWNS_ASSET]->(asset)
RETURN asset.name AS asset, bank.name AS lien_holder, new_owner.name AS new_owner;

// 7. All paths up to 4 hops between Rajesh and Apex Holdings
MATCH p=shortestPath(
  (a:Person {canonical_name: 'rajesh kumar'})-[*1..4]-
  (b:Company {canonical_name: 'apex holdings pvt. ltd.'})
)
RETURN p;
""".strip()
