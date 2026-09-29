// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Skill Tree (Constellation Map)
// Every deck is a hub and its topics orbit it as nodes: colour =
// mastery (ember → gold → mint, with a matching arc), size = card
// count, a dashed ring = not started, a pulsing accent dot = reviews
// due. Click a topic to start a quiz on it (flashcard-only topics
// open Review). The list view carries the same numbers as a table.
// ═══════════════════════════════════════════════════════════

'use client';

import { memo, useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Layers, List, Orbit, Play, Repeat, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, EmptyState, SegmentedControl, StatTile } from '@/components/ui';
import { EASE_OUT_QUINT, FG, INK, LINE, resolveAccent } from '@/styles/tokens';
import { computeMastery, deckCards, isQuizCard, MASTERED_THRESHOLD, useLearningStore } from '@/stores/useLearningStore';
import type { CardReview, Deck, Mastery, Topic } from '@/types/learning';
import type { DeckTarget, TrainingLinkMode } from './deep-link';
import { TabHeader } from './QuizControls';
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
/** Deep space behind the marks (SVG attributes need a literal colour). */
const SPACE = INK[900];
/** Due dots follow the live accent (a CSS property, so var() works). */
const DUE_STYLE = { fill: 'var(--accent)' } as const;

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
  const deckHue = resolveAccent(deck.color);
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
  const tipStats = activeNode
    ? {
        title: activeNode.topic.name,
        mastery: activeNode.mastery,
        meta: `${activeNode.cards} cards · ${activeNode.quizCards} quiz · ${activeNode.mastery.mastered} mastered`,
        due: activeNode.due,
        action: describeAction(activeNode),
      }
    : {
        title: deck.name,
        mastery: map.mastery,
        meta: `${map.mastery.total} cards · ${map.mastery.mastered} mastered`,
        due: map.due,
        action: describeAction(hubStats, 'deck'),
      };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="group" aria-label={`${deck.name} topics`}>
        <defs>
          <radialGradient id={glowId}>
            <stop offset="0%" stopColor={deckHue} stopOpacity={0.28} />
            <stop offset="100%" stopColor={deckHue} stopOpacity={0} />
          </radialGradient>
        </defs>

        {map.stars.map((star, i) => (
          <circle key={i} cx={star.x} cy={star.y} r={star.r} fill={FG.base} opacity={star.o * 0.8} />
        ))}
        {map.rings.map((ring, i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={ring.rx}
            ry={ring.ry}
            fill="none"
            stroke={LINE.strong}
            strokeDasharray="2 5"
          />
        ))}

        {/* Links */}
        {nodes.map((node, i) => (
          <motion.line
            key={node.topic.id}
            x1={cx}
            y1={cy}
            x2={node.x}
            y2={node.y}
            stroke={masteryColor(node.mastery.value, node.mastery.seen > 0 ? 0.4 : 0.14)}
            strokeWidth={activeNode?.topic.id === node.topic.id ? 2 : 1.2}
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.04 * i, ease: EASE_OUT_QUINT }}
          />
        ))}

        {/* Hub */}
        <circle cx={cx} cy={cy} r={HUB_R + 28} fill={`url(#${glowId})`} />
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
          <circle cx={cx} cy={cy} r={HUB_R} fill={SPACE} stroke={deckHue} strokeOpacity={hubActive ? 1 : 0.7} strokeWidth={hubActive ? 2 : 1.25} />
          <circle cx={cx} cy={cy} r={HUB_R + 6} fill="none" stroke={LINE.strong} strokeWidth={3} />
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
          {hubActive && (
            <circle cx={cx} cy={cy} r={HUB_R + 11} fill="none" strokeWidth={1.25} style={{ stroke: 'var(--accent)' }} />
          )}
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
                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.42, ease: EASE_OUT_QUINT, delay: reduceMotion ? 0 : 0.08 + 0.035 * i }}
                onClick={() => onOpen(deck.id, node)}
                onKeyDown={(e) => activateOnKey(e, () => onOpen(deck.id, node))}
                onMouseEnter={select}
                onMouseLeave={() => setActive(null)}
                onFocus={select}
                onBlur={() => setActive(null)}
              >
                <motion.g
                  initial={false}
                  animate={{ scale: isActive && !reduceMotion ? 1.12 : 1 }}
                  transition={{ duration: 0.18, ease: EASE_OUT_QUINT }}
                >
                  {/* Hit area larger than the mark */}
                  <circle r={Math.max(node.r + 9, 16)} fill="transparent" />
                  <circle r={node.r} fill={SPACE} />
                  <circle
                    r={node.r}
                    fill={masteryColor(value, untouched ? 0.05 : 0.2)}
                    stroke={color}
                    strokeOpacity={untouched ? 0.6 : 1}
                    strokeWidth={1.5}
                    strokeDasharray={untouched ? '3 3' : undefined}
                  />
                  <circle r={node.r + 4} fill="none" stroke={LINE.strong} strokeWidth={2.5} />
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
                  {isActive && <circle r={node.r + 8.5} fill="none" strokeWidth={1.25} style={{ stroke: 'var(--accent)' }} />}
                  {node.r >= 12 && (
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={9.5}
                      fontWeight={600}
                      fill={FG.base}
                      className="font-mono"
                    >
                      {node.cards}
                    </text>
                  )}
                </motion.g>
              </motion.g>
              {node.due > 0 && (
                <circle
                  cx={node.r * 0.75}
                  cy={-node.r * 0.75}
                  r={3.5}
                  stroke={SPACE}
                  strokeWidth={1.5}
                  style={DUE_STYLE}
                  className="motion-safe:animate-pulse-soft"
                  pointerEvents="none"
                />
              )}
              {map.showLabels && (
                <text
                  x={node.labelX - node.x}
                  y={node.labelY - node.y}
                  textAnchor={node.anchor}
                  fontSize={11}
                  fontWeight={isActive ? 600 : 500}
                  fill={isActive ? FG.base : FG.muted}
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
          role="tooltip"
          className="glass-popover pointer-events-none absolute z-10 w-60 animate-scale-in rounded-control px-3 py-2.5 text-xs"
          style={{
            left: `${tipX}%`,
            top: tipBelow ? `${((tip.y + tip.r + 12) / height) * 100}%` : undefined,
            bottom: tipBelow ? undefined : `${((height - (tip.y - tip.r - 12)) / height) * 100}%`,
            transform: `translateX(${tipShift})`,
          }}
        >
          <p className="hud-label truncate">{tipStats.title}</p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-base font-semibold text-fg tabular">{toPercent(tipStats.mastery.value)}%</span>
            <span className="text-fg-muted">mastery</span>
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-600/70">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, toPercent(tipStats.mastery.value))}%`, background: masteryColor(tipStats.mastery.value) }}
            />
          </div>
          <p className="mt-2 text-fg-muted tabular">
            {tipStats.meta}
            {tipStats.due > 0 && <span className="whitespace-nowrap text-accent"> · {tipStats.due} due</span>}
          </p>
          <p className="mt-1.5 border-t border-line pt-1.5 text-accent">{tipStats.action}</p>
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
  const reduceMotion = useReducedMotion();

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

  const deckMeta = (map: DeckMap) =>
    `${toPercent(map.mastery.value)}% mastery · ${map.nodes.length} topic${map.nodes.length === 1 ? '' : 's'} · ${map.mastery.total} cards`;

  const deckActions = (map: DeckMap) => (
    <>
      {map.due > 0 && (
        <Button variant="ghost" size="sm" leadingIcon={Repeat} onClick={() => launch('flashcards', { deckId: map.deck.id, topicId: null })}>
          Review {map.due}
        </Button>
      )}
      {map.quizCards > 0 && (
        <Button variant="secondary" size="sm" leadingIcon={Play} onClick={() => launch('quiz', { deckId: map.deck.id, topicId: null })}>
          Quiz deck
        </Button>
      )}
    </>
  );

  return (
    <div className="@container space-y-6 p-5">
      <TabHeader
        icon={Orbit}
        title="Skill tree"
        description="Your decks as constellations. Click a topic to quiz it; quizzes, reviews and flashcards light it up."
        actions={
          <SegmentedControl
            size="sm"
            aria-label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'map', label: 'Map', icon: Orbit },
              { value: 'list', label: 'List', icon: List },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
        <StatTile size="sm" label="Mastery" icon={Target} value={toPercent(totals.mastery.value)} unit="%" />
        <StatTile size="sm" label="Topics" icon={Trophy} value={totals.topicsMastered} unit={`of ${totals.topics} mastered`} />
        <StatTile size="sm" label="Cards" icon={Layers} value={totals.mastery.mastered} unit={`of ${totals.mastery.total} mastered`} />
        <StatTile
          size="sm"
          label="Due now"
          icon={CalendarClock}
          value={<span className={totals.due > 0 ? 'text-accent' : undefined}>{totals.due}</span>}
        />
      </div>

      {maps.length === 0 && (
        <EmptyState icon={Orbit} title="No decks yet" description="Create a deck to grow your skill tree." />
      )}

      {maps.length > 0 && view === 'map' && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-muted">
            <span className="flex items-center gap-2">
              <span className="hud-label">Mastery</span>
              <span className="font-mono text-2xs text-fg-subtle">0%</span>
              <span aria-hidden className="h-1.5 w-24 rounded-full" style={{ background: MASTERY_GRADIENT }} />
              <span className="font-mono text-2xs text-fg-subtle">100%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="22" height="12" aria-hidden="true">
                <circle cx="4" cy="6" r="3" fill="none" stroke={FG.subtle} />
                <circle cx="15" cy="6" r="5.5" fill="none" stroke={FG.subtle} />
              </svg>
              Size = cards
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden="true">
                <circle cx="6" cy="6" r="5" fill="none" stroke={FG.subtle} strokeDasharray="2 2" />
              </svg>
              Not started
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-accent motion-safe:animate-pulse-soft" />
              Reviews due
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-2">
            {maps.map((map, i) => (
              <motion.div
                key={map.deck.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: i * 0.05, ease: EASE_OUT_QUINT }}
              >
                <Card
                  padding="none"
                  eyebrow={map.due > 0 ? `${map.due} due` : 'Constellation'}
                  title={
                    <>
                      <span aria-hidden className="mr-1.5">
                        {map.deck.icon}
                      </span>
                      {map.deck.name}
                    </>
                  }
                  description={deckMeta(map)}
                  actions={deckActions(map)}
                  bodyClassName="overflow-hidden rounded-b-card border-t border-line bg-ink-950/40"
                >
                  {map.nodes.length === 0 ? (
                    <EmptyState size="sm" icon={Orbit} title="No topics yet" description="Add a topic to this deck to chart it." />
                  ) : (
                    <DeckConstellation map={map} active={active} setActive={setActive} onOpen={openNode} />
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {maps.length > 0 && view === 'list' && (
        <div className="space-y-4">
          {maps.map((map) => (
            <Card
              key={map.deck.id}
              padding="none"
              title={
                <>
                  <span aria-hidden className="mr-1.5">
                    {map.deck.icon}
                  </span>
                  {map.deck.name}
                </>
              }
              description={deckMeta(map)}
              actions={deckActions(map)}
              bodyClassName="border-t border-line"
            >
              {map.nodes.length === 0 ? (
                <EmptyState size="sm" icon={Orbit} title="No topics yet" description="Add a topic to this deck to chart it." />
              ) : (
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-ui">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="hud-label px-4 py-2 font-medium">Topic</th>
                        <th className="hud-label px-2 py-2 font-medium">Mastery</th>
                        <th className="hud-label px-2 py-2 text-right font-medium">Cards</th>
                        <th className="hud-label px-2 py-2 text-right font-medium">Mastered</th>
                        <th className="hud-label px-2 py-2 text-right font-medium">Due</th>
                        <th className="px-4 py-2">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {map.nodes.map((node) => (
                        <tr key={node.topic.id} className="h-11 text-fg-muted transition-colors duration-120 hover:bg-surface-hover">
                          <td className="max-w-[14rem] truncate px-4 text-fg" title={node.topic.name}>
                            {node.topic.name}
                          </td>
                          <td className="px-2">
                            <span className="flex items-center gap-2.5">
                              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-600/70">
                                <span
                                  className="block h-full rounded-full"
                                  style={{
                                    width: `${Math.max(2, toPercent(node.mastery.value))}%`,
                                    backgroundColor: masteryColor(node.mastery.value),
                                  }}
                                />
                              </span>
                              <span className="w-9 text-right font-mono text-xs text-fg tabular">
                                {toPercent(node.mastery.value)}%
                              </span>
                            </span>
                          </td>
                          <td className="px-2 text-right font-mono text-xs tabular">{node.cards}</td>
                          <td className="px-2 text-right font-mono text-xs tabular">{node.mastery.mastered}</td>
                          <td className={cn('px-2 text-right font-mono text-xs tabular', node.due > 0 && 'text-accent')}>
                            {node.due}
                          </td>
                          <td className="px-4 text-right">
                            {node.cards > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leadingIcon={node.quizCards > 0 ? Play : Repeat}
                                onClick={() => openNode(map.deck.id, node)}
                              >
                                {node.quizCards > 0 ? 'Quiz' : 'Review'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export const SkillTree = memo(SkillTreeInner);
