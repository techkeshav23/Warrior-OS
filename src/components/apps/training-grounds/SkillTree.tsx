// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Skill Tree (Constellation Map)
// Every deck is a hub and its topics orbit it as nodes: colour =
// mastery (red → amber → green, with a matching arc), size = card
// count, a dashed ring = not started, a pulsing dot = reviews due.
// Click a topic to start a quiz on it (flashcard-only topics open
// Review). The list view carries the same numbers without the map.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { List, Orbit, Play, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeMastery, deckCards, isQuizCard, MASTERED_THRESHOLD, useLearningStore } from '@/stores/useLearningStore';
import type { CardReview, Deck, Mastery, Topic } from '@/types/learning';
import type { DeckTarget, TrainingLinkMode } from './deep-link';
import { launchTraining, type TrainingLauncher } from './practice/launch';
import { MASTERY_GRADIENT, masteryColor, toPercent } from './practice/mastery';

interface SkillTreeProps {
  /** Opens a mode on a deck/topic (from TrainingGroundsApp); the start event is used without it. */
  onStart?: TrainingLauncher;
}

type View = 'map' | 'list';

interface TopicStats {
  topic: Topic;
  cards: number;
  quizCards: number;
  due: number;
  mastery: Mastery;
}

interface TopicNode extends TopicStats {
  x: number;
  y: number;
  r: number;
  labelX: number;
  labelY: number;
  anchor: 'start' | 'middle' | 'end';
}

interface DeckMap {
  deck: Deck;
  mastery: Mastery;
  quizCards: number;
  due: number;
  nodes: TopicNode[];
  width: number;
  height: number;
  rings: { rx: number; ry: number }[];
  showLabels: boolean;
  stars: { x: number; y: number; r: number; o: number }[];
}

const HUB_R = 30;
/** Up to this many topics sit on one labelled orbit; more use two rings (labels on hover). */
const SINGLE_RING_MAX = 12;
const LABEL_MAX = 14;
const SPACE = '#0b1020';
const DUE_COLOR = '#22d3ee';

function countDue(cards: Topic['cards'], reviews: Readonly<Record<string, CardReview>>, now: number): number {
  let n = 0;
  for (const card of cards) {
    const review = reviews[card.id];
    if (review && review.dueAt <= now) n += 1;
  }
  return n;
}

function truncate(name: string): string {
  return name.length > LABEL_MAX ? `${name.slice(0, LABEL_MAX - 1)}…` : name;
}

/** Deterministic starfield (no Math.random in render). */
function starfield(seed: number, width: number, height: number): DeckMap['stars'] {
  const stars: DeckMap['stars'] = [];
  let s = seed % 2147483647 || 1;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < 46; i++) {
    stars.push({ x: next() * width, y: next() * height, r: 0.4 + next() * 0.9, o: 0.15 + next() * 0.35 });
  }
  return stars;
}

function hashString(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

/** Place a deck's topics on one or two elliptical orbits around the hub. */
function layoutDeck(deck: Deck, topics: TopicStats[], maxCards: number): Omit<DeckMap, 'mastery' | 'quizCards' | 'due'> {
  const n = topics.length;
  const twoRings = n > SINGLE_RING_MAX;
  const width = twoRings ? 600 : 560;
  const height = twoRings ? 380 : 300;
  const cx = width / 2;
  const cy = height / 2;
  const rings = twoRings
    ? [
        { rx: 140, ry: 82 },
        { rx: 250, ry: 150 },
      ]
    : [{ rx: 160, ry: 96 }]; // leaves room for a 14-character label beside the side nodes
  const innerCount = twoRings ? Math.ceil(n * 0.38) : n;

  const nodes = topics.map((stats, i): TopicNode => {
    const ring = twoRings && i >= innerCount ? 1 : 0;
    const slot = ring === 0 ? i : i - innerCount;
    const count = ring === 0 ? innerCount : n - innerCount;
    // Two topics sit left/right (the map is wide); otherwise start at the top.
    const start = n === 2 ? Math.PI : -Math.PI / 2;
    const angle = start + (slot / Math.max(1, count)) * Math.PI * 2 + (ring === 1 ? Math.PI / count : 0);
    const { rx, ry } = rings[ring];
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    const scale = Math.sqrt(stats.cards / Math.max(1, maxCards));
    const r = stats.cards === 0 ? 7 : twoRings ? 7 + 9 * scale : 9 + 12 * scale;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let anchor: TopicNode['anchor'] = 'middle';
    let labelX = x;
    let labelY = sin > 0 ? y + r + 15 : y - r - 9;
    if (cos > 0.35) {
      anchor = 'start';
      labelX = x + r + 8;
      labelY = y + 3.5;
    } else if (cos < -0.35) {
      anchor = 'end';
      labelX = x - r - 8;
      labelY = y + 3.5;
    }
    return { ...stats, x, y, r, labelX, labelY, anchor };
  });

  return {
    deck,
    nodes,
    width,
    height,
    rings,
    showLabels: !twoRings,
    stars: starfield(hashString(deck.id), width, height),
  };
}

// ─── Map pieces ───

interface ActiveNode {
  deckId: string;
  topicId: string | null;
}

function activateOnKey(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

function describeAction(stats: { cards: number; quizCards: number }, scope: 'topic' | 'deck' = 'topic'): string {
  if (stats.cards === 0) return 'No cards yet';
  if (stats.quizCards === 0) return 'Flashcards only: click to review';
  return scope === 'deck' ? 'Click to quiz the whole deck' : 'Click to start a quiz';
}

interface DeckConstellationProps {
  map: DeckMap;
  active: ActiveNode | null;
  setActive: (node: ActiveNode | null) => void;
  onOpen: (deckId: string, topic: TopicStats | null) => void;
}

function DeckConstellation({ map, active, setActive, onOpen }: DeckConstellationProps) {
  const reduceMotion = useReducedMotion();
  // Unique per instance: two open Training Grounds windows must not share gradient ids.
  const glowId = `hub-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { deck, width, height, nodes } = map;
  const cx = width / 2;
  const cy = height / 2;
  const hubArc = 2 * Math.PI * (HUB_R + 6);
  const hubStats = { cards: map.mastery.total, quizCards: map.quizCards };
  const hubActive = active?.deckId === deck.id && active.topicId === null;
  const activeNode = active?.deckId === deck.id && active.topicId ? nodes.find((n) => n.topic.id === active.topicId) : undefined;

  // Tooltip anchor, in % of the map box: below upper-half nodes, above lower-half ones.
  const tip = activeNode ?? (hubActive ? { x: cx, y: cy, r: HUB_R } : null);
  const tipBelow = tip ? tip.y < height / 2 + 1 : true;
  const tipX = tip ? (tip.x / width) * 100 : 0;
  const tipShift = tipX < 22 ? '-12%' : tipX > 78 ? '-88%' : '-50%';

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="group" aria-label={`${deck.name} topics`}>
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor={deck.color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={deck.color} stopOpacity={0} />
          </radialGradient>
        </defs>

        {map.stars.map((star, i) => (
          <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="#fff" opacity={star.o} />
        ))}
        {map.rings.map((ring, i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={ring.rx} ry={ring.ry} fill="none" stroke="rgba(255,255,255,0.07)" />
        ))}

        {/* Links */}
        {nodes.map((node, i) => (
          <motion.line
            key={node.topic.id}
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke={masteryColor(node.mastery.value, node.mastery.seen > 0 ? 0.45 : 0.18)}
            strokeWidth={activeNode?.topic.id === node.topic.id ? 2 : 1.2}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.05 * i }}
          />
        ))}

        {/* Hub */}
        <circle cx={cx} cy={cy} r={HUB_R + 26} fill={`url(#${glowId})`} />
        <g
          role="button"
          tabIndex={0}
          aria-label={`${deck.name}: ${toPercent(map.mastery.value)}% mastery. ${describeAction(hubStats, 'deck')}`}
          className="cursor-pointer outline-none"
          onClick={() => onOpen(deck.id, null)}
          onKeyDown={(e) => activateOnKey(e, () => onOpen(deck.id, null))}
          onMouseEnter={() => setActive({ deckId: deck.id, topicId: null })}
          onMouseLeave={() => setActive(null)}
          onFocus={() => setActive({ deckId: deck.id, topicId: null })}
          onBlur={() => setActive(null)}
        >
          <circle cx={cx} cy={cy} r={HUB_R} fill={SPACE} stroke={deck.color} strokeWidth={hubActive ? 2.5 : 1.5} />
          <circle cx={cx} cy={cy} r={HUB_R + 6} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} />
          <circle
            cx={cx}
            cy={cy}
            r={HUB_R + 6}
            fill="none"
            stroke={masteryColor(map.mastery.value)}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.001, map.mastery.value) * hubArc} ${hubArc}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={24}>
            {deck.icon}
          </text>
        </g>

        {/* Topics */}
        {nodes.map((node, i) => {
          const value = node.mastery.value;
          const color = masteryColor(value);
          const untouched = node.mastery.seen === 0;
          const isActive = activeNode?.topic.id === node.topic.id;
          const arc = 2 * Math.PI * (node.r + 4);
          const select = () => setActive({ deckId: deck.id, topicId: node.topic.id });
          return (
            <g key={node.topic.id} transform={`translate(${node.x} ${node.y})`}>
              <motion.g
                role="button"
                tabIndex={0}
                aria-label={`${node.topic.name}: ${toPercent(value)}% mastery, ${node.cards} cards, ${node.due} due. ${describeAction(node)}`}
                className={cn('outline-none', node.cards > 0 ? 'cursor-pointer' : 'cursor-default')}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20, delay: 0.1 + 0.04 * i }}
                onClick={() => onOpen(deck.id, node)}
                onKeyDown={(e) => activateOnKey(e, () => onOpen(deck.id, node))}
                onMouseEnter={select}
                onMouseLeave={() => setActive(null)}
                onFocus={select}
                onBlur={() => setActive(null)}
              >
                <motion.g
                  initial={false}
                  animate={{ scale: isActive ? 1.15 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                >
                  {/* Hit area larger than the mark */}
                  <circle r={Math.max(node.r + 9, 16)} fill="transparent" />
                  <circle r={node.r} fill={SPACE} />
                  <circle
                    r={node.r}
                    fill={masteryColor(value, untouched ? 0.06 : 0.22)}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray={untouched ? '3 3' : undefined}
                  />
                  <circle r={node.r + 4} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.5} />
                  {value > 0 && (
                    <circle
                      r={node.r + 4}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeDasharray={`${value * arc} ${arc}`}
                      transform="rotate(-90)"
                    />
                  )}
                  {isActive && <circle r={node.r + 8} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1} />}
                  {node.r >= 12 && (
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="rgba(255,255,255,0.85)">
                      {node.cards}
                    </text>
                  )}
                </motion.g>
              </motion.g>
              {node.due > 0 && (
                <motion.circle
                  cx={node.r * 0.75}
                  cy={-node.r * 0.75}
                  r={3.5}
                  fill={DUE_COLOR}
                  stroke={SPACE}
                  strokeWidth={1.5}
                  animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  pointerEvents="none"
                />
              )}
              {map.showLabels && (
                <text
                  x={node.labelX - node.x}
                  y={node.labelY - node.y}
                  textAnchor={node.anchor}
                  fontSize={10.5}
                  fill={isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.62)'}
                  pointerEvents="none"
                >
                  {truncate(node.topic.name)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-52 rounded-lg border border-white/10 bg-slate-950/95 px-3 py-2 shadow-xl"
          style={{
            left: `${tipX}%`,
            top: tipBelow ? `${((tip.y + tip.r + 12) / height) * 100}%` : undefined,
            bottom: tipBelow ? undefined : `${((height - (tip.y - tip.r - 12)) / height) * 100}%`,
            transform: `translateX(${tipShift})`,
          }}
        >
          {activeNode ? (
            <>
              <p className="truncate text-[11px] text-white/55">{activeNode.topic.name}</p>
              <p className="text-sm font-semibold text-white">{toPercent(activeNode.mastery.value)}% mastery</p>
              <p className="mt-0.5 text-[11px] text-white/55">
                {activeNode.cards} cards · {activeNode.quizCards} quiz · {activeNode.mastery.mastered} mastered
                {activeNode.due > 0 ? ` · ${activeNode.due} due` : ''}
              </p>
              <p className="mt-1 text-[11px] text-cyan-300/80">{describeAction(activeNode)}</p>
            </>
          ) : (
            <>
              <p className="truncate text-[11px] text-white/55">{deck.name}</p>
              <p className="text-sm font-semibold text-white">{toPercent(map.mastery.value)}% mastery</p>
              <p className="mt-0.5 text-[11px] text-white/55">
                {map.mastery.total} cards · {map.mastery.mastered} mastered{map.due > 0 ? ` · ${map.due} due` : ''}
              </p>
              <p className="mt-1 text-[11px] text-cyan-300/80">{describeAction(hubStats, 'deck')}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Skill Tree ───

function SkillTreeInner({ onStart }: SkillTreeProps) {
  const decks = useLearningStore((s) => s.decks);
  const reviews = useLearningStore((s) => s.reviews);
  const [view, setView] = useState<View>('map');
  const [active, setActive] = useState<ActiveNode | null>(null);

  // `now` ticks once a minute (due dots), keeping render pure.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const maps = useMemo(() => {
    const stats = decks.map((deck) =>
      deck.topics.map(
        (topic): TopicStats => ({
          topic,
          cards: topic.cards.length,
          quizCards: topic.cards.filter(isQuizCard).length,
          due: countDue(topic.cards, reviews, now),
          mastery: computeMastery(topic.cards, reviews),
        })
      )
    );
    const maxCards = Math.max(1, ...stats.flat().map((s) => s.cards));
    return decks.map((deck, i): DeckMap => {
      const topics = stats[i];
      return {
        ...layoutDeck(deck, topics, maxCards),
        mastery: computeMastery(deckCards(deck), reviews),
        quizCards: topics.reduce((sum, t) => sum + t.quizCards, 0),
        due: topics.reduce((sum, t) => sum + t.due, 0),
      };
    });
  }, [decks, reviews, now]);

  const totals = useMemo(() => {
    const all = computeMastery(
      decks.flatMap((d) => deckCards(d)),
      reviews
    );
    const topics = maps.flatMap((m) => m.nodes).filter((n) => n.cards > 0);
    return {
      mastery: all,
      topics: topics.length,
      topicsMastered: topics.filter((n) => n.mastery.value >= MASTERED_THRESHOLD).length,
      due: maps.reduce((sum, m) => sum + m.due, 0),
    };
  }, [decks, reviews, maps]);

  const launch = useCallback(
    (mode: TrainingLinkMode, target: DeckTarget) => launchTraining(onStart, mode, target),
    [onStart]
  );

  const openNode = useCallback(
    (deckId: string, topic: TopicStats | null) => {
      const map = maps.find((m) => m.deck.id === deckId);
      if (!map) return;
      const cards = topic ? topic.cards : map.mastery.total;
      const quizCards = topic ? topic.quizCards : map.quizCards;
      if (cards === 0) return;
      launch(quizCards > 0 ? 'quiz' : 'flashcards', { deckId, topicId: topic ? topic.topic.id : null });
    },
    [maps, launch]
  );

  const tiles = [
    { label: 'Overall mastery', value: `${toPercent(totals.mastery.value)}%` },
    { label: 'Topics mastered', value: `${totals.topicsMastered} / ${totals.topics}` },
    { label: 'Cards mastered', value: `${totals.mastery.mastered} / ${totals.mastery.total}` },
    { label: 'Due now', value: String(totals.due) },
  ];

  return (
    <div className="@container space-y-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Orbit className="h-5 w-5 text-cyan-300" />
            Skill Tree
          </h3>
          <p className="mt-1 text-xs text-white/50">
            Your decks as constellations. Click a topic to start a quiz on it; quizzes, reviews and flashcards light it
            up.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/10 text-xs" role="group" aria-label="View">
          {(
            [
              { id: 'map', label: 'Map', Icon: Orbit },
              { id: 'list', label: 'List', Icon: List },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-pressed={view === id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                view === id ? 'bg-cyan-500/25 text-cyan-100' : 'text-white/50 hover:bg-white/10'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xl font-semibold text-white">{tile.value}</p>
            <p className="text-[11px] text-white/45">{tile.label}</p>
          </div>
        ))}
      </div>

      {maps.length === 0 && (
        <p className="mt-12 text-center text-sm text-white/40">No decks yet. Create one to grow your skill tree.</p>
      )}

      {maps.length > 0 && view === 'map' && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/55">
            <span className="flex items-center gap-2">
              Mastery
              <span className="text-white/35">0%</span>
              <span className="h-1.5 w-24 rounded-full" style={{ background: MASTERY_GRADIENT }} />
              <span className="text-white/35">100%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="22" height="12" aria-hidden="true">
                <circle cx="4" cy="6" r="3" fill="none" stroke="rgba(255,255,255,0.5)" />
                <circle cx="15" cy="6" r="5.5" fill="none" stroke="rgba(255,255,255,0.5)" />
              </svg>
              Size = cards
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden="true">
                <circle cx="6" cy="6" r="5" fill="none" stroke="rgba(255,255,255,0.5)" strokeDasharray="2 2" />
              </svg>
              Not started
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DUE_COLOR }} />
              Reviews due
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-2">
            {maps.map((map, i) => (
              <motion.section
                key={map.deck.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">
                      <span className="mr-1.5">{map.deck.icon}</span>
                      {map.deck.name}
                    </h4>
                    <p className="text-[11px] text-white/45">
                      {toPercent(map.mastery.value)}% mastery · {map.nodes.length} topic
                      {map.nodes.length === 1 ? '' : 's'} · {map.mastery.total} cards
                      {map.due > 0 ? ` · ${map.due} due` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {map.quizCards > 0 && (
                      <button
                        type="button"
                        onClick={() => launch('quiz', { deckId: map.deck.id, topicId: null })}
                        className="flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200 hover:bg-cyan-500/20"
                      >
                        <Play className="h-3 w-3" />
                        Quiz deck
                      </button>
                    )}
                    {map.due > 0 && (
                      <button
                        type="button"
                        onClick={() => launch('flashcards', { deckId: map.deck.id, topicId: null })}
                        className="flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20"
                      >
                        <Repeat className="h-3 w-3" />
                        Review {map.due}
                      </button>
                    )}
                  </div>
                </div>
                {map.nodes.length === 0 ? (
                  <p className="px-4 py-10 text-center text-xs text-white/40">No topics yet.</p>
                ) : (
                  <DeckConstellation map={map} active={active} setActive={setActive} onOpen={openNode} />
                )}
              </motion.section>
            ))}
          </div>
        </>
      )}

      {maps.length > 0 && view === 'list' && (
        <div className="space-y-4">
          {maps.map((map) => (
            <section key={map.deck.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2">
                <h4 className="truncate text-sm font-semibold text-white">
                  <span className="mr-1.5">{map.deck.icon}</span>
                  {map.deck.name}
                </h4>
                <span className="text-xs text-white/50 tabular-nums">{toPercent(map.mastery.value)}%</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-white/35">
                    <th className="px-4 py-1.5 font-medium">Topic</th>
                    <th className="px-2 py-1.5 font-medium">Mastery</th>
                    <th className="px-2 py-1.5 text-right font-medium">Cards</th>
                    <th className="px-2 py-1.5 text-right font-medium">Mastered</th>
                    <th className="px-2 py-1.5 text-right font-medium">Due</th>
                    <th className="px-4 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {map.nodes.map((node) => (
                    <tr key={node.topic.id} className="border-t border-white/5 text-white/70">
                      <td className="max-w-[12rem] truncate px-4 py-2">{node.topic.name}</td>
                      <td className="px-2 py-2">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.max(2, toPercent(node.mastery.value))}%`,
                                backgroundColor: masteryColor(node.mastery.value),
                              }}
                            />
                          </span>
                          <span className="w-9 text-right tabular-nums">{toPercent(node.mastery.value)}%</span>
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{node.cards}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{node.mastery.mastered}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{node.due}</td>
                      <td className="px-4 py-2 text-right">
                        {node.cards > 0 && (
                          <button
                            type="button"
                            onClick={() => openNode(map.deck.id, node)}
                            className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/10"
                          >
                            {node.quizCards > 0 ? 'Quiz' : 'Review'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export const SkillTree = memo(SkillTreeInner);
