// template-store.ts — user template CRUD with localStorage persistence

import { create } from 'zustand';
import type { WorldProject } from '@world-forge/schema';

export interface UserTemplate {
  id: string;
  name: string;
  description: string;
  genre: string;
  icon: string;
  createdAt: string;
  updatedAt: string;
  project: WorldProject;
}

const STORAGE_KEY = 'world-forge-templates';

function persist(templates: UserTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('Failed to save templates to localStorage:', e);
  }
}

function loadFromStorage(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserTemplate[];
  } catch {
    console.warn('Corrupted template data in localStorage — resetting');
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

interface TemplateState {
  templates: UserTemplate[];
  loadTemplates: () => void;
  saveTemplate: (template: Omit<UserTemplate, 'id' | 'createdAt' | 'updatedAt'>) => UserTemplate;
  updateTemplate: (id: string, updates: Partial<Pick<UserTemplate, 'name' | 'description' | 'genre' | 'icon'>>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => UserTemplate | undefined;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],

  loadTemplates: () => {
    set({ templates: loadFromStorage() });
  },

  saveTemplate: (input) => {
    const now = new Date().toISOString();
    const template: UserTemplate = {
      id: `template-${Date.now()}`,
      name: input.name,
      description: input.description,
      genre: input.genre,
      icon: input.icon,
      createdAt: now,
      updatedAt: now,
      project: JSON.parse(JSON.stringify(input.project)),
    };
    const templates = [...get().templates, template];
    persist(templates);
    set({ templates });
    return template;
  },

  updateTemplate: (id, updates) => {
    const templates = get().templates.map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
    );
    persist(templates);
    set({ templates });
  },

  deleteTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id);
    persist(templates);
    set({ templates });
  },

  duplicateTemplate: (id) => {
    const original = get().templates.find((t) => t.id === id);
    if (!original) return undefined;
    const now = new Date().toISOString();
    const copy: UserTemplate = {
      id: `template-${Date.now()}`,
      name: `${original.name} (copy)`,
      description: original.description,
      genre: original.genre,
      icon: original.icon,
      createdAt: now,
      updatedAt: now,
      project: JSON.parse(JSON.stringify(original.project)),
    };
    const templates = [...get().templates, copy];
    persist(templates);
    set({ templates });
    return copy;
  },
}));
