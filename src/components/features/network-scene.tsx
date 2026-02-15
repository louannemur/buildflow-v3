"use client";

import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const RADIUS = 4.5;
const DETAIL = 2;
const CONNECTION_DISTANCE = 2.2;
const NODE_SIZE = 0.15;
const CENTER_NODE_SIZE = 0.8;

// Calypso warm palette
const COLORS = {
  primary: new THREE.Color("#C4501A"),   // terracotta accent nodes
  secondary: new THREE.Color("#8B7355"), // warm brown nodes
  line: new THREE.Color("#8B7355"),      // warm brown lines
  center: new THREE.Color("#C4501A"),    // terracotta center
};

function NetworkSphere({ isTalking = false }: { isTalking?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const centerRef = useRef<THREE.Mesh>(null);

  const { basePoints, linePairs, nodeColors } = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(RADIUS, DETAIL);
    const posAttribute = geo.attributes.position;
    const vertexCount = posAttribute.count;

    const tempPoints: THREE.Vector3[] = [];
    const pointSet = new Set<string>();

    for (let i = 0; i < vertexCount; i++) {
      const x = posAttribute.getX(i);
      const y = posAttribute.getY(i);
      const z = posAttribute.getZ(i);
      const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;

      if (!pointSet.has(key)) {
        pointSet.add(key);
        tempPoints.push(new THREE.Vector3(x, y, z));
      }
    }

    const colors = new Float32Array(tempPoints.length * 3);
    const colorObj = new THREE.Color();
    tempPoints.forEach((point, i) => {
      const isAccent = Math.random() > 0.85 || point.y > RADIUS * 0.8;
      colorObj.set(isAccent ? COLORS.primary : COLORS.secondary);
      colorObj.toArray(colors, i * 3);
    });

    const pairs: [number, number][] = [];
    for (let i = 0; i < tempPoints.length; i++) {
      for (let j = i + 1; j < tempPoints.length; j++) {
        if (tempPoints[i].distanceTo(tempPoints[j]) < CONNECTION_DISTANCE) {
          pairs.push([i, j]);
        }
      }
    }

    return { basePoints: tempPoints, linePairs: pairs, nodeColors: colors };
  }, []);

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(linePairs.length * 6);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [linePairs]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      if (!mesh.instanceColor) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(basePoints.length * 3),
          3,
        );
      }
      mesh.instanceColor.array.set(nodeColors);
      mesh.instanceColor.needsUpdate = true;

      const tempObj = new THREE.Object3D();
      for (let i = 0; i < basePoints.length; i++) {
        tempObj.position.copy(basePoints[i]);
        tempObj.updateMatrix();
        mesh.setMatrixAt(i, tempObj.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    const lines = linesRef.current;
    if (lines) {
      const positions = lines.geometry.attributes.position
        .array as Float32Array;
      let posIdx = 0;
      for (let i = 0; i < linePairs.length; i++) {
        const [idx1, idx2] = linePairs[i];
        const p1 = basePoints[idx1];
        const p2 = basePoints[idx2];
        positions[posIdx++] = p1.x;
        positions[posIdx++] = p1.y;
        positions[posIdx++] = p1.z;
        positions[posIdx++] = p2.x;
        positions[posIdx++] = p2.y;
        positions[posIdx++] = p2.z;
      }
      lines.geometry.attributes.position.needsUpdate = true;
    }
  }, [nodeColors, basePoints, linePairs]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (!meshRef.current || !linesRef.current || !groupRef.current) return;

    groupRef.current.rotation.y = time * 0.05;

    if (isTalking) {
      const breath = Math.sin(time * 1.5) * 0.08;
      const talk =
        (Math.sin(time * 15) * 0.5 +
          Math.sin(time * 25) * 0.3 +
          Math.cos(time * 10) * 0.2) *
        0.03;

      groupRef.current.rotation.z = Math.sin(time * 0.5) * 0.05;

      if (centerRef.current) {
        const centerScale = 1 + Math.sin(time * 2) * 0.1 + talk * 2;
        centerRef.current.scale.setScalar(centerScale);
      }

      const currentPositions: THREE.Vector3[] = [];
      const tempObj = new THREE.Object3D();

      for (let i = 0; i < basePoints.length; i++) {
        const p = basePoints[i];
        const warbleX = Math.sin(p.y * 0.5 + time * 3) * 0.1;
        const warbleY = Math.cos(p.x * 0.5 + time * 2.5) * 0.1;
        const warbleZ = Math.sin(p.z * 0.5 + time * 2) * 0.1;
        const totalScale = 1 + breath + talk;

        const newPos = new THREE.Vector3(
          p.x * totalScale + warbleX,
          p.y * totalScale + warbleY,
          p.z * totalScale + warbleZ,
        );
        currentPositions.push(newPos);

        tempObj.position.copy(newPos);
        tempObj.updateMatrix();
        meshRef.current!.setMatrixAt(i, tempObj.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;

      const positions = linesRef.current.geometry.attributes.position
        .array as Float32Array;
      let posIdx = 0;
      for (let i = 0; i < linePairs.length; i++) {
        const [idx1, idx2] = linePairs[i];
        const p1 = currentPositions[idx1];
        const p2 = currentPositions[idx2];
        positions[posIdx++] = p1.x;
        positions[posIdx++] = p1.y;
        positions[posIdx++] = p1.z;
        positions[posIdx++] = p2.x;
        positions[posIdx++] = p2.y;
        positions[posIdx++] = p2.z;
      }
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    } else {
      groupRef.current.rotation.z = 0;
      if (centerRef.current) centerRef.current.scale.setScalar(1);

      const tempObj = new THREE.Object3D();
      for (let i = 0; i < basePoints.length; i++) {
        tempObj.position.copy(basePoints[i]);
        tempObj.updateMatrix();
        meshRef.current!.setMatrixAt(i, tempObj.matrix);
      }
      meshRef.current.instanceMatrix.needsUpdate = true;

      const positions = linesRef.current.geometry.attributes.position
        .array as Float32Array;
      let posIdx = 0;
      for (let i = 0; i < linePairs.length; i++) {
        const [idx1, idx2] = linePairs[i];
        const p1 = basePoints[idx1];
        const p2 = basePoints[idx2];
        positions[posIdx++] = p1.x;
        positions[posIdx++] = p1.y;
        positions[posIdx++] = p1.z;
        positions[posIdx++] = p2.x;
        positions[posIdx++] = p2.y;
        positions[posIdx++] = p2.z;
      }
      linesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={centerRef} position={[0, 0, 0]}>
        <sphereGeometry args={[CENTER_NODE_SIZE, 32, 32]} />
        <meshBasicMaterial color={COLORS.center} />
      </mesh>

      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial color={COLORS.line} transparent opacity={0.4} />
      </lineSegments>

      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, basePoints.length]}
      >
        <sphereGeometry args={[NODE_SIZE, 16, 16]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

export function NetworkScene({ isTalking = false }: { isTalking?: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 14], fov: 50 }}
      style={{
        background: "transparent",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <NetworkSphere isTalking={isTalking} />
    </Canvas>
  );
}
