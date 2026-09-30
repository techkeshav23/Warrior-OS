// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Warrior 3D: the canvas (client-only)
// The full R3F scene for one stage: fog, lights, reflections, the
// warrior (GLB or procedural), arc reactor, aura, sparks, platform,
// embers, bloom and the variant's camera. Loaded only through
// next/dynamic({ ssr: false }) by WarriorStage.
// ═══════════════════════════════════════════════════════════

'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useWarriorModel } from './model';
import { PlaceholderWarrior } from './PlaceholderWarrior';
import { GlbWarrior } from './GlbWarrior';
import { ArcReactor, type ReactorAnchor } from './ArcReactor';
import { Platform } from './Platform';
import { Aura, DecaySparks, Embers } from './effects';
import { Bloom, ForgeEnvironment } from './postfx';
import { createFx, type WarriorFx } from './pose';
import { glitchJolt } from './flicker';
import type { WarriorBaseAction, WarriorLook, WarriorVariant } from './types';

export interface WarriorCanvasProps {
  variant: WarriorVariant;
  look: WarriorLook;
  baseAction: WarriorBaseAction;
  stageId: string;
  /** Force the reactor's speaking state; undefined = follow NEXUS. */
  speaking?: boolean;
  /** False → frameloop 'never' (off-screen / hidden tab / paused). */
  active: boolean;
  reducedMotion: boolean;
  /** Called when WebGL context creation fails. */
  onContextLost?: () => void;
}

const BG = '#031318';
const FOG = '#041a20';

interface VariantConfig {
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  dpr: [number, number];
  bloom: boolean;
  shadows: boolean;
  reflective: boolean;
  embers: number;
  fullPlatform: boolean;
  fog: number;
}

const CONFIG: Record<WarriorVariant, VariantConfig> = {
  hero: { fov: 30, position: [2.2, 1.25, 4.6], target: [0, 0.96, 0], dpr: [1, 1.75], bloom: true, shadows: false, reflective: true, embers: 160, fullPlatform: true, fog: 0.075 },
  hall: { fov: 35, position: [1.9, 1.45, 3.3], target: [0, 0.95, 0], dpr: [1, 2], bloom: true, shadows: true, reflective: true, embers: 220, fullPlatform: true, fog: 0.065 },
  card: { fov: 30, position: [1.5, 1.2, 4.0], target: [0, 1.0, 0], dpr: [1, 1.5], bloom: false, shadows: false, reflective: false, embers: 40, fullPlatform: false, fog: 0.09 },
};

/** Hero: a slow cinematic swing around the warrior, low heroic angle. */
function HeroCamera({ target, still }: { target: [number, number, number]; still: boolean }) {
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new THREE.Vector3(...target), [target]);
  useFrame((state) => {
    const t = still ? 0 : state.clock.elapsedTime;
    const a = 0.45 + Math.sin(t * 0.09) * 0.42;
    const r = 4.75 + Math.sin(t * 0.13) * 0.2;
    camera.position.set(Math.sin(a) * r, 1.05 + Math.sin(t * 0.11) * 0.12, Math.cos(a) * r);
    camera.lookAt(look);
  });
  return null;
}

function FixedCamera({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  const look = useMemo(() => new THREE.Vector3(...target), [target]);
  useFrame(() => camera.lookAt(look));
  return null;
}

function Lights({ shadows }: { shadows: boolean }) {
  return (
    <>
      <hemisphereLight args={['#1d5563', '#020506', 0.35]} />
      <directionalLight
        position={[2.5, 4.2, 3.4]}
        intensity={1.1}
        color="#e3edf2"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2.5}
        shadow-camera-bottom={-0.5}
        shadow-camera-near={1}
        shadow-camera-far={10}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {/* Rim lights: plasma behind-left, ember behind-right. */}
      <directionalLight position={[-3.2, 2.6, -2.8]} intensity={6} color="#2fd6f5" />
      <directionalLight position={[3.4, 1.6, -2.4]} intensity={4.5} color="#ff7a2a" />
      <spotLight position={[0.6, 5, 2.6]} angle={0.38} penumbra={0.9} intensity={3} distance={9} decay={2} color="#bff4ff" />
      <pointLight position={[0, 0.25, 0.9]} intensity={1.6} distance={3} decay={2} color="#2fd6f5" />
    </>
  );
}

/** Warrior + reactor + aura + sparks, with decay glitch jitter on the group. */
function WarriorRoot({ look, baseAction, stageId, speaking, fxRef, variant, motion }: {
  look: WarriorLook;
  baseAction: WarriorBaseAction;
  stageId: string;
  speaking?: boolean;
  fxRef: React.RefObject<WarriorFx>;
  variant: WarriorVariant;
  motion: number;
}) {
  const model = useWarriorModel();
  const anchorRef = useRef<ReactorAnchor | null>(null);
  const root = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const j = glitchJolt(state.clock.elapsedTime, look.damage, look.critical);
    g.position.x = j * 0.035;
    g.rotation.y = 0.15 + j * 0.05;
  });
  const figureProps = { look, baseAction, stageId, fxRef, anchorRef, motion };
  return (
    <group ref={root} rotation={[0, 0.15, 0]}>
      {model.status === 'glb' && model.asset ? (
        <GlbWarrior key="glb" asset={model.asset} {...figureProps} />
      ) : model.usePlaceholder ? (
        <PlaceholderWarrior key="placeholder" {...figureProps} />
      ) : null}
      <ArcReactor anchorRef={anchorRef} fxRef={fxRef} look={look} speaking={speaking} light={variant !== 'card'} />
      {variant !== 'card' && <Aura look={look} fxRef={fxRef} />}
      <DecaySparks active={look.critical} />
    </group>
  );
}

export default function WarriorCanvas({ variant, look, baseAction, stageId, speaking, active, reducedMotion, onContextLost }: WarriorCanvasProps) {
  const cfg = CONFIG[variant];
  const fxRef = useRef<WarriorFx>(createFx());
  const motion = reducedMotion ? 0.25 : 1;

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={cfg.dpr}
      shadows={cfg.shadows ? 'percentage' : false}
      gl={{ antialias: true, powerPreference: variant === 'card' ? 'low-power' : 'high-performance', alpha: false }}
      camera={{ fov: cfg.fov, position: cfg.position, near: 0.1, far: 60 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.95;
        gl.domElement.addEventListener('webglcontextlost', () => onContextLost?.(), { once: true });
      }}
      style={{ background: BG }}
    >
      <color attach="background" args={[BG]} />
      <fogExp2 attach="fog" args={[FOG, cfg.fog]} />
      <ForgeEnvironment intensity={1} />
      <Lights shadows={cfg.shadows} />
      <WarriorRoot look={look} baseAction={baseAction} stageId={stageId} speaking={speaking} fxRef={fxRef} variant={variant} motion={motion} />
      <Platform look={look} fxRef={fxRef} reflective={cfg.reflective} full={cfg.fullPlatform} receiveShadow={cfg.shadows} />
      <Embers count={reducedMotion ? Math.round(cfg.embers / 3) : cfg.embers} fxRef={fxRef} />
      {cfg.bloom && <Bloom fxRef={fxRef} strength={0.4} radius={0.1} threshold={1.1} />}
      {variant === 'hero' && <HeroCamera target={cfg.target} still={reducedMotion} />}
      {variant === 'card' && <FixedCamera target={cfg.target} />}
      {variant === 'hall' && (
        <OrbitControls
          target={cfg.target}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={2.2}
          maxDistance={5.2}
          minPolarAngle={0.35}
          maxPolarAngle={1.6}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.45}
          makeDefault
        />
      )}
    </Canvas>
  );
}
