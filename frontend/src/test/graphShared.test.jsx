import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => {
  const Position = {
    Top: 'top',
    Right: 'right',
    Bottom: 'bottom',
    Left: 'left',
  };

  const Handle = ({ type, position, style, ...props }) =>
    React.createElement('div', {
      ...props,
      'data-testid': `handle-${type}-${position}`,
      style,
    });

  return { Handle, Position };
});

// ---------------------------------------------------------------------------
// Imports (must be after mocks)
// ---------------------------------------------------------------------------

import {
  MAX_LABEL_LENGTH,
  getNodeWeight,
  hexToRgba,
  blendColors,
  truncateLabel,
  buildGraphData,
  ConceptNode,
  SourceNode,
} from '../pages/KnowledgeGraph/graphShared';

// ---------------------------------------------------------------------------
// Test data for buildGraphData
// ---------------------------------------------------------------------------

const conceptNodes = [
  { id: 'concept-1', label: 'React', color: '#61DAFB' },
  { id: 'concept-2', label: 'AI', color: '#FF6B6B' },
];

const sourceConceptMap = {
  1: ['concept-1'],
  2: ['concept-1', 'concept-2'],
};

const premiumItems = [
  { id: 1, title: 'Item 1', hasNote: true, platform: 'BILIBILI' },
  { id: 2, title: 'Item 2', hasNote: true, platform: 'ZHIHU' },
];

// ===========================================================================
//  Constants
// ===========================================================================

describe('MAX_LABEL_LENGTH', () => {
  it('equals 5', () => {
    expect(MAX_LABEL_LENGTH).toBe(5);
  });
});

// ===========================================================================
//  getNodeWeight
// ===========================================================================

describe('getNodeWeight', () => {
  it('returns 3 when item.hasNote is true', () => {
    expect(getNodeWeight({ hasNote: true })).toBe(3);
  });

  it('returns 0 when item.hasNote is false', () => {
    expect(getNodeWeight({ hasNote: false })).toBe(0);
  });

  it('returns 0 when item.hasNote is undefined / falsy', () => {
    expect(getNodeWeight({})).toBe(0);
    expect(getNodeWeight({ hasNote: null })).toBe(0);
    expect(getNodeWeight({ hasNote: 0 })).toBe(0);
  });
});

// ===========================================================================
//  hexToRgba
// ===========================================================================

describe('hexToRgba', () => {
  it('converts "#FF0000" with alpha 0.5 → "rgba(255, 0, 0, 0.5)"', () => {
    expect(hexToRgba('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('converts "#00FF00" with alpha 1 → "rgba(0, 255, 0, 1)"', () => {
    expect(hexToRgba('#00FF00', 1)).toBe('rgba(0, 255, 0, 1)');
  });

  it('converts "#0000FF" with alpha 0 → "rgba(0, 0, 255, 0)"', () => {
    expect(hexToRgba('#0000FF', 0)).toBe('rgba(0, 0, 255, 0)');
  });

  it('handles an arbitrary hex color', () => {
    expect(hexToRgba('#A1B2C3', 0.75)).toBe('rgba(161, 178, 195, 0.75)');
  });
});

// ===========================================================================
//  blendColors
// ===========================================================================

describe('blendColors', () => {
  it('returns the same color for a single-element array', () => {
    expect(blendColors(['#FF0000']).toUpperCase()).toBe('#FF0000');
  });

  it('averages two colors (red + blue = purple)', () => {
    const result = blendColors(['#FF0000', '#0000FF']);
    expect(result).toBe('#800080');
  });

  it('returns "#ffffff" for empty array', () => {
    expect(blendColors([])).toBe('#ffffff');
  });

  it('returns "#ffffff" for null / undefined', () => {
    expect(blendColors(null)).toBe('#ffffff');
    expect(blendColors(undefined)).toBe('#ffffff');
  });

  it('averages three colors correctly', () => {
    const result = blendColors(['#000000', '#808080', '#FFFFFF']);
    expect(result).toBe('#808080');
  });

  it('normalizes mixed-case hex', () => {
    const result = blendColors(['#ff0000', '#00Ff00']);
    expect(result).toBe('#808000');
  });
});

// ===========================================================================
//  truncateLabel
// ===========================================================================

describe('truncateLabel', () => {
  it('returns short text unchanged', () => {
    expect(truncateLabel('abc', 5)).toBe('abc');
  });

  it('returns exact-length text unchanged', () => {
    expect(truncateLabel('abcde', 5)).toBe('abcde');
  });

  it('truncates long text with ellipsis (\u2026)', () => {
    const result = truncateLabel('abcdefgh', 5);
    expect(result).toBe('abcde\u2026');
    expect(result.length).toBe(6);
  });

  it('returns "" for null', () => {
    expect(truncateLabel(null, 5)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(truncateLabel(undefined, 5)).toBe('');
  });

  it('returns "" for empty string', () => {
    expect(truncateLabel('', 5)).toBe('');
  });

  it('handles len=0 (everything longer than 0 is truncated)', () => {
    expect(truncateLabel('a', 0)).toBe('\u2026');
    expect(truncateLabel('', 0)).toBe('');
  });
});

// ===========================================================================
//  buildGraphData
// ===========================================================================

describe('buildGraphData', () => {
  it('returns { nodes: [], edges: [] } when premiumItems is empty', () => {
    const result = buildGraphData([], undefined, {}, conceptNodes, sourceConceptMap);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('creates source node + concept node + edge for single item', () => {
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1'] };
    const result = buildGraphData(items, undefined, {}, conceptNodes, scMap);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);

    const sourceNode = result.nodes.find(n => n.id === 'source-1');
    const conceptNode = result.nodes.find(n => n.id === 'concept-1');
    expect(sourceNode).toBeDefined();
    expect(sourceNode.type).toBe('source');
    expect(conceptNode).toBeDefined();
    expect(conceptNode.type).toBe('concept');

    expect(result.edges[0].source).toBe('source-1');
    expect(result.edges[0].target).toBe('concept-1');
  });

  it('creates correct number of nodes and edges for multiple items', () => {
    const result = buildGraphData(premiumItems, undefined, {}, conceptNodes, sourceConceptMap);

    expect(result.nodes).toHaveLength(4);
    expect(result.edges).toHaveLength(3);

    const sourceIds = result.nodes.filter(n => n.type === 'source').map(n => n.id);
    const conceptIds = result.nodes.filter(n => n.type === 'concept').map(n => n.id);
    expect(sourceIds.sort()).toEqual(['source-1', 'source-2']);
    expect(conceptIds.sort()).toEqual(['concept-1', 'concept-2']);
  });

  it('does not create item that has no concept mapping', () => {
    const items = [
      { id: 1, title: 'Item 1', hasNote: true },
      { id: 99, title: 'Orphan', hasNote: false },
    ];
    const scMap = { 1: ['concept-1'] };
    const result = buildGraphData(items, undefined, {}, conceptNodes, scMap);

    expect(result.nodes.find(n => n.id === 'source-99')).toBeUndefined();
    expect(result.nodes).toHaveLength(2);
  });

  it('filters out concepts that are not in conceptNodes', () => {
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1', 'concept-nonexistent'] };
    const result = buildGraphData(items, undefined, {}, conceptNodes, scMap);

    const conceptNode = result.nodes.find(n => n.id === 'concept-1');
    expect(conceptNode).toBeDefined();
    expect(result.nodes.find(n => n.id === 'concept-nonexistent')).toBeUndefined();
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].target).toBe('concept-1');
  });

  it('uses savedPositions when available', () => {
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1'] };
    const saved = {
      'source-1': { x: 100, y: 200 },
      'concept-1': { x: 300, y: 400 },
    };
    const result = buildGraphData(items, undefined, saved, conceptNodes, scMap);

    const sourceNode = result.nodes.find(n => n.id === 'source-1');
    const conceptNode = result.nodes.find(n => n.id === 'concept-1');

    expect(sourceNode.position.x).toBe(100);
    expect(sourceNode.position.y).toBe(200);
    expect(conceptNode.position.x).toBe(300);
    expect(conceptNode.position.y).toBe(400);
  });

  it('does NOT use savedPositions for other nodes (only matching ids)', () => {
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1'] };
    const saved = { 'source-999': { x: 100, y: 200 } };
    const result = buildGraphData(items, undefined, saved, conceptNodes, scMap);

    const sourceNode = result.nodes.find(n => n.id === 'source-1');
    expect(sourceNode.position.x).not.toBe(100);
  });

  it('filters out duplicate concept labels, keeping only the first', () => {
    const dupConceptNodes = [
      { id: 'concept-1', label: 'React', color: '#61DAFB' },
      { id: 'concept-2', label: 'AI', color: '#FF6B6B' },
      { id: 'concept-3', label: 'React', color: '#999999' },
    ];
    const items = premiumItems;
    const scMap = {
      1: ['concept-1', 'concept-3'],
      2: ['concept-1', 'concept-2'],
    };
    const result = buildGraphData(items, undefined, {}, dupConceptNodes, scMap);

    const conceptIds = result.nodes.filter(n => n.type === 'concept').map(n => n.id);
    expect(conceptIds).toContain('concept-1');
    expect(conceptIds).toContain('concept-2');
    expect(conceptIds).not.toContain('concept-3');
  });

  it('excludes concepts that have no associated premium items', () => {
    const extraConceptNodes = [
      { id: 'concept-1', label: 'React', color: '#61DAFB' },
      { id: 'concept-2', label: 'AI', color: '#FF6B6B' },
      { id: 'concept-orphan', label: 'Unused', color: '#CCCCCC' },
    ];
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1'] };
    const result = buildGraphData(items, undefined, {}, extraConceptNodes, scMap);

    expect(result.nodes.find(n => n.id === 'concept-orphan')).toBeUndefined();
    expect(result.nodes.find(n => n.id === 'concept-1')).toBeDefined();
  });

  it('only includes visible concepts when visibleConcepts is provided', () => {
    const visible = new Set(['concept-1']);
    const result = buildGraphData(premiumItems, visible, {}, conceptNodes, sourceConceptMap);

    const conceptIds = result.nodes.filter(n => n.type === 'concept').map(n => n.id);
    expect(conceptIds).toEqual(['concept-1']);

    expect(result.nodes.find(n => n.id === 'source-1')).toBeDefined();
    expect(result.nodes.find(n => n.id === 'source-2')).toBeDefined();

    const edgeTargets = result.edges.map(e => e.target);
    expect(edgeTargets).toEqual(['concept-1', 'concept-1']);
  });

  it('visibleConcepts=null means all active concepts are visible', () => {
    const result = buildGraphData(premiumItems, null, {}, conceptNodes, sourceConceptMap);
    const conceptIds = result.nodes.filter(n => n.type === 'concept').map(n => n.id);
    expect(conceptIds.sort()).toEqual(['concept-1', 'concept-2']);
  });

  it('assigns primaryColor and secondaryColor to source nodes', () => {
    const result = buildGraphData(premiumItems, undefined, {}, conceptNodes, sourceConceptMap);
    const source2 = result.nodes.find(n => n.id === 'source-2');
    expect(source2.data.primaryColor).toBeDefined();
    expect(source2.data.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(source2.data.secondaryColor).toBeDefined();
    expect(source2.data.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('source node with single concept has empty secondaryColor when only one concept', () => {
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1'] };
    const result = buildGraphData(items, undefined, {}, conceptNodes, scMap);
    const source1 = result.nodes.find(n => n.id === 'source-1');
    expect(source1.data.secondaryColor).toBeNull();
  });

  it('edge data includes type and color', () => {
    const items = [{ id: 1, title: 'Item 1', hasNote: true }];
    const scMap = { 1: ['concept-1'] };
    const result = buildGraphData(items, undefined, {}, conceptNodes, scMap);

    expect(result.edges[0].data.type).toBe('belongs');
    expect(result.edges[0].data.color).toBe('#61DAFB');
  });

  it('nodes have position properties', () => {
    const result = buildGraphData(premiumItems, undefined, {}, conceptNodes, sourceConceptMap);
    result.nodes.forEach(node => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    });
  });

  it('concept nodes have count in data', () => {
    const result = buildGraphData(premiumItems, undefined, {}, conceptNodes, sourceConceptMap);
    const concept1 = result.nodes.find(n => n.id === 'concept-1');
    expect(concept1.data.count).toBe(2);

    const concept2 = result.nodes.find(n => n.id === 'concept-2');
    expect(concept2.data.count).toBe(1);
  });
});

// ===========================================================================
//  ConceptNode Component
// ===========================================================================

describe('ConceptNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with default values', () => {
    const { container } = render(<ConceptNode data={{}} />);
    const root = container.firstChild;
    expect(root).toBeInTheDocument();
  });

  it('renders label text', () => {
    render(<ConceptNode data={{ label: 'React', size: 80, color: '#61DAFB' }} />);
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders empty string when no label', () => {
    render(<ConceptNode data={{ label: '', size: 80, color: '#61DAFB' }} />);
    // The label span should exist but be empty (no non-whitespace content)
    const labels = screen.getAllByText('');
    // There should be at least one span with empty text (the label span)
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows dimmed opacity 0.1 when dimmed=true', () => {
    const { container } = render(
      <ConceptNode data={{ dimmed: true, size: 80, color: '#61DAFB' }} />
    );
    const outerDiv = container.firstChild;
    expect(outerDiv.style.opacity).toBe('0.1');
  });

  it('default opacity is 1 when not dimmed', () => {
    const { container } = render(
      <ConceptNode data={{ size: 80, color: '#61DAFB' }} />
    );
    const outerDiv = container.firstChild;
    expect(outerDiv.style.opacity).toBe('1');
  });

  it('shows focused styles when isFocused=true', () => {
    const { container } = render(
      <ConceptNode data={{ isFocused: true, size: 80, color: '#61DAFB' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.border).toContain('4px');
    expect(circle.style.borderColor).toBe('rgb(255, 255, 255)');
  });

  it('shows highlighted styles when highlighted=true', () => {
    const { container } = render(
      <ConceptNode data={{ highlighted: true, size: 80, color: '#61DAFB' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.borderWidth).toBe('3.5px');
  });

  it('shows authorHighlight styles', () => {
    const { container } = render(
      <ConceptNode data={{ authorHighlight: true, size: 80, color: '#61DAFB' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.borderColor).toBe('rgb(251, 191, 36)');
    expect(circle.style.borderWidth).toBe('3px');
  });

  it('renders Handle components', () => {
    const { container } = render(<ConceptNode data={{ size: 80, color: '#61DAFB' }} />);
    const handles = container.querySelectorAll('[data-testid="handle-source-top"]');
    expect(handles.length).toBe(1);
    const targetHandles = container.querySelectorAll('[data-testid="handle-target-bottom"]');
    expect(targetHandles.length).toBe(1);
  });

  it('isFocused overrides authorHighlight border', () => {
    const { container } = render(
      <ConceptNode data={{ isFocused: true, authorHighlight: true, size: 80, color: '#61DAFB' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.borderColor).toBe('rgb(255, 255, 255)');
    expect(circle.style.borderWidth).toBe('4px');
  });
});

// ===========================================================================
//  SourceNode Component
// ===========================================================================

describe('SourceNode', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with default values', () => {
    const { container } = render(<SourceNode data={{}} />);
    const root = container.firstChild;
    expect(root).toBeInTheDocument();
  });

  it('renders truncated label', () => {
    render(<SourceNode data={{ sourceTitle: 'HelloWorld', size: 24, primaryColor: '#FF0000' }} />);
    expect(screen.getByText('Hello\u2026')).toBeInTheDocument();
  });

  it('renders short label without truncation', () => {
    render(<SourceNode data={{ sourceTitle: 'Hi', size: 24, primaryColor: '#FF0000' }} />);
    expect(screen.getByText('Hi')).toBeInTheDocument();
  });

  it('does not render label when no sourceTitle', () => {
    const { container } = render(<SourceNode data={{ size: 24, primaryColor: '#FF0000' }} />);
    // The label span is conditionally rendered (only when label truthy)
    // There should be no span child with text content
    const spans = container.querySelectorAll('span');
    // Only the Handle divs (no span), or Handle is div
    // Since no sourceTitle, truncateLabel returns '' which is falsy → no <span>
    expect(spans.length).toBe(0);
  });

  it('shows dimmed state', () => {
    const { container } = render(
      <SourceNode data={{ dimmed: true, size: 24, primaryColor: '#FF0000' }} />
    );
    const outerDiv = container.firstChild;
    expect(outerDiv.style.opacity).toBe('0.1');
  });

  it('shows focused state', () => {
    const { container } = render(
      <SourceNode data={{ isFocused: true, size: 24, primaryColor: '#FF0000' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.borderColor).toBe('rgb(255, 255, 255)');
    expect(circle.style.borderWidth).toBe('4px');
  });

  it('shows authorHighlight state', () => {
    const { container } = render(
      <SourceNode data={{ authorHighlight: true, size: 24, primaryColor: '#FF0000' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.borderColor).toBe('rgb(251, 191, 36)');
    expect(circle.style.borderWidth).toBe('3px');
    expect(circle.style.background).toBe('rgba(251, 191, 36, 0.4)');
  });

  it('shows highlighted state', () => {
    const { container } = render(
      <SourceNode data={{ highlighted: true, size: 24, primaryColor: '#FF0000' }} />
    );
    const circle = container.firstChild.firstChild;
    expect(circle.style.borderColor).toBe('rgb(255, 255, 255)');
    expect(circle.style.borderWidth).toBe('3.5px');
  });

  it('renders Handle component', () => {
    const { container } = render(<SourceNode data={{ size: 24, primaryColor: '#FF0000' }} />);
    const handles = container.querySelectorAll('[data-testid="handle-source-top"]');
    expect(handles.length).toBe(1);
  });
});
