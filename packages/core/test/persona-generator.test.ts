import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PersonaGenerator } from '../src/persona/persona-generator.js';
import { LLMRunner } from '../src/llm.js';
import { buildPersonaSystemPrompt } from '../src/prompts/persona-generation.js';

describe('PersonaGenerator', () => {
  it('first mode: LLM returns persona content, written + read back', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'persona-'));
    const content = '# User Narrative Profile\n> **Archetype**: 务实理想主义者\n\n## Chapter 1: Context';
    const llm = { run: async () => content } as unknown as LLMRunner;
    const gen = new PersonaGenerator({ llm, personaPath: join(dir, 'persona.md'), dataDir: dir });
    const result = await gen.generatePersona({ mode: 'first', changedScenes: [] });
    expect(result.success).toBe(true);
    expect(readFileSync(result.personaPath, 'utf-8')).toContain('务实理想主义者');
    rmSync(dir, { recursive: true, force: true });
  });

  it('incremental mode passes existing persona as context', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'persona-'));
    let capturedPrompt = '';
    const llm = { run: async (p: any) => { capturedPrompt = p.prompt; return '# updated'; } } as unknown as LLMRunner;
    const gen = new PersonaGenerator({ llm, personaPath: join(dir, 'persona.md'), dataDir: dir });
    await gen.generatePersona({ mode: 'incremental', existingPersona: '# old persona', changedScenes: [{ content: 'scene content', updated: '2026-08-05' }] });
    expect(capturedPrompt).toContain('old persona');
    expect(capturedPrompt).toContain('scene content');
    rmSync(dir, { recursive: true, force: true });
  });

  it('empty LLM output → success:false (read-back validation)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'persona-empty-'));
    const llm = { run: async () => '   ' } as unknown as LLMRunner;
    const gen = new PersonaGenerator({ llm, personaPath: join(dir, 'persona.md'), dataDir: dir });
    const result = await gen.generatePersona({ mode: 'first', changedScenes: [] });
    expect(result.success).toBe(false);
    expect(result.personaPath).toBe(join(dir, 'persona.md'));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('buildPersonaSystemPrompt', () => {
  it('title + four-layer scan + output template + constraints', () => {
    const p = buildPersonaSystemPrompt();
    expect(p).toContain('Persona Architect - Incremental Evolution Protocol');
    expect(p).toContain('Layer 1');
    expect(p).toContain('Layer 2');
    expect(p).toContain('Layer 3');
    expect(p).toContain('Layer 4');
    expect(p).toContain('# User Narrative Profile');
    expect(p).toContain('Chapter 1');
    expect(p).toContain('Chapter 2');
    expect(p).toContain('Chapter 3');
    expect(p).toContain('Chapter 4');
    expect(p).toContain('2000 字符');
    expect(p).toContain('禁止过度推测');
  });
});
